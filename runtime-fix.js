(()=>{
  const harmless=(msg='')=>/ResizeObserver loop|Script error\.?$/i.test(String(msg));
  let startup=true;
  const report=(message,source)=>{
    if(harmless(message)) return;
    console.error('[Lunarist runtime]',message,source||'');
    if(startup || !window.state?.backendReady) return;
    try{ if(typeof window.toast==='function') window.toast('Something went wrong. Please try again.'); }catch{}
  };
  window.addEventListener('error',e=>report(e.message,e.filename),true);
  window.addEventListener('unhandledrejection',e=>report(e.reason?.message||e.reason,'promise'),true);
  window.setTimeout(()=>{startup=false},4000);
})();
