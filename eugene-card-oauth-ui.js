(function(){
  'use strict';
  if(window.__lunaristEugeneOAuthUI)return;
  window.__lunaristEugeneOAuthUI=true;

  // Eugene Card is the OAuth client. Starting OAuth must be a direct browser
  // navigation from the user's click; fetching an URL first can be blocked by
  // popup/navigation timing and was the cause of the "Unable to start..." toast.
  const EUGENE_START='https://eugene-card-1.vercel.app/?connect=lunarist&oauth_start=1';
  const STATUS='/api/eugene-card/status';

  async function session(){
    const sb=window.supabaseClient||window.supabase;
    try{return(await sb?.auth?.getSession?.())?.data?.session||null}catch{return null}
  }

  function startOAuth(){
    // Do not await a fetch before navigation. The click itself owns the
    // navigation, so browser popup blockers cannot turn a successful OAuth
    // start into a false "Unable to start" error.
    window.location.assign(EUGENE_START);
  }

  async function refreshStatus(){
    const s=await session();
    if(!s?.access_token)return'not_connected';
    try{
      const r=await fetch(STATUS,{headers:{Authorization:`Bearer ${s.access_token}`},cache:'no-store'});
      if(!r.ok)return'not_connected';
      const d=await r.json();
      return d.connected?'connected':'not_connected';
    }catch{return'not_connected'}
  }

  async function disconnect(){
    const s=await session();
    if(!s?.access_token)return;
    try{await fetch('/api/eugene-card/revoke',{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'}})}catch{}
    try{window.dispatchEvent(new CustomEvent('lunarist:eugene-connection-changed',{detail:{connected:false}}))}catch{}
    render('not_connected');
  }

  function statusNodes(){return[...document.querySelectorAll('body *')].filter(el=>{if(el.children.length>2)return false;const t=(el.textContent||'').trim();return t==='Checking connection...'||t==='Connected'||t==='Not connected'})}
  function render(status){
    const text=status==='connected'?'Connected':'Not connected';
    statusNodes().forEach(el=>{el.textContent=text;el.dataset.eugeneStatusManaged='oauth'});
    document.querySelectorAll('[data-eugene-connection-status]').forEach(el=>{el.textContent=text;el.dataset.status=status});
  }
  function buttonText(el){return(el.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()}

  window.startEugeneOAuth=startOAuth;
  window.disconnectEugeneOAuth=disconnect;

  // Capture-phase handler covers dynamically rendered navigation buttons.
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('button,a');
    if(!b)return;
    const t=buttonText(b);
    if(t==='connect eugene card'||t==='connect account'||t.includes('connect your eugene card')){
      e.preventDefault();
      e.stopImmediatePropagation();
      startOAuth();
      return;
    }
    if(t==='disconnect eugene card'||t==='disconnect account'||t.includes('disconnect eugene')){
      e.preventDefault();
      e.stopImmediatePropagation();
      disconnect();
    }
  },true);

  let busy=false;
  async function boot(){
    const p=new URLSearchParams(location.search);
    if(p.get('eugene_connected')==='1'||p.get('eugene_connected')==='0'){
      const clean=new URL(location.href);
      clean.searchParams.delete('eugene_connected');
      history.replaceState({},'',clean.pathname+clean.search+clean.hash);
    }
    const tick=async()=>{
      if(busy)return;
      busy=true;
      try{render(await refreshStatus())}finally{busy=false}
    };
    await tick();
    setInterval(tick,5000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
