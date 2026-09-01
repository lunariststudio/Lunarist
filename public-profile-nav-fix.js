// Lunarist — keep global navigation working on public /:username profiles.
(function(){
  if(typeof window==='undefined' || window.__lunaristPublicProfileNavFix) return;
  window.__lunaristPublicProfileNavFix=true;

  const RESERVED=/^(?:discover|artists|services|commissions|admin|api)$/i;
  const isPublicProfilePath=()=>{
    const p=location.pathname.replace(/^\/+|\/+$/g,'');
    return !!p && !p.includes('/') && !RESERVED.test(p);
  };

  document.addEventListener('click',function(event){
    const button=event.target?.closest?.('#navlinks [data-route]');
    if(!button || !isPublicProfilePath()) return;
    const route=String(button.dataset.route||'').trim();
    if(!route || typeof window.goRoute!=='function') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.getElementById('navlinks')?.classList.remove('open');
    window.goRoute(route);
  },true);

  // The commission tab has its own async handler in the main app; keep it
  // functional on profile URLs without changing its existing behavior.
  document.addEventListener('click',function(event){
    const button=event.target?.closest?.('#navCommissionsBtn');
    if(!button || !isPublicProfilePath()) return;
    if(typeof window.openCommissionsPage!=='function') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    document.getElementById('navlinks')?.classList.remove('open');
    window.openCommissionsPage();
  },true);
})();
