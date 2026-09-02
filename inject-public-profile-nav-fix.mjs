import fs from 'node:fs';
const file='index.html';
const tag='<script src="/public-profile-nav-fix.js?v=2"></script>';
if(!fs.existsSync(file)) throw new Error('index.html not found');
let html=fs.readFileSync(file,'utf8');
html=html.replace(/\s*<script src="\/public-profile-nav-fix\.js[^>]*><\/script>/g,'');
if(!html.includes(tag)){
  if(!html.includes('</head>')) throw new Error('</head> not found');
  html=html.replace('</head>',tag+'\n</head>');
  fs.writeFileSync(file,html);
}
console.log('Public profile navigation fix injected.');
