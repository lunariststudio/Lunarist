import crypto from 'node:crypto';
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const sbHeaders=key=>({apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'});
const jsonHeaders=key=>({...sbHeaders(key),'Content-Type':'application/json'});
function config(){return{url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),key:process.env.SUPABASE_SERVICE_ROLE_KEY||''}}
async function rest(url,key,path,options={}){const r=await fetch(`${url}/rest/v1/${path}`,{headers:{...sbHeaders(key),...(options.headers||{})},...options});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}return{ok:r.ok,status:r.status,data}}
async function user(url,key,req){const a=String(req.headers.authorization||'');const t=a.startsWith('Bearer ')?a.slice(7):'';if(!t)return null;const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${t}`}});if(!r.ok)return null;return r.json().catch(()=>null)}
async function admin(url,key,req){const u=await user(url,key,req);if(!u?.id)return false;const r=await rest(url,key,`profiles?id=eq.${encodeURIComponent(u.id)}&select=id,is_admin,role&limit=1`);const p=r.ok&&Array.isArray(r.data)?r.data[0]:null;return !!p&&(p.is_admin===true||String(p.role||'').toLowerCase()==='administrator')}
export async function handleOAuthAdmin(req,res){
  const {url,key}=config();
  if(!url||!key)return res.status(503).json({error:'Server credentials are not configured.'});
  if(!(await admin(url,key,req)))return res.status(403).json({error:'Administrator access required.'});
  const action=String(req.query?.admin_action||req.query?.action||'list-clients');
  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  try{
    if(action==='list-clients'){
      const r=await rest(url,key,'oauth_clients?select=id,client_id,name,client_type,redirect_uris,allowed_scopes,active,created_at,updated_at&order=created_at.desc');
      return res.status(r.status).json(r.data||[]);
    }
    if(action==='create-client'){
      const name=String(body.name||'').trim().slice(0,100);
      const redirectUris=Array.isArray(body.redirect_uris)?body.redirect_uris.map(x=>String(x).trim()).filter(Boolean).slice(0,20):[];
      const scopes=[...new Set((Array.isArray(body.allowed_scopes)?body.allowed_scopes:['identity','profile']).map(x=>String(x)).filter(x=>['identity','profile','offline_access'].includes(x)))];
      if(!name||!redirectUris.length)return res.status(400).json({error:'Application name and at least one HTTPS redirect URI are required.'});
      if(redirectUris.some(u=>{try{const x=new URL(u);return x.protocol!=='https:'}catch{return true}}))return res.status(400).json({error:'Redirect URIs must use HTTPS.'});
      const clientId=`lun_${crypto.randomBytes(10).toString('base64url')}`;
      const r=await rest(url,key,'oauth_clients',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({client_id:clientId,name,client_type:'public',redirect_uris:redirectUris,allowed_scopes:scopes,active:true,created_by:(await user(url,key,req))?.id})});
      return res.status(r.status).json(Array.isArray(r.data)?r.data[0]:r.data);
    }
    if(action==='toggle-client'){
      const clientId=String(body.client_id||'').trim();
      if(!clientId)return res.status(400).json({error:'Client ID is required.'});
      const active=body.active===true||body.active==='true';
      const r=await rest(url,key,`oauth_clients?client_id=eq.${encodeURIComponent(clientId)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active,updated_at:new Date().toISOString()})});
      return res.status(r.status).json({ok:r.ok});
    }
    if(action==='revoke-client'){
      const clientId=String(body.client_id||'').trim();
      if(!clientId)return res.status(400).json({error:'Client ID is required.'});
      const r=await rest(url,key,`oauth_tokens?client_id=eq.${encodeURIComponent(clientId)}&revoked_at=is.null`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({revoked_at:new Date().toISOString()})});
      return res.status(r.status).json({ok:r.ok});
    }
    if(action==='delete-client'){
      const clientId=String(body.client_id||'').trim();
      if(!clientId)return res.status(400).json({error:'Client ID is required.'});
      const existing=await rest(url,key,`oauth_clients?client_id=eq.${encodeURIComponent(clientId)}&select=id,client_id&limit=1`);
      if(!existing.ok)return res.status(existing.status).json(existing.data||{error:'Unable to look up application.'});
      if(!Array.isArray(existing.data)||!existing.data[0])return res.status(404).json({error:'OAuth application not found.'});
      // Explicitly clean up dependent records first so deletion also works when FK cascades are absent.
      await rest(url,key,`oauth_authorization_codes?client_id=eq.${encodeURIComponent(clientId)}`,{method:'DELETE'});
      await rest(url,key,`oauth_tokens?client_id=eq.${encodeURIComponent(clientId)}`,{method:'DELETE'});
      const r=await rest(url,key,`oauth_clients?client_id=eq.${encodeURIComponent(clientId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
      if(!r.ok)return res.status(r.status).json(r.data||{error:'Unable to delete OAuth application.'});
      return res.status(200).json({ok:true,client_id:clientId});
    }
    if(action==='update-client'){
      const clientId=String(body.client_id||'').trim();
      if(!clientId)return res.status(400).json({error:'Client ID is required.'});
      const patch={};
      if(body.name)patch.name=String(body.name).trim().slice(0,100);
      if(Array.isArray(body.redirect_uris))patch.redirect_uris=body.redirect_uris.map(x=>String(x).trim()).filter(Boolean).slice(0,20);
      if(Array.isArray(body.allowed_scopes))patch.allowed_scopes=[...new Set(body.allowed_scopes.map(x=>String(x)).filter(x=>['identity','profile','offline_access'].includes(x)))];
      patch.updated_at=new Date().toISOString();
      const r=await rest(url,key,`oauth_clients?client_id=eq.${encodeURIComponent(clientId)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
      return res.status(r.status).json({ok:r.ok});
    }
    // Existing grants actions remain supported.
    if(action==='grants'){
      const r=await rest(url,key,'oauth_tokens?select=id,client_id,lunarist_user_id,scope,access_expires_at,refresh_expires_at,revoked_at,last_used_at,created_at&order=created_at.desc&limit=200');
      const rows=Array.isArray(r.data)?r.data:[];
      const ids=[...new Set(rows.map(x=>x.lunarist_user_id).filter(Boolean))];
      const profiles=ids.length?(await rest(url,key,`profiles?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,username,display_name`)).data||[]:[];
      const map=new Map(profiles.map(p=>[p.id,p]));
      return res.status(r.status).json(rows.map(x=>({...x,profile:map.get(x.lunarist_user_id)||null,active:!x.revoked_at&&new Date(x.access_expires_at)>new Date()})));
    }
    if(action==='revoke'){
      const id=String(body.id||'');
      if(!id)return res.status(400).json({error:'Grant id is required.'});
      const r=await rest(url,key,`oauth_tokens?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({revoked_at:new Date().toISOString()})});
      return res.status(r.status).json({ok:r.ok});
    }
    if(action==='revoke-user'){
      const clientId=String(body.client_id||''),uid=String(body.lunarist_user_id||'');
      if(!clientId||!uid)return res.status(400).json({error:'Client and user are required.'});
      const r=await rest(url,key,`oauth_tokens?client_id=eq.${encodeURIComponent(clientId)}&lunarist_user_id=eq.${encodeURIComponent(uid)}&revoked_at=is.null`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({revoked_at:new Date().toISOString()})});
      return res.status(r.status).json({ok:r.ok});
    }
    return res.status(400).json({error:'Unknown admin action.'});
  }catch(e){console.error(e);return res.status(500).json({error:'OAuth admin request failed.'});}
}
