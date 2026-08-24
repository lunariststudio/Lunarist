const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'index.html');
if(!fs.existsSync(file))throw new Error('index.html not found');
let html=fs.readFileSync(file,'utf8');
const tag='<script src="/lunarist-enhancements.js?v=1"></script>';
if(!html.includes(tag)){
  if(!html.includes('</body>'))throw new Error('index.html has no closing body tag');
  html=html.replace('</body>',`${tag}\n</body>`);
  fs.writeFileSync(file,html);
}
console.log('Lunarist enhancements injected safely.');
