const fs=require('fs');
let s=fs.readFileSync('index.html','utf8');
const r=[
['.navin{height:72px;max-width:1280px;margin:auto;padding:0 24px;display:flex;align-items:center;gap:26px}', '.navin{height:72px;max-width:1280px;margin:auto;padding:0 24px;display:flex;align-items:center;gap:26px;position:relative}'],
['.navlinks.open{display:flex;position:absolute;left:10px;right:10px;top:62px;background:#0d0b13;border:1px solid var(--line);border-radius:15px;padding:8px;flex-direction:column}', '.navlinks.open{display:flex;position:absolute;left:10px;right:10px;top:calc(100% + 8px);z-index:70;background:#0d0b13;border:1px solid var(--line);border-radius:15px;padding:8px;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4);backdrop-filter:blur(18px);max-height:calc(100vh - 78px);overflow-y:auto}'],
["function initReveal(){const els=document.querySelectorAll('.reveal');if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in-view'));return}const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -30px'});els.forEach(e=>io.observe(e));}", "function initReveal(){const els=[...document.querySelectorAll('.reveal:not(.in-view)')];if(!els.length)return;if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in-view'));return}const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -30px'});els.forEach(e=>io.observe(e));}"],
["document.getElementById('view').innerHTML=html;\n   bind();", "document.getElementById('view').innerHTML=html;\n   bind();\n   initReveal();"],
["document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in-view'));",''],
['@media(max-width:720px){.navin{height:62px;padding:0 15px}', '@media(max-width:720px){.navin{height:62px;padding:0 15px;position:relative}']
];
for(const [a,b] of r){if(!s.includes(a))throw new Error('UI patch target not found: '+a.slice(0,80));s=s.replace(a,b)}
fs.writeFileSync('index.html',s);