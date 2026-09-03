(()=>{
  const harmless=(msg='')=>/ResizeObserver loop|Script error\.?$/i.test(String(msg));
  const report=(message,source)=>{
    if(harmless(message)) return;
    console.error('[Lunarist runtime]',message,source||'');
  };
  window.addEventListener('error',e=>report(e.message,e.filename),true);
  window.addEventListener('unhandledrejection',e=>report(e.reason?.message||e.reason,'promise'),true);
  const injectMobileMenuFix=()=>{
    if(document.getElementById('lunarist-mobile-menu-fix')) return;
    const style=document.createElement('style');
    style.id='lunarist-mobile-menu-fix';
    style.textContent=`
      @media(max-width:720px){
        .navlinks.open{
          position:fixed!important;
          left:10px!important;
          right:10px!important;
          top:62px!important;
          width:auto!important;
          z-index:99999!important;
          max-height:calc(100dvh - 72px)!important;
          overflow-y:auto!important;
          overflow-x:hidden!important;
          flex-direction:column!important;
        }
        .navlinks.open .navbtn,.navlinks.open a,.navlinks.open button{
          width:100%!important;
          min-width:0!important;
        }
      }
    `;
    (document.head||document.documentElement).appendChild(style);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',injectMobileMenuFix,{once:true});
  else injectMobileMenuFix();
})();
