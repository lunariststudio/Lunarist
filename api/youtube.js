async function youtubeFallback(videoId){
  const videoUrl=`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  let title='',description='',channelTitle='',viewCount=null,likeCount=null,publishedAt=null;
  let thumbnailUrl=`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const decodeHtml=(v)=>String(v||'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/gi,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const decodeJs=(v)=>{try{return JSON.parse('"'+String(v).replace(/\\/g,'\\').replace(/"/g,'\\"')+'"')}catch{return decodeHtml(v)}};
  // Do NOT regex the first generic "title" / "viewCount" on a YouTube page.
  // The page contains many unrelated title/view fields, which can accidentally
  // put a view label into the Project title. Read the canonical videoDetails
  // object from ytInitialPlayerResponse first.
  const extractPlayerResponse=(html)=>{
    const marker='ytInitialPlayerResponse = ';
    const at=html.indexOf(marker);
    if(at<0)return null;
    let i=at+marker.length;
    while(i<html.length && /\s/.test(html[i]))i++;
    if(html[i]!=='{')return null;
    let depth=0,inStr=false,esc=false;
    for(let j=i;j<html.length;j++){
      const c=html[j];
      if(inStr){
        if(esc)esc=false; else if(c==='\\')esc=true; else if(c==='"')inStr=false;
        continue;
      }
      if(c==='"'){inStr=true;continue;}
      if(c==='{')depth++;
      else if(c==='}') { depth--; if(depth===0){ try{return JSON.parse(html.slice(i,j+1));}catch{return null;} } }
    }
    return null;
  };
  const extractMeta=(html,name)=>{
    const escaped=String(name).replace(/[.*+?^${}()|[\\]\\]/g,'\\$&');
    const re=new RegExp("<meta[^>]+(?:property|name)=[\"']"+escaped+"[\"'][^>]+content=[\"']([^\"']*)[\"']",'i');
    const m=html.match(re); return m?decodeHtml(m[1]):'';
  };


  // oEmbed is independent of the YouTube Data API quota. It reliably supplies
  // the canonical title, creator and thumbnail even when the API is exhausted.
  try{
    const r=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,{
      headers:{accept:'application/json'},signal:AbortSignal.timeout(7000)
    });
    const d=await r.json().catch(()=>({}));
    if(r.ok){
      title=d.title||'';
      channelTitle=d.author_name||'';
      thumbnailUrl=d.thumbnail_url||thumbnailUrl;
    }
  }catch{}

  // The watch page contains ytInitialPlayerResponse / videoDetails. Unlike the
  // Data API this request consumes no YouTube Data API quota. Prefer these
  // fields for the actual video description and public counters.
  try{
    const r=await fetch(videoUrl,{headers:{
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
      'accept':'text/html,application/xhtml+xml',
      'accept-language':'en-US,en;q=0.9'
    },signal:AbortSignal.timeout(10000)});
    const html=await r.text();
    if(r.ok){
      const player=extractPlayerResponse(html);
      const vd=player?.videoDetails||{};
      // Only accept the title/description/counters from videoDetails. This
      // prevents unrelated page labels such as "4.6K views" from becoming the
      // Project title.
      if(vd.title)title=vd.title;
      if(vd.shortDescription)description=vd.shortDescription;
      if(vd.author)channelTitle=vd.author;
      if(vd.viewCount!=null && /^\d+$/.test(String(vd.viewCount)))viewCount=Number(vd.viewCount);
      if(vd.publishDate)publishedAt=vd.publishDate;

      const playerVideo=player?.videoDetails||{};
      if(playerVideo.likeCount!=null && /^\d+$/.test(String(playerVideo.likeCount)))likeCount=Number(playerVideo.likeCount);
      const thumbs=player?.videoDetails?.thumbnail?.thumbnails||[];
      const thumb=thumbs.length?thumbs[thumbs.length-1]?.url:'';
      if(thumb)thumbnailUrl=thumb;

      // Meta tags are a secondary fallback for title/description/thumbnail.
      title=title||extractMeta(html,'og:title');
      description=description||extractMeta(html,'description')||extractMeta(html,'og:description');
      thumbnailUrl=extractMeta(html,'og:image')||thumbnailUrl;

      // JSON-LD can provide the description if YouTube changes its player markup.
      if(!description){
        const ld=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
        if(ld){try{const j=JSON.parse(ld[1]);const item=Array.isArray(j)?j.find(x=>x?.['@type']==='VideoObject'):j;if(item?.description)description=item.description;if(item?.name&&!title)title=item.name;if(item?.thumbnailUrl){const t=Array.isArray(item.thumbnailUrl)?item.thumbnailUrl[0]:item.thumbnailUrl;if(t)thumbnailUrl=t;}}catch{}}
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
    quotaMessage:'YouTube API quota is exhausted. Metadata and publicly exposed statistics were loaded from YouTube without using the Data API quota.',
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
  try{const url=`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`,r=await fetch(url),data=await r.json();if(!r.ok){const reason=data?.error?.errors?.[0]?.reason||'';if(r.status===403&&['quotaExceeded','dailyLimitExceeded','userRateLimitExceeded','rateLimitExceeded'].includes(reason))return res.status(200).json(await youtubeFallback(videoId));return res.status(r.status).json({error:data?.error?.message||'YouTube API request failed'})}const item=data.items?.[0];if(!item)return res.status(404).json({error:'YouTube video not found'});const statistics=item.statistics||{},live=item.liveStreamingDetails||{};return res.status(200).json({title:item.snippet?.title||'',description:item.snippet?.description||'',publishedAt:item.snippet?.publishedAt||'',channelTitle:item.snippet?.channelTitle||'',viewCount:statistics.viewCount!=null?Number(statistics.viewCount):null,likeCount:statistics.likeCount!=null?Number(statistics.likeCount):null,likes:statistics.likeCount!=null?Number(statistics.likeCount):null,isLive:!!live.actualStartTime&&!live.actualEndTime,actualStartTime:live.actualStartTime||null,scheduledStartTime:live.scheduledStartTime||null,thumbnailUrl:item.snippet?.thumbnails?.high?.url||item.snippet?.thumbnails?.default?.url||''})}catch{return res.status(500).json({error:'Unable to contact YouTube'})}
}
