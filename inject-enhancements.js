const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'index.html');
if(!fs.existsSync(file))throw new Error('index.html not found');
let html=fs.readFileSync(file,'utf8');
const requiredScripts=['lunarist-enhancements.js','social-links.js','member-social-fix.js','client-messaging.js','client-chat-and-artist-join.js','x-project-player.js','social-project-fix.js','services-drag-drop.js','x-discovery-likes.js','project-media-manager.js'];
if(!html.includes('</body>'))throw new Error('index.html has no closing body tag');
const removedScripts=['slides-pricing.js','slides-live-ui.js','slides-persistence-fix.js','slides-hard-save.js','project-slides-view.js','slides-final-fix.js','slides-addon-logic.js','slides-addon-logic-fix.js','project-media-carousel-fix.js'];
for(const name of removedScripts){const re=new RegExp(`\\s*<script[^>]*src=["']/${name.replace(/\\./g,'\\\\.')}(\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'g');html=html.replace(re,'\n');}
for(const name of requiredScripts){const alreadyPresent=new RegExp(`<script[^>]*src=["']/${name.replace(/\\./g,'\\\\.')}(\\?[^"']*)?["'][^>]*>`).test(html);if(!alreadyPresent)html=html.replace('</body>',`<script src="/${name}"></script>\n</body>`);}
html=html.replace(/\s*<script src="\/client-route-safety\.js\?v=1"><\/script>\s*/g,'\n');
// Expose safe bridges for the external media manager without exposing credentials.
html=html.replace('const state={','const state={');
if(!html.includes('window.__lunaristState=state'))html=html.replace(/const data=\{members:\[\],projects:\[\],services:\[\],recommendations:\[\]\};/,'const data={members:[],projects:[],services:[],recommendations:[]};window.__lunaristState=state;window.__lunaristData=data;');
if(!html.includes('window.__lunaristGetSession'))html=html.replace('async function loadConfig(){','window.__lunaristGetSession=async()=>{try{return (await supabaseClient.auth.getSession()).data.session||null}catch{return null}};\nasync function loadConfig(){');
fs.writeFileSync(file,html);
console.log('Lunarist enhancements injected: social players, messaging, metrics, draggable Services, and Project Media multi-upload/carousel; legacy standalone Slides scripts removed.');
