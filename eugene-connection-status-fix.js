// Eugene Card OAuth status synchronization.
(function(){
  'use strict';
  if(typeof window==='undefined'||window.__lunaristEugeneStatusFix)return;
  window.__lunaristEugeneStatusFix=true;
  const CHECKING='Checking connection...',CONNECTED='Connected',NOT_CONNECTED='Not connected';let status='checking',running=false;
  function nodes(){return[...document.querySelectorAll('body *')].filter(el=>{if(el.children.length>2)return false;const t=(el.textContent||'').trim();return t===CHECKING||t===CONNECTED||t===NOT_CONNECTED})}
  function render(){const text=status==='connected'?CONNECTED:status==='not_connected'?NOT_CONNECTED:CHECKING;nodes().forEach(el=>{el.textContent=text;el.dataset.eugeneStatusManaged='oauth';el.setAttribute('aria-label',`Eugene Card: ${text}`)});document.querySelectorAll('[data-eugene-connection-status]').forEach(el=>{el.textContent=text;el.dataset.status=status})}
  async function check(){if(running)return;const sb=window.supabaseClient||window.supabase;try{const s=await sb?.auth?.getSession?.();if(!s?.data?.session?.access_token){status='not_connected';render();return}running=true;const r=await fetch('/api/eugene-connect',{headers:{Authorization:`Bearer ${s.data.session.access_token}`},cache:'no-store'});if(!r.ok)throw Error('status request failed');const d=await r.json();status=d.connected?'connected':'not_connected'}catch{status='not_connected'}finally{running=false;render()}}
  window.addEventListener('lunarist:eugene-connection-changed',e=>{status=e?.detail?.connected?'connected':'not_connected';render();check()});
  function start(){render();check();setInterval(check,5000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
