import crypto from 'node:crypto';

const ORIGIN = 'https://lunaristudio.vercel.app';
const EUGENE_ORIGIN = 'https://eugene-card-1.vercel.app';
const SESSION_COOKIE = 'lunarist_oauth_session';
const SESSION_TTL_MS = 10 * 60 * 1000;

const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const random = () => crypto.randomBytes(32).toString('base64url');

function supabaseConfig() {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  };
}

function cors(res, origin) {
  if (origin === EUGENE_ORIGIN || origin === ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

async function supabaseUser(url, key, accessToken) {
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ? user : null;
}

async function insertSession(url, key, session, userId, expiresAt) {
  const response = await fetch(`${url}/rest/v1/oauth_authorization_sessions`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      session_hash: hash(session),
      lunarist_user_id: userId,
      expires_at: expiresAt
    }),
    cache: 'no-store'
  });
  return response.ok;
}

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const origin = req.headers.origin;
  if (origin && origin !== EUGENE_ORIGIN && origin !== ORIGIN) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { url, key } = supabaseConfig();
  if (!url || !key) return res.status(500).json({ error: 'server_configuration_error' });

  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', error_description: 'Sign in to Lunarist is required.' });
  }

  const accessToken = authorization.slice(7).trim();
  const user = await supabaseUser(url, key, accessToken);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized', error_description: 'The Lunarist session is invalid or expired.' });
  }

  const session = random();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const saved = await insertSession(url, key, session, user.id, expiresAt);
  if (!saved) return res.status(500).json({ error: 'server_error', error_description: 'Unable to start the OAuth session.' });

  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(session)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return res.status(200).json({ ok: true, expires_at: expiresAt });
}
