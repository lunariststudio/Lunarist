const ORIGIN='https://lunaristudio.vercel.app';
const EUGENE_ORIGIN='https://eugene-card-1.vercel.app';
const CALLBACK=`${EUGENE_ORIGIN}/?connect=lunarist`;
const EUGENE_RETURN=`${EUGENE_ORIGIN}/?connect=lunarist&oauth_start=1`;
const CLIENT_ID='eugene-card';

function config(){return{url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),key:process.env.SUPABASE_SERVICE_ROLE_KEY||''}}
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
import crypto from 'node:crypto';
async function rest(url,key,path,options={}){const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json',...(options.headers||{})}});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}return{ok:r.ok,status:r.status,data}}
function redirect(res,values){const u=new URL(EUGENE_RETURN);for(const [k,v] of Object.entries(values)){if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))}return res.redirect(302,u.toString())}

// Eugene Card is the OAuth public client. Lunarist provides the OAuth
// authorization/token endpoints. The Start endpoint is only a launcher:
// it sends the user to Eugene Card, where Eugene creates its own PKCE
// verifier/state before starting the authorization request.
export async function callback(req,res){
  const {url,key}=config();
  if(!url||!key)return res.status(503).send('OAuth service is not configured.');
  const q=req.query||{};
  const code=String(q.code||'').trim();
  const state=String(q.state||'').trim();
  const error=String(q.error||'').trim();
  const description=String(q.error_description||'').trim();
  if(error)return redirect(res,{error,error_description:description,state});
  if(!code)return redirect(res,{error:'invalid_request',error_description:'Authorization code is missing.',state});
  const r=await rest(url,key,`oauth_authorization_codes?code_hash=eq.${encodeURIComponent(hash(code))}&client_id=eq.${encodeURIComponent(CLIENT_ID)}&redirect_uri=eq.${encodeURIComponent(CALLBACK)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`);
  if(!r.ok||!Array.isArray(r.data)||!r.data.length)return redirect(res,{error:'invalid_grant',error_description:'Authorization code is invalid or expired.',state});
  return redirect(res,{connect:'lunarist',code,state});
}

export async function start(req,res){
  return res.status(200).json({
    provider:'Lunarist',
    client_id:CLIENT_ID,
    authorization_endpoint:`${ORIGIN}/oauth/authorize`,
    token_endpoint:`${ORIGIN}/oauth/token`,
    userinfo_endpoint:`${ORIGIN}/oauth/userinfo`,
    revocation_endpoint:`${ORIGIN}/oauth/revoke`,
    redirect_uri:CALLBACK,
    scope:'identity profile offline_access',
    pkce:'S256',
    authorization_url:EUGENE_RETURN
  });
}

export async function status(req,res){
  return res.status(200).json({connected:false,managed_by:'Eugene Card',provider:'Lunarist',client_id:CLIENT_ID,message:'Connection state is owned by Eugene Card. Start OAuth from Eugene Card.'});
}

export async function revoke(req,res){
  return res.status(410).json({error:'deprecated_endpoint',error_description:'Revoke the Lunarist connection from Eugene Card using its OAuth token/revoke flow.'});
}

export async function handle(req,res){
  const action=String(req.query?.action||'status');
  if(action==='callback')return callback(req,res);
  if(action==='start')return start(req,res);
  if(action==='revoke')return revoke(req,res);
  return status(req,res);
}

export const constants={ORIGIN,EUGENE_ORIGIN,CLIENT_ID,CALLBACK,EUGENE_RETURN};
