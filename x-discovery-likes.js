// Discovery cards: X posts use likes as the primary social metric because X view counts
// are not reliably available when the API quota is exhausted.
(function(){
  if(typeof window==='undefined'||window.__lunaristXDiscoveryLikesInstalled)return;
  window.__lunaristXDiscoveryLikesInstalled=true;
  const isX=url=>{try{const u=new URL(String(url||''),location.href);const h=u.hostname.toLowerCase().replace(/^www\./,'');return (h==='x.com'||h==='twitter.com'||h==='mobile.twitter.com')&&/\/status\/\d+/i.test(u.pathname)}catch{return false}};
  const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString():'—';
  const metricCache=new Map();
  async function fetchMetrics(url){
    const key=String(url||''); const hit=metricCache.get(key);
    if(hit&&Date.now()-hit.at<15000)return hit.data;
    try{const r=await fetch('/api/x?url='+encodeURIComponent(key),{cache:'no-store'});const d=await r.json().catch(()=>null);
      if(!r.ok||d?.platform!=='x')return null; metricCache.set(key,{data:d,at:Date.now()}); return d;
    }catch{return null}
  }
  async function sync(){
    const projects=Array.isArray(window.data?.projects)?window.data.projects:[];
    if(!projects.length)return;
    const cards=[...document.querySelectorAll('[data-project]')];
    await Promise.all(cards.map(async card=>{
      const id=card.getAttribute('data-project');
      const p=projects.find(x=>String(x.id)===String(id));
      if(!p||!isX(p.media_url||p.mediaUrl||p.url||''))return;
      const url=p.media_url||p.mediaUrl||p.url||'';
      const live=await fetchMetrics(url);
      const likes=Number(live?.likes??p.likes);
      if(!Number.isFinite(likes))return;
      const meta=card.querySelector('.meta.artist span')||card.querySelector('.meta span');
      if(!meta)return;
      const name=(meta.textContent||'').split('·')[0].trim();
      meta.textContent=name+' · '+fmt(likes)+' likes';
      meta.dataset.xDiscoveryLikes='1';
    }));
  }
  const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(sync,250)});
  const start=()=>{if(document.body)obs.observe(document.body,{childList:true,subtree:true,characterData:true});sync();setTimeout(sync,300);setTimeout(sync,1500);setInterval(sync,30000)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
