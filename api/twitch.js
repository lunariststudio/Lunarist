// Lunarist Twitch fetcher
// Required Vercel environment variables:
// TWITCH_CLIENT_ID
// TWITCH_CLIENT_SECRET

function parseTwitchUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) return null;

  let u;
  try {
    u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'twitch.tv' && host !== 'm.twitch.tv') return null;

  const parts = u.pathname.split('/').filter(Boolean);
  if (!parts.length) return null;

  if (parts[0].toLowerCase() === 'videos' && parts[1]) {
    return { type: 'video', id: parts[1] };
  }
  if (parts[0].toLowerCase() === 'directory') return null;
  if (parts[0].toLowerCase() === 'clip' && parts[1]) {
    return { type: 'clip', id: parts[1] };
  }

  return { type: 'channel', login: parts[0] };
}

async function getAppToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Twitch API credentials are not configured in Vercel.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.message || 'Unable to authenticate with Twitch.');
  }
  return data.access_token;
}

async function twitchFetch(path, token) {
  const response = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Twitch API error (${response.status})`);
  return data;
}

function videoDurationToSeconds(duration) {
  const m = String(duration || '').match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

export default async function handler(req, res) {
  try {
    const raw = req.query?.url || req.body?.url;
    const parsed = parseTwitchUrl(raw);

    if (!parsed) {
      return res.status(400).json({ error: 'That does not look like a Twitch URL.' });
    }

    const token = await getAppToken();

    if (parsed.type === 'channel') {
      const users = await twitchFetch(`/users?login=${encodeURIComponent(parsed.login)}`, token);
      const user = users.data?.[0];
      if (!user) return res.status(404).json({ error: 'Twitch channel not found.' });

      const streams = await twitchFetch(`/streams?user_id=${encodeURIComponent(user.id)}`, token);
      const stream = streams.data?.[0];

      return res.status(200).json({
        platform: 'twitch',
        type: stream ? 'live' : 'channel',
        url: raw,
        title: stream?.title || user.display_name,
        description: user.description || '',
        author: user.display_name,
        username: user.login,
        thumbnail: stream?.thumbnail_url
          ? stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')
          : user.profile_image_url,
        game: stream?.game_name || '',
        isLive: !!stream,
        viewers: Number(stream?.viewer_count || 0),
        viewCount: 0,
        likes: 0,
        startedAt: stream?.started_at || null
      });
    }

    if (parsed.type === 'video') {
      const videos = await twitchFetch(`/videos?id=${encodeURIComponent(parsed.id)}`, token);
      const video = videos.data?.[0];
      if (!video) return res.status(404).json({ error: 'Twitch VOD not found.' });

      return res.status(200).json({
        platform: 'twitch',
        type: 'video',
        url: raw,
        id: video.id,
        title: video.title || '',
        description: video.description || '',
        author: video.user_name || '',
        username: video.user_login || '',
        thumbnail: video.thumbnail_url
          ? video.thumbnail_url.replace('%{width}', '1280').replace('%{height}', '720')
          : '',
        game: video.game_name || '',
        isLive: false,
        viewers: 0,
        viewCount: Number(video.view_count || 0),
        duration: video.duration || '',
        durationSeconds: videoDurationToSeconds(video.duration),
        publishedAt: video.published_at || null
      });
    }

    // Twitch clips require additional broadcaster information in some API
    // versions; return a clear response rather than pretending to fetch it.
    return res.status(400).json({
      error: 'Twitch Clips are not supported by this fetcher yet. Use a channel or VOD URL.'
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unable to fetch Twitch data.'
    });
  }
}
