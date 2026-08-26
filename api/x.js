export default async function handler(req, res) {
  const input = String(req.query?.url || '').trim();
  const match = input.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i);
  if (!match) return res.status(400).json({ error: 'Invalid X post URL. Use an x.com/.../status/... link.' });

  let token = String(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || '').trim();
  token = token.replace(/^Bearer\s+/i, '').replace(/^['\"]|['\"]$/g, '').trim();
  if (!token) return res.status(503).json({ error: 'X_BEARER_TOKEN is not configured in Vercel.' });

  async function oembedFallback(reason) {
    try {
      const o = new URL('https://publish.twitter.com/oembed');
      o.searchParams.set('url', input);
      o.searchParams.set('omit_script', 'true');
      const r = await fetch(o);
      const d = await r.json().catch(() => ({}));
      if (r.ok && (d.html || d.author_name)) {
        return res.status(200).json({
          platform: 'x', id: match[1], url: input,
          title: d.author_name ? `Post by @${d.author_name}` : 'X post',
          description: '', authorName: d.author_name || '',
          username: d.author_url ? d.author_url.split('/').filter(Boolean).pop() || '' : '',
          profileImageUrl: '', thumbnailUrl: '', mediaUrl: input, mediaType: 'embed',
          likes: null, views: null, reposts: null, replies: null, quotes: null,
          createdAt: null, media: [],
          fallback: true,
          warning: 'X API usage is currently unavailable. Basic post metadata was fetched via X oEmbed; engagement metrics require available X API credits.'
        });
      }
    } catch (e) { console.error('[X oEmbed fallback]', e); }
    return res.status(429).json({
      error: 'X API credits/usage are depleted. Basic fallback metadata could not be fetched. Restore X API access/credits to fetch this post and its metrics.',
      code: 'x_usage_capped', reason
    });
  }

  try {
    const endpoint = new URL(`https://api.x.com/2/tweets/${match[1]}`);
    endpoint.searchParams.set('tweet.fields', 'created_at,public_metrics,author_id,attachments');
    endpoint.searchParams.set('expansions', 'author_id,attachments.media_keys');
    endpoint.searchParams.set('user.fields', 'username,name,profile_image_url,verified');
    endpoint.searchParams.set('media.fields', 'url,preview_image_url,type,width,height');

    const r = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = data?.detail || data?.error || data?.title || `X API returned ${r.status}`;
      const usageCapped = r.status === 402 || r.status === 429 || /usage.?cap|credit|monthly product cap|credits depleted|credits/i.test(detail);
      if (usageCapped) return await oembedFallback(detail);
      return res.status(r.status).json({ error: detail });
    }

    const post = data.data;
    if (!post) return res.status(404).json({ error: 'X post not found or is not publicly accessible.' });
    const author = (data.includes?.users || []).find(u => u.id === post.author_id) || {};
    const media = (data.includes?.media || []).map(m => ({
      type: m.type || '', url: m.url || '', previewImageUrl: m.preview_image_url || '',
      width: m.width ?? null, height: m.height ?? null
    }));
    const metrics = post.public_metrics || {};
    const firstMedia = media[0] || null;

    return res.status(200).json({
      platform: 'x', id: post.id, url: input,
      title: post.text ? post.text.split(/\n+/)[0].slice(0, 140) : `Post by @${author.username || ''}`,
      description: post.text || '', authorName: author.name || '', username: author.username || '',
      profileImageUrl: author.profile_image_url || '',
      thumbnailUrl: firstMedia?.previewImageUrl || (firstMedia?.type === 'photo' ? firstMedia.url : ''),
      mediaUrl: firstMedia?.url || '', mediaType: firstMedia?.type || '',
      likes: metrics.like_count != null ? Number(metrics.like_count) : null,
      views: metrics.impression_count != null ? Number(metrics.impression_count) : null,
      reposts: metrics.retweet_count != null ? Number(metrics.retweet_count) : null,
      replies: metrics.reply_count != null ? Number(metrics.reply_count) : null,
      quotes: metrics.quote_count != null ? Number(metrics.quote_count) : null,
      createdAt: post.created_at || null, media
    });
  } catch (e) {
    console.error('[X API]', e);
    return res.status(502).json({ error: 'Unable to contact X API.' });
  }
}
