const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'index.html');
if(!fs.existsSync(file))throw new Error('index.html not found');
let html=fs.readFileSync(file,'utf8');
const requiredScripts=['lunarist-enhancements.js','client-messaging.js','client-chat-and-artist-join.js','x-project-player.js','social-project-fix.js','services-drag-drop.js','x-discovery-likes.js','project-media-manager.js','slides-addon-logic.js','slides-addon-logic-fix.js'];
if(!html.includes('</body>'))throw new Error('index.html has no closing body tag');
const removedScripts=['slides-pricing.js','slides-live-ui.js','slides-persistence-fix.js','slides-hard-save.js','project-slides-view.js','slides-final-fix.js','project-media-carousel-fix.js','social-links.js','member-social-fix.js','profile-social-settings.js','public-profile-socials.js'];
for(const name of removedScripts){const re=new RegExp(`\\s*<script[^>]*src=["']/${name.replace(/\\./g,'\\\\.')}(\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'g');html=html.replace(re,'\n');}
for(const name of requiredScripts){const alreadyPresent=new RegExp(`<script[^>]*src=["']/${name.replace(/\\./g,'\\\\.')}(\\?[^"']*)?["'][^>]*>`).test(html);if(!alreadyPresent)html=html.replace('</body>',`<script src="/${name}"></script>\n</body>`);}
html=html.replace(/\s*<script src="\/client-route-safety\.js\?v=1"><\/script>\s*/g,'\n');
if(!html.includes('window.state=state'))html=html.replace(/const data=\{members:\[\],projects:\[\],services:\[\],recommendations:\[\]\};/,'const data={members:[],projects:[],services:[],recommendations:[]};window.state=state;window.data=data;');
if(!html.includes('window.supabaseClient=window.supabase.createClient'))html=html.replace('supabaseClient=window.supabase.createClient','supabaseClient=window.supabaseClient=window.supabase.createClient');
fs.writeFileSync(file,html);
console.log('Lunarist enhancements injected; removed all Profile Social & Website features and legacy social profile injectors.');
