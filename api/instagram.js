// Lunarist Instagram fetcher
// Public embed fallback + optional Graph media lookup.
// Vercel env: INSTAGRAM_ACCESS_TOKEN
// Optional: META_APP_ID / META_APP_SECRET
import { getInstagramPageMeta } from './instagram-meta-fallback.js';
function clean(v){return String(v||'').trim().replace(/^['"]|['"]$/g,'').replace(/^Bearer\s+/i,'').trim();}
function normalize(raw){const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);const h=u.hostname.toLowerCase().replace(/^www\./,'');if(h!=='instagram.com'&&h!=='instagr.am')throw new Error('That does not look like an Instagram URL.');if(!/(^|\/)(p|reel|tv)\/[^/]+/i.test(u.pathname))throw new Error('Use an Instagram post, reel, or video URL.');return u.toString();}
function appToken(){const id=clean(process.env.META_APP_ID),secret=clean(process.env.META_APP_SECRET);return id&&secret?`${id}|${secret}`:'';}
function metaToken(){return clean(process.env.INSTAGRAM_ACCESS_TOKEN)||appToken();}
function metaUrl(url,token){const u=new URL(url);if(token)u.searchParams.set('access_token',token);return u;}
async function oembed(target,token){let u=metaUrl('https://graph.facebook.com/v25.0/instagram_oembed',token);u.searchParams.set('url',target);u.searchParams.set('maxwidth','658');u.searchParams.set('omitscript','true');let r=await fetch(u),d=await r.json().catch(()=>({}));if(!r.ok&&token){u=metaUrl('https://graph.facebook.com/v25.0/instagram_oembed','');u.searchParams.set('url',target);u.searchParams.set('maxwidth','658');u.searchParams.set('omitscript','true');r=await fetch(u);d=await r.json().catch(()=>({}));}return{r,d};}
export default async function handler(req,res){try{
  const raw=req.query?.url||req.body?.url||''; const target=normalize(raw); const token=metaToken();
  const {r,d}=await oembed(target,token); const pm=await getInstagramPageMeta(target);
  if(!r.ok){
    const e=d?.error||{}; const description=pm.description||pm.title||'';
    return res.status(200).json({platform:'instagram',type:'post',url:pm.url||target,title:pm.title||'Instagram post',description,caption:description,author:'',username:'',thumbnail:pm.image||'',mediaUrl:pm.video||'',mediaType:/\/reel\//i.test(target)||/\/tv\//i.test(target)?'video':'image',views:null,likes:null,metricsUnavailable:true,fetchFailed:true,authError:Number(e.code)===190,error:e.message||'Instagram embed request failed.',code:e.code||null,embedHtml:'',embedUrl:target});
  }
  const title=d.title||pm.title||'Instagram post'; const description=d.description||d.title||pm.description||''; const thumb=d.thumbnail_url||pm.image||''; const mediaType=/\/reel\//i.test(target)||/\/tv\//i.test(target)?'video':'image';
  let media=null; const mediaId=d.media_id||d.id||'';
  if(mediaId&&clean(process.env.INSTAGRAM_ACCESS_TOKEN)){try{const fields='id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,view_count';const u=metaUrl(`https://graph.facebook.com/v25.0/${encodeURIComponent(mediaId)}`,clean(process.env.INSTAGRAM_ACCESS_TOKEN));u.searchParams.set('fields',fields);const mr=await fetch(u),md=await mr.json().catch(()=>({}));if(mr.ok)media=md;}catch{}}
  return res.status(200).json({platform:'instagram',type:media?.media_type||mediaType,url:media?.permalink||pm.url||target,title:media?.caption?media.caption.split('\n')[0].slice(0,120):title,description:media?.caption||description,caption:media?.caption||description,author:d.author_name||'',username:d.author_name||'',thumbnail:media?.thumbnail_url||media?.media_url||thumb,mediaUrl:media?.media_url||pm.video||'',mediaType:media?.media_type||mediaType,views:media?.view_count!=null?Number(media.view_count):null,viewCount:media?.view_count!=null?Number(media.view_count):null,likes:media?.like_count!=null?Number(media.like_count):null,likeCount:media?.like_count!=null?Number(media.like_count):null,comments:media?.comments_count!=null?Number(media.comments_count):null,embedHtml:d.html||'',embedUrl:target,metricsUnavailable:!media,provider:'instagram-oembed'});
}catch(e){return res.status(400).json({error:e?.message||'Unable to fetch Instagram data.'});}}
