const cfg=()=>({url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),key:process.env.SUPABASE_SERVICE_ROLE_KEY||''});

async function userFromToken(url,key,token){
  if(!token)return null;
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`} });
  if(!r.ok)return null;
  return await r.json();
}
async function rest(url,key,path,options={}){
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(options.headers||{})};
  const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers});
  const text=await r.text();
  let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok){const msg=body?.message||body?.error||body?.hint||text||`Supabase request failed (${r.status})`;throw new Error(msg)}
  return body;
}
async function isAdmin(url,key,userId){
  const rows=await rest(url,key,`profiles?select=id,is_admin&id=eq.${encodeURIComponent(userId)}&limit=1`);
  return !!rows?.[0]?.is_admin;
}
async function rpc(url,key,name,body,token){
  return await rest(url,key,`rpc/${name}`,{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify(body||{})});
}
export default async function handler(req,res){
  const {url,key}=cfg();
  if(!url||!key)return res.status(503).json({error:'Supabase server credentials are not configured.'});
  try{
    const auth=String(req.headers.authorization||'');
    const token=auth.startsWith('Bearer ')?auth.slice(7):'';
    const user=await userFromToken(url,key,token);
    const action=req.method==='GET'?(new URL(req.url,`https://${req.headers.host||'localhost'}`)).searchParams.get('action'):(req.body||{}).action;

    if(action==='reserve'){
      const code=String((req.body||{}).code||'').trim().toUpperCase();
      const email=String((req.body||{}).email||'').trim().toLowerCase();
      const nonce=String((req.body||{}).nonce||'').trim();
      if(!/^[A-Z0-9]{8,32}$/.test(code))return res.status(400).json({error:'Invalid invitation code.'});
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'A valid email is required.'});
      if(!/^[A-Za-z0-9_-]{24,80}$/.test(nonce))return res.status(400).json({error:'Invalid invitation reservation.'});
      const result=await rpc(url,key,'reserve_member_invitation',{p_code:code,p_email:email,p_nonce:nonce});
      return res.status(200).json(result||{success:true});
    }
    if(action==='redeem'){
      if(!user?.id)return res.status(401).json({error:'Sign in is required to redeem an invitation.'});
      const code=String((req.body||{}).code||'').trim();
      const nonce=String((req.body||{}).nonce||'').trim();
      if(!/^[A-Z0-9]{8,32}$/i.test(code))return res.status(400).json({error:'Invalid invitation code.'});
      if(nonce && !/^[A-Za-z0-9_-]{24,80}$/.test(nonce))return res.status(400).json({error:'Invalid invitation reservation.'});
      const result=await rpc(url,key,'redeem_member_invitation',{p_code:code,p_nonce:nonce||null},token);
      return res.status(200).json(result||{success:true});
    }

    if(!user?.id)return res.status(401).json({error:'Authentication required.'});
    if(!(await isAdmin(url,key,user.id)))return res.status(403).json({error:'Administrator access required.'});

    if(action==='create'){
      const days=Math.max(1,Math.min(365,Number((req.body||{}).expires_days||30)));
      const expiresAt=new Date(Date.now()+days*86400000).toISOString();
      const result=await rpc(url,key,'create_member_invitation',{p_expires_at:expiresAt},token);
      return res.status(200).json(result);
    }
    if(action==='list'){
      const rows=await rest(url,key,'member_invitations?select=id,code,created_at,expires_at,used_at,used_by&order=created_at.desc&limit=100');
      return res.status(200).json(rows||[]);
    }
    if(action==='revoke'){
      const id=String((req.body||{}).id||'');
      if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Invalid invitation id.'});
      await rest(url,key,`member_invitations?id=eq.${encodeURIComponent(id)}&used_at=is.null`,{method:'PATCH',body:JSON.stringify({used_at:new Date().toISOString()})});
      return res.status(200).json({success:true});
    }
    return res.status(400).json({error:'Unknown invitation action.'});
  }catch(e){console.error(e);return res.status(400).json({error:e.message||'Invitation request failed.'});}
}
