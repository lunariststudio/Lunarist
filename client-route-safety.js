// Lunarist public client route safety patch.
// The Client Space patch can run before profiles are loaded; never let a missing data.members
// array crash the whole site. Public client pages can be resolved directly by username.
(function(){
  if(typeof window==='undefined')return;
  const boot=()=>{
    if(window.__lunaristClientRouteSafety)return true;
    if(typeof window.routeFromPath!=='function'||typeof window.goRoute!=='function'||typeof window.render!=='function')return false;

    const originalRouteFromPath=window.routeFromPath.bind(window);
    const originalGoRoute=window.goRoute.bind(window);
    const originalRender=window.render.bind(window);
    const originalPathForRoute=typeof window.pathForRoute==='function'?window.pathForRoute.bind(window):null;
    const reserved=new Set(['','discover','artists','services','commissions','admin','clients','api','saved']);

    function cleanPath(){
      try{return decodeURIComponent(location.pathname.replace(/^\\/+|\\/+$/g,''));}catch{return '';}
    }
    function looksLikePublicClientPath(){
      const s=cleanPath();
      return !!s&&!s.includes('/')&&!reserved.has(s.toLowerCase());
    }
    function publicTokenFromRoute(route){
      const s=String(route||'');
      return s.startsWith('clientprofile:')?s.slice('clientprofile:'.length):'';
    }

    window.routeFromPath=function(){
      try{return originalRouteFromPath();}
      catch(err){
        if(looksLikePublicClientPath())return 'clientprofile:'+cleanPath();
        throw err;
      }
    };

    window.pathForRoute=function(route){
      const token=publicTokenFromRoute(route);
      if(token)return '/'+encodeURIComponent(token);
      return originalPathForRoute?originalPathForRoute(route):'/';
    };

    window.goRoute=function(route,replace){
      const token=publicTokenFromRoute(route);
      if(token){
        try{state.route=route;}catch{}
        const path='/'+encodeURIComponent(token);
        if(location.pathname!==path)history[replace?'replaceState':'pushState']({route},'',path);
        if(typeof window.renderPublicClientProfile==='function')return window.renderPublicClientProfile(token);
      }
      try{return originalGoRoute(route,replace)}
      catch(err){
        if(looksLikePublicClientPath()&&typeof window.renderPublicClientProfile==='function'){
          const token=cleanPath();
          try{state.route='clientprofile:'+token;}catch{}
          return window.renderPublicClientProfile(token);
        }
        throw err;
      }
    };

    window.render=function(preserve){
      const route=String(window.state?.route||'');
      if(route.startsWith('clientprofile:')&&typeof window.renderPublicClientProfile==='function'){
        return window.renderPublicClientProfile(publicTokenFromRoute(route));
      }
      try{return originalRender(preserve)}
      catch(err){
        if(looksLikePublicClientPath()&&typeof window.renderPublicClientProfile==='function'){
          const token=cleanPath();
          try{state.route='clientprofile:'+token;}catch{}
          return window.renderPublicClientProfile(token);
        }
        throw err;
      }
    };

    window.__lunaristClientRouteSafety=true;
    return true;
  };
  if(boot())return;
  let tries=0;
  const timer=setInterval(()=>{if(boot()||++tries>80)clearInterval(timer)},100);
})();
