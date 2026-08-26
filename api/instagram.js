// Lunarist Instagram fetcher
// Required: INSTAGRAM_ACCESS_TOKEN
// Optional: META_APP_ID / META_APP_SECRET are NOT substitutes for a user/content token.
function clean(v){return String(v||'').trim().replace(/^['"]|['"]$/g,'').replace(/^Bearer\s+/i,'').trim();}
function normalize(raw){
  const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
  const h=u.hostname.toLowerCase().replace(/^www\./,'');
  if(h!=='instagram.com'&&h!=='instagr.am') throw new Error('That does not look like an Instagram URL.');
  if(!/(^|\/)(p|reel|tv)\/[^/]+/i.test(u.pathname)) throw new Error('Use an Instagram post or reel URL.');
  return u.toString();
}
async function request(host,url,token){
  const u=new URL(host);
  u.searchParams.set('access_token',token);
  return fetch(u);
}
export default async function handler(req,res){
  try{
    const raw=req.query?.url||req.body?.url||'';
    const target=normalize(raw);
    const token=clean(process.env.INSTAGRAM_ACCESS_TOKEN);
    if(!token){
      return res.status(400).json({error:'INSTAGRAM_ACCESS_TOKEN is not configured. META_APP_ID/META_APP_SECRET cannot replace an Instagram content-access token.'});
    }

    // oEmbed is the correct fallback for public Instagram URLs when Graph media
    // lookup isn't available to the app/token. It does not expose private data.
    const oe=new URL('https://graph.facebook.com/v24.0/instagram_oembed');
    oe.searchParams.set('url',target);
    oe.searchParams.set('access_token',token);
    let r=await fetch(oe);
    let d=await r.json().catch(()=>({}));

    if(r.ok){
      return res.status(200).json({
        platform:'instagram',url:d.url||target,
        title:d.title||'Instagram post',description:d.title||'',
        author:d.author_name||'',username:d.author_name||'',
        thumbnail:d.thumbnail_url||'',mediaUrl:'',mediaType:''
      });
    }

    // If oEmbed rejects the supplied token, return the actual actionable Meta error.
    return res.status(r.status||400).json({
      error:d.error?.message||'Instagram API request failed.',
      code:d.error?.code||null,
      hint:'Use a valid Instagram/Meta user access token with the required Instagram permissions. META_APP_ID and META_APP_SECRET alone are not a content-access token.'
    });
  }catch(e){return res.status(400).json({error:e?.message||'Unable to fetch Instagram data.'});}
}
