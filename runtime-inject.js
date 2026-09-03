const fs=require('fs');
const p='index.html';
let s=fs.readFileSync(p,'utf8');
// The runtime guard is now inline in index.html. Loading /runtime-fix.js from
// the root is unsafe with the SPA fallback because a missing/re-written asset
// is returned as HTML and then parsed as JavaScript (Unexpected token '<').
s=s.replace(/\n?<script src="\/runtime-fix\.js(?:\?[^\"]*)?"><\/script>/g,'');
// The OAuth bridge was present twice in production. Keep the versioned bridge only.
s=s.replace(/\n?<script src="\/oauth-browser-bridge\.js"><\/script>/g,'');
fs.writeFileSync(p,s);
console.log('Lunarist runtime/OAuth startup guard kept inline; duplicate bridge removed');
