const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'index.html');
if(!fs.existsSync(file))throw new Error('index.html not found');
let html=fs.readFileSync(file,'utf8');
const tags=[
  '<script src="/lunarist-enhancements.js?v=1"></script>',
  '<script src="/social-links.js?v=2"></script>'
];
if(!html.includes('</body>'))throw new Error('index.html has no closing body tag');
for(const tag of tags){
  if(!html.includes(tag)) html=html.replace('</body>',`${tag}\n</body>`);
}
html=html.replace(/\s*<script src="\/client-route-safety\.js\?v=1"><\/script>\s*/g,'\n');
fs.writeFileSync(file,html);
console.log('Lunarist enhancements and social links injected safely.');
