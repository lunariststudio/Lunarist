// Fallback metadata helper for public X posts when the paid X API is unavailable.
// Uses X's public syndication endpoint for post text/media preview metadata.
function parseId(raw){
  const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
  const m=u.pathname.match(/\/(?:[^/]+)\/status\/(\d+)/i);
  if(!m) throw new Error('Invalid X post URL.');
  return m[1];
}
export async function getXPublicFallback(raw){
  try{
    const id=parseId(raw);
    const u=new URL('https://cdn.syndication.twimg.com/tweet-result');
    u.searchParams.set('id',id);
    u.searchParams.set('lang','en');
    const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0 Lunarist/1.0'}});
    if(!r.ok)return {};
    const d=await r.json().catch(()=>({}));
    const media=Array.isArray(d.mediaDetails)?d.mediaDetails[0]:null;
    return {
      text:d.text||d.full_text||'',
      author:d.user?.name||'',
      username:d.user?.screen_name||'',
      thumbnail:media?.media_url_https||media?.media_url||media?.video_info?.variants?.[0]?.url||'',
      mediaUrl:media?.media_url_https||media?.media_url||'',
      mediaType:media?.type||''
    };
  }catch{return {};}
}
