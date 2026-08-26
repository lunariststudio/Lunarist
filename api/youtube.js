export default async function handler(req, res) {
  const platform = String(req.query?.platform || 'youtube').toLowerCase();

  if (platform === 'x' || platform === 'twitter') {
    const input = String(req.query?.url || '').trim();
    const match = input.match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i);
    if (!match) return res.status(400).json({ error: 'Invalid X post URL' });
    const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
    if (!token) return res.status(503).json({ error: 'X_BEARER_TOKEN is not configured' });
    try {
      const endpoint = new URL(`https://api.x.com/2/tweets/${match[1]}`);
      endpoint.searchParams.set('tweet.fields', 'created_at,public_metrics,author_id,attachments');
      endpoint.searchParams.set('expansions', 'author_id,attachments.media_keys');
      endpoint.searchParams.set('user.fields', 'username,name,profile_image_url,verified');
      endpoint.searchParams.set('media.fields', 'url,preview_image_url,type,width,height');
      const r = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.detail || data?.title || 'X API request failed' });
      const post = data.data;
      if (!post) return res.status(404).json({ error: 'X post not found' });
      const author = (data.includes?.users || []).find(u => u.id === post.author_id) || {};
      const media = (data.includes?.media || []).map(m => ({ type: m.type, url: m.url || '', previewImageUrl: m.preview_image_url || '', width: m.width || null, height: m.height || null }));
      const metrics = post.public_metrics || {};
      const firstMedia = media[0] || null;
      return res.status(200).json({ platform:'x', id:post.id, url:input, title:post.text ? post.text.split(/\n+/)[0].slice(0,140) : `Post by @${author.username || ''}`, description:post.text || '', authorName:author.name || '', username:author.username || '', profileImageUrl:author.profile_image_url || '', thumbnailUrl:firstMedia?.previewImageUrl || (firstMedia?.type === 'photo' ? firstMedia.url : ''), mediaUrl:firstMedia?.url || '', mediaType:firstMedia?.type || '', likes:Number(metrics.like_count || 0), views:null, reposts:Number(metrics.retweet_count || 0), replies:Number(metrics.reply_count || 0), quotes:Number(metrics.quote_count || 0), createdAt:post.created_at || null, media });
    } catch { return res.status(500).json({ error: 'Unable to contact X' }); }
  }

  if (platform === 'instagram' || platform === 'ig') {
    const input = String(req.query?.url || '').trim();
    try {
      const u = new URL(input);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (!['instagram.com'].includes(host) && !host.endsWith('.instagram.com')) throw new Error();
    } catch { return res.status(400).json({ error: 'Invalid Instagram URL' }); }
    const token = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
    if (!token) return res.status(503).json({ error: 'INSTAGRAM_ACCESS_TOKEN is not configured' });
    try {
      const endpoint = new URL('https://graph.facebook.com/v22.0/instagram_oembed');
      endpoint.searchParams.set('url', input); endpoint.searchParams.set('access_token', token); endpoint.searchParams.set('omitscript','true');
      const r = await fetch(endpoint); const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error:data?.error?.message || 'Instagram API request failed' });
      return res.status(200).json({ platform:'instagram', url:input, title:data.title || '', authorName:data.author_name || '', authorUrl:data.author_url || '', thumbnailUrl:data.thumbnail_url || '', html:data.html || '', provider:data.provider_name || 'Instagram', likes:null, views:null });
    } catch { return res.status(500).json({ error:'Unable to contact Instagram' }); }
  }

  const videoId = String(req.query?.videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return res.status(400).json({ error: 'Invalid YouTube video ID' });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(503).json({ error: 'YOUTUBE_API_KEY is not configured' });
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;
    const r = await fetch(url); const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error:data?.error?.message || 'YouTube API request failed' });
    const item=data.items?.[0]; if(!item)return res.status(404).json({error:'YouTube video not found'});
    const statistics=item.statistics||{},live=item.liveStreamingDetails||{};
    return res.status(200).json({title:item.snippet?.title||'',description:item.snippet?.description||'',publishedAt:item.snippet?.publishedAt||'',channelTitle:item.snippet?.channelTitle||'',viewCount:statistics.viewCount!=null?Number(statistics.viewCount):null,likeCount:statistics.likeCount!=null?Number(statistics.likeCount):null,likes:statistics.likeCount!=null?Number(statistics.likeCount):null,isLive:!!live.actualStartTime&&!live.actualEndTime,actualStartTime:live.actualStartTime||null,scheduledStartTime:live.scheduledStartTime||null});
  } catch { return res.status(500).json({error:'Unable to contact YouTube'}); }
}
