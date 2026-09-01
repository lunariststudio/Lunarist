// Lunarist Client Space navigation fix.
(function(){
  if(typeof window==='undefined'||window.__lunaristClientSpaceNavFix)return;
  const routeFromButton=(button)=>{const direct=button?.dataset?.route||button?.dataset?.navRoute||button?.dataset?.path;if(direct)return String(direct).replace(/^\//,'');const source=(button?.getAttribute?.('onclick')||'')+' '+(typeof button?.onclick==='function'?button.onclick.toString():'');const m=source.match(/(?:goRoute|openRoute)\s*\(\s*["'`]([^"'`]+)["'`]/);if(m)return m[1].replace(/^\//,'');const id=String(button?.id||'').toLowerCase();const text=String(button?.textContent||'').trim().toLowerCase();const key=(id+' '+text).replace(/[^a-z0-9]+/g,' ');const map=[['discover','discover'],['services','services'],['artists','artists'],['projects','projects'],['commissions','commissions'],['my commission','commissions'],['member space','member'],['home','home'],['studio','studio'],['about','about']];for(const [needle,route] of map)if(key.includes(needle))return route;return null;};
  const unlock=()=>{const nav=document.getElementById('navlinks');if(nav){nav.style.position='relative';nav.style.zIndex='1000';nav.style.pointerEvents='auto';nav.querySelectorAll('button,a').forEach(x=>{x.style.pointerEvents='auto';});}};
  document.addEventListener('click',(event)=>{const button=event.target?.closest?.('#navlinks .navbtn');if(!button||button.id==='navClientSpaceBtn')return;const current=typeof window.routeFromPath==='function'?window.routeFromPath(location.pathname):null;if(current!=='clients')return;const route=routeFromButton(button);if(!route||typeof window.pathForRoute!=='function')return;const path=window.pathForRoute(route);if(!path)return;event.preventDefault();event.stopImmediatePropagation();window.location.assign(path);},true);

  // Admin Studio API Connector: loaded on demand so it does not expose credentials.
  const loadApiConnector=()=>{if(document.getElementById('adminApiConnectorsScript'))return;const s=document.createElement('script');s.id='adminApiConnectorsScript';s.src='/admin-api-connectors.js?v=1';s.onload=()=>{if(typeof window.renderAdminApiConnectors==='function')window.renderAdminApiConnectors()};document.head.appendChild(s);};
  const maybeConnector=()=>{if(document.getElementById('adminPageView'))loadApiConnector()};
  new MutationObserver(()=>{unlock();maybeConnector()}).observe(document.documentElement,{childList:true,subtree:true});
  unlock();maybeConnector();
  window.__lunaristClientSpaceNavFix=true;
})();
