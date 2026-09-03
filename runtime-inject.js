const fs=require('fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
const tag='<script src="/runtime-fix.js?v=2"></script>';
// The OAuth bridge was present twice in production. Keep the versioned bridge only.
s=s.replace(/\n?<script src="\/oauth-browser-bridge\.js"><\/script>/g,'');
if(!s.includes('/runtime-fix.js')) s=s.replace('</head>',tag+'\n</head>');
else s=s.replace(/<script src="\/runtime-fix\.js\?v=[^"]+"><\/script>/g,tag);
fs.writeFileSync(p,s);
console.log('Lunarist runtime/OAuth startup guard injected');
