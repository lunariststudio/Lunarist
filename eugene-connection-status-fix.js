// Fixes the Eugene Card connection status UI so it never remains stuck on
// "Checking connection...". The status is derived from the authenticated
// Lunarist user's Supabase profile record.
(function(){
  'use strict';
  if(typeof window==='undefined'||window.__lunaristEugeneStatusFix)return;
  window.__lunaristEugeneStatusFix=true;

  const CONNECTED='Connected';
  const NOT_CONNECTED='Not connected';
  const CHECKING='Checking connection...';
  let status='checking';
  let attempts=0;
  let lastUserId='';

  function normalize(value){
    try{
      const u=new URL(String(value||''));
      return u.protocol==='https:'&&u.origin==='https://eugene-card-1.vercel.app' ? u.href : '';
    }catch{return ''}
  }

  function statusNodes(){
    const all=[...document.querySelectorAll('body *')];
    return all.filter(el=>{
      if(el.children.length>2)return false;
      const t=(el.textContent||'').trim();
      return t===CHECKING || t===CONNECTED || t===NOT_CONNECTED;
    });
  }

  function render(){
    const text=status==='connected'?CONNECTED:status==='not_connected'?NOT_CONNECTED:CHECKING;
    statusNodes().forEach(el=>{
      if((el.textContent||'').trim()!==CHECKING && el.dataset.eugeneStatusManaged!=='1')return;
      el.dataset.eugeneStatusManaged='1';
      el.textContent=text;
      el.setAttribute('aria-label',`Eugene Card: ${text}`);
      const dot=el.querySelector?.('span');
      if(dot)dot.textContent='●';
    });
    document.querySelectorAll('[data-eugene-connection-status]').forEach(el=>{
      el.textContent=text;
      el.dataset.status=status;
    });
  }

  async function check(){
    const sb=window.supabaseClient||window.supabase;
    const user=window.state?.currentUser;
    if(!sb||!user){
      attempts++;
      if(attempts>=10){status='not_connected';render();return true;}
      return false;
    }
    if(lastUserId===user.id&&status!=='checking')return true;
    lastUserId=user.id;
    try{
      const result=await sb.from('profiles').select('eugene_card_url').eq('id',user.id).maybeSingle();
      if(result.error)throw result.error;
      status=normalize(result.data?.eugene_card_url)?'connected':'not_connected';
    }catch(e){
      // A failed status check must not leave the UI spinning forever.
      status='not_connected';
    }
    render();
    return true;
  }

  window.addEventListener('lunarist:eugene-connection-changed',e=>{
    status=e?.detail?.connected?'connected':'not_connected';
    lastUserId='';
    render();
    check();
  });

  const observer=new MutationObserver(()=>render());
  function start(){
    render();
    observer.observe(document.body,{childList:true,subtree:true});
    const timer=setInterval(async()=>{
      render();
      if(await check()){
        if(status!=='checking')clearInterval(timer);
      }
    },700);
    setTimeout(()=>{if(status==='checking'){status='not_connected';render();clearInterval(timer)}},8000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
