(function(){
  'use strict';
  if(window.__lunaristEugeneOAuthNavFix)return;
  window.__lunaristEugeneOAuthNavFix=true;
  function wire(){
    const b=document.getElementById('navEugeneCardBtn');
    if(!b||typeof window.startEugeneOAuth!=='function')return;
    if(b.textContent!=='Eugene Card')b.textContent='Eugene Card';
    if(b.title!=='Connect or manage Eugene Card')b.title='Connect or manage Eugene Card';
    if(b.__eugeneOAuthWired)return;
    b.__eugeneOAuthWired=true;
    b.onclick=()=>window.startEugeneOAuth();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
  else wire();
  const observer=new MutationObserver(()=>wire());
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
