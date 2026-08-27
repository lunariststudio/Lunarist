const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'index.html');
if(!fs.existsSync(file))throw new Error('index.html not found');
let html=fs.readFileSync(file,'utf8');
const requiredScripts=['lunarist-enhancements.js','social-links.js','member-social-fix.js','client-messaging.js','client-chat-and-artist-join.js','x-project-player.js','social-project-fix.js','slides-pricing.js','slides-live-ui.js','slides-persistence-fix.js','slides-hard-save.js','project-slides-view.js','services-drag-drop.js','x-discovery-likes.js','slides-final-fix.js'];
if(!html.includes('</body>'))throw new Error('index.html has no closing body tag');
for(const name of requiredScripts){const alreadyPresent=new RegExp(`<script[^>]*src=["']/${name.replace(/\./g,'\\.')}(\\?[^"']*)?["'][^>]*>`).test(html);if(!alreadyPresent)html=html.replace('</body>',`<script src="/${name}"></script>\n</body>`);}
html=html.replace(/\s*<script src="\/client-route-safety\.js\?v=1"><\/script>\s*/g,'\n');
fs.writeFileSync(file,html);
console.log('Lunarist enhancements injected: social players, messaging, X/Instagram metrics, visible Price/Slides, Supabase-confirmed Project Slides saving, stable Project Slides thumbnails/modals, public Project Slides viewer, draggable Services, and X Discovery likes.');
