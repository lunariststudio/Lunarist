function config() {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  };
}

export default async function handler(req, res) {
  const { url, key } = config();
  if (!url || !key) return res.status(503).json({ error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.' });
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    if (req.method === 'GET') {
      const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
      if (!q.startsWith('resource=')) return res.status(400).json({ error: 'Use resource=profiles or resource=projects' });
      const params = new URLSearchParams(q);
      const resource = params.get('resource');
      if (!['profiles','projects'].includes(resource)) return res.status(400).json({ error: 'Unsupported resource' });
      params.delete('resource');
      const r = await fetch(`${url}/rest/v1/${resource}?${params.toString()}`, { headers });
      const text = await r.text();
      res.status(r.status).setHeader('Content-Type', 'application/json');
      return res.send(text);
    }
    if (req.method === 'POST') {
      const { event } = req.body || {};
      if (!event || typeof event !== 'object') return res.status(400).json({ error: 'Invalid event' });
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
