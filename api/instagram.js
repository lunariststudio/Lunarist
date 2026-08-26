export default async function handler(req, res) {
  const input = String(req.query?.url || '').trim();
  try {
    const u = new URL(input);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) throw new Error('bad host');
  } catch {
    return res.status(400).json({ error: 'Invalid Instagram URL.' });
  }

  const token = String(process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '').trim();
  if (!token) return res.status(503).json({ error: 'INSTAGRAM_ACCESS_TOKEN is not configured in Vercel.' });

  try {
    // Instagram oEmbed is the supported server-side way to obtain public post/reel
    // preview metadata without scraping Instagram HTML.
    const endpoint = new URL('https://graph.facebook.com/v24.0/instagram_oembed');
    endpoint.searchParams.set('url', input);
    endpoint.searchParams.set('access_token', token);
    endpoint.searchParams.set('omitscript', 'true');

    const r = await fetch(endpoint);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const message = data?.error?.message || `Instagram Graph API returned ${r.status}`;
      return res.status(r.status).json({ error: message });
    }

    return res.status(200).json({
      platform: 'instagram', url: input,
      title: data.title || '', description: data.title || '',
      authorName: data.author_name || '', authorUrl: data.author_url || '',
      thumbnailUrl: data.thumbnail_url || '', html: data.html || '',
      provider: data.provider_name || 'Instagram',
      likes: null, views: null,
      mediaUrl: input,
      mediaType: /instagram\.com\/(?:reel|reels|tv)\//i.test(input) ? 'video' : 'image'
    });
  } catch (e) {
    console.error('[Instagram API]', e);
    return res.status(502).json({ error: 'Unable to contact Instagram Graph API.' });
  }
}
