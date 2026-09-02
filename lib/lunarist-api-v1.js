import {handleOAuthAdmin} from './oauth-admin.js';

// Lunarist API v1 adapter. The browser talks only to these stable, first-party
// endpoints; privileged Supabase access remains server-side in oauth-admin.js.
export async function handleLunaristApiV1(req,res){
  const path=String(req.query?.v1_path||'').replace(/\/+$/,'')||'/';
  const parts=path.split('/').filter(Boolean).map(decodeURIComponent);
  if(parts[0]!== 'oauth') return res.status(404).json({error:'Lunarist API v1 route not found.'});

  if(parts[1]==='apps'){
    if(req.method==='GET' && !parts[2]){req.query={...(req.query||{}),admin_action:'list-clients'};return handleOAuthAdmin(req,res)}
    if(req.method==='POST' && !parts[2]){req.query={...(req.query||{}),admin_action:'create-client'};return handleOAuthAdmin(req,res)}
    if(parts[2]){
      const clientId=parts[2];
      if(parts[3]==='status' && req.method==='PATCH'){req.body={...(typeof req.body==='object'?req.body:{}),action:'toggle-client',client_id:clientId};req.query={...(req.query||{}),admin_action:'toggle-client'};return handleOAuthAdmin(req,res)}
      if(parts[3]==='tokens' && req.method==='DELETE'){req.body={...(typeof req.body==='object'?req.body:{}),action:'revoke-client',client_id:clientId};req.query={...(req.query||{}),admin_action:'revoke-client'};return handleOAuthAdmin(req,res)}
      if(req.method==='DELETE' && !parts[3]){req.body={...(typeof req.body==='object'?req.body:{}),action:'delete-client',client_id:clientId};req.query={...(req.query||{}),admin_action:'delete-client'};return handleOAuthAdmin(req,res)}
      if(req.method==='PATCH' && !parts[3]){req.body={...(typeof req.body==='object'?req.body:{}),action:'update-client',client_id:clientId};req.query={...(req.query||{}),admin_action:'update-client'};return handleOAuthAdmin(req,res)}
    }
  }

  if(parts[1]==='grants'){
    if(req.method==='GET' && !parts[2]){req.query={...(req.query||{}),admin_action:'grants'};return handleOAuthAdmin(req,res)}
    if(parts[2] && req.method==='DELETE'){req.body={...(typeof req.body==='object'?req.body:{}),action:'revoke',id:parts[2]};req.query={...(req.query||{}),admin_action:'revoke'};return handleOAuthAdmin(req,res)}
  }

  return res.status(404).json({error:'Lunarist API v1 route not found.'});
}
