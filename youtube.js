export default async function handler(req, res) {
  const videoId = String(req.query?.videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid YouTube video ID' });
  }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'YOUTUBE_API_KEY is not configured' });
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'YouTube API request failed' });
    const item = data.items?.[0];
    if (!item) return res.status(404).json({ error: 'YouTube video not found' });
    return res.status(200).json({
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      publishedAt: item.snippet?.publishedAt || '',
      channelTitle: item.snippet?.channelTitle || ''
    });
  } catch (e) {
    return res.status(500).json({ error: 'Unable to contact YouTube' });
  }
}
