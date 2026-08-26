// Lunarist X fetcher
// Vercel env: X_BEARER_TOKEN
function clean(v){return String(v||'').trim().replace(/^['"]|['"]$/g,'').replace(/^Bearer\s+/i,'').trim();}
function parse(raw){
  const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
  const h=u.hostname.toLowerCase().replace(/^www\./,'');
  if(h!=='x.com'&&h!=='twitter.com'&&h!=='mobile.twitter.com') throw new Error('That does not look like an X post URL.');
  const m=u.pathname.match(/\/(?:[^/]+)\/status\/(\d+)/i);
  if(!m) throw new Error('That does not look like an X post URL.');
  return m[1];
}
export default async function handler(req,res){
  try{
    const id=parse(req.query?.url||req.body?.url||'');
    const token=clean(process.env.X_BEARER_TOKEN);
    if(!token) throw new Error('X_BEARER_TOKEN is not configured in Vercel.');
    const url=new URL(`https://api.x.com/2/tweets/${id}`);
    url.searchParams.set('tweet.fields','created_at,public_metrics,author_id,attachments,text');
    url.searchParams.set('expansions','author_id,attachments.media_keys');
    url.searchParams.set('user.fields','name,username,profile_image_url');
    url.searchParams.set('media.fields','url,preview_image_url,type,width,height,alt_text');
    const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      return res.status(r.status).json({error:d.detail||d.title||d.errors?.[0]?.message||'X API request failed.'});
    }
    const t=d.data||{};
    const metric=t.public_metrics||{};
    const author=(d.includes?.users||[])[0]||{};
    const media=(d.includes?.media||[])[0]||{};
    const thumb=media.preview_image_url||media.url||'';
    const original=`https://x.com/${author.username||'i'}/status/${id}`;
    return res.status(200).json({
      platform:'x',type:'post',url:original,id,
      title:t.text? t.text.split('\n')[0].slice(0,120):'X post',
      description:t.text||'',text:t.text||'',
      author:author.name||'',username:author.username||'',
      thumbnail:thumb,mediaUrl:media.url||'',mediaType:media.type||'',
      createdAt:t.created_at||null,
      views:Number(metric.impression_count??0),
      likes:Number(metric.like_count??0),
      replies:Number(metric.reply_count??0),
      reposts:Number(metric.retweet_count??0),
      quotes:Number(metric.quote_count??0),
      publicMetrics:metric
    });
  }catch(e){return res.status(400).json({error:e?.message||'Unable to fetch X data.'});}
}
