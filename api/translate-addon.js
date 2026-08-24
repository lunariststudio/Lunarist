function cfg(){return {key:process.env.DEEPL_API_KEY||'',url:process.env.DEEPL_API_URL||'https://api-free.deepl.com/v2/translate'}}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const c=cfg(); if(!c.key)return res.status(503).json({error:'DeepL is not configured.'});
  const text=String(req.body?.text||'').trim().slice(0,2000); if(!text)return res.status(400).json({error:'Text is required.'});
  try{const r=await fetch(c.url,{method:'POST',headers:{Authorization:`DeepL-Auth-Key ${c.key}`,'Content-Type':'application/json'},body:JSON.stringify({text:[text],source_lang:'EN',target_lang:'JA',preserve_formatting:true})});const d=await r.json();if(!r.ok)throw new Error(d?.message||'DeepL translation failed.');const translation=d?.translations?.[0]?.text;if(!translation)throw new Error('DeepL returned no translation.');return res.status(200).json({translation});}catch(e){return res.status(502).json({error:e.message||'Translation failed.'})}
}
