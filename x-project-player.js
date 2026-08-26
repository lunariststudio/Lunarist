// Lunarist X project video player + live X engagement sync.
// Uses the existing /api/x endpoint; no X credentials are exposed to the browser.
(function(){
  if(typeof window==='undefined') return;
  if(window.__lunaristXProjectPlayerInstalled) return;
  window.__lunaristXProjectPlayerInstalled=true;

  const cache=new Map();
  let activeId='';
  let refreshTimer=null;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString(): '—';

  function style(){
    if($('#lunarist-x-player-style')) return;
    const s=document.createElement('style');
    s.id='lunarist-x-player-style';
    s.textContent=`
      body.lunarist-x-video-mode{overflow:hidden!important}
      body.lunarist-x-video-mode .modal{padding:0!important;background:#000!important;backdrop-filter:none!important}
      body.lunarist-x-video-mode .modalbox{width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;border:0!important;border-radius:0!important;background:#000!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      body.lunarist-x-video-mode .modalmedia{position:relative!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;aspect-ratio:auto!important;background:#000!important;display:flex!important;align-items:center!important;justify-content:center!important}
      body.lunarist-x-video-mode .modalmedia video{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;border-radius:0!important;background:#000!important}
      body.lunarist-x-video-mode .modalmedia iframe{width:100%!important;height:100%!important;border:0!important}
      body.lunarist-x-video-mode .modalcontent{position:absolute!important;left:0;right:0;bottom:0;z-index:4;padding:22px 24px 24px!important;background:linear-gradient(transparent,rgba(0,0,0,.88) 38%,rgba(0,0,0,.96))!important;pointer-events:none}
      body.lunarist-x-video-mode .modalcontent>*{pointer-events:auto}
      body.lunarist-x-video-mode .modalcontent h2,body.lunarist-x-video-mode .modalcontent p{display:none!important}
      .lunarist-x-toolbar{position:absolute;top:14px;left:14px;right:14px;z-index:8;display:flex;align-items:center;justify-content:space-between;gap:10px;pointer-events:none}
      .lunarist-x-toolbar>*{pointer-events:auto}
      .lunarist-x-badge,.lunarist-x-fullscreen{border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.58);backdrop-filter:blur(12px);color:#fff;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:800}
      .lunarist-x-fullscreen{cursor:pointer}
      .lunarist-x-metrics{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .lunarist-x-metric{display:inline-flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;font-size:12px;font-weight:700;backdrop-filter:blur(10px)}
      .lunarist-x-source{color:rgba(255,255,255,.72);font-size:11px;margin-top:8px}
      @media(max-width:720px){body.lunarist-x-video-mode .modalcontent{padding:18px 14px 16px!important}.lunarist-x-toolbar{top:9px;left:9px;right:9px}.lunarist-x-metric{padding:7px 9px;font-size:11px}}
    `;
    document.head.appendChild(s);
  }

  function parseId(url){
    try{
      const u=new URL(url,location.href);
      const m=u.pathname.match(/\/(?:[^/]+)\/status\/(\d+)/i);
      return m?m[1]:'';
    }catch{return ''}
  }

  function currentXId(){
    const modal=$('.modal.open');
    if(!modal) return '';
    const explicit=modal.querySelector('[data-x-url]')?.getAttribute('data-x-url');
    if(explicit){const id=parseId(explicit);if(id)return id;}
    for(const a of modal.querySelectorAll('a[href]')){
      const id=parseId(a.href);if(id)return id;
    }
    for(const f of modal.querySelectorAll('iframe[src]')){
      const id=parseId(f.src);if(id)return id;
    }
    const text=modal.textContent||'';
    const m=text.match(/(?:x\.com|twitter\.com)\/[^\s/]+\/status\/(\d+)/i);
    return m?m[1]:'';
  }

  function apiUrl(id){return `/api/x?url=${encodeURIComponent(`https://x.com/i/status/${id}`)}`;}

  async function fetchX(id){
    if(!id)return null;
    try{
      const r=await fetch(apiUrl(id),{cache:'no-store'});
      const d=await r.json().catch(()=>null);
      if(!r.ok||!d||d.platform!=='x')return null;
      cache.set(id,d);
      return d;
    }catch{return null}
  }

  function ensureToolbar(modal){
    if(modal.querySelector('.lunarist-x-toolbar')) return modal.querySelector('.lunarist-x-toolbar');
    const bar=document.createElement('div');
    bar.className='lunarist-x-toolbar';
    bar.innerHTML='<span class="lunarist-x-badge">𝕏 X Project</span><button type="button" class="lunarist-x-fullscreen" aria-label="Enter fullscreen">⛶ Fullscreen</button>';
    bar.querySelector('.lunarist-x-fullscreen').onclick=async()=>{
      try{
        const box=modal.querySelector('.modalbox')||modal;
        if(document.fullscreenElement) await document.exitFullscreen();
        else await box.requestFullscreen?.();
      }catch{}
    };
    modal.appendChild(bar);
    return bar;
  }

  function renderMetrics(modal,d){
    if(!d)return;
    let host=modal.querySelector('.lunarist-x-metrics');
    if(!host){
      const content=modal.querySelector('.modalcontent')||modal;
      host=document.createElement('div');host.className='lunarist-x-metrics';
      content.appendChild(host);
    }
    const engagement=[d.likes,d.replies,d.reposts].every(v=>Number.isFinite(Number(v)))
      ?Number(d.likes)+Number(d.replies)+Number(d.reposts):null;
    host.innerHTML=[
      `<span class="lunarist-x-metric">♥ ${fmt(d.likes)} likes</span>`,
      `<span class="lunarist-x-metric">◉ ${fmt(d.views)} views</span>`,
      `<span class="lunarist-x-metric">↩ ${fmt(d.replies)} replies</span>`,
      `<span class="lunarist-x-metric">↻ ${fmt(d.reposts)} reposts</span>`,
      engagement!=null?`<span class="lunarist-x-metric">✦ ${fmt(engagement)} engagement</span>`:''
    ].join('');
    let source=modal.querySelector('.lunarist-x-source');
    if(!source){source=document.createElement('div');source.className='lunarist-x-source';(modal.querySelector('.modalcontent')||modal).appendChild(source)}
    source.textContent=d.metricsUnavailable?'X metrics are temporarily unavailable.':'Live metrics synced from X.';
  }

  function installVideo(modal,d){
    const media=modal.querySelector('.modalmedia');
    if(!media||!d)return;
    ensureToolbar(modal);
    renderMetrics(modal,d);
    if(d.mediaType!=='video'||!d.mediaUrl) return;
    let video=media.querySelector('video.lunarist-x-video');
    if(!video){
      media.querySelectorAll('iframe').forEach(x=>x.remove());
      video=document.createElement('video');
      video.className='lunarist-x-video';
      video.controls=true;video.playsInline=true;video.preload='metadata';
      video.setAttribute('webkit-playsinline','true');
      media.appendChild(video);
    }
    if(video.src!==d.mediaUrl){
      video.src=d.mediaUrl;
      video.load();
    }
    media.setAttribute('data-x-id',d.id||'');
    document.body.classList.add('lunarist-x-video-mode');
    const modalClose=modal.querySelector('.modalclose,[data-close]');
    if(modalClose&&!modalClose.dataset.xCloseBound){
      modalClose.dataset.xCloseBound='1';
      modalClose.addEventListener('click',()=>document.body.classList.remove('lunarist-x-video-mode'),true);
    }
  }

  async function sync(){
    const modal=$('.modal.open');
    if(!modal){
      document.body.classList.remove('lunarist-x-video-mode');
      activeId='';
      return;
    }
    const id=currentXId();
    if(!id)return;
    activeId=id;
    const d=cache.get(id)||await fetchX(id);
    if(!d)return;
    installVideo(modal,d);
  }

  const nativeFetch=window.fetch;
  window.fetch=async function(input,init){
    const response=await nativeFetch.apply(this,arguments);
    try{
      const url=typeof input==='string'?input:(input?.url||'');
      if(/\/api\/x(?:\?|$)/.test(url)){
        response.clone().json().then(d=>{
          if(d?.platform==='x'&&d?.id){cache.set(String(d.id),d);setTimeout(sync,0)}
        }).catch(()=>{});
      }
    }catch{}
    return response;
  };

  const observer=new MutationObserver(()=>{
    clearTimeout(observer.t);
    observer.t=setTimeout(sync,40);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','src']});

  style();
  sync();
  setInterval(()=>{if(activeId)sync()},60000);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.fullscreenElement)document.body.classList.remove('lunarist-x-video-mode')});
})();
