// Lunarist Client Space UI polish layer.
(function(){
  if(typeof window==='undefined') return;
  const STYLE_ID='lunarist-client-space-ui-v2';
  function install(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      #lunarist-client-space-root{--client-glass:rgba(255,255,255,.045);--client-glass-2:rgba(255,255,255,.025);--client-border:rgba(255,255,255,.11);--client-pink:rgba(255,134,200,.18);position:relative}
      #lunarist-client-space-root .client-hero{position:relative;overflow:hidden;padding:30px;border:1px solid var(--client-border);border-radius:28px;background:radial-gradient(circle at 88% 0%,rgba(201,182,255,.16),transparent 34%),radial-gradient(circle at 5% 100%,rgba(255,134,200,.08),transparent 30%),var(--client-glass);box-shadow:0 24px 70px rgba(0,0,0,.25)}
      #lunarist-client-space-root .client-hero:after{content:"";position:absolute;width:240px;height:240px;right:-100px;bottom:-140px;border-radius:50%;background:rgba(201,182,255,.08);filter:blur(8px);pointer-events:none}
      #lunarist-client-space-root .client-hero>*{position:relative;z-index:1}
      #lunarist-client-space-root .client-kicker{font:700 10px/1.2 IBM Plex Mono,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--moon)}
      #lunarist-client-space-root .client-title{font-size:clamp(34px,5vw,58px);line-height:.98;letter-spacing:-.055em;margin:8px 0 10px}
      #lunarist-client-space-root .client-subtitle{max-width:720px;color:var(--muted);font-size:15px}
      #lunarist-client-space-root .client-url{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding:13px 15px;border:1px solid var(--client-border);border-radius:15px;background:rgba(0,0,0,.14);min-width:0}
      #lunarist-client-space-root .client-url-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:12px}
      #lunarist-client-space-root .client-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:18px 0}
      #lunarist-client-space-root .client-tab{border:1px solid var(--client-border);background:var(--client-glass-2);color:var(--muted);padding:12px 10px;border-radius:14px;font-weight:800;transition:.18s;min-width:0}
      #lunarist-client-space-root .client-tab:hover{transform:translateY(-1px);border-color:rgba(201,182,255,.4);color:var(--text)}
      #lunarist-client-space-root .client-tab.active{background:linear-gradient(180deg,rgba(201,182,255,.16),rgba(255,134,200,.08));border-color:rgba(201,182,255,.5);color:var(--text);box-shadow:0 8px 26px rgba(0,0,0,.18)}
      #lunarist-client-space-root .client-card{border:1px solid var(--client-border);border-radius:22px;background:var(--client-glass);padding:20px;box-shadow:0 14px 40px rgba(0,0,0,.16)}
      #lunarist-client-space-root .client-card-grid{display:grid;grid-template-columns:1.4fr .6fr;gap:14px}
      #lunarist-client-space-root .client-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
      #lunarist-client-space-root .client-stat{padding:15px;border:1px solid var(--client-border);border-radius:16px;background:var(--client-glass-2);min-width:0}
      #lunarist-client-space-root .client-stat strong{display:block;font-size:23px;letter-spacing:-.03em}
      #lunarist-client-space-root .client-stat span{display:block;color:var(--muted);font-size:11px;margin-top:3px}
      #lunarist-client-space-root .client-section-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:24px 0 12px}
      #lunarist-client-space-root .client-section-title h2{font-size:24px;margin:0;letter-spacing:-.035em}
      #lunarist-client-space-root .client-section-title p{margin:3px 0 0;color:var(--muted);font-size:12px}
      #lunarist-client-space-root .client-action-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #lunarist-client-space-root .client-action{border:1px solid rgba(255,134,200,.22);background:linear-gradient(135deg,rgba(255,134,200,.08),rgba(201,182,255,.04));border-radius:17px;padding:16px}
      #lunarist-client-space-root .client-action strong{display:block}
      #lunarist-client-space-root .client-action .meta{margin-top:5px}
      #lunarist-client-space-root .client-profile{display:grid;grid-template-columns:160px 1fr;gap:24px;align-items:start}
      #lunarist-client-space-root .client-profile-avatar{width:150px;height:150px;border-radius:50%;object-fit:cover;border:1px solid var(--client-border);background:#111}
      #lunarist-client-space-root .client-chip-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
      #lunarist-client-space-root .client-chip{display:inline-flex;align-items:center;padding:6px 9px;border:1px solid var(--client-border);border-radius:999px;color:var(--muted);background:rgba(255,255,255,.025);font-size:11px}
      #lunarist-client-space-root .client-empty{padding:55px 20px;text-align:center;border:1px dashed var(--client-border);border-radius:20px;color:var(--muted)}
      #lunarist-client-space-root .client-recommend-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      #lunarist-client-space-root .client-recommend-grid>*{min-width:0}
      #navClientSpaceBtn{display:none}
      body.lunarist-client-space-active #navClientSpaceBtn{display:inline-flex;color:var(--text);background:rgba(255,255,255,.05);border-color:var(--client-border)}
      @media(max-width:1000px){#lunarist-client-space-root .client-tabs{grid-template-columns:repeat(5,minmax(130px,1fr));overflow-x:auto}#lunarist-client-space-root .client-card-grid{grid-template-columns:1fr}.client-recommend-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:720px){#lunarist-client-space-root .client-hero{padding:21px;border-radius:22px}.client-title{font-size:38px}.client-url{align-items:flex-start;flex-direction:column}.client-url .btn{width:100%}#lunarist-client-space-root .client-tabs{display:flex;overflow-x:auto;padding-bottom:3px}#lunarist-client-space-root .client-tab{flex:0 0 auto}.client-stats{grid-template-columns:1fr 1fr!important}.client-action-list{grid-template-columns:1fr!important}.client-profile{grid-template-columns:1fr!important;text-align:center}.client-profile-avatar{margin:0 auto}.client-chip-row{justify-content:center}.client-recommend-grid{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(s);
  }
  function refresh(){install();document.body.classList.toggle('lunarist-client-space-active',!!document.getElementById('navClientSpaceBtn'))}
  refresh();
  const obs=new MutationObserver(()=>refresh());
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),20000);
})();
