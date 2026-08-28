// Lunarist X integration — single authoritative metrics pipeline.
// Auth order: OAuth 2.0 user token -> Bearer token -> public web fallbacks.
// Public metrics: likes, replies, reposts, quotes, impression/view counts.

const clean = v => String(v || '').trim().replace(/^['"]|['"]$/g, '').replace(/^Bearer\s+/i, '').trim();

function parseX(raw) {
  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (!['x.com', 'twitter.com', 'mobile.twitter.com'].includes(host)) throw new Error('That does not look like an X post URL.');
  const m = u.pathname.match(/\/(?:[^/]+)\/status\/(\d+)/i);
  if (!m) throw new Error('That does not look like an X post URL.');
  return { id: m[1], original: u.toString() };
}

function finite(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function metric(v) {
  const n = finite(v);
  return n != null && n >= 0 ? Math.floor(n) : null;
}

async function oembed(url) {
  try {
    const u = new URL('https://publish.x.com/oembed');
    u.searchParams.set('url', url);
    u.searchParams.set('omit_script', '1');
    const r = await fetch(u, { headers: { Accept: 'application/json' } });
    return r.ok ? await r.json().catch(() => null) : null;
  } catch { return null; }
}

async function official(id, token, authContext) {
  if (!token) return null;
  try {
    const u = new URL(`https://api.x.com/2/tweets/${id}`);
    u.searchParams.set('tweet.fields', 'created_at,public_metrics,author_id,attachments,text');
    u.searchParams.set('expansions', 'author_id,attachments.media_keys');
    u.searchParams.set('user.fields', 'name,username,profile_image_url');
    u.searchParams.set('media.fields', 'url,preview_image_url,type,width,height,alt_text,public_metrics,duration_ms,variants');
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.data) return { ok: false, status: r.status, error: d?.detail || d?.title || d?.errors?.[0]?.message || 'X API request failed.' };

    const t = d.data;
    const tm = t.public_metrics || {};
    const author = (d.includes?.users || [])[0] || {};
    const media = (d.includes?.media || [])[0] || {};
    const mm = media.public_metrics || {};
    const isVideo = media.type === 'video' || media.type === 'animated_gif';
    let mediaUrl = '';
    if (isVideo && Array.isArray(media.variants)) {
      const mp4 = media.variants.filter(v => v.content_type === 'video/mp4').sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      mediaUrl = mp4?.url || '';
    }

    const likes = metric(tm.like_count);
    const replies = metric(tm.reply_count);
    const reposts = metric(tm.retweet_count);
    const quotes = metric(tm.quote_count);
    const bookmarks = metric(tm.bookmark_count);
    const impressionCount = metric(tm.impression_count);
    const videoViews = isVideo ? metric(mm.view_count) : null;
    const views = videoViews != null ? videoViews : impressionCount;
    const text = t.text || '';

    return {
      ok: true,
      data: {
        platform: 'x', type: 'post', id: String(t.id || id),
        url: `https://x.com/${author.username || 'i'}/status/${t.id || id}`,
        title: text ? text.split('\n')[0].slice(0, 120) : 'X post',
        description: text, text,
        author: author.name || '', username: author.username || '',
        thumbnail: media.preview_image_url || media.url || '',
        mediaUrl: mediaUrl || media.url || '', mediaType: mediaUrl ? 'video' : (media.type || ''),
        createdAt: t.created_at || null,
        views, viewCount: views, likes, likeCount: likes, replies, reposts, quotes, bookmarks,
        publicMetrics: tm, mediaPublicMetrics: mm,
        metricsSource: authContext,
        authContext,
        metricsUnavailable: false,
        metricsRaw: { impression_count: impressionCount, video_view_count: videoViews }
      }
    };
  } catch (e) {
    return { ok: false, status: 0, error: e?.message || 'X API request failed.' };
  }
}

async function refreshOAuthToken() {
  const refresh = clean(process.env.X_OAUTH2_REFRESH_TOKEN);
  const clientId = clean(process.env.X_CLIENT_ID);
  const clientSecret = clean(process.env.X_CLIENT_SECRET);
  if (!refresh || !clientId) return null;
  try {
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId });
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
    if (clientSecret) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    const r = await fetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers, body });
    const d = await r.json().catch(() => ({}));
    return r.ok && d.access_token ? clean(d.access_token) : null;
  } catch { return null; }
}

async function oauthAccessToken() {
  return clean(process.env.X_OAUTH2_ACCESS_TOKEN) || await refreshOAuthToken();
}

async function syndication(id) {
  try {
    const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
    const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d?.id_str ? d : null;
  } catch { return null; }
}

function textFromEmbedHtml(html) {
  if (!html) return '';
  const m = String(html).match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!m) return '';
  return m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ').trim();
}

function fromSyndication(d, id, embed) {
  const text = d.text || textFromEmbedHtml(embed?.html) || '';
  const user = d.user || {};
  const media = d.mediaDetails?.[0] || {};
  const views = [d.view_count, d.views, d.viewCount, d.video_view_count, d.play_count, media.view_count, media.views, media.viewCount, media.video_view_count, media.play_count].map(Number).find(Number.isFinite);
  const likes = metric(d.favorite_count), replies = metric(d.conversation_count), reposts = metric(d.retweet_count), quotes = metric(d.quote_count);
  return {
    platform: 'x', type: 'post', id: String(id), url: `https://x.com/${user.screen_name || 'i'}/status/${id}`,
    title: text ? text.split('\n')[0].slice(0, 120) : 'X post', description: text, text,
    author: user.name || embed?.author_name || '', username: user.screen_name || '',
    thumbnail: media.media_url_https || media.thumbnail_url || '', mediaUrl: '', mediaType: '', createdAt: d.created_at || null,
    views: metric(views), viewCount: metric(views), likes, likeCount: likes, replies, reposts, quotes, bookmarks: null,
    publicMetrics: { like_count: likes, reply_count: replies, retweet_count: reposts, quote_count: quotes, impression_count: metric(views) },
    mediaPublicMetrics: {}, metricsUnavailable: false, metricsSource: 'x-syndication', authContext: 'public', quotaLimited: true,
    embedHtml: embed?.html || '', embedUrl: `https://x.com/i/status/${id}`
  };
}

function graphqlFeatures() {
  return {
    creator_subscriptions_tweet_preview_api_enabled:true, communities_web_enable_tweet_community_results_fetch:true,
    c9s_tweet_anatomy_moderator_badge_enabled:true, articles_preview_enabled:true,
    tweetypie_unmention_optimization_enabled:true, responsive_web_edit_tweet_api_enabled:true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled:true, view_counts_everywhere_api_enabled:true,
    longform_notetweets_consumption_enabled:true, responsive_web_twitter_article_tweet_consumption_enabled:true,
    tweet_awards_web_tipping_enabled:false, creator_subscriptions_quote_tweet_preview_enabled:true,
    freedom_of_speech_not_reach_fetch_enabled:true, standardized_nudges_misinfo:true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:true,
    tweet_with_visibility_results_prefer_gql_media_interstitial_enabled:true, rweb_video_timestamps_enabled:true,
    longform_notetweets_rich_text_read_enabled:true, longform_notetweets_inline_media_enabled:true,
    responsive_web_graphql_exclude_directive_enabled:true, verified_phone_label_enabled:false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled:false, responsive_web_graphql_timeline_navigation_enabled:true,
    responsive_web_enhance_cards_enabled:false
  };
}

async function webGraphql(id) {
  const bearer = clean(process.env.X_WEB_BEARER);
  const queryIds = [clean(process.env.X_WEB_TWEET_QUERY_ID), 'zAz9764BcLZOJ0JU2wrd1A'].filter(Boolean);
  if (!bearer) return null;
  for (const queryId of [...new Set(queryIds)]) {
    try {
      const u = new URL(`https://x.com/i/api/graphql/${queryId}/TweetResultByRestId`);
      u.searchParams.set('variables', JSON.stringify({ tweetId: String(id), withCommunity:false, includePromotedContent:false, withVoice:false }));
      u.searchParams.set('features', JSON.stringify(graphqlFeatures()));
      u.searchParams.set('fieldToggles', JSON.stringify({ withArticleRichContentState:true, withArticlePlainText:true }));
      const r = await fetch(u, { headers: { Authorization: `Bearer ${bearer}`, 'x-twitter-active-user':'yes', 'User-Agent':'Mozilla/5.0', Accept:'application/json' }, cache:'no-store' });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      const raw = j?.data?.tweetResult?.result;
      const t = raw?.tweet || raw;
      if (!t) continue;
      const legacy = t.legacy || {};
      const views = metric(t.views?.count ?? legacy.views?.count ?? legacy.view_count);
      const likes = metric(legacy.favorite_count), replies = metric(legacy.reply_count), reposts = metric(legacy.retweet_count), quotes = metric(legacy.quote_count);
      if ([views, likes, replies, reposts, quotes].some(v => v != null)) return { views, likes, replies, reposts, quotes, source: 'x-web' };
    } catch {}
  }
  return null;
}

async function fresh(id, embed) {
  const oauth = await oauthAccessToken();
  const bearer = clean(process.env.X_BEARER_TOKEN);
  const candidates = [];
  if (oauth) candidates.push(['x-oauth2', oauth]);
  if (bearer && bearer !== oauth) candidates.push(['x-bearer', bearer]);

  let best = null;
  for (const [source, token] of candidates) {
    const result = await official(id, token, source);
    if (!result?.ok) continue;
    best = result.data;
    // Critical: do NOT return immediately when impressions/views are 0.
    // X can return zero/missing public impressions while its web data has a real count.
    if (best.views != null && best.views > 0) return best;
  }

  // If official metrics produced zero/missing views, explicitly try public fallbacks.
  const syn = await syndication(id);
  let data = syn ? fromSyndication(syn, id, embed) : best;
  const web = await webGraphql(id);
  if (web) {
    data = data || { platform:'x', type:'post', id:String(id), url:`https://x.com/i/status/${id}`, title:embed?.title || 'X post', description:textFromEmbedHtml(embed?.html), text:textFromEmbedHtml(embed?.html), author:embed?.author_name || '' };
    if (web.views != null) data.views = data.viewCount = web.views;
    if (web.likes != null) data.likes = data.likeCount = web.likes;
    if (web.replies != null) data.replies = web.replies;
    if (web.reposts != null) data.reposts = web.reposts;
    if (web.quotes != null) data.quotes = web.quotes;
    data.metricsSource = data.metricsSource ? `${data.metricsSource}+x-web` : 'x-web';
    data.metricsUnavailable = false;
  }

  if (data) return data;
  return {
    platform:'x', type:'post', id:String(id), url:`https://x.com/i/status/${id}`,
    title:embed?.title || 'X post', description:textFromEmbedHtml(embed?.html), text:textFromEmbedHtml(embed?.html),
    author:embed?.author_name || '', username:'', thumbnail:'', mediaUrl:'', mediaType:'',
    views:null, viewCount:null, likes:null, likeCount:null, replies:null, reposts:null, quotes:null,
    metricsUnavailable:true, metricsSource:'unavailable', embedHtml:embed?.html || '', embedUrl:`https://x.com/i/status/${id}`
  };
}

async function syncProject(projectId, xId) {
  const base = clean(process.env.SUPABASE_URL), key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!base || !key || !projectId || !xId) return false;
  try {
    const headers = { apikey:key, Authorization:`Bearer ${key}`, Accept:'application/json' };
    const lookup = await fetch(`${base}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=id,media_url`, { headers });
    if (!lookup.ok) return false;
    const rows = await lookup.json().catch(() => []);
    if (!rows?.[0]) return false;
    try { if (parseX(rows[0].media_url).id !== String(xId)) return false; } catch { return false; }
    const embed = await oembed(`https://x.com/i/status/${xId}`);
    const data = await fresh(xId, embed);
    const patch = {};
    if (data.likes != null) patch.likes = data.likes;
    if (data.views != null) patch.views = data.views;
    if (!Object.keys(patch).length) return false;
    const r = await fetch(`${base}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`, { method:'PATCH', headers:{...headers,'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify({...patch,updated_at:new Date().toISOString()}) });
    return r.ok;
  } catch { return false; }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const projectId = String(body.projectId || ''), xId = String(body.xId || '');
      if (!projectId || !xId) return res.status(400).json({ ok:false, error:'projectId and xId are required.' });
      const ok = await syncProject(projectId, xId);
      return res.status(ok ? 200 : 400).json({ ok });
    }
    const parsed = parseX(req.query?.url || req.body?.url || '');
    const embed = await oembed(`https://x.com/i/status/${parsed.id}`);
    const data = await fresh(parsed.id, embed);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json({ ...data, embedHtml:data.embedHtml || embed?.html || '', embedUrl:`https://x.com/i/status/${parsed.id}` });
  } catch (e) {
    return res.status(400).json({ error:e?.message || 'Unable to fetch X data.' });
  }
}
