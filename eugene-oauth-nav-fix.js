(function(){
  'use strict';
  function wire(){
    const b=document.getElementById('navEugeneCardBtn');
    if(!b||typeof window.startEugeneOAuth!=='function')return;
    b.textContent='Eugene Card';
    b.title='Connect or manage Eugene Card';
    b.onclick=()=>window.startEugeneOAuth();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
  else wire();
  new MutationObserver(wire).observe(document.documentElement,{childList:true,subtree:true});
})();
