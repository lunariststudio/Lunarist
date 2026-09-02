// Lunarist Client Space — Eugene Card connection tab.
// Intentionally isolated from Profile and from the global navigation.
(function(){
  'use strict';
  if(typeof window==='undefined'||window.__lunaristClientEugeneCardTab)return;
  window.__lunaristClientEugeneCardTab=true;

  const TAB='eugene-card';
  const SECTION='client-space-eugene-card';

  function isClient(){
    const m=window.state?.currentMember;
    return !!m&&!m.is_admin&&m.account_type!=='member';
  }
  function session(){
    const sb=window.supabaseClient||window.supabase;
    return sb?.auth?.getSession?.().then(r=>r?.data?.session||null).catch(()=>null);
  }
  async function status(){
    const s=await session();
    if(!s?.access_token)return {connected:false};
    // Prefer the existing connection-status endpoint used by the OAuth UI.
    try{
      const r=await fetch('/api/eugene-connect',{headers:{Authorization:'Bearer '+s.access_token},cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(r.ok)return d;
    }catch(_){ }
    return {connected:false};
  }
  function styles(){
    if(document.getElementById('client-space-eugene-card-css'))return;
    const st=document.createElement('style');st.id='client-space-eugene-card-css';st.textContent=`
      .client-eugene-card{box-sizing:border-box;width:100%;max-width:575px;padding:25px;border:1px solid rgba(155,132,220,.32);border-radius:24px;background:linear-gradient(145deg,rgba(31,27,43,.92),rgba(18,16,27,.96));box-shadow:0 12px 35px rgba(0,0,0,.16)}
      .client-eugene-head{display:flex;align-items:center;gap:17px}.client-eugene-icon{width:57px;height:57px;flex:0 0 57px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#7860ff,#8650e9);color:#fff;font-size:26px;font-weight:900}.client-eugene-title{margin:0;font-size:21px;line-height:1.2;font-weight:800}.client-eugene-status{margin-top:7px;font-size:15px;font-weight:800}.client-eugene-copy{margin:27px 0 17px;color:var(--muted,#a8a0b6);font-size:15px;line-height:1.65}.client-eugene-actions{display:flex;gap:10px;flex-wrap:wrap}.client-eugene-connect,.client-eugene-disconnect{min-height:58px;border-radius:17px;font-size:16px;font-weight:800}.client-eugene-connect{min-width:230px;background:#f6f3fb;color:#15121e;border:0}.client-eugene-disconnect{min-width:130px}
      @media(max-width:600px){.client-eugene-card{padding:20px;border-radius:20px}.client-eugene-connect,.client-eugene-disconnect{width:100%}}
    `;document.head.appendChild(st);
  }
  function shell(){
    const tabs=document.getElementById('clientSpaceTabs');
    if(!tabs)return false;
    let tab=tabs.querySelector('[data-client-tab="'+TAB+'"]');
    if(!tab){
      tab=document.createElement('button');tab.type='button';tab.className='filter';tab.dataset.clientTab=TAB;tab.textContent='Eugene Card';tabs.appendChild(tab);
    }
    let sec=document.getElementById(SECTION);
    if(!sec){
      sec=document.createElement('section');sec.className='client-space-section';sec.id=SECTION;tabs.parentNode?.appendChild(sec);
    }
    if(!sec.dataset.rendered){
      sec.innerHTML=`<div class="client-eugene-card"><div class="client-eugene-head"><div class="client-eugene-icon" aria-hidden="true">✦</div><div><h3 class="client-eugene-title">Eugene Card</h3><div class="client-eugene-status" id="clientEugeneStatus">Not connected</div></div></div><p class="client-eugene-copy" id="clientEugeneCopy">Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.</p><div class="client-eugene-actions"><button class="btn client-eugene-connect" id="clientEugeneConnect" type="button">Connect Eugene Card</button><button class="btn client-eugene-disconnect" id="clientEugeneDisconnect" type="button" style="display:none">Disconnect</button></div></div>`;
      sec.dataset.rendered='1';
    }
    if(!tab.dataset.bound){
      tab.dataset.bound='1';tab.addEventListener('click',()=>{
        tabs.querySelectorAll('[data-client-tab]').forEach(b=>b.classList.toggle('active',b===tab));
        tabs.parentNode.querySelectorAll('.client-space-section').forEach(x=>x.classList.toggle('active',x===sec));
        window.__lunaristClientTab=TAB;
        refresh();
      });
    }
    const connect=document.getElementById('clientEugeneConnect');
    const disconnect=document.getElementById('clientEugeneDisconnect');
    if(connect&&!connect.dataset.bound){
      connect.dataset.bound='1';connect.addEventListener('click',async()=>{
        if(typeof window.startEugeneOAuth==='function'){connect.disabled=true;connect.textContent='Opening Eugene Card…';try{await window.startEugeneOAuth()}catch(e){connect.disabled=false;connect.textContent='Connect Eugene Card';window.toast?.(e?.message||'Unable to start Eugene Card connection.')}}
        else{window.toast?.('Eugene Card connection is not ready yet. Please try again.');}
      });
    }
    if(disconnect&&!disconnect.dataset.bound){
      disconnect.dataset.bound='1';disconnect.addEventListener('click',async()=>{
        if(!confirm('Disconnect Eugene Card from this Lunarist account?'))return;
        const s=await session();if(!s?.access_token)return;
        disconnect.disabled=true;
        try{const r=await fetch('/api/eugene-connect',{method:'POST',headers:{Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'disconnect'}),cache:'no-store'});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Unable to disconnect Eugene Card.');await refresh();window.toast?.('Eugene Card disconnected.');}catch(e){window.toast?.(e.message||'Unable to disconnect Eugene Card.');}finally{disconnect.disabled=false;}
      });
    }
    return true;
  }
  async function refresh(){
    if(!isClient()||!shell())return;
    const st=document.getElementById('clientEugeneStatus'),cp=document.getElementById('clientEugeneCopy'),c=document.getElementById('clientEugeneConnect'),d=document.getElementById('clientEugeneDisconnect');
    if(!st||!cp||!c||!d)return;
    const x=await status(),connected=!!x.connected;
    st.textContent=connected?'Connected':'Not connected';c.textContent=connected?'Connected to Eugene Card':'Connect Eugene Card';c.disabled=connected;d.style.display=connected?'':'none';cp.textContent=connected?'Your Lunarist account is linked to Eugene Card. You can disconnect it here at any time.':'Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.';
  }
  function boot(){styles();refresh();const o=new MutationObserver(()=>{if(location.pathname==='/clients'||window.state?.route==='clients')shell()});o.observe(document.body,{childList:true,subtree:true});setInterval(()=>{if(location.pathname==='/clients'||window.state?.route==='clients')refresh()},2500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
