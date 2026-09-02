(function(){'use strict';
if(window.__lunaristOAuthBrowserBridge)return;window.__lunaristOAuthBrowserBridge=true;
let running=false,attached=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function client(){return window.supabaseClient||window.lunaristSupabaseClient||window.supabaseClientInstance||null}
async function session(){const sb=client();if(!sb?.auth?.getSession)return null;try{return(await sb.auth.getSession())?.data?.session||null}catch{return null}}
function oauthUrl(){const p=new URLSearchParams(location.search);const u=new URL('/oauth/authorize',location.origin);for(const k of ['client_id','redirect_uri','response_type','scope','code_challenge','code_challenge_method','state']){const v=p.get(k);if(v)u.searchParams.set(k,v)}return u}
async function continueOAuth(){
 if(running)return false;
 const p=new URLSearchParams(location.search);if(p.get('oauth_start')!=='1')return false;
 const s=await session();
 if(!s?.access_token)return false;
 running=true;
 try{
   const r=await fetch('/oauth/session',{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`},credentials:'include',cache:'no-store'});
   if(!r.ok){let d=null;try{d=await r.json()}catch{};throw Error(d?.error_description||d?.error||'Could not start OAuth session.');}
   history.replaceState({},'',location.pathname);
   location.replace(oauthUrl().toString());
   return true;
 }catch(e){running=false;try{window.toast?.(e.message||'Could not start OAuth session.')}catch{};return false}
}
async function boot(){
 for(let i=0;i<80;i++){
   const sb=client();
   if(sb?.auth?.getSession){
     if(!attached){
       attached=true;
       try{sb.auth.onAuthStateChange((event)=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(continueOAuth,0)})}catch{}
     }
     if(await continueOAuth())return;
     // A persisted session can take a moment to hydrate; retry without requiring a new sign-in event.
     await sleep(100);
   }else await sleep(100);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
