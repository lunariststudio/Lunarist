const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cfg(){
  return {
    url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),
    serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY||'',
    anonKey:process.env.SUPABASE_ANON_KEY||'',
    deeplKey:process.env.DEEPL_API_KEY||'',
    deeplUrl:process.env.DEEPL_API_URL || (String(process.env.DEEPL_API_KEY||'').endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate')
  };
}
function str(v,max){return typeof v==='string'?v.slice(0,max):''}
async function db(c,path,opts={}){
  return fetch(`${c.url}/rest/v1/${path}`,{...opts,headers:{apikey:c.serviceKey,Authorization:`Bearer ${c.serviceKey}`,'Content-Type':'application/json',...(opts.headers||{})}})
}
async function getUser(c,auth){
  if(!auth||!c.anonKey)return null;
  const r=await fetch(`${c.url}/auth/v1/user`,{headers:{apikey:c.anonKey,Authorization:auth}});
  if(!r.ok)return null;
  return await r.json();
}
async function translate(c,text){
  const r=await fetch(c.deeplUrl,{method:'POST',headers:{Authorization:`DeepL-Auth-Key ${c.deeplKey}`,'Content-Type':'application/json'},body:JSON.stringify({text:[text],source_lang:'EN',target_lang:'JA',preserve_formatting:true,formality:'prefer_more'})});
  const d=await r.json();
  if(!r.ok)throw Object.assign(new Error(d?.message||'DeepL translation failed.'),{status:r.status});
  const out=d?.translations?.[0]?.text;
  if(!out)throw Object.assign(new Error('DeepL returned no translation.'),{status:502});
  return out;
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const c=cfg();
  if(!c.url||!c.serviceKey||!c.deeplKey)return res.status(503).json({error:'Translation environment is not configured. Add DEEPL_API_KEY to Vercel.'});
  try{
    const b=req.body||{};
    if(b.action==='translate_tos'){
      const user=await getUser(c,req.headers.authorization||'');
      if(!user?.id)return res.status(401).json({error:'Sign in to translate and save your TOS.'});
      const text=str(b.text,12000).trim();
      if(!text)return res.status(400).json({error:'TOS text is required.'});
      const translation=await translate(c,text);
      await db(c,`profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({tos_ja:translation,updated_at:new Date().toISOString()})});
      return res.status(200).json({translation});
    }
    if(b.action==='translate_profile_tos'){
      const profileId=String(b.profile_id||'');
      if(!UUID_RE.test(profileId))return res.status(400).json({error:'Invalid profile.'});
      const r=await db(c,`profiles?select=id,tos,tos_ja&id=eq.${encodeURIComponent(profileId)}&limit=1`);
      const rows=await r.json();
      if(!r.ok)throw Object.assign(new Error('Unable to load profile TOS.'),{status:502});
      const profile=rows?.[0];
      if(!profile?.tos)return res.status(404).json({error:'This artist has no custom TOS.'});
      if(profile.tos_ja)return res.status(200).json({translation:profile.tos_ja,cached:true});
      const translation=await translate(c,profile.tos);
      await db(c,`profiles?id=eq.${encodeURIComponent(profileId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({tos_ja:translation,updated_at:new Date().toISOString()})});
      return res.status(200).json({translation,cached:false});
    }
    return res.status(400).json({error:'Unknown translation action.'});
  }catch(e){
    console.error('DeepL translation error',e);
    return res.status(e.status||500).json({error:e.message||'Translation failed.'});
  }
}
