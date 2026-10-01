import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

async function requireUser(req) {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!url || !key || !token) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(res, 500, { error: 'OpenAI is not configured on the server.' });
  }

  try {
    const user = await requireUser(req);
    if (!user?.id) {
      return json(res, 401, { error: 'Sign in to Lunarist to use AI.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const input = typeof body.input === 'string' ? body.input.trim() : '';

    if (!input) {
      return json(res, 400, { error: 'input is required.' });
    }

    if (input.length > 12000) {
      return json(res, 400, { error: 'input is too long.' });
    }

    const response = await openai.responses.create({
      model: 'gpt-6-luna',
      input,
      store: true,
    });

    return json(res, 200, {
      id: response.id,
      output_text: response.output_text,
    });
  } catch (error) {
    console.error('OpenAI request failed:', error);
    return json(res, 500, {
      error: error?.message || 'OpenAI request failed.',
    });
  }
}
