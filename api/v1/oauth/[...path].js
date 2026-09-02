import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_SCOPES = new Set(['identity','profile','offline_access']);

function config(){
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/,'');
  const key = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return { url, key };
}

function tokenFromRequest(req){
  const h = String(req.headers?.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

function client(req){
  const {url,key}=config();
  if(!url || !key) return null;
  const token=tokenFromRequest(req);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:token?{Authorization:`Bearer ${token}`}:{}}});
}

async function requireAdmin(req){
  const sb=client(req);
  if(!sb) return {error:'Lunarist API is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) on the server.',status:503};
  const token=tokenFromRequest(req);
  if(!token) return {error:'Administrator sign-in is required.',status:401};
  const {data:{user},error:authError}=await sb.auth.getUser(token);
  if(authError || !user?.id) return {error:'Administrator session is invalid or expired.',status:401};
  const {data:profile,error}=await sb.from('profiles').select('id,is_admin,role').eq('id',user.id).maybeSingle();
  if(error) return {error:`Unable to verify administrator access: ${error.message}`,status:500};
  if(!profile || !(profile.is_admin===true || String(profile.role||'').toLowerCase()==='administrator')) return {error:'Administrator access required.',status:403};
  return {sb,user,profile};
}

function pathParts(req){
  let p=req.query?.path;
  if(Array.isArray(p)) return p.map(String);
  if(typeof p==='string') return p.split('/').filter(Boolean).map(decodeURIComponent);
  return [];
}

function sendError(res,status,error,extra={}){return res.status(status).json({error,...extra});}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');
  if(req.method==='OPTIONS') return res.status(204).end();

  const parts=pathParts(req);
  if(parts[0]!=='oauth') return sendError(res,404,'Lunarist API v1 route not found.');
  const auth=await requireAdmin(req);
  if(auth.error) return sendError(res,auth.status,auth.error);
  const {sb,user}=auth;

  try{
    // /oauth/apps
    if(parts[1]==='apps' && !parts[2]){
      if(req.method==='GET'){
        const {data,error}=await sb.from('oauth_clients').select('id,client_id,name,client_type,redirect_uris,allowed_scopes,active,created_at,updated_at').order('created_at',{ascending:false});
        if(error) return sendError(res,500,'Unable to load OAuth applications.',{details:error.message});
        return res.status(200).json(data||[]);
      }
      if(req.method==='POST'){
        const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
        const name=String(body.name||'').trim().slice(0,100);
        const redirectUris=Array.isArray(body.redirect_uris)?body.redirect_uris.map(x=>String(x).trim()).filter(Boolean).slice(0,20):[];
        const scopes=[...new Set((Array.isArray(body.allowed_scopes)?body.allowed_scopes:['identity','profile']).map(String).filter(x=>ALLOWED_SCOPES.has(x)))];
        if(!name || !redirectUris.length) return sendError(res,400,'Application name and at least one HTTPS redirect URI are required.');
        if(redirectUris.some(u=>{try{return new URL(u).protocol!=='https:'}catch{return true}})) return sendError(res,400,'Redirect URIs must use HTTPS.');
        const clientId=`lun_${crypto.randomBytes(10).toString('base64url')}`;
        const {data,error}=await sb.from('oauth_clients').insert({client_id:clientId,name,client_type:'public',redirect_uris:redirectUris,allowed_scopes:scopes,active:true,created_by:user.id}).select('id,client_id,name,client_type,redirect_uris,allowed_scopes,active,created_at,updated_at').single();
        if(error) return sendError(res,500,'Unable to create OAuth application.',{details:error.message});
        return res.status(201).json(data);
      }
      return sendError(res,405,'Method not allowed.');
    }

    if(parts[1]==='apps' && parts[2]){
      const clientId=parts[2];
      if(parts[3]==='status'){
        if(req.method!=='PATCH') return sendError(res,405,'Method not allowed.');
        const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
        const active=body.active===true || body.active==='true';
        const {data,error}=await sb.from('oauth_clients').update({active,updated_at:new Date().toISOString()}).eq('client_id',clientId).select('client_id,active,updated_at').maybeSingle();
        if(error) return sendError(res,500,'Unable to update application status.',{details:error.message});
        if(!data) return sendError(res,404,'OAuth application not found.');
        return res.status(200).json(data);
      }
      if(parts[3]==='tokens'){
        if(req.method!=='DELETE') return sendError(res,405,'Method not allowed.');
        const {error}=await sb.from('oauth_tokens').update({revoked_at:new Date().toISOString()}).eq('client_id',clientId).is('revoked_at',null);
        if(error) return sendError(res,500,'Unable to revoke application tokens.',{details:error.message});
        return res.status(200).json({ok:true,client_id:clientId});
      }
      if(!parts[3] && req.method==='DELETE'){
        await sb.from('oauth_authorization_codes').delete().eq('client_id',clientId);
        await sb.from('oauth_tokens').delete().eq('client_id',clientId);
        const {data,error}=await sb.from('oauth_clients').delete().eq('client_id',clientId).select('client_id').maybeSingle();
        if(error) return sendError(res,500,'Unable to delete OAuth application.',{details:error.message});
        if(!data) return sendError(res,404,'OAuth application not found.');
        return res.status(200).json({ok:true,client_id:clientId});
      }
      if(!parts[3] && req.method==='PATCH'){
        const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
        const patch={updated_at:new Date().toISOString()};
        if(body.name) patch.name=String(body.name).trim().slice(0,100);
        if(Array.isArray(body.redirect_uris)) patch.redirect_uris=body.redirect_uris.map(x=>String(x).trim()).filter(Boolean).slice(0,20);
        if(Array.isArray(body.allowed_scopes)) patch.allowed_scopes=[...new Set(body.allowed_scopes.map(String).filter(x=>ALLOWED_SCOPES.has(x)))];
        const {data,error}=await sb.from('oauth_clients').update(patch).eq('client_id',clientId).select('id,client_id,name,client_type,redirect_uris,allowed_scopes,active,created_at,updated_at').maybeSingle();
        if(error) return sendError(res,500,'Unable to update OAuth application.',{details:error.message});
        if(!data) return sendError(res,404,'OAuth application not found.');
        return res.status(200).json(data);
      }
    }

    if(parts[1]==='grants' && !parts[2]){
      if(req.method!=='GET') return sendError(res,405,'Method not allowed.');
      const {data:rows,error}=await sb.from('oauth_tokens').select('id,client_id,lunarist_user_id,scope,access_expires_at,refresh_expires_at,revoked_at,last_used_at,created_at').order('created_at',{ascending:false}).limit(200);
      if(error) return sendError(res,500,'Unable to load OAuth grants.',{details:error.message});
      const ids=[...new Set((rows||[]).map(x=>x.lunarist_user_id).filter(Boolean))];
      let profiles=[];
      if(ids.length){const r=await sb.from('profiles').select('id,username,display_name').in('id',ids);if(!r.error)profiles=r.data||[];}
      const map=new Map(profiles.map(p=>[p.id,p]));
      return res.status(200).json((rows||[]).map(x=>({...x,profile:map.get(x.lunarist_user_id)||null,active:!x.revoked_at && (!x.access_expires_at || new Date(x.access_expires_at)>new Date())})));
    }
    if(parts[1]==='grants' && parts[2]){
      if(req.method!=='DELETE') return sendError(res,405,'Method not allowed.');
      const {data,error}=await sb.from('oauth_tokens').update({revoked_at:new Date().toISOString()}).eq('id',parts[2]).select('id').maybeSingle();
      if(error) return sendError(res,500,'Unable to revoke OAuth grant.',{details:error.message});
      if(!data) return sendError(res,404,'OAuth grant not found.');
      return res.status(200).json({ok:true,id:parts[2]});
    }

    return sendError(res,404,'Lunarist API v1 route not found.');
  }catch(e){
    console.error('[lunarist-api-v1]',e);
    return sendError(res,500,'Lunarist API request failed.',{details:String(e?.message||e)});
  }
}
