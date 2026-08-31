// Lunarist Client Space — mobile polish.
(function(){
  if(typeof window==='undefined'||window.__lunaristClientMobilePolish)return;
  const style=document.createElement('style');style.id='lunarist-client-mobile-polish';style.textContent=`
    @media (max-width:720px){
      .client-space-tabs{margin:0 -2px 16px;padding:0 2px 7px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}.client-space-tabs::-webkit-scrollbar{display:none}.client-space-tabs .filter{min-height:44px;padding:10px 14px;scroll-snap-align:start}
      .client-stat-grid{gap:8px}.client-stat-card{min-height:76px;padding:12px}.client-stat-card b{font-size:20px}
      .client-action,.client-deadline{padding:13px;border-radius:14px}.client-action button,.client-deadline button,.client-space-section button{min-height:44px}
      .client-recommend-grid{grid-template-columns:1fr;gap:10px}.client-review-card{padding:14px}
      .client-progress{gap:3px}.client-progress span{height:6px}
      .lunarist-next-action{gap:8px}.lunarist-next-action button{width:100%;min-height:44px}
      .lunarist-state-pair{gap:6px}.lunarist-state-pair span{min-height:54px;justify-content:center}
      .lcd-panel{width:100%;max-width:none;border-left:0}.lcd-head{padding:16px;position:sticky;top:0;z-index:2;background:inherit}.lcd-body{padding:14px 16px calc(32px + env(safe-area-inset-bottom))}.lcd-grid{grid-template-columns:1fr 1fr;gap:10px}.lcd-card{border-radius:14px;padding:14px}.lcd-close{min-width:44px;min-height:44px}.lcd-secondary{min-height:44px;width:100%}
      .lunarist-commission-detail{padding-bottom:env(safe-area-inset-bottom)}
      .lunarist-commission-timeline{margin-top:10px}.lct-event{padding-bottom:12px}.lct-event strong{font-size:12px}.lct-event small,.lct-event p{font-size:11px}
      body.lunarist-panel-open{overflow:hidden}
    }
    @media (max-width:420px){.client-stat-grid{grid-template-columns:1fr 1fr}.client-profile-grid{gap:10px}.client-space-tabs{gap:6px}.client-space-tabs .filter{font-size:12px;padding:9px 12px}.lcd-grid{grid-template-columns:1fr}.lcd-head h2{font-size:19px}.lcd-details div{align-items:flex-start;flex-direction:column;gap:3px}.lcd-details dd{text-align:left}}
    @media (prefers-reduced-motion:reduce){.lcd-panel,.lcd-backdrop{scroll-behavior:auto!important;transition:none!important}}
  `;document.head.appendChild(style);
  const lock=()=>{if(document.querySelector('.lunarist-commission-detail'))document.body.classList.add('lunarist-panel-open');else document.body.classList.remove('lunarist-panel-open')};
  new MutationObserver(lock).observe(document.body,{childList:true});lock();window.__lunaristClientMobilePolish=true;
})();
