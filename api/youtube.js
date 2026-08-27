async function youtubeFallback(videoId){
  const videoUrl=`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  let title='',description='',channelTitle='',viewCount=null,likeCount=null,publishedAt=null;
  const thumbnailUrl=`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  // oEmbed remains available when the Data API quota is exhausted and gives us
  // the canonical title + channel without consuming YouTube Data API quota.
  try{
    const r=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,{headers:{'accept':'application/json'},signal:AbortSignal.timeout(7000)});
    const d=await r.json().catch(()=>({}));
    if(r.ok){title=d.title||'';channelTitle=d.author_name||'';}
  }catch{}

  // The public watch page can expose the same metadata/statistics that a user
  // can see in YouTube. This is only a fallback; it does NOT use an API key and
  // therefore does not consume YouTube Data API quota.
  try{
    const r=await fetch(videoUrl,{headers:{
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      'accept-language':'en-US,en;q=0.9'
    },signal:AbortSignal.timeout(9000)});
    const html=await r.text();
    if(r.ok){
      const meta=(name)=>{
        const re=new RegExp(`<meta[^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}["'][^>]+content=["']([^"']*)["']`,'i');
        const m=html.match(re); return m?m[1]:'';
      };
      const decode=(v)=>String(v||'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      const ogTitle=decode(meta('og:title'));
      const ogDescription=decode(meta('og:description'));
      if(ogTitle)title=ogTitle;
      if(ogDescription)description=ogDescription;

      // Prefer the videoDetails object for views. For likes, YouTube's watch
      // page has historically exposed likeCount in its serialized data. Keep
      // these guarded because YouTube can change this markup at any time.
      const videoView=html.match(/"videoDetails"\s*:\s*\{[\s\S]{0,60000}?"viewCount"\s*:\s*"(\d+)"/);
      if(videoView)viewCount=Number(videoView[1]);
      else { const firstView=html.match(/"viewCount"\s*:\s*"(\d+)"/); if(firstView)viewCount=Number(firstView[1]); }
      const firstLike=html.match(/"likeCount"\s*:\s*"(\d+)"/);
      if(firstLike)likeCount=Number(firstLike[1]);

      const pub=html.match(/"publishDate"\s*:\s*"([^"]+)"/);
      if(pub)publishedAt=pub[1];
      const author=html.match(/"ownerChannelName"\s*:\s*"([^"]+)"/);
      if(author)channelTitle=decode(author[1]);

      // JSON-LD is a useful description/title fallback when og:* is absent.
      if(!description){
        const ld=html.match(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/);
        if(ld){try{description=JSON.parse('"'+ld[1]+'"')}catch{description=decode(ld[1])}}
      }
    }
  }catch{}

  return{
    title,
    description,
    publishedAt,
    channelTitle,
    viewCount,
    likeCount,
    likes:likeCount,
    isLive:false,
    actualStartTime:null,
    scheduledStartTime:null,
    quotaExceeded:true,
    quotaMessage:'YouTube API quota is exhausted. Project metadata and any publicly exposed statistics were loaded from YouTube without using the Data API quota.',
    thumbnailUrl
  };
}
export default async function handler(req, res) {
  const platform = String(req.query?.platform || 'youtube').toLowerCase();
  if (platform === 'x' || platform === 'twitter') {
    const input = String(req.query?.url || '').trim();
    const match = input.match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i);
    if (!match) return res.status(400).json({ error: 'Invalid X post URL' });
    const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
    if (!token) return res.status(503).json({ error: 'X_BEARER_TOKEN is not configured' });
    try { const endpoint=new URL(`https://api.x.com/2/tweets/${match[1]}`);endpoint.searchParams.set('tweet.fields','created_at,public_metrics,author_id,attachments');endpoint.searchParams.set('expansions','author_id,attachments.media_keys');endpoint.searchParams.set('user.fields','username,name,profile_image_url,verified');endpoint.searchParams.set('media.fields','url,preview_image_url,type,width,height');const r=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`}}),data=await r.json();if(!r.ok)return res.status(r.status).json({error:data?.detail||data?.title||'X API request failed'});const post=data.data;if(!post)return res.status(404).json({error:'X post not found'});const author=(data.includes?.users||[]).find(u=>u.id===post.author_id)||{},media=(data.includes?.media||[]).map(m=>({type:m.type,url:m.url||'',previewImageUrl:m.preview_image_url||'',width:m.width||null,height:m.height||null})),metrics=post.public_metrics||{},firstMedia=media[0]||null;return res.status(200).json({platform:'x',id:post.id,url:input,title:post.text?post.text.split(/\n+/)[0].slice(0,140):`Post by @${author.username||''}`,description:post.text||'',authorName:author.name||'',username:author.username||'',profileImageUrl:author.profile_image_url||'',thumbnailUrl:firstMedia?.previewImageUrl||(firstMedia?.type==='photo'?firstMedia.url:''),mediaUrl:firstMedia?.url||'',mediaType:firstMedia?.type||'',likes:Number(metrics.like_count||0),views:Number(metrics.impression_count||0)||null,reposts:Number(metrics.retweet_count||0),replies:Number(metrics.reply_count||0),quotes:Number(metrics.quote_count||0),createdAt:post.created_at||null,media}); } catch { return res.status(500).json({error:'Unable to contact X'}); }
  }
  if (platform === 'instagram' || platform === 'ig') {
    const input=String(req.query?.url||'').trim();try{const u=new URL(input),host=u.hostname.toLowerCase().replace(/^www\./,'');if(host!=='instagram.com'&&!host.endsWith('.instagram.com'))throw Error()}catch{return res.status(400).json({error:'Invalid Instagram URL'})}const token=process.env.INSTAGRAM_ACCESS_TOKEN||process.env.META_ACCESS_TOKEN;if(!token)return res.status(503).json({error:'INSTAGRAM_ACCESS_TOKEN is not configured'});try{const endpoint=new URL('https://graph.facebook.com/v22.0/instagram_oembed');endpoint.searchParams.set('url',input);endpoint.searchParams.set('access_token',token);endpoint.searchParams.set('omitscript','true');const r=await fetch(endpoint),data=await r.json();if(!r.ok)return res.status(r.status).json({error:data?.error?.message||'Instagram API request failed'});return res.status(200).json({platform:'instagram',url:input,title:data.title||'',authorName:data.author_name||'',authorUrl:data.author_url||'',thumbnailUrl:data.thumbnail_url||'',html:data.html||'',provider:data.provider_name||'Instagram',likes:null,views:null,mediaUrl:input,mediaType:'image'})}catch{return res.status(500).json({error:'Unable to contact Instagram'})}
  }
  const videoId=String(req.query?.videoId||'').trim();if(!/^[A-Za-z0-9_-]{11}$/.test(videoId))return res.status(400).json({error:'Invalid YouTube video ID'});const key=process.env.YOUTUBE_API_KEY;if(!key){const fallback=await youtubeFallback(videoId);return res.status(200).json(fallback)}
  try{const url=`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`,r=await fetch(url),data=await r.json();if(!r.ok){const reason=data?.error?.errors?.[0]?.reason||'';if(r.status===403&&reason==='quotaExceeded')return res.status(200).json(await youtubeFallback(videoId));return res.status(r.status).json({error:data?.error?.message||'YouTube API request failed'})}const item=data.items?.[0];if(!item)return res.status(404).json({error:'YouTube video not found'});const statistics=item.statistics||{},live=item.liveStreamingDetails||{};return res.status(200).json({title:item.snippet?.title||'',description:item.snippet?.description||'',publishedAt:item.snippet?.publishedAt||'',channelTitle:item.snippet?.channelTitle||'',viewCount:statistics.viewCount!=null?Number(statistics.viewCount):null,likeCount:statistics.likeCount!=null?Number(statistics.likeCount):null,likes:statistics.likeCount!=null?Number(statistics.likeCount):null,isLive:!!live.actualStartTime&&!live.actualEndTime,actualStartTime:live.actualStartTime||null,scheduledStartTime:live.scheduledStartTime||null,thumbnailUrl:item.snippet?.thumbnails?.high?.url||item.snippet?.thumbnails?.default?.url||''})}catch{return res.status(500).json({error:'Unable to contact YouTube'})}
}
