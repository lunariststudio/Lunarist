// Discovery cards: X posts use likes as the primary social metric because X view counts
// are not reliably available when the API quota is exhausted.
(function(){
  if(typeof window==='undefined'||window.__lunaristXDiscoveryLikesInstalled)return;
  window.__lunaristXDiscoveryLikesInstalled=true;
  const isX=url=>{try{const u=new URL(String(url||''),location.href);const h=u.hostname.toLowerCase().replace(/^www\./,'');return (h==='x.com'||h==='twitter.com'||h==='mobile.twitter.com')&&/\/status\/\d+/i.test(u.pathname)}catch{return false}};
  const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString():'—';
  function sync(){
    const projects=Array.isArray(window.data?.projects)?window.data.projects:[];
    if(!projects.length)return;
    document.querySelectorAll('[data-project]').forEach(card=>{
      const id=card.getAttribute('data-project');
      const p=projects.find(x=>String(x.id)===String(id));
      if(!p||!isX(p.media_url||p.mediaUrl||p.url||''))return;
      const likes=Number(p.likes);
      if(!Number.isFinite(likes))return;
      const meta=card.querySelector('.meta.artist span')||card.querySelector('.meta span');
      if(!meta)return;
      const name=(meta.textContent||'').split('·')[0].trim();
      meta.textContent=name+' · '+fmt(likes)+' likes';
      meta.dataset.xDiscoveryLikes='1';
    });
  }
  const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(sync,60)});
  const start=()=>{if(document.body)obs.observe(document.body,{childList:true,subtree:true,characterData:true});sync();setTimeout(sync,300);setTimeout(sync,1000)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
