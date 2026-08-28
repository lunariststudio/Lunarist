// Lunarist Discover X metrics — live likes and views.
(function(){
  if(typeof window==='undefined'||window.__lunaristXDiscoveryMetricsInstalled)return;
  window.__lunaristXDiscoveryMetricsInstalled=true;
  const cache=new Map();
  const TTL=15000;
  const isX=url=>{try{const u=new URL(String(url||''),location.href);const h=u.hostname.toLowerCase().replace(/^www\./,'');return ['x.com','twitter.com','mobile.twitter.com'].includes(h)&&/\/status\/\d+/i.test(u.pathname)}catch{return false}};
  const idOf=url=>{try{const u=new URL(String(url||''),location.href);return u.pathname.match(/\/status\/(\d+)/i)?.[1]||''}catch{return ''}};
  const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString():'—';
  async function metrics(id){
    const hit=cache.get(id); if(hit&&Date.now()-hit.ts<TTL)return hit.data;
    try{const r=await fetch(`/api/x?url=${encodeURIComponent(`https://x.com/i/status/${id}`)}&t=${Date.now()}`,{cache:'no-store'});const d=await r.json().catch(()=>null);if(!r.ok||!d||d.platform!=='x')return null;cache.set(id,{data:d,ts:Date.now()});return d}catch{return null}
  }
  async function sync(){
    const projects=Array.isArray(window.data?.projects)?window.data.projects:[]; if(!projects.length)return;
    const cards=[...document.querySelectorAll('[data-project]')];
    await Promise.all(cards.map(async card=>{
      const p=projects.find(x=>String(x.id)===String(card.getAttribute('data-project'))); if(!p)return;
      const url=p.media_url||p.mediaUrl||p.url||''; if(!isX(url))return;
      const id=idOf(url); if(!id)return;
      const d=await metrics(id); if(!d)return;
      const meta=card.querySelector('.meta.artist span')||card.querySelector('.meta span'); if(!meta)return;
      const name=(meta.dataset.xDiscoveryName)||(meta.textContent||'').split('·')[0].trim(); meta.dataset.xDiscoveryName=name;
      const parts=[]; if(d.likes!=null)parts.push(`${fmt(d.likes)} likes`); const engagement=[d.likes,d.replies,d.reposts,d.quotes].map(Number); if(engagement.every(Number.isFinite))parts.push(`${fmt(engagement.reduce((a,v)=>a+v,0))} engagements`);
      if(parts.length)meta.textContent=name+' · '+parts.join(' · ');
    }));
  }
  const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(sync,150)});
  const start=()=>{if(document.body)obs.observe(document.body,{childList:true,subtree:true});sync();setTimeout(sync,500);setTimeout(sync,1500)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
