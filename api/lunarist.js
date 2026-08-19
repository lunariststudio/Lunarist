function config() {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  };
}

// Only the exact resources/columns the frontend actually needs are exposed.
// The service-role key bypasses RLS, so every filter here is fixed server-side —
// client query params are never forwarded to PostgREST directly.
const RESOURCES = {
  profiles: {
    select: 'id,username,display_name,role,bio,avatar_url,skills,available',
    order: 'created_at',
    // profiles are public per RLS ("profiles are public"), no extra filter needed
    extraParams: {}
  },
  projects: {
    select: 'id,owner_id,title,description,category,tags,thumbnail_url,media_url,media_type,published,views,likes,created_at',
    order: 'created_at.desc',
    // mirrors the RLS policy: only published projects are visible through this public endpoint
    extraParams: { published: 'eq.true' }
  }
};

const EVENT_TYPES = ['view', 'like', 'save', 'share', 'open_artist', 'search'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeEvent(event) {
  if (!event || typeof event !== 'object') return null;

  const session_id = typeof event.session_id === 'string' ? event.session_id.slice(0, 128) : null;
  if (!session_id) return null;

  const event_type = typeof event.event_type === 'string' ? event.event_type : null;
  if (!EVENT_TYPES.includes(event_type)) return null;

  let project_id = null;
  if (event.project_id !== undefined && event.project_id !== null) {
    if (typeof event.project_id !== 'string' || !UUID_RE.test(event.project_id)) return null;
    project_id = event.project_id;
  }

  const category = typeof event.category === 'string' ? event.category.slice(0, 64) : null;

  let tags = [];
  if (event.metadata && typeof event.metadata === 'object' && Array.isArray(event.metadata.tags)) {
    tags = event.metadata.tags.filter(t => typeof t === 'string').slice(0, 20).map(t => t.slice(0, 64));
  }

  // user_id is intentionally never accepted from the client: this endpoint runs with the
  // service-role key (no auth context), so there is no way to verify a claimed user_id.
  // Accepting it would let any caller spoof analytics as another user.
  return {
    session_id,
    project_id,
    event_type,
    category,
    metadata: { tags }
  };
}

export default async function handler(req, res) {
  const { url, key } = config();
  if (!url || !key) return res.status(503).json({ error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' });
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    if (req.method === 'GET') {
      const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
      const params = new URLSearchParams(q);
      const resource = params.get('resource');
      const def = RESOURCES[resource];
      if (!def) return res.status(400).json({ error: 'Use resource=profiles or resource=projects' });

      // Build the outgoing query from the fixed definition only — client-supplied
      // select/order/filter params are ignored so RLS-equivalent restrictions
      // (e.g. published=eq.true) can't be overridden or widened.
      const outParams = new URLSearchParams();
      outParams.set('select', def.select);
      outParams.set('order', def.order);
      for (const [k, v] of Object.entries(def.extraParams)) outParams.set(k, v);

      const r = await fetch(`${url}/rest/v1/${resource}?${outParams.toString()}`, { headers });
      const text = await r.text();
      res.status(r.status).setHeader('Content-Type', 'application/json');
      return res.send(text);
    }
    if (req.method === 'POST') {
      const event = sanitizeEvent((req.body || {}).event);
      if (!event) return res.status(400).json({ error: 'Invalid event' });
      const r = await fetch(`${url}/rest/v1/discovery_events`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(event)
      });
      const text = await r.text();
      res.status(r.status);
      return text ? res.send(text) : res.end();
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Supabase request failed' });
  }
}
