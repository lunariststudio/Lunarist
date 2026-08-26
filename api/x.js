// Lunarist X fetcher + project metric sync.
// Vercel env: X_BEARER_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
function clean(v){return String(v||'').trim().replace(/^['"]|['"]$/g,'').replace(/^Bearer\s+/i,'').trim();}
function parse(raw){
  const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
  const h=u.hostname.toLowerCase().replace(/^www\./,'');
  if(!['x.com','twitter.com','mobile.twitter.com'].includes(h)) throw new Error('That does not look like an X post URL.');
  const m=u.pathname.match(/\/(?:[^/]+)\/status\/(\d+)/i);
  if(!m) throw new Error('That does not look like an X post URL.');
  return {id:m[1],original:u.toString()};
}
function usageError(status,d){
  const s=JSON.stringify(d||{}).toLowerCase();
  return status===429||/usage.?cap|credits?.?deplet|credit.?deplet|quota|billing|spend.?limit|rate.?limit/.test(s);
}
async function oembed(url){
  const u=new URL('https://publish.x.com/oembed');u.searchParams.set('url',url);u.searchParams.set('omit_script','1');
  const r=await fetch(u);const d=await r.json().catch(()=>({}));return r.ok?d:null;
}
function textFromEmbedHtml(html){
  if(!html)return '';
  const m=String(html).match(/<p[^>]*>([\s\S]*?)<\/p>/i);if(!m)return '';
  return m[1].replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'\"').replace(/&#39;/g,"'").replace(/&mdash;/g,'—').replace(/&nbsp;/g,' ').trim();
}
async function syncProject(projectId,xId,likes,views){
  const base=clean(process.env.SUPABASE_URL),key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if(!base||!key||!projectId||!xId)return false;
  const headers={apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'};
  const lookup=await fetch(`${base}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=id,media_url`,{headers});
  if(!lookup.ok)return false;
  const rows=await lookup.json().catch(()=>[]);const row=rows?.[0];
  if(!row||!parseIdFromAny(row.media_url,xId))return false;
  const patch={};
  if(Number.isFinite(Number(likes)))patch.likes=Math.max(0,Math.floor(Number(likes)));
  if(Number.isFinite(Number(views)))patch.views=Math.max(0,Math.floor(Number(views)));
  if(!Object.keys(patch).length)return false;
  const r=await fetch(`${base}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(patch)});
  return r.ok;
}
function parseIdFromAny(url,xId){
  try{return parse(url).id===String(xId);}catch{return false;}
}

export default async function handler(req,res){
  try{
    if(req.method==='POST'){
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      const ok=await syncProject(String(body.projectId||''),String(body.xId||''),body.likes,body.views);
      return res.status(ok?200:400).json({ok});
    }

    const parsed=parse(req.query?.url||req.body?.url||'');
    const token=clean(process.env.X_BEARER_TOKEN);
    let embed=null;try{embed=await oembed(`https://x.com/i/status/${parsed.id}`);}catch{}

    if(!token){
      const fallbackText=textFromEmbedHtml(embed?.html);
      return res.status(200).json({platform:'x',type:'post',url:`https://x.com/i/status/${parsed.id}`,id:parsed.id,title:fallbackText?fallbackText.split('\n')[0].slice(0,120):(embed?.title||'X post'),description:fallbackText,text:fallbackText,author:embed?.author_name||'',username:'',thumbnail:'',mediaUrl:'',mediaType:'',views:null,likes:null,replies:null,reposts:null,metricsUnavailable:true,quotaLimited:false,embedHtml:embed?.html||'',embedUrl:`https://x.com/i/status/${parsed.id}`});
    }

    const u=new URL(`https://api.x.com/2/tweets/${parsed.id}`);
    u.searchParams.set('tweet.fields','created_at,public_metrics,author_id,attachments,text');
    u.searchParams.set('expansions','author_id,attachments.media_keys');
    u.searchParams.set('user.fields','name,username,profile_image_url');
    u.searchParams.set('media.fields','url,preview_image_url,type,width,height,alt_text,public_metrics,duration_ms,variants');
    const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}});const d=await r.json().catch(()=>({}));

    if(!r.ok){
      if(usageError(r.status,d)){
        const fallbackText=textFromEmbedHtml(embed?.html);
        return res.status(200).json({platform:'x',type:'post',url:`https://x.com/i/status/${parsed.id}`,id:parsed.id,title:fallbackText?fallbackText.split('\n')[0].slice(0,120):(embed?.title||'X post'),description:fallbackText,text:fallbackText,author:embed?.author_name||'',username:'',thumbnail:'',mediaUrl:'',mediaType:'',views:null,likes:null,replies:null,reposts:null,metricsUnavailable:true,quotaLimited:true,embedHtml:embed?.html||'',embedUrl:`https://x.com/i/status/${parsed.id}`,notice:'X API credits/usage are unavailable. The post can still be embedded, but API metrics are unavailable.'});
      }
      return res.status(r.status).json({error:d.detail||d.title||d.errors?.[0]?.message||'X API request failed.'});
    }

    const t=d.data||{},tm=t.public_metrics||{},author=(d.includes?.users||[])[0]||{},media=(d.includes?.media||[])[0]||{},mm=media.public_metrics||{};
    const isVideo=media.type==='video'||media.type==='animated_gif';
    let directVideoUrl='';
    if(isVideo&&Array.isArray(media.variants)){
      const mp4s=media.variants.filter(v=>v.content_type==='video/mp4').sort((a,b)=>(b.bitrate||0)-(a.bitrate||0));
      if(mp4s.length)directVideoUrl=mp4s[0].url;
    }
    const videoViews=isVideo&&mm.view_count!=null?Number(mm.view_count):null;
    const impressions=tm.impression_count!=null?Number(tm.impression_count):null;
    const views=videoViews!=null?videoViews:impressions;
    const likes=tm.like_count!=null?Number(tm.like_count):null;
    const description=t.text||textFromEmbedHtml(embed?.html)||'';
    return res.status(200).json({platform:'x',type:'post',url:`https://x.com/${author.username||'i'}/status/${parsed.id}`,id:parsed.id,title:description?description.split('\n')[0].slice(0,120):'X post',description,text:description,author:author.name||embed?.author_name||'',username:author.username||'',thumbnail:media.preview_image_url||media.url||'',mediaUrl:directVideoUrl||media.url||'',mediaType:directVideoUrl?'video':(media.type||''),createdAt:t.created_at||null,views:Number.isFinite(views)?views:null,viewCount:Number.isFinite(views)?views:null,likes:Number.isFinite(likes)?likes:null,likeCount:Number.isFinite(likes)?likes:null,replies:tm.reply_count!=null?Number(tm.reply_count):null,reposts:tm.retweet_count!=null?Number(tm.retweet_count):null,publicMetrics:tm,mediaPublicMetrics:mm,metricsUnavailable:false,quotaLimited:false,embedHtml:embed?.html||'',embedUrl:`https://x.com/i/status/${parsed.id}`});
  }catch(e){return res.status(400).json({error:e?.message||'Unable to fetch X data.'});}
}
