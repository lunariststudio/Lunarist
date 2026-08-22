import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Priority given to Service Role Key for administrative actions, fallback to Anon Key
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

export default async function handler(req, res) {
  const { method } = req;
  const { resource, session_id, limit } = req.query;

  // Set CORS and JSON Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- GET REQUESTS ---
  if (method === 'GET') {
    try {
      if (resource === 'profiles') {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, role, bio, avatar_url, skills, available, is_admin, account_type, tos, theme')
          .order('display_name');

        if (error) throw error;
        return res.status(200).json(data || []);
      }

      if (resource === 'projects') {
        const { data, error } = await supabase
          .from('projects')
          .select('id, owner_id, title, category, tags, views, likes, created_at, description, thumbnail_url, media_url, media_type, published, status, featured')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data || []);
      }

      if (resource === 'services') {
        const { data, error } = await supabase
          .from('services')
          .select('id, owner_id, artist_id, title, category, tags, price_from, delivery_time, thumbnail_url, views, created_at, description, add_ons, status, published, service_projects(project_id)')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data || []);
      }

      if (resource === 'recommendations') {
        const fetchLimit = parseInt(limit, 10) || 5;

        if (session_id) {
          const { data, error } = await supabase
            .from('discovery_events')
            .select('project_id, category, event_type')
            .eq('session_id', session_id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && data && data.length > 0) {
            const projectScores = {};
            data.forEach((evt) => {
              const pid = evt.project_id;
              if (!pid) return;
              const weight = evt.event_type === 'like' ? 4 : evt.event_type === 'save' ? 3 : 1;
              projectScores[pid] = (projectScores[pid] || 0) + weight;
            });

            const sortedProjectIds = Object.keys(projectScores).sort(
              (a, b) => projectScores[b] - projectScores[a]
            );

            const recommendedObjects = sortedProjectIds.slice(0, fetchLimit).map((pid) => ({
              project_id: pid,
              score: projectScores[pid],
            }));

            return res.status(200).json(recommendedObjects);
          }
        }

        // Fallback: Return top viewed published projects
        const { data: topProjects, error: topErr } = await supabase
          .from('projects')
          .select('id, views')
          .eq('published', true)
          .order('views', { ascending: false })
          .limit(fetchLimit);

        if (topErr) throw topErr;

        const fallbackRecs = (topProjects || []).map((p) => ({
          project_id: p.id,
          score: p.views || 0,
        }));

        return res.status(200).json(fallbackRecs);
      }

      return res.status(400).json({ error: 'Invalid resource specified' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Database query failed' });
    }
  }

  // --- POST REQUESTS ---
  if (method === 'POST') {
    try {
      const body = req.body || {};

      // Administrative Member Toggle Action
      if (body.action === 'toggle-member') {
        const { targetId, nextType } = body;

        if (!targetId || !nextType) {
          return res.status(400).json({ error: 'Missing targetId or nextType' });
        }

        const { data, error } = await supabase
          .from('profiles')
          .update({ account_type: nextType, updated_at: new Date().toISOString() })
          .eq('id', targetId)
          .select();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      // Event Tracking Action
      if (body.event) {
        const { session_id, project_id, event_type, category, metadata } = body.event;

        const { data, error } = await supabase.from('discovery_events').insert({
          session_id: session_id || 'guest',
          project_id: project_id || null,
          event_type: event_type || 'view',
          category: category || null,
          metadata: metadata || {},
          created_at: new Date().toISOString(),
        });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      return res.status(400).json({ error: 'Unrecognized action or event payload' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'POST execution failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}