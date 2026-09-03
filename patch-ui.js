const fs=require('fs');
let s=fs.readFileSync('index.html','utf8');

function replaceOnce(from,to,label){
  if(s.includes(to)) return;
  if(!s.includes(from)) throw new Error('UI patch target not found: '+label);
  s=s.replace(from,to);
}

replaceOnce(
  '.navin{height:72px;max-width:1280px;margin:auto;padding:0 24px;display:flex;align-items:center;gap:26px}',
  '.navin{height:72px;max-width:1280px;margin:auto;padding:0 24px;display:flex;align-items:center;gap:26px;position:relative}',
  'desktop nav container'
);

replaceOnce(
  '.navlinks.open{display:flex;position:absolute;left:10px;right:10px;top:62px;background:#0d0b13;border:1px solid var(--line);border-radius:15px;padding:8px;flex-direction:column}',
  '.navlinks.open{display:flex;position:fixed;left:10px;right:10px;top:62px;z-index:99999;width:calc(100vw - 20px);max-width:calc(100vw - 20px);min-width:0;box-sizing:border-box;background:#0d0b13;border:1px solid var(--line);border-radius:15px;padding:8px;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4);backdrop-filter:blur(18px);max-height:calc(100dvh - 72px);overflow-y:auto;overflow-x:hidden}',
  'mobile menu'
);

replaceOnce(
  "function initReveal(){const els=document.querySelectorAll('.reveal');if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in-view'));return}const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -30px'});els.forEach(e=>io.observe(e));}",
  "function initReveal(){const els=[...document.querySelectorAll('.reveal:not(.in-view)')];if(!els.length)return;if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in-view'));return}const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -30px'});els.forEach(e=>io.observe(e));}",
  'reveal initializer'
);

if(!s.includes('bind();\n   initReveal();')){
  const renderRx=/document\.getElementById\(['"]view['"]\)\.innerHTML\s*=\s*html;\s*bind\(\);/;
  if(renderRx.test(s)){
    s=s.replace(renderRx,m=>m+'\n   initReveal();');
  }else{
    const scrollRx=/\s*window\.scrollTo\(\{top:0,behavior:'instant'\}\)/;
    if(!scrollRx.test(s)) throw new Error('Render hook target not found');
    s=s.replace(scrollRx,"\n   initReveal();\n   window.scrollTo({top:0,behavior:'instant'})");
  }
}

const revealLine="document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in-view'));";
s=s.replace(revealLine,'');

if(!s.includes('@media(max-width:720px){.navin{height:62px;padding:0 15px;position:relative}')){
  s=s.replace(
    '@media(max-width:720px){.navin{height:62px;padding:0 15px}',
    '@media(max-width:720px){.navin{height:62px;padding:0 15px;position:relative}'
  );
}

// Remove references to scripts that are not present in the repository. A missing
// JS asset is rewritten to index.html by the SPA fallback, which then executes
// as JavaScript and produces "Unexpected token <" in the browser.
s=s.replace(/\n?<script src="\/social-links\.js(?:\?[^\"]*)?"><\/script>/g,'');

// Remove the old global toast-producing error handler. Runtime errors should
// stay visible in DevTools without creating a misleading user-facing toast.
s=s.replace(
  /window\.addEventListener\('error',\s*\(e\)\s*=>\s*\{\s*console\.error\('\[Lunarist Error Handler\]',\s*e\.error \|\| e\.message\);\s*if\(typeof toast === 'function'\) toast\('Something went wrong\. Please try again\.'\);\s*\}\);/,
  "window.addEventListener('error', (e) => { console.error('[Lunarist Error Handler]', e.error || e.message); });"
);

// Use a real manifest file instead of a data: URL. Chromium can reject the data
// manifest URL with ERR_INVALID_URL in production.
s=s.replace(/<link rel="manifest" href="data:application\/manifest\+json;base64,[^"]+">/, '<link rel="manifest" href="/manifest.json">');

// Mobile nav must not live inside a header/backdrop-filter/overflow containing
// block. Portal the open menu to <body> so position:fixed is truly viewport-fixed.
if(!s.includes('lunarist-mobile-nav-portal')){
  const portalCss=`<style id="lunarist-mobile-nav-portal">@media(max-width:720px){.navlinks.open{position:fixed!important;left:10px!important;right:10px!important;top:62px!important;width:calc(100vw - 20px)!important;max-width:calc(100vw - 20px)!important;z-index:99999!important;box-sizing:border-box!important;max-height:calc(100dvh - 72px)!important;overflow-y:auto!important;overflow-x:hidden!important}.navlinks.open .navbtn,.navlinks.open a,.navlinks.open button{display:flex!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;justify-content:flex-start!important;white-space:normal!important}.navlinks.open>*{width:100%!important;max-width:100%!important;box-sizing:border-box!important}}</style>`;
  s=s.replace('</head>',portalCss+'\n</head>');
}

if(!s.includes('lunarist-mobile-nav-portal-script')){
  const portalScript=`<script id="lunarist-mobile-nav-portal-script">(()=>{const setup=()=>{const nav=document.querySelector('.navlinks');if(!nav||nav.dataset.mobilePortalReady==='1')return;nav.dataset.mobilePortalReady='1';const parent=nav.parentNode;const marker=document.createComment('lunarist-mobile-nav-marker');parent.insertBefore(marker,nav);let inBody=false;const sync=()=>{if(window.innerWidth>720){if(inBody){marker.parentNode?.insertBefore(nav,marker.nextSibling);inBody=false}return}if(nav.classList.contains('open')){if(!inBody){document.body.appendChild(nav);inBody=true}}else if(inBody){marker.parentNode?.insertBefore(nav,marker.nextSibling);inBody=false}};new MutationObserver(sync).observe(nav,{attributes:true,attributeFilter:['class']});window.addEventListener('resize',sync,{passive:true});sync()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup()})();</script>`;
  s=s.replace('</body>',portalScript+'\n</body>');
}

fs.writeFileSync('index.html',s);
console.log('Lunarist UI animation + mobile menu + runtime asset patch applied');