function str(v,max){return typeof v==='string'?v.trim().slice(0,max):''}
async function deepl(text,target){
  const key=process.env.DEEPL_API_KEY; if(!key)return null;
  const r=await fetch('https://api-free.deepl.com/v2/translate',{method:'POST',headers:{Authorization:`DeepL-Auth-Key ${key}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({text,target_lang:target==='ja'?'JA':'EN'})});
  const d=await r.json(); if(!r.ok)throw Error(d?.message||'DeepL translation failed'); return d?.translations?.[0]?.text||null;
}
async function google(text,target){
  const u='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+encodeURIComponent(target)+'&dt=t&q='+encodeURIComponent(text);
  const r=await fetch(u); if(!r.ok)throw Error('Translation service unavailable'); const d=await r.json(); return Array.isArray(d?.[0])?d[0].map(x=>x?.[0]||'').join(''):'';
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const text=str(req.body?.text,12000), target=req.body?.target==='ja'?'ja':null;
  if(!text||!target)return res.status(400).json({error:'text and target=ja are required'});
  try{const translation=await deepl(text,target)||await google(text,target); if(!translation)throw Error('No translation returned'); return res.status(200).json({translation,target,provider:process.env.DEEPL_API_KEY?'deepl':'google'});}catch(e){console.error(e);return res.status(502).json({error:e.message||'Translation failed'});}
}
