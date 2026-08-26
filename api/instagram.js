// Lunarist Instagram fetcher
// Vercel env: INSTAGRAM_ACCESS_TOKEN
// META_APP_ID / META_APP_SECRET are app credentials and do not replace a
// valid Instagram content/user access token.
function clean(v){return String(v||'').trim().replace(/^['"]|['"]$/g,'').replace(/^Bearer\s+/i,'').trim();}
function normalize(raw){
  const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
  const h=u.hostname.toLowerCase().replace(/^www\./,'');
  if(h!=='instagram.com'&&h!=='instagr.am') throw new Error('That does not look like an Instagram URL.');
  if(!/(^|\/)(p|reel|tv)\/[^/]+/i.test(u.pathname)) throw new Error('Use an Instagram post or reel URL.');
  return u.toString();
}
function metaError(d){
  const e=d?.error||{};
  return {message:e.message||'Instagram API request failed.',code:e.code??null,type:e.type??null};
}
export default async function handler(req,res){
  try{
    const raw=req.query?.url||req.body?.url||'';
    const target=normalize(raw);
    const token=clean(process.env.INSTAGRAM_ACCESS_TOKEN);
    if(!token){
      return res.status(400).json({
        error:'INSTAGRAM_ACCESS_TOKEN is missing.',
        hint:'META_APP_ID and META_APP_SECRET are not substitutes for an Instagram user/content access token.'
      });
    }

    // Meta's oEmbed endpoint is intended for embedding public Instagram media.
    const u=new URL('https://graph.facebook.com/v24.0/instagram_oembed');
    u.searchParams.set('url',target);
    u.searchParams.set('access_token',token);
    const r=await fetch(u);
    const d=await r.json().catch(()=>({}));

    if(r.ok){
      return res.status(200).json({
        platform:'instagram', type:'post', url:d.url||target,
        title:d.title||'Instagram post', description:d.title||'',
        author:d.author_name||'', username:d.author_name||'',
        thumbnail:d.thumbnail_url||'', mediaUrl:'',
        mediaType:'', views:null, likes:null, metricsUnavailable:true,
        embedHtml:d.html||'', provider:'instagram-oembed'
      });
    }

    const e=metaError(d);
    const tokenProblem=Number(e.code)===190 || /oauth|access token|token/i.test(e.message);
    return res.status(200).json({
      platform:'instagram', type:'post', url:target,
      title:'Instagram post', description:'',
      author:'', username:'', thumbnail:'',
      mediaUrl:'', mediaType:'',
      views:null, likes:null, metricsUnavailable:true,
      fetchFailed:true, authError:tokenProblem,
      error:e.message, code:e.code, errorType:e.type,
      hint:tokenProblem
        ? 'Meta rejected INSTAGRAM_ACCESS_TOKEN. Generate a valid Instagram/Meta user/content access token with the permissions required by your Instagram API product. META_APP_ID/META_APP_SECRET alone cannot replace it.'
        : 'Meta rejected the Instagram request.'
    });
  }catch(e){return res.status(400).json({error:e?.message||'Unable to fetch Instagram data.'});}
}
