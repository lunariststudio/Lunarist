// Lunarist — global navigation fix for public user/client profiles.
(function(){
  'use strict';
  if(typeof window==='undefined'||window.__lunaristPublicProfileNavFixV2)return;
  window.__lunaristPublicProfileNavFixV2=true;

  const fallbackPaths={home:'/',discover:'/discover',services:'/services',artists:'/artists',admin:'/admin',commissions:'/commissions',member:'/member'};
  const routeFor=(button)=>String(button?.dataset?.route||button?.dataset?.navRoute||'').trim();
  const isCommission=(button)=>button?.id==='navCommissionsBtn'||/my\s+commissions?/i.test(button?.textContent||'');

  function navigate(button){
    const route=routeFor(button);
    if(!route)return false;
    document.getElementById('navlinks')?.classList.remove('open');

    if(isCommission(button)&&typeof window.openCommissionsPage==='function'){
      window.openCommissionsPage();
      return true;
    }
    if(typeof window.goRoute==='function'){
      window.goRoute(route);
      return true;
    }
    const path=fallbackPaths[route]||('/'+route.replace(/^\//,''));
    window.location.assign(path);
    return true;
  }

  // Capture phase is intentional: public user/client profile content can have
  // its own click handling. Navigation must win before the profile handlers.
  document.addEventListener('click',function(event){
    const button=event.target?.closest?.('#navlinks [data-route]');
    if(!button)return;
    if(!navigate(button))return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);

  // Keep the nav clickable even if a profile render temporarily adds a
  // full-page interaction layer or changes inline pointer-events/z-index.
  const repair=()=>{
    const nav=document.querySelector('.nav');
    const links=document.getElementById('navlinks');
    if(nav){nav.style.pointerEvents='auto';nav.style.zIndex='1000';}
    if(links){links.style.pointerEvents='auto';links.style.zIndex='1001';}
  };
  repair();
  new MutationObserver(repair).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
})();
