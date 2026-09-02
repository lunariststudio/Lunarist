(function(){
  'use strict';
  if(window.__lunaristEugeneOAuthUI)return;
  window.__lunaristEugeneOAuthUI=true;

  const API='/api/eugene-card';
  const EUGENE='https://eugene-card-1.vercel.app';
  const REDIRECT=`${EUGENE}/?connect=lunarist`;
  let observer=null;
  let starting=false;

  async function session(){
    const sb=window.supabaseClient||window.supabase;
    try{return (await sb?.auth?.getSession?.())?.data?.session||null}catch{return null}
  }

  async function startOAuth(){
    if(starting)return;
    starting=true;
    const buttons=[...document.querySelectorAll('#eugeneConnectBtn')];
    buttons.forEach(b=>{b.disabled=true;b.textContent='Opening Eugene Card…'});
    try{
      const s=await session();
      if(!s?.access_token){
        window.toast?.('Please sign in to Lunarist first.');
        return;
      }

      // Establish the short-lived server-side authorization session first.
      // The browser never receives a client secret or service-role credential.
      const r=await fetch(`${API}/session`,{
        method:'POST',
        headers:{Authorization:`Bearer ${s.access_token}`},
        credentials:'include',
        cache:'no-store'
      });
      if(!r.ok){
        const d=await r.json().catch(()=>({}));
        throw new Error(d.error||'Could not start the Eugene Card connection.');
      }

      const u=new URL(`${API}/authorize`,location.origin);
      u.searchParams.set('client_id','eugene-card');
      u.searchParams.set('redirect_uri',REDIRECT);
      u.searchParams.set('response_type','code');
      u.searchParams.set('scope','identity profile offline_access');
      u.searchParams.set('code_challenge_method','S256');
      // The provider-side bridge creates the PKCE verifier/challenge for the
      // Eugene client session; state still protects the browser redirect.
      u.searchParams.set('state',crypto.randomUUID());
      location.href=u.toString();
    }catch(e){
      window.toast?.(e.message||'Could not start the Eugene Card connection.');
    }finally{
      starting=false;
    }
  }

  async function handleAuthorizeBridge(){
    const p=new URLSearchParams(location.search);
    if(p.get('eugene_authorize')!=='1'||window.__eugeneBridgeHandled)return;
    window.__eugeneBridgeHandled=true;
    try{
      const s=await session();
      if(!s?.access_token){window.toast?.('Please sign in to Lunarist first.');return;}
      const r=await fetch(`${API}/session`,{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`},credentials:'include',cache:'no-store'});
      if(!r.ok)throw new Error('Could not authorize Eugene Card.');
      const u=new URL(`${API}/authorize`,location.origin);
      u.searchParams.set('client_id',p.get('client_id')||'eugene-card');
      u.searchParams.set('redirect_uri',p.get('redirect_uri')||REDIRECT);
      u.searchParams.set('response_type','code');
      u.searchParams.set('scope',p.get('scope')||'identity profile offline_access');
      u.searchParams.set('code_challenge_method','S256');
      if(p.get('code_challenge'))u.searchParams.set('code_challenge',p.get('code_challenge'));
      if(p.get('state'))u.searchParams.set('state',p.get('state'));
      history.replaceState({},'',location.pathname);
      location.href=u.toString();
    }catch(e){window.toast?.(e.message||'Could not authorize Eugene Card.');}
  }

  async function refreshStatus(){
    const s=await session();
    if(!s?.access_token)return {connected:false};
    try{
      const r=await fetch('/api/eugene-connect',{headers:{Authorization:`Bearer ${s.access_token}`},credentials:'include',cache:'no-store'});
      if(!r.ok)return {connected:false};
      const d=await r.json();
      return {connected:!!d.connected,data:d};
    }catch{return {connected:false};}
  }

  function findStatus(){
    const explicit=document.querySelector('[data-eugene-connection-status]');
    if(explicit)return (explicit.textContent||'').trim();
    const el=document.getElementById('eugeneConnectStatus');
    return (el?.textContent||'').trim();
  }

  function syncButtonWithStatus(){
    const card=document.getElementById('eugeneConnectCard');
    const btn=document.getElementById('eugeneConnectBtn');
    if(!card||!btn)return;
    const status=findStatus().toLowerCase();
    if(status.includes('not connected')||status.includes('unable to check')){
      // profile-sync.js used to leave the button disabled with the old
      // "Connected to Eugene Card" label after a status refresh. Never allow
      // that contradictory state: a disconnected account must be connectable.
      btn.disabled=false;
      btn.textContent='Connect Eugene Card';
      btn.removeAttribute('aria-disabled');
    }
  }

  function bindConnectButton(){
    const btn=document.getElementById('eugeneConnectBtn');
    if(!btn)return;
    if(btn.dataset.oauthBound==='1')return;
    btn.dataset.oauthBound='1';
    // Capture phase guarantees this integration wins over the legacy
    // profile-sync click handler, which only opens Eugene Card directly.
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      startOAuth();
    },true);
    btn.title='Connect Eugene Card with Lunarist OAuth';
  }

  async function tick(){
    bindConnectButton();
    syncButtonWithStatus();
    const card=document.getElementById('eugeneConnectCard');
    if(!card)return;
    const result=await refreshStatus();
    const statusEl=document.getElementById('eugeneConnectStatus');
    const btn=document.getElementById('eugeneConnectBtn');
    const disconnect=document.getElementById('eugeneDisconnectBtn');
    const copy=document.getElementById('eugeneConnectCopy');
    const email=document.getElementById('eugeneConnectEmail');
    if(statusEl)statusEl.textContent=result.connected?'Connected':'Not connected';
    if(result.connected){
      card.classList.add('connected');
      if(btn){btn.disabled=true;btn.textContent='Connected to Eugene Card';}
      if(disconnect)disconnect.style.display='';
      if(copy)copy.textContent='Your Lunarist account is linked to Eugene Card. You can disconnect it here at any time.';
      if(email)email.textContent=result.data?.connection?.eugene_email||'';
    }else{
      card.classList.remove('connected');
      if(btn){btn.disabled=false;btn.textContent='Connect Eugene Card';}
      if(disconnect)disconnect.style.display='none';
      if(copy)copy.textContent='Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.';
      if(email)email.textContent='';
    }
  }

  function boot(){
    handleAuthorizeBridge();
    observer=new MutationObserver(()=>{bindConnectButton();syncButtonWithStatus();});
    observer.observe(document.body,{childList:true,subtree:true});
    tick();
    setInterval(tick,3000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
