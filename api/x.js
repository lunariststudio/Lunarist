import { getXPublicFallback } from './x-meta-fallback.js';

function clean(v){return String(v||'').trim().replace(/^['"]|['"]$/g,'').replace(/^Bearer\s+/i,'').trim();}
function parse(raw){
  const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
  const h=u.hostname.toLowerCase().replace(/^www\./,'');
  if(!['x.com','twitter.com','mobile.twitter.com'].includes(h)) throw new Error('That does not look like an X post URL.');
  const m=u.pathname.match(/\/(?:[^/]+)\/status\/(\d+)/i);
  if(!m) throw new Error('That does not look like an X post URL.');
  return {id:m[1], original:u.toString()};
}
function usageError(status,d){
  const s=JSON.stringify(d||{}).toLowerCase();
  return status===429 || /usage.?cap|credits?.?deplet|credit.?deplet|quota|billing|spend.?limit|rate.?limit/.test(s);
}
async function oembed(url){
  const u=new URL('https://publish.x.com/oembed');
  u.searchParams.set('url',url); u.searchParams.set('omit_script','1');
  const r=await fetch(u); const d=await r.json().catch(()=>({}));
  return r.ok ? d : null;
}
export default async function handler(req,res){
  try{
    const parsed=parse(req.query?.url||req.body?.url||'');
    const token=clean(process.env.X_BEARER_TOKEN);
    let embed=null, fallback={};
    try{ embed=await oembed(`https://x.com/i/status/${parsed.id}`); }catch{}
    if(!token){
      fallback=await getXPublicFallback(parsed.original);
      const text=fallback.text||'';
      return res.status(200).json({
        platform:'x',type:'post',url:`https://x.com/i/status/${parsed.id}`,id:parsed.id,
        title:text?text.split('\n')[0].slice(0,120):(embed?.title||'X post'),
        description:text,text,author:fallback.author||embed?.author_name||'',username:fallback.username||'',
        thumbnail:fallback.thumbnail||'',mediaUrl:fallback.mediaUrl||'',mediaType:fallback.mediaType||'',
        views:null,likes:null,replies:null,reposts:null,metricsUnavailable:true,quotaLimited:false,
        embedHtml:embed?.html||'',embedUrl:`https://x.com/i/status/${parsed.id}`
      });
    }
    const u=new URL(`https://api.x.com/2/tweets/${parsed.id}`);
    u.searchParams.set('tweet.fields','created_at,public_metrics,author_id,attachments,text');
    u.searchParams.set('expansions','author_id,attachments.media_keys');
    u.searchParams.set('user.fields','name,username,profile_image_url');
    u.searchParams.set('media.fields','url,preview_image_url,type,width,height,alt_text,public_metrics,duration_ms');
    const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}}); const d=await r.json().catch(()=>({}));
    if(!r.ok){
      if(usageError(r.status,d)){
        fallback=await getXPublicFallback(parsed.original);
        const text=fallback.text||'';
        return res.status(200).json({platform:'x',type:'post',url:`https://x.com/i/status/${parsed.id}`,id:parsed.id,
          title:text?text.split('\n')[0].slice(0,120):(embed?.title||'X post'),description:text,text,
          author:fallback.author||embed?.author_name||'',username:fallback.username||'',thumbnail:fallback.thumbnail||'',mediaUrl:fallback.mediaUrl||'',mediaType:fallback.mediaType||'',
          views:null,likes:null,replies:null,reposts:null,metricsUnavailable:true,quotaLimited:true,
          embedHtml:embed?.html||'',embedUrl:`https://x.com/i/status/${parsed.id}`,
          notice:'X API credits/usage are unavailable. Public post text and thumbnail fallback were used.'});
      }
      return res.status(r.status).json({error:d.detail||d.title||d.errors?.[0]?.message||'X API request failed.'});
    }
    const t=d.data||{}, tm=t.public_metrics||{}, author=(d.includes?.users||[])[0]||{}, media=(d.includes?.media||[])[0]||{}, mm=media.public_metrics||{};
    const isVideo=media.type==='video'||media.type==='animated_gif';
    const views=isVideo&&mm.view_count!=null?Number(mm.view_count):null, likes=tm.like_count!=null?Number(tm.like_count):null;
    return res.status(200).json({platform:'x',type:'post',url:`https://x.com/${author.username||'i'}/status/${parsed.id}`,id:parsed.id,
      title:t.text?t.text.split('\n')[0].slice(0,120):'X post',description:t.text||'',text:t.text||'',author:author.name||embed?.author_name||'',username:author.username||'',
      thumbnail:media.preview_image_url||media.url||'',mediaUrl:media.url||'',mediaType:media.type||'',createdAt:t.created_at||null,
      views:Number.isFinite(views)?views:null,viewCount:Number.isFinite(views)?views:null,likes:Number.isFinite(likes)?likes:null,likeCount:Number.isFinite(likes)?likes:null,
      replies:tm.reply_count!=null?Number(tm.reply_count):null,reposts:tm.retweet_count!=null?Number(tm.retweet_count):null,publicMetrics:tm,mediaPublicMetrics:mm,
      metricsUnavailable:false,quotaLimited:false,embedHtml:embed?.html||'',embedUrl:`https://x.com/i/status/${parsed.id}`});
  }catch(e){return res.status(400).json({error:e?.message||'Unable to fetch X data.'});}
}
