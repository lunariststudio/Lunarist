(function(){
  'use strict';
  if(window.__lunaristEugeneOAuthUI)return;
  window.__lunaristEugeneOAuthUI=true;

  const LUNARIST='/oauth/authorize';
  const STATUS='/api/eugene-connect';
  const CLIENT_ID='eugene-card';
  const EUGENE_ORIGIN='https://eugene-card-1.vercel.app';

  async function session(){
    const sb=window.supabaseClient||window.supabase;
    try{return(await sb?.auth?.getSession?.())?.data?.session||null}catch{return null}
  }
  async function startOAuth(){
    const s=await session();
    if(!s?.access_token){try{window.toast?.('Please sign in to Lunarist first.')}catch{};return}
    const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
    const verifier=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
    const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const state=crypto.randomUUID();
    sessionStorage.setItem('lunarist_eugene_pkce_verifier',verifier);
    sessionStorage.setItem('lunarist_eugene_oauth_state',state);
    const u=new URL(LUNARIST,location.origin);
    u.searchParams.set('response_type','code');u.searchParams.set('client_id',CLIENT_ID);u.searchParams.set('redirect_uri',`${EUGENE_ORIGIN}/?connect=lunarist`);u.searchParams.set('scope','identity profile offline_access');u.searchParams.set('code_challenge',challenge);u.searchParams.set('code_challenge_method','S256');u.searchParams.set('state',state);
    location.href=u.toString();
  }
  async function refreshStatus(){
    const s=await session();if(!s?.access_token)return'not_connected';
    try{const r=await fetch(STATUS,{headers:{Authorization:`Bearer ${s.access_token}`},cache:'no-store'});if(!r.ok)return'not_connected';const d=await r.json();return d.connected?'connected':'not_connected'}catch{return'not_connected'}
  }
  async function disconnect(){
    const s=await session();if(!s?.access_token)return;
    try{await fetch(STATUS,{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'}})}catch{}
    try{window.dispatchEvent(new CustomEvent('lunarist:eugene-connection-changed',{detail:{connected:false}}))}catch{}
    render('not_connected');
  }
  function statusNodes(){return[...document.querySelectorAll('body *')].filter(el=>{if(el.children.length>2)return false;const t=(el.textContent||'').trim();return t==='Checking connection...'||t==='Connected'||t==='Not connected'})}
  function render(status){const text=status==='connected'?'Connected':'Not connected';statusNodes().forEach(el=>{el.textContent=text;el.dataset.eugeneStatusManaged='oauth'});document.querySelectorAll('[data-eugene-connection-status]').forEach(el=>{el.textContent=text;el.dataset.status=status})}
  function buttonText(el){return(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}
  document.addEventListener('click',e=>{const b=e.target.closest?.('button,a');if(!b)return;const t=buttonText(b);if(t==='connect eugene card'||t==='connect account'||t.includes('connect your eugene card')){e.preventDefault();e.stopImmediatePropagation();startOAuth()}if(t==='disconnect eugene card'||t==='disconnect account'||t.includes('disconnect eugene')){e.preventDefault();e.stopImmediatePropagation();disconnect()}},true);
  let busy=false;async function boot(){const tick=async()=>{if(busy)return;busy=true;try{render(await refreshStatus())}finally{busy=false}};await tick();setInterval(tick,5000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
