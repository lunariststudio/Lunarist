const fs=require('fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
const tag='<script src="/runtime-fix.js?v=1"></script>';
if(!s.includes('/runtime-fix.js')){
  s=s.replace('</head>',tag+'\n</head>');
  fs.writeFileSync(p,s);
}
console.log('Lunarist runtime guard injected');
