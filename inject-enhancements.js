const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'index.html');
if(!fs.existsSync(file))throw new Error('index.html not found');
let html=fs.readFileSync(file,'utf8');
const requiredScripts=['lunarist-enhancements.js','social-links.js','member-social-fix.js','client-messaging.js','client-chat-and-artist-join.js'];
if(!html.includes('</body>'))throw new Error('index.html has no closing body tag');
for(const name of requiredScripts){
  const alreadyPresent=new RegExp(`<script[^>]*src=["']/${name.replace(/\./g,'\\.')}(\\?[^"']*)?["'][^>]*>`).test(html);
  if(!alreadyPresent) html=html.replace('</body>',`<script src="/${name}"></script>\n</body>`);
}
html=html.replace(/\s*<script src="\/client-route-safety\.js\?v=1"><\/script>\s*/g,'\n');
fs.writeFileSync(file,html);
console.log('Lunarist profile/social/messaging scripts injected safely.');
