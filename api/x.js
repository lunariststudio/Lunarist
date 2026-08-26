// Lunarist X fetcher
// Vercel env: X_BEARER_TOKEN
function clean(v){return String(v||'').trim().replace(/^['"]|['"]$/g,'').replace(/^Bearer\s+/i,'').trim();}
function parse(raw){
  const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
  const h=u.hostname.toLowerCase().replace(/^www\./,'');
  if(!['x.com','twitter.com','mobile.twitter.com'].includes(h)) throw new Error('That does not look like an X post URL.');
  const m=u.pathname.match(/\/(?:[^/]+)\/status\/(\d+)/i);
  if(!m) throw new Error('That does not look like an X post URL.');
  return {id:m[1], original:u.toString()};
}
function isUsageError(status,d){
  const s=JSON.stringify(d||{}).toLowerCase();
  return status===429 || /usage.?cap|credits?.?deplet|credit.?deplet|quota|billing|spend.?limit|rate.?limit/.test(s) ||
    /\/usage-capped|\/rate-limit-exceeded/.test(String(d?.type||''));
}
function fallback(id, original){
  return {
    platform:'x', type:'post', url:`https://x.com/i/status/${id}`, id,
    title:'X post', description:'',
    author:'', username:'',
    thumbnail:'', mediaUrl:'', mediaType:'',
    views:null, likes:null, replies:null, reposts:null,
    metricsUnavailable:true, quotaLimited:true,
    embedUrl:`https://x.com/i/status/${id}`,
    originalUrl:original
  };
}
export default async function handler(req,res){
  try{
    const parsed=parse(req.query?.url||req.body?.url||'');
    const token=clean(process.env.X_BEARER_TOKEN);
    if(!token) return res.status(200).json(fallback(parsed.id,parsed.original));

    const u=new URL(`https://api.x.com/2/tweets/${parsed.id}`);
    u.searchParams.set('tweet.fields','created_at,public_metrics,author_id,attachments,text');
    u.searchParams.set('expansions','author_id,attachments.media_keys');
    u.searchParams.set('user.fields','name,username,profile_image_url');
    u.searchParams.set('media.fields','url,preview_image_url,type,width,height,alt_text');

    const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}});
    const d=await r.json().catch(()=>({}));

    if(!r.ok){
      if(isUsageError(r.status,d)) return res.status(200).json({
        ...fallback(parsed.id,parsed.original),
        error:null,
        notice:'X API usage/credits are unavailable. The post can still be saved, but X metrics cannot be fetched until API access is restored.'
      });
      return res.status(r.status).json({error:d.detail||d.title||d.errors?.[0]?.message||'X API request failed.'});
    }

    const t=d.data||{}, metric=t.public_metrics||{};
    const author=(d.includes?.users||[])[0]||{};
    const media=(d.includes?.media||[])[0]||{};
    return res.status(200).json({
      platform:'x',type:'post',url:`https://x.com/${author.username||'i'}/status/${parsed.id}`,
      id:parsed.id,title:t.text?t.text.split('\n')[0].slice(0,120):'X post',
      description:t.text||'',text:t.text||'',
      author:author.name||'',username:author.username||'',
      thumbnail:media.preview_image_url||media.url||'',
      mediaUrl:media.url||'',mediaType:media.type||'',
      createdAt:t.created_at||null,
      views:Number.isFinite(Number(metric.impression_count))?Number(metric.impression_count):null,
      likes:Number.isFinite(Number(metric.like_count))?Number(metric.like_count):null,
      replies:Number.isFinite(Number(metric.reply_count))?Number(metric.reply_count):null,
      reposts:Number.isFinite(Number(metric.retweet_count))?Number(metric.retweet_count):null,
      publicMetrics:metric, metricsUnavailable:false, quotaLimited:false,
      embedUrl:`https://x.com/i/status/${parsed.id}`
    });
  }catch(e){return res.status(400).json({error:e?.message||'Unable to fetch X data.'});}
}
