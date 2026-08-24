function config(){return{url:(process.env.SUPABASE_URL||"").replace(/\/$/,""),key:process.env.SUPABASE_SERVICE_ROLE_KEY||""}}
const RESOURCES={profiles:{select:'id,username,display_name,role,bio,avatar_url,skills,available,account_type,is_admin',order:'created_at'},projects:{select:'id,owner_id,title,description,category,tags,thumbnail_url,media_url,media_type,published,featured,views,likes,created_at',order:'created_at.desc'},services:{select:'id,owner_id,title,description,category,tags,price_from,delivery_time,thumbnail_url,published,featured,views,created_at,service_projects(project_id)',order:'created_at.desc'}};
const EVENT_TYPES=['view','like','save','share','open_artist','search'];
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeCommission(c){
  if(!c||typeof c!=='object')return null;
  const service_id=typeof c.service_id==='string'&&UUID_RE.test(c.service_id)?c.service_id:null;
  const name=typeof c.name==='string'?c.name.trim().slice(0,100):'';
  const email=typeof c.email==='string'?c.email.trim().slice(0,160):'';
  const message=typeof c.message==='string'?c.message.trim().slice(0,4000):'';
  const budget=typeof c.budget==='string'?c.budget.trim().slice(0,80):'';
  const addon_titles=Array.isArray(c.addon_titles)?c.addon_titles.filter(x=>typeof x==='string').slice(0,10).map(x=>x.slice(0,120)):[];
  if(!service_id||!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!message)return null;
  return{service_id,name,email,message,budget,addon_titles};
}

function sanitizeEvent(event){if(!event||typeof event!=='object')return null;const session_id=typeof event.session_id==='string'?event.session_id.slice(0,128):null;if(!session_id)return null;const event_type=typeof event.event_type==='string'?event.event_type:null;if(!EVENT_TYPES.includes(event_type))return null;let project_id=null;if(event.project_id!=null){if(typeof event.project_id!=='string'||!UUID_RE.test(event.project_id))return null;project_id=event.project_id}const category=typeof event.category==='string'?event.category.slice(0,64):null;const tags=event.metadata&&Array.isArray(event.metadata.tags)?event.metadata.tags.filter(t=>typeof t==='string').slice(0,20).map(t=>t.slice(0,64)):[];return{session_id,project_id,event_type,category,metadata:{tags}}}

async function getAdminUser(req,url,key){
  const auth=String(req.headers.authorization||'');
  if(!auth.toLowerCase().startsWith('bearer '))return null;
  const token=auth.slice(7).trim();
  if(!token)return null;
  const r=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`}});
  if(!r.ok)return null;
  const user=await r.json();
  if(!user?.id)return null;
  const p=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,is_admin,account_type`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if(!p.ok)return null;
  const rows=await p.json();
  return rows[0]?.is_admin?user:null;
}

export default async function handler(req,res){const {url,key}=config();if(!url||!key)return res.status(503).json({error:'Supabase server credentials are not configured.'});const q=req.url.includes('?')?req.url.slice(req.url.indexOf('?')+1):'';const params=new URLSearchParams(q);const resource=params.get('resource');try{if(req.method==='GET'){
  if(resource==='recommendations'){
    const sessionId=params.get('session_id')||'';
    if(!sessionId)return res.status(400).json({error:'session_id is required'});
    const limit=Math.min(20,Math.max(1,Number(params.get('limit')||5)));
    const r=await fetch(`${url}/rest/v1/rpc/get_recommendations`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_session_id:sessionId,p_limit:limit})});
    const text=await r.text();res.status(r.status).setHeader('Content-Type','application/json');return res.send(text);
  }
  const def=RESOURCES[resource];
  if(!def)return res.status(400).json({error:'Use resource=profiles, resource=projects, resource=services, or resource=recommendations'});
  const out=new URLSearchParams({select:def.select,order:def.order});if(resource==='projects'||resource==='services')out.set('published','eq.true');if(resource==='profiles')out.set('or','(account_type.eq.member,is_admin.eq.true)');
  const r=await fetch(`${url}/rest/v1/${resource}?${out}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  const text=await r.text();res.status(r.status).setHeader('Content-Type','application/json');return res.send(text)
}if(req.method==='POST'){
  if((req.body||{}).action==='toggle-member'){
    const admin=await getAdminUser(req,url,key);
    if(!admin)return res.status(403).json({error:'Administrator access required'});
    const targetId=typeof req.body.targetId==='string'?req.body.targetId.trim():'';
    const nextType=req.body.nextType==='member'?'member':req.body.nextType==='user'?'user':null;
    if(!UUID_RE.test(targetId)||!nextType)return res.status(400).json({error:'Invalid member update'});
    if(targetId===admin.id)return res.status(400).json({error:'You cannot change your own member status here'});
    const r=await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}&is_admin=eq.false`,{method:'PATCH',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({account_type:nextType,updated_at:new Date().toISOString()})});
    const text=await r.text();if(!r.ok)return res.status(r.status).send(text||JSON.stringify({error:'Failed to update member status'}));
    return res.status(200).json({success:true,profile:Array.isArray(JSON.parse(text||'[]'))?JSON.parse(text||'[]')[0]||null:null});
  }
  if((req.body||{}).commission){
    const c=sanitizeCommission(req.body.commission);
    if(!c)return res.status(400).json({error:'Invalid commission inquiry'});
    const r=await fetch(`${url}/rest/v1/commissions`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(c)});
    const text=await r.text();res.status(r.status);return text?res.send(text):res.end();
  }
  const event=sanitizeEvent((req.body||{}).event);if(!event)return res.status(400).json({error:'Invalid event'});const r=await fetch(`${url}/rest/v1/discovery_events`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(event)});const text=await r.text();res.status(r.status);return text?res.send(text):res.end()}return res.status(405).json({error:'Method not allowed'})}catch(e){console.error(e);return res.status(500).json({error:'Supabase request failed'})}}
