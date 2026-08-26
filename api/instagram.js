// Lunarist Instagram fetcher
// Environment variables:
// INSTAGRAM_ACCESS_TOKEN
// META_APP_ID (optional fallback)
// META_APP_SECRET (optional fallback)

function cleanToken(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

async function getToken() {
  const direct = cleanToken(process.env.INSTAGRAM_ACCESS_TOKEN);
  if (direct) return direct;

  const appId = cleanToken(process.env.META_APP_ID);
  const appSecret = cleanToken(process.env.META_APP_SECRET);

  if (!appId || !appSecret) {
    throw new Error('Instagram credentials are not configured in Vercel.');
  }

  const url = new URL('https://graph.facebook.com/oauth/access_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    throw new Error(data.error?.message || 'Unable to obtain Meta app access token.');
  }

  return cleanToken(data.access_token);
}

function normalizeInstagramUrl(raw) {
  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'instagram.com' && host !== 'instagr.am') {
    throw new Error('That does not look like an Instagram URL.');
  }
  return u.toString();
}

export default async function handler(req, res) {
  try {
    const raw = req.query?.url || req.body?.url;
    if (!raw) return res.status(400).json({ error: 'Instagram URL is required.' });

    const target = normalizeInstagramUrl(raw);
    const token = await getToken();

    // Try Graph API first.
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username';
    const graph = new URL('https://graph.instagram.com/');
    graph.searchParams.set('fields', fields);
    graph.searchParams.set('id', target);
    graph.searchParams.set('access_token', token);

    let response = await fetch(graph);
    let data = await response.json().catch(() => ({}));

    // If the supplied token is a Facebook Graph token, retry through graph.facebook.com.
    if (!response.ok) {
      const fb = new URL('https://graph.facebook.com/');
      fb.searchParams.set('fields', fields);
      fb.searchParams.set('id', target);
      fb.searchParams.set('access_token', token);
      response = await fetch(fb);
      data = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
      const msg = data.error?.message || 'Instagram API request failed.';
      const code = data.error?.code ? ` (code ${data.error.code})` : '';
      return res.status(response.status || 400).json({
        error: `${msg}${code}`,
        hint: 'Use a valid Meta/Instagram access token with permission to read the submitted Instagram content.'
      });
    }

    return res.status(200).json({
      platform: 'instagram',
      url: data.permalink || target,
      title: data.caption ? data.caption.split('\n')[0].slice(0, 120) : data.username || 'Instagram post',
      description: data.caption || '',
      author: data.username || '',
      thumbnail: data.thumbnail_url || data.media_url || '',
      mediaUrl: data.media_url || '',
      mediaType: data.media_type || '',
      timestamp: data.timestamp || null,
      likes: 0,
      views: 0
    });
  } catch (error) {
    return res.status(400).json({
      error: error?.message || 'Unable to fetch Instagram data.'
    });
  }
}
