import crypto from 'node:crypto';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const FIREBASE_API_KEY = 'AIzaSyCm13Nh6k6W9wsL0_OPpjKZNrbSg-pFsuA';
const CODE_TTL_MS = 10 * 60 * 1000;

async function lunaristUser(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return await r.json();
}

function tokenFrom(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

async function supabase(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
}

async function createCode(userId) {
  await supabase(`eugene_link_codes?lunarist_user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
  const code = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const r = await supabase('eugene_link_codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ lunarist_user_id: userId, code, expires_at: expiresAt })
  });
  if (!r.ok) throw new Error(await r.text());
  return { code, expires_at: expiresAt };
}

async function getConnection(userId) {
  const r = await supabase(`eugene_card_connections?lunarist_user_id=eq.${encodeURIComponent(userId)}&select=eugene_uid,eugene_email,connected_at,last_seen_at&limit=1`);
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  const account = Array.isArray(d?.users) ? d.users[0] : null;
  if (!account?.localId) return null;
  return { uid: account.localId, email: account.email || null };
}

async function exchange(code, firebaseIdToken) {
  const firebaseUser = await verifyFirebaseIdToken(firebaseIdToken);
  if (!firebaseUser) return { status: 401, body: { error: 'Eugene Card sign-in could not be verified.' } };

  const r = await supabase(`eugene_link_codes?code=eq.${encodeURIComponent(code)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,lunarist_user_id&limit=1`);
  const rows = await r.json().catch(() => []);
  const pending = Array.isArray(rows) ? rows[0] : null;
  if (!pending) return { status: 400, body: { error: 'This Lunarist connection code is invalid or expired.' } };

  const existing = await supabase(`eugene_card_connections?eugene_uid=eq.${encodeURIComponent(firebaseUser.uid)}&select=lunarist_user_id&limit=1`);
  const existingRows = await existing.json().catch(() => []);
  const existingUser = Array.isArray(existingRows) ? existingRows[0] : null;
  if (existingUser && existingUser.lunarist_user_id !== pending.lunarist_user_id) {
    return { status: 409, body: { error: 'This Eugene Card account is already connected to another Lunarist account.' } };
  }

  await supabase(`eugene_link_codes?id=eq.${encodeURIComponent(pending.id)}`, { method: 'DELETE' });
  const saved = await supabase('eugene_card_connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      lunarist_user_id: pending.lunarist_user_id,
      eugene_uid: firebaseUser.uid,
      eugene_email: firebaseUser.email,
      connected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    })
  });
  if (!saved.ok) return { status: 500, body: { error: 'The Eugene Card connection could not be saved.' } };
  return { status: 200, body: { connected: true, eugene_email: firebaseUser.email || null } };
}

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(res, 503, { error: 'Supabase server credentials are not configured.' });
  try {
    if (req.method === 'POST' && req.body?.action === 'exchange') {
      const code = String(req.body.code || '').trim();
      const idToken = String(req.body.firebase_id_token || '').trim();
      if (!/^[A-Za-z0-9_-]{20,200}$/.test(code) || !idToken) return json(res, 400, { error: 'Invalid connection request.' });
      const result = await exchange(code, idToken);
      return json(res, result.status, result.body);
    }

    const user = await lunaristUser(tokenFrom(req));
    if (!user?.id) return json(res, 401, { error: 'Sign in is required.' });

    if (req.method === 'GET') {
      const connection = await getConnection(user.id);
      if (connection) {
        await supabase(`eugene_card_connections?lunarist_user_id=eq.${encodeURIComponent(user.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ last_seen_at: new Date().toISOString() })
        });
      }
      return json(res, 200, { connected: !!connection, connection });
    }

    if (req.method === 'POST' && req.body?.action === 'create-code') {
      const connection = await getConnection(user.id);
      if (connection) return json(res, 200, { connected: true, connection });
      const result = await createCode(user.id);
      return json(res, 200, { connected: false, ...result });
    }

    if (req.method === 'POST' && req.body?.action === 'disconnect') {
      await supabase(`eugene_card_connections?lunarist_user_id=eq.${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      await supabase(`eugene_link_codes?lunarist_user_id=eq.${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      return json(res, 200, { connected: false });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('eugene-connect', error);
    return json(res, 500, { error: 'Eugene Card connection service failed.' });
  }
}
