import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!token || !supabaseUrl || !serviceKey) return null;

  const response = await fetch(supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + token
    }
  });
  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
    return;
  }

  try {
    const user = await getUser(req);
    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const input = typeof req.body?.input === 'string' ? req.body.input : '';
    if (!input.trim()) {
      res.status(400).json({ error: 'input is required' });
      return;
    }
    if (input.length > 12000) {
      res.status(413).json({ error: 'input is too long' });
      return;
    }

    const response = await openai.responses.create({
      model: 'gpt-6-luna',
      input,
      store: true
    });

    res.status(200).json({
      id: response.id,
      output_text: response.output_text || ''
    });
  } catch (error) {
    console.error('OpenAI request failed:', error);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
}
