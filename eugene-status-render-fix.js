// Eugene Card status render fix.
// profile-sync.js refreshes the Eugene card every ~700ms. Its renderer used to
// rebuild the card HTML on every refresh, resetting the visible status to
// "Checking connection..." before the async request could finish. Keep the
// existing DOM after the first render so the resolved status is not erased.
(function(){
  'use strict';
  if(typeof window==='undefined'||window.__eugeneStatusRenderFix)return;
  window.__eugeneStatusRenderFix=true;

  function install(){
    if(!window.Element)return;
    const proto=Element.prototype;
    const descriptor=Object.getOwnPropertyDescriptor(proto,'innerHTML');
    if(!descriptor||!descriptor.set||!descriptor.get)return;
    if(proto.__lunaristEugeneInnerHTMLPatched)return;
    proto.__lunaristEugeneInnerHTMLPatched=true;

    Object.defineProperty(proto,'innerHTML',{
      configurable:descriptor.configurable,
      enumerable:descriptor.enumerable,
      get:descriptor.get,
      set:function(value){
        // Only suppress the destructive rebuild performed by profile-sync on
        // an already-rendered Eugene Card. Initial creation is still allowed.
        if(this.id==='eugeneConnectCard' && this.isConnected && this.dataset.eugeneRendered==='1'){
          const text=String(value||'');
          if(text.includes('id="eugeneConnectStatus"') && text.includes('Checking connection'))return;
        }
        descriptor.set.call(this,value);
        if(this.id==='eugeneConnectCard')this.dataset.eugeneRendered='1';
      }
    });
  }

  function markExisting(){
    const card=document.getElementById('eugeneConnectCard');
    if(card)card.dataset.eugeneRendered='1';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install();markExisting()},{once:true});
  else {install();markExisting();}
  const observer=new MutationObserver(markExisting);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
