// Public Instagram metadata fallback used when Meta oEmbed rejects/does not return metadata.
export async function getInstagramPageMeta(target){
  try{
    const r=await fetch(target,{headers:{'user-agent':'Mozilla/5.0 (compatible; Lunarist/1.0)','accept':'text/html'},redirect:'follow'});
    const html=await r.text();
    const get=(name)=>{
      const esc=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const re=new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${esc}["']`,'i');
      const m=html.match(re); return m?.[1]||m?.[2]||'';
    };
    return {title:get('og:title'),description:get('og:description'),image:get('og:image'),video:get('og:video'),url:get('og:url')||target};
  }catch{return {title:'',description:'',image:'',video:'',url:target};}
}
