
// Global Error Boundary & Graceful Handling
window.addEventListener('error', (e) => {
  console.error('[Lunarist Error Handler]', e.error || e.message);
  if(typeof toast === 'function') toast('Something went wrong. Please try again.');
});

let supabaseClient=null;
const state={route:'home',filter:'All',roleFilter:'All Roles',query:'',session:{id:'s_'+Math.random().toString(36).slice(2),interests:{},viewed:[],liked:[]},currentUser:null,currentMember:null,selectedTheme:'moonlight',backendReady:false,authMode:'signin',inviteCode:'',loadError:null,conversations:[],activeConversation:null,notifications:[],myCommissions:[],myCommissionError:null,myReviews:[],savedIds:new Set()};
const data={members:[],projects:[],services:[],recommendations:[]};window.state=state;window.data=data;
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}


function parseServicePrice(value, fallback=0){
  if(value===null||value===undefined)return Number(fallback)||0;
  let raw=String(value).trim();
  if(!raw)return Number(fallback)||0;
  // Accept normal forms such as 30, $30, USD 30, $ 30, 30 USD, 30.00, and 30,00.
  raw=raw.replace(/[,$€£¥]/g,'').replace(/(USD|JPY|EUR|GBP)/ig,'').trim();
  // Be forgiving of a common O-for-0 typo when it is adjacent to digits.
  raw=raw.replace(/(?<=\d)[Oo](?=\d)/g,'0').replace(/(?<=\$|\s)[Oo](?=\d)/g,'0');
  const match=raw.match(/[-+]?\d+(?:[.,]\d+)?/);
  if(!match)return Number(fallback)||0;
  const n=Number(match[0].replace(',','.'));
  return Number.isFinite(n)&&n>0?n:(Number(fallback)||0);
}
function serviceBasePrice(service){
  if(!service)return 0;
  const parsed=parseServicePrice(service.price_from,0);
  if(parsed>0)return parsed;
  const amount=Number(service.amount);
  return Number.isFinite(amount)&&amount>0?amount:0;
}

async function lunaristAIImprove(field, context){
  const el=document.getElementById(field);
  if(!el)return;
  const original=el.value.trim();
  if(!original){toast('Write a rough draft first.');return}
  const btn=document.querySelector('[data-ai-improve="'+field+'"]');
  if(btn){btn.disabled=true;btn.textContent='✨ Improving…';}
  try{
    const headers=await apiAuthHeaders();
    const prompt=[
      'You are Lunarist Studio\'s writing assistant.',
      'Improve the creator\'s copy while preserving their meaning and factual claims.',
      'Use a calm, thoughtful, premium creative-studio voice: clear, specific, human, never generic or overly promotional.',
      'Do not invent clients, awards, prices, capabilities, timelines, or facts.',
      'Return only the finished copy, with no commentary or quotation marks.',
      context||'',
      '\nDraft:\n'+original
    ].join('\n');
    const r=await fetch('/api/openai',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({input:prompt})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d?.error||'AI improvement failed.');
    const improved=String(d.output_text||'').trim();
    if(!improved)throw new Error('AI returned no text.');
    el.value=improved;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    toast('✨ Copy improved with OpenAI');
  }catch(e){toast(e.message||'AI improvement failed.')}finally{
    if(btn){btn.disabled=false;btn.textContent='✨ Improve with AI';}
  }
}

function updateSeoMeta(title, desc, image) {
  const pageTitle = title ? `${title} — Lunarist Studio` : 'Lunarist Studio — Unleash Your Dream';
  document.title = pageTitle;
  const ogT = document.getElementById('ogTitle'); if(ogT) ogT.content = pageTitle;
  const ogD = document.getElementById('ogDesc'); if(ogD) ogD.content = desc || 'A living creative network where artists share work and clients discover talent.';
  const ogI = document.getElementById('ogImage'); if(ogI && image) ogI.content = image;
}

function handleImageError(img) {
  img.onerror = null;
  img.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
}

function formatDescription(text){if(!text)return '';const escaped=esc(text);const formatted=escaped.replace(/(?:^|\n)[-*\u2022]\s+(.+)/g,'<div class="bullet-item"><span class="bullet-dot">•</span><span>$1</span></div>');return formatted.replace(/\n/g,'<br>')}
function formatViews(n){
  n=Number(n||0);
  if(n>=1000000)return (n/1000000).toFixed(1).replace(/\.0$/,'')+'M';
  if(n>=1000)return (n/1000).toFixed(1).replace(/\.0$/,'')+'K';
  return n.toLocaleString();
}
function applyTheme(themeName){
  state.selectedTheme = themeName || 'moonlight';
  document.documentElement.setAttribute('data-theme', state.selectedTheme);
}
function getSession(){let s=null;try{s=JSON.parse(localStorage.getItem('lunarist_session')||'null')}catch(e){}if(!s||typeof s!=='object')s={};s.id=typeof s.id==='string'&&s.id?s.id:'s_'+Math.random().toString(36).slice(2);s.interests=s.interests&&typeof s.interests==='object'?s.interests:{};s.viewed=Array.isArray(s.viewed)?s.viewed:[];s.liked=Array.isArray(s.liked)?s.liked:[];localStorage.setItem('lunarist_session',JSON.stringify(s));return s}
state.session=getSession();
function saveSession(){localStorage.setItem('lunarist_session',JSON.stringify(state.session))}
function member(id){return data.members.find(m=>m.id===id)||null}
function roleLabel(m){if(!m)return 'Guest';if(m.is_admin)return 'Administrator';return m.account_type==='member'?'Lunarist Member':'User'}
function memberByUsername(u){u=String(u||'').toLowerCase();return data.members.find(m=>(m.username||'').toLowerCase()===u)||null}
const RESERVED_ROUTES=['discover','artists','services','commissions','admin','api'];
function pathForRoute(route){if(route==='home')return '/';if(route==='discover')return '/discover';if(route==='artists')return '/artists';if(route==='services')return '/services';if(route==='commissions')return '/commissions';if(route==='admin')return '/admin';if(route.startsWith('member:')){const m=member(route.split(':')[1]);return m?.username?('/'+m.username):'/artists'}return '/'}
function goRoute(route,replace){state.route=route;const path=pathForRoute(route);if(location.pathname!==path){history[replace?'replaceState':'pushState']({route},'',path)}render()}
function routeFromPath(){const seg=decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g,''));if(!seg)return 'home';if(seg==='discover')return 'discover';if(seg==='artists')return 'artists';if(seg==='services')return 'services';if(seg==='commissions')return 'commissions';if(seg==='admin')return 'admin';if(RESERVED_ROUTES.includes(seg.toLowerCase()))return 'home';const m=memberByUsername(seg);return m?'member:'+m.id:'home'}
function extractYoutubeId(url){
  if(!url) return null;
  const s=String(url).trim();
  if(/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try{
    const normalized=/^[a-z][a-z0-9+.-]*:\/\//i.test(s)?s:'https://'+s;
    const u=new URL(normalized);
    const host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='youtu.be'){
      const id=u.pathname.split('/').filter(Boolean)[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;
    }
    if(host==='youtube.com'||host==='m.youtube.com'||host==='music.youtube.com'){
      const v=u.searchParams.get('v');
      if(/^[A-Za-z0-9_-]{11}$/.test(v||'')) return v;
      const parts=u.pathname.split('/').filter(Boolean);
      if(['embed','shorts','live','v'].includes(parts[0])){
        const id=parts[1];
        return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;
      }
    }
  }catch{}
  const m=s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/i);
  return m?m[1]:null;
}
function embedToWatchUrl(u){const m=String(u||'').match(/embed\/([A-Za-z0-9_-]{11})/);return m?('https://youtu.be/'+m[1]):''}
window.addEventListener('popstate',()=>{state.route=routeFromPath();render()});
async function uploadProjectFile(file,kind){if(!file)return null;const ext=(file.name.split('.').pop()||'bin').toLowerCase(),path=`${state.currentUser.id}/${crypto.randomUUID()}-${kind}.${ext}`;const up=await supabaseClient.storage.from('project-media').upload(path,file,{upsert:false,contentType:file.type||undefined});if(up.error)throw up.error;const pub=supabaseClient.storage.from('project-media').getPublicUrl(path);return pub.data.publicUrl}
function score(p){
  const interests=state.session.interests||{};
  const category=String(p?.category||'');
  const tags=Array.isArray(p?.tags)?p.tags:[];
  const interestRaw=Number(interests[category]||0);
  const tagRaw=tags.reduce((n,t)=>n+Number(interests[t]||0),0);
  return Math.min(100,(Math.min(1,(interestRaw/10)+(tagRaw/40))*40)+(Math.min(1,tagRaw/20)*20)+(Math.min(1,Number(p?.views||0)/5000)*15)+(Math.max(0,1-(Math.max(0,(Date.now()-(Date.parse(p?.created_at||'')||Date.now())))/86400000)/180)*10)+(p?.member&&state.session.viewed.includes(p.member)?8:2)+5);
}
function aiOrder(items,ids){
  const order=new Map((Array.isArray(ids)?ids:[]).map((id,i)=>[String(id),i]));
  return [...items].sort((a,b)=>{
    const aiA=order.has(String(a.id))?order.get(String(a.id)):9999;
    const aiB=order.has(String(b.id))?order.get(String(b.id)):9999;
    if(aiA!==aiB)return aiA-aiB;
    return score(b)-score(a);
  });
}
function personalized(){
  const ai=state.aiRanking?.homeProjectIds||[];
  if(ai.length)return aiOrder(data.projects.filter(p=>p.published!==false),ai);
  const ranked=(data.recommendations||[]).map(r=>data.projects.find(p=>p.id===r.project_id)).filter(Boolean);
  return ranked.length?ranked:[...data.projects].sort((a,b)=>score(b)-score(a));
}
async function refreshRecommendations(){
  if(!state.backendReady)return;
  try{
    const r=await fetch('/api/lunarist?resource=recommendations&session_id='+encodeURIComponent(state.session.id)+'&limit=5');
    if(!r.ok)throw new Error('Recommendation service unavailable');
    const rows=await r.json();
    data.recommendations=Array.isArray(rows)?rows:[];
  }catch(e){data.recommendations=[];}
}
async function refreshAIRecommendations(){
  if(!state.backendReady || state._aiRecommendationLoaded)return;
  state._aiRecommendationLoaded=true;
  const projects=[...data.projects].sort((a,b)=>score(b)-score(a)).slice(0,48).map(p=>{
    const m=member(p.member)||{};
    return {id:p.id,title:p.title,category:p.category,tags:p.tags,description:p.description||p.desc,creator:m.name,role:m.role,popularity:Number(p.likes||0)+Number(p.views||0),freshness:Date.parse(p.created_at||'')||0};
  });
  const services=[...data.services].sort((a,b)=>(Number(b.views||0)-Number(a.views||0))).slice(0,48).map(s=>{
    const m=member(s.member)||{};
    return {id:s.id,title:s.title,category:s.category,tags:s.tags,description:s.description,creator:m.name,role:m.role,price:s.price_from||s.amount,delivery:s.delivery_time,popularity:Number(s.views||0),freshness:Date.parse(s.created_at||'')||0};
  });
  if(!projects.length&&!services.length)return;
  try{
    const r=await fetch('/api/openai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recommendations',
      interests:state.session.interests||{},
      viewed:state.session.viewed||[],
      projects,services
    })});
    if(!r.ok)throw new Error('AI recommendation request failed');
    const d=await r.json();
    state.aiRanking={
      homeProjectIds:Array.isArray(d.homeProjectIds)?d.homeProjectIds:[],
      discoverProjectIds:Array.isArray(d.discoverProjectIds)?d.discoverProjectIds:[],
      serviceIds:Array.isArray(d.serviceIds)?d.serviceIds:[]
    };
    if(['home','services','discover'].includes(state.route))render(true);
  }catch(e){
    state.aiRanking={homeProjectIds:[],discoverProjectIds:[],serviceIds:[]};
  }
}
const siteAnalyticsState={visitorId:null,sessionId:null,pageRoutes:new Set(),queue:[],flushTimer:null};
function analyticsId(prefix){try{if(crypto?.randomUUID)return crypto.randomUUID()}catch{}return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}
function initSiteAnalytics(){
  if(siteAnalyticsState.visitorId)return;
  try{siteAnalyticsState.visitorId=localStorage.getItem('lunarist_analytics_visitor_v3')||analyticsId('v');localStorage.setItem('lunarist_analytics_visitor_v3',siteAnalyticsState.visitorId)}catch{siteAnalyticsState.visitorId=analyticsId('v')}
  try{siteAnalyticsState.sessionId=sessionStorage.getItem('lunarist_analytics_session_v3')||analyticsId('s');sessionStorage.setItem('lunarist_analytics_session_v3',siteAnalyticsState.sessionId)}catch{siteAnalyticsState.sessionId=analyticsId('s')}
  try{siteAnalyticsState.queue=JSON.parse(sessionStorage.getItem('lunarist_analytics_queue_v1')||'[]')||[]}catch{siteAnalyticsState.queue=[]}
  if(!siteAnalyticsState.flushTimer)siteAnalyticsState.flushTimer=setInterval(flushSiteAnalytics,5000);
}
function analyticsDevice(){const w=window.innerWidth||0;return w<640?'mobile':w<1024?'tablet':'desktop'}
function analyticsAttribution(){
  const q=new URLSearchParams(location.search);
  return {source:q.get('utm_source')||null,medium:q.get('utm_medium')||null,campaign:q.get('utm_campaign')||null,landing:location.pathname||'/'};
}
async function flushSiteAnalytics(){
  initSiteAnalytics();
  if(!state.backendReady||!supabaseClient||!siteAnalyticsState.queue.length)return;
  const pending=siteAnalyticsState.queue.splice(0,10);
  let failed=[];
  for(const payload of pending){try{const r=await supabaseClient.rpc('record_site_analytics_event',payload);if(r?.error)failed.push(payload)}catch{failed.push(payload)}}
  if(failed.length)siteAnalyticsState.queue=[...failed,...siteAnalyticsState.queue].slice(-50);
  try{sessionStorage.setItem('lunarist_analytics_queue_v1',JSON.stringify(siteAnalyticsState.queue))}catch{}
}
function trackSiteEvent(eventName,opts={}){
  initSiteAnalytics();
  const attribution=analyticsAttribution();
  const payload={p_visitor_id:siteAnalyticsState.visitorId,p_session_id:siteAnalyticsState.sessionId,p_event_name:eventName,p_route:String(opts.route||location.pathname||'/').slice(0,160),p_entity_type:opts.entityType||null,p_entity_id:opts.entityId||null,p_category:opts.category||null,p_referrer:document.referrer||null,p_device_type:analyticsDevice(),p_user_id:state.currentUser?.id||null,p_metadata:{...attribution,...(opts.metadata||{})}};
  siteAnalyticsState.queue.push(payload);siteAnalyticsState.queue=siteAnalyticsState.queue.slice(-50);
  try{sessionStorage.setItem('lunarist_analytics_queue_v1',JSON.stringify(siteAnalyticsState.queue))}catch{}
  void flushSiteAnalytics();
}
window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flushSiteAnalytics()});
window.addEventListener('pagehide',()=>{void flushSiteAnalytics()});
function trackSitePageView(){
  initSiteAnalytics();
  const route=state.route||'home';
  if(route==='admin'||route.startsWith('member:')===false&&route==='')return;
  const key=route+'|'+siteAnalyticsState.sessionId;
  if(siteAnalyticsState.pageRoutes.has(key))return;
  siteAnalyticsState.pageRoutes.add(key);
  trackSiteEvent('page_view',{route});
}
async function track(p,type='view'){
  state.session.interests[p.category]=(state.session.interests[p.category]||0)+(type==='like'?4:1);
  (p.tags||[]).forEach(t=>state.session.interests[t]=(state.session.interests[t]||0)+(type==='like'?.7:.15));
  if(!state.session.viewed.includes(p.id))state.session.viewed.unshift(p.id);
  state.session.viewed=state.session.viewed.slice(0,30);saveSession();
  if(state.backendReady)fetch('/api/lunarist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:{session_id:state.session.id,project_id:p.id,event_type:type,category:p.category,metadata:{tags:p.tags||[]}}})}).catch(()=>{});
  trackSiteEvent(type==='like'?'like':type==='save'?'save':'project_view',{entityType:'project',entityId:p.id,category:p.category,metadata:{tags:p.tags||[]}});
}

function avatar(m){return `<img class="avatar" src="${esc(m?.avatar||'https://i.pravatar.cc/160?u=unknown')}" alt="${esc(m?.name||'Artist')}" loading="lazy" onerror="handleImageError(this)">`}
function applyNaturalMediaRatio(el, img, opts={}){
  if(!el || !img) return;
  const set=()=>{
    const w=Number(img.naturalWidth||0), h=Number(img.naturalHeight||0);
    if(!w || !h) return;
    el.classList.add('auto-ratio');
    el.style.setProperty('--media-ratio', `${w} / ${h}`);
    if(opts.modal){
      // Keep the media box itself the same ratio as the source so there are
      // no artificial black/empty columns around portrait or custom-ratio art.
      const maxH=(window.innerWidth<=720 ? window.innerHeight*0.68 : window.innerHeight*0.72);
      const maxW=Math.max(240, Math.min(window.innerWidth*(window.innerWidth<=720?.94:.88), 960));
      const ratio=w/h;
      const width=Math.min(maxW, maxH*ratio);
      el.style.setProperty('--media-width', `${Math.max(1,width)}px`);
    }
  };
  if(img.complete) set();
  img.addEventListener('load',set,{once:true});
}
function bindAutoRatioMedia(root=document){
  root.querySelectorAll('.thumb img').forEach(img=>applyNaturalMediaRatio(img.parentElement,img));
  if(window.markYoutubeThumbnails) window.markYoutubeThumbnails(root);
}
function card(p,feature=false){
  const m=member(p.member);
  const directBadge=p.lunarist_direct?`<span class="badge lunarist-direct-badge" title="Commissioned and purchased directly through Lunarist Studio">✦ Lunarist Studio Commission</span>`:'';
  // X does not reliably expose public view counts through the available API.
  // On Discovery cards, show the real X like count instead of a misleading 0 views.
  const xProject=isXStatusUrl(p.media_url||p.mediaUrl||p.video||'');
  const youtubeProject=!!(extractYoutubeId(p.media_url||p.mediaUrl||p.video||p.thumbnail_url||p.image||''));
  const discoveryMetric=xProject
    ? `${formatViews(p.likes)} likes`
    : `${formatViews(p.views)} views`;
  const thumbClass=youtubeProject?'thumb thumb-youtube':'thumb';
  return `<article class="card ${feature?'feature':''}" data-project="${p.id}">
    <div class="${thumbClass} auto-ratio">
      <img src="${esc(youtubeProject ? ('https://i.ytimg.com/vi/'+extractYoutubeId(p.media_url||p.mediaUrl||p.video||p.thumbnail_url||p.image||'')+'/maxresdefault.jpg') : (p.image||''))}" alt="${esc(p.title)}" loading="lazy" onload="applyNaturalMediaRatio(this.parentElement,this)" onerror="${youtubeProject ? "this.onerror=null;this.src='"+esc(p.image||'')+"';" : "handleImageError(this)"}">
      <div class="overlay"><span class="badge">${esc(p.category)}</span>${directBadge}</div>
    </div>
    <div class="cardbody">
      <div class="title">${esc(p.title)}</div>
      <div class="meta artist">${avatar(m)}<span>${esc(m?.name||'Unknown artist')} · ${discoveryMetric}</span></div>
      ${p.lunarist_direct?`<div class="lunarist-direct-label">✦ Purchased through Lunarist Studio</div>`:''}
      <div class="tags">${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
    </div>
  </article>`;
}
function sortServicesByOrder(list){return [...(list||[])].sort((a,b)=>{const ao=Number(a?.sort_order),bo=Number(b?.sort_order);const an=Number.isFinite(ao)?ao:2147483647,bn=Number.isFinite(bo)?bo:2147483647;return an-bn||String(a?.title||'').localeCompare(String(b?.title||''));})}
function serviceCard(s){const m=member(s.member);return `<article class="card service-card services-page" data-service="${s.id}"><div class="thumb auto-ratio"><img src="${esc(s.thumbnail_url||'')}" alt="${esc(s.title)}" loading="lazy" onload="this.classList.toggle('portrait',this.naturalHeight>this.naturalWidth);applyNaturalMediaRatio(this.parentElement,this)" onerror="handleImageError(this)"><div class="overlay"><span class="badge">${esc(s.category)}</span></div></div><div class="cardbody"><div class="title">${esc(s.title)}</div><div class="meta artist">${avatar(m)}<span>${esc(m?.name||'Unknown artist')}</span></div><div class="meta">${[s.price_from?('From '+esc(s.price_from)):'',esc(s.delivery_time||'')].filter(Boolean).join(' · ')}</div><div class="tags">${(s.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div></article>`}
function services(){let list=sortServicesByOrder(data.services);if(state.query){const q=state.query.toLowerCase();list=list.filter(s=>(s.title+' '+s.category+' '+(s.tags||[]).join(' ')+' '+(member(s.member)?.name||'')).toLowerCase().includes(q))}else if(state.aiRanking?.serviceIds?.length){list=aiOrder(list,state.aiRanking.serviceIds)}return `<div class="container"><section class="section" style="padding-top:55px"><div class="sectionhead"><div><div class="eyebrow">Hire the collective</div><h2 style="font-size:46px">Services.</h2><p>Book Lunarist members directly for commissions and packages.</p></div><input class="search" id="searchInput" placeholder="Search services, artists…" value="${esc(state.query)}"></div><div class="grid" id="servicesGrid">${list.length?list.map(serviceCard).join(''):emptyState('No services listed yet.','Lunarist Members can list services from their dashboard.')}</div></section></div>`}

function money(v){const n=Number(String(v??'').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>0?n:0}
function isVideoDurationAddon(ao){const t=String(ao?.title||'').toLowerCase();return /video\s+over\s+3\s+minutes/.test(t)||/3\s*minutes.*30\s*sec/.test(t)||/30\s*sec.*3\s*minutes/.test(t)}
function addonIsDuration(ao){return ao?.type==='duration'||ao?.duration===true||Number(ao?.included_seconds||ao?.includedSeconds||0)>0||Number(ao?.unit_seconds||ao?.unitSeconds||0)>0||isVideoDurationAddon(ao)}
function addonDurationConfig(ao){const inferred=isVideoDurationAddon(ao);return {included:Number(ao?.included_seconds??ao?.includedSeconds??(inferred?180:0))||0,unit:Number(ao?.unit_seconds??ao?.unitSeconds??(inferred?30:30))||30,price:Number(ao?.price??(inferred?10:0))||0}}
function addonDurationAmount(ao,durationSeconds){const c=addonDurationConfig(ao);const d=Math.max(0,Number(durationSeconds)||0);if(!d||d<=c.included)return 0;return Math.ceil((d-c.included)/c.unit)*c.price}
function addonAmount(base,ao,extra){
  const n=Number(ao?.price||0);
  if(addonIsDuration(ao)) return addonDurationAmount(ao,extra?.durationSeconds||0);
  return ao?.type==='percent' ? (base*n/100) : n;
}
function addonLabel(ao){
  if(addonIsDuration(ao)){const c=addonDurationConfig(ao);return '+$'+c.price.toFixed(2)+' / '+Math.round(c.unit/60*10)/10+' min';}
  return ao?.type==='percent' ? ('+'+Number(ao.price||0)+'%') : ('+$'+Number(ao.price||0).toFixed(2));
}
function parseDurationInput(v){const m=String(v||'').trim().match(/^(\d{1,4}):(\d{2})$/);if(!m)return null;const sec=Number(m[1])*60+Number(m[2]);return Number.isFinite(sec)&&Number(m[2])<60?sec:null}
function formatDurationSeconds(sec){sec=Math.max(0,Math.round(Number(sec)||0));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function addonIcon(title){
  const t=String(title||'').toLowerCase();
  if(t.includes('commercial'))return '💼';
  if(t.includes('rush')||t.includes('expedite')||t.includes('priority'))return '⚡';
  if(t.includes('nda')||t.includes('private'))return '🔒';
  if(t.includes('revision'))return '🔁';
  return '✦';
}

function openAttachmentViewer(url, name='Attachment', mime=''){
  const viewer=document.getElementById('attachmentViewer'),body=document.getElementById('attachmentViewerBody'),title=document.getElementById('attachmentViewerTitle');
  if(!viewer||!body){window.open(url,'_blank','noopener');return} const safeUrl=String(url||''),safeName=String(name||'Attachment'); if(!safeUrl)return;
  title.textContent=safeName; const lower=(safeName+' '+safeUrl).toLowerCase();
  const isImage=/\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:[?#].*)?$/i.test(lower)||String(mime).startsWith('image/');
  const isVideo=/\.(mp4|webm|mov|m4v|ogg)(?:[?#].*)?$/i.test(lower)||String(mime).startsWith('video/');
  const isPdf=/\.pdf(?:[?#].*)?$/i.test(lower)||String(mime)==='application/pdf';
  if(isImage)body.innerHTML=`<img src="${esc(safeUrl)}" alt="${esc(safeName)}">`;
  else if(isVideo)body.innerHTML=`<video src="${esc(safeUrl)}" controls autoplay playsinline></video>`;
  else if(isPdf)body.innerHTML=`<iframe src="${esc(safeUrl)}#view=FitH" title="${esc(safeName)}"></iframe>`;
  else body.innerHTML=`<div class="attachment-viewer-fallback"><div style="font-size:54px;margin-bottom:8px">📎</div><h3 style="margin:0 0 6px">${esc(safeName)}</h3><p class="meta">This file type does not have an in-app preview.</p><div class="attachment-viewer-actions"><a class="btn primary" href="${esc(safeUrl)}" target="_blank" rel="noopener">Open file</a><a class="btn" href="${esc(safeUrl)}" download>Download</a></div></div>`;
  viewer.classList.add('open');viewer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
}
function closeAttachmentViewer(){const viewer=document.getElementById('attachmentViewer'),body=document.getElementById('attachmentViewerBody');if(!viewer)return;viewer.classList.remove('open');viewer.setAttribute('aria-hidden','true');if(body)body.innerHTML='';document.body.style.overflow='';}
document.getElementById('attachmentViewerClose')?.addEventListener('click',closeAttachmentViewer);
document.getElementById('attachmentViewer')?.addEventListener('click',e=>{if(e.target.id==='attachmentViewer')closeAttachmentViewer();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAttachmentViewer();});
function notificationTarget(n){const link=String(n?.link||'');if(link)return link;const type=String(n?.type||'').toLowerCase();if(type==='message'||type==='inquiry')return 'dashboard:messages';if(type==='approval')return 'dashboard:projects';if(type==='system')return 'dashboard:profile';if(type==='commission')return 'commissions';return 'dashboard:overview';}
async function openNotificationTarget(n){const target=notificationTarget(n);document.getElementById('notifPopover')?.classList.remove('open');if(target.startsWith('chat:')){const convId=target.slice(5);await openDashboard('messages');if(convId)await selectConversation(convId);return;}if(target.startsWith('dashboard:')){await openDashboard(target.split(':')[1]||'overview');return;}if(target==='commissions'){goRoute('commissions');return;}if(target.startsWith('/')){location.href=target;return;}}
async function sendNotification(userId, title, message, type='info', link=null) {
  if(!userId) return;
  // Best-effort only. This inserts a row on behalf of the OTHER party (user_id !== auth.uid()),
  // which a same-row-only RLS policy on `notifications` will reject. Previously that rejection
  // was unhandled and bubbled up into sendMsg()'s try/catch, so a failed "New Message" notification
  // showed as "Could not send message" even though the message itself had already been inserted —
  // this only ever hit the artist's reply flow, since the client-side chat path never calls this.
  // Swallow failures here; the message send must never depend on the notification succeeding.
  try{
    const { error } = await supabaseClient.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      link
    });
    if(error) console.warn('[Lunarist] notification insert failed (non-fatal):', error.message);
  }catch(e){
    console.warn('[Lunarist] notification insert failed (non-fatal):', e?.message||e);
  }
}

async function loadUserNotifications() {
  if(!state.currentUser) return;
  const { data: list } = await supabaseClient.from('notifications')
    .select('*')
    .eq('user_id', state.currentUser.id)
    .order('created_at', { ascending: false })
    .limit(20);

  state.notifications = list || [];
  renderNotificationsUI();
}

function renderNotificationsUI() {
  const toggleBtn = document.getElementById('notifToggleBtn');
  const countBadge = document.getElementById('notifBadgeCount');
  const popoverList = document.getElementById('notifList');

  if(!state.currentUser) { if(toggleBtn) toggleBtn.style.display = 'none'; return; }
  toggleBtn.style.display = 'inline-flex';

  const unreadCount = state.notifications.filter(n => !n.is_read).length;
  if(unreadCount > 0) {
    countBadge.textContent = unreadCount;
    countBadge.style.display = 'inline';
  } else {
    countBadge.style.display = 'none';
  }

  if(!popoverList) return;
  if(!state.notifications.length) {
    popoverList.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No notifications yet.</div>`;
    return;
  }

  popoverList.innerHTML = state.notifications.map(n => `
    <button type="button" class="notif-item ${n.is_read ? '' : 'unread'}" data-notif-id="${n.id}" style="width:100%;text-align:left;cursor:pointer">
      <b style="display:block;color:var(--text)">${esc(n.title)}</b>
      <span style="color:var(--muted)">${esc(n.message)}</span>
      <div class="chat-meta" style="text-align:left;margin-top:2px">${new Date(n.created_at).toLocaleDateString()} · Click to open</div>
    </button>
  `).join('');
  document.querySelectorAll('[data-notif-id]').forEach(el => {
    el.onclick = async () => {
      const id=el.dataset.notifId, n=state.notifications.find(x=>String(x.id)===String(id));
      await supabaseClient.from('notifications').update({is_read:true}).eq('id',id);
      await loadUserNotifications(); if(n) await openNotificationTarget(n);
    };
  });
}

async function createOrGetConversation(artistId, serviceId=null, projectId=null) {
  if(!state.currentUser) {
    openAuth('signin');
    document.getElementById('authSubtitle').textContent='Sign in to chat with this artist.';
    document.getElementById('authModal')?.classList.add('open');
    return null;
  }
  if(state.currentUser.id === artistId) { toast("You cannot message yourself"); return null; }

  const { data: existing } = await supabaseClient.from('conversations')
    .select('*')
    .or(`and(client_id.eq.${state.currentUser.id},artist_id.eq.${artistId}),and(client_id.eq.${artistId},artist_id.eq.${state.currentUser.id})`)
    .maybeSingle();

  if(existing) return existing;

  const { data: created, error } = await supabaseClient.from('conversations').insert({
    client_id: state.currentUser.id,
    artist_id: artistId,
    service_id: serviceId,
    project_id: projectId
  }).select().single();

  if(error) { toast(error.message); return null; }
  return created;
}

let lunaristMessageBackgroundTimer = null;
let lunaristMessageBackgroundLoading = false;

async function loadUserConversations() {
  if(!state.currentUser || !supabaseClient) {
    state.conversations = [];
    updateMessagesUnreadBadge();
    return;
  }
  if(lunaristMessageBackgroundLoading) return;
  lunaristMessageBackgroundLoading = true;
  const { data: convs, error } = await supabaseClient.from('conversations')
    .select(`
      *,
      client:client_id(id, display_name, username, avatar_url),
      artist:artist_id(id, display_name, username, avatar_url),
      service:service_id(title),
      messages(content, created_at, sender_id, is_read)
    `)
    .or(`client_id.eq.${state.currentUser.id},artist_id.eq.${state.currentUser.id}`)
    .order('last_message_at', { ascending: false });

  if(!error) {
    state.conversations = convs || [];
    updateMessagesUnreadBadge();
  }
  lunaristMessageBackgroundLoading = false;
}

function startBackgroundMessageSync() {
  if(lunaristMessageBackgroundTimer) clearInterval(lunaristMessageBackgroundTimer);
  lunaristMessageBackgroundTimer = null;
  if(!state.currentUser || !supabaseClient) return;

  // Load the user's conversations/messages immediately after authentication,
  // without opening/rendering the client portal.
  loadUserConversations().catch(()=>{});

  // Keep the badge current while the user is browsing the main Lunarist site.
  lunaristMessageBackgroundTimer = setInterval(() => {
    if(state.currentUser && document.visibilityState !== 'hidden') {
      loadUserConversations().catch(()=>{});
    }
  }, 15000);
}

function stopBackgroundMessageSync() {
  if(lunaristMessageBackgroundTimer) clearInterval(lunaristMessageBackgroundTimer);
  lunaristMessageBackgroundTimer = null;
  lunaristMessageBackgroundLoading = false;
  state.conversations = [];
  state.activeConversation = null;
  updateMessagesUnreadBadge();
}

let lunaristUsdJpyRate=null;
let lunaristAddonTranslations={};
let lunaristServiceDescriptionTranslations={};
async function getUsdJpyRate(){if(lunaristUsdJpyRate)return lunaristUsdJpyRate;try{const r=await fetch('/api/exchange?from=USD&to=JPY',{cache:'no-store'});const d=await r.json();if(!r.ok||!Number(d.rate))throw new Error(d.error||'Exchange rate unavailable');lunaristUsdJpyRate=Number(d.rate);return lunaristUsdJpyRate}catch(e){console.warn('USD/JPY rate unavailable',e);return 0}}
async function translateAddonText(text){const key=String(text||'').trim();if(!key)return '';if(lunaristAddonTranslations[key])return lunaristAddonTranslations[key];try{const r=await fetch('/api/translate-addon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:key})});const d=await r.json();if(r.ok&&d.translation){lunaristAddonTranslations[key]=d.translation;return d.translation}}catch(e){console.warn('Addon translation failed',e)}return key}
async function translateServiceDescription(text){const key=String(text||'').trim();if(!key)return '';if(lunaristServiceDescriptionTranslations[key])return lunaristServiceDescriptionTranslations[key];try{const r=await fetch('/api/translate-addon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:key})});const d=await r.json();if(r.ok&&d.translation){lunaristServiceDescriptionTranslations[key]=d.translation;return d.translation}}catch(e){console.warn('Service description translation failed',e)}return key}

function openService(id){
  if(!state.currentUser){
    state.pendingServiceId=id;
    openAuth('signin');
    document.getElementById('authSubtitle').textContent='Sign in to view this service and contact the artist.';
    document.getElementById('authModal')?.classList.add('open');
    return;
  }
  state.openServiceId=id;
  trackSiteEvent('service_view',{entityType:'service',entityId:id,category:data.services.find(x=>x.id===id)?.category||null});
  const s=data.services.find(x=>x.id===id);if(!s)return;
  const m=member(s.member);
  const examples=(s.projectIds||[]).map(pid=>data.projects.find(p=>p.id===pid)).filter(Boolean);
  const addOns = (Array.isArray(s.add_ons) ? s.add_ons : []).map(ao=>isVideoDurationAddon(ao)?{...ao,type:'duration',duration:true,included_seconds:Number(ao.included_seconds??180)||180,unit_seconds:Number(ao.unit_seconds??30)||30,price:Number(ao.price??10)||10}:ao);
  const basePrice = serviceBasePrice(s);
  const canCheckout = basePrice>0;

  updateSeoMeta(s.title, s.description, s.thumbnail_url);

  const serviceModalMedia=document.getElementById('modalMedia');
  serviceModalMedia.classList.add('auto-ratio');
  serviceModalMedia.style.removeProperty('--media-width');
  serviceModalMedia.innerHTML=`<img src="${esc(s.thumbnail_url||'')}" alt="" onload="applyNaturalMediaRatio(this.parentElement,this,{modal:true})" onerror="handleImageError(this)">`;
  document.getElementById('modalContent').innerHTML=`
    <div class="eyebrow">${esc(s.category)}</div>
    <h2>${esc(s.title)}</h2>
    <div class="artist">${avatar(m)}<button class="btn" data-modal-member="${m?.id||''}">${esc(m?.name||'Unknown artist')} · View profile</button></div>
    <p id="serviceDescriptionText">${formatDescription(s.description)}</p>
    <div class="stats">
      ${s.price_from?`<span class="stat">From ${esc(s.price_from)}</span>`:''}
      ${s.delivery_time?`<span class="stat">${esc(s.delivery_time)}</span>`:''}
      <button class="btn pink" id="modalDirectChatBtn" style="margin-left:auto">💬 Chat with Artist</button>
    </div>

    ${examples.length?`<div class="sectionhead" style="margin-top:22px"><div><h3 style="margin:0">Portfolio examples</h3></div></div><div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${examples.map(p=>card(p)).join('')}</div>`:''}

    <div style="margin-top:26px;padding:22px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.02)">
      <h2 style="font-size:26px;margin:0 0 6px;font-style:italic">Inquire — ${esc(s.title)}</h2>
      <p id="inquirySubtext" style="color:var(--muted);margin-top:0"></p>

      <div class="formgrid" style="margin-top:16px">
        <div class="field"><label>Your Name / Handle *</label><input id="inqName" placeholder="Your name or handle"></div>
        <div class="field"><label>Company / Agency Name (Optional)</label><input id="inqCompany" placeholder="Studio or agency"></div>
        <div class="field"><label>Your Email Address *</label><input id="inqEmail" type="email" placeholder="you@example.com"></div>
        <div class="field"><label>Social Media e.g. @Handle *</label><input id="inqSocial" placeholder="@yourhandle"></div>
        <div class="field full"><label>Target Deadline / Preferred Delivery Date (Optional)</label><input id="inqDeadline" type="date"></div>
        <div class="field full"><label>Project Brief &amp; Description (Optional)</label><textarea id="inqBrief" placeholder="Tell them what you have in mind…"></textarea></div>
      </div>

      <div style="margin-top:16px;padding:16px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.02)">
        <div class="eyebrow" style="margin-bottom:10px;color:var(--gold)">Add-ons &amp; Custom Options</div>
        ${addOns.length?`<div style="display:flex;flex-direction:column;gap:8px" id="svcModalAddons">
          ${addOns.map((ao,idx)=>`<div class="addon-box" data-addon-wrap="${idx}"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;width:100%"><input type="checkbox" class="modalAddonCheck" data-idx="${idx}"> ${addonIcon(ao.title)} <span class="addon-title-text" data-addon-title="${idx}">${esc(ao.title)}</span> <span style="margin-left:auto;color:var(--gold);font-weight:800">${addonLabel(ao)}</span></label>${addonIsDuration(ao)?`<div class="duration-addon-control" data-duration-control="${idx}" style="display:none;margin:8px 0 2px 30px"><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px">Video Duration (mm:ss)</label><input class="duration-addon-input" data-duration-idx="${idx}" inputmode="numeric" placeholder="03:00" value="" style="width:150px;border:1px solid var(--line);background:#0a0910;color:var(--text);padding:9px 10px;border-radius:10px"><div class="meta duration-addon-help" data-duration-help="${idx}">Enter the total video duration.</div></div>`:''}</div>`).join('')}
        </div>`:`<div class="meta">This service has no optional add-ons.</div>`}
      </div>

      <div id="svcPriceBreakdown" style="margin-top:14px;padding:16px;border:1px solid var(--gold);border-radius:14px;background:rgba(232,207,145,.05)">
        <div class="eyebrow" style="color:var(--gold);margin-bottom:8px">Automatic price calculation</div>
        <div id="svcPriceLines" style="display:flex;flex-direction:column;gap:6px"></div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-weight:900;font-size:18px"><span>Total</span><span id="svcCalculatedTotal">$0.00 USD</span></div>
      </div>

      <div class="field full" style="margin-top:14px"><label>Upload Brief / Asset Attachment (Optional)</label><input type="file" id="inqAttachment"><div class="meta" id="inqAttachStatus">Images or documents, up to 5MB.</div></div>

      ${m?.tos?`
        <div class="tos-box" id="inquiryTosBox" style="max-height:220px">
          <div class="eyebrow" style="margin-bottom:6px">Terms of Service (TOS)</div>
          <div id="inquiryTosText">${formatDescription((state.language==='ja'&&m.tos_ja)?m.tos_ja:m.tos)}</div>
          ${state.language==='ja'&&!m.tos_ja?`<div class="meta" id="inquiryTosTranslationStatus" style="margin-top:8px">Japanese translation will be generated by the artist when their TOS is saved.</div>`:''}
        </div>
      `:''}

      <div class="addon-box" style="margin-top:14px">
        <label><input type="checkbox" id="inqAgreeTos"> <span data-i18n="I have read and agree to the">I have read and agree to the</span> <span id="inqTosAgreementName">${m?.tos?"Terms of Service":"artist's terms"}</span> <span data-i18n="(Required)">(Required)</span></label>
      </div>

      ${canCheckout?`
        <div class="formgrid" style="margin-top:14px">
          <div class="field" id="depositOption" role="button" tabindex="0" style="cursor:pointer;border:1px solid var(--gold);border-radius:12px;padding:12px;text-align:center">
            <b style="color:var(--gold)" id="depositAmountLabel">50% Deposit</b>
            <div class="meta" id="depositSubLabel">Save Slot</div>
          </div>
          <div class="field" id="fullOption" role="button" tabindex="0" style="cursor:pointer;border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center">
            <b id="fullAmountLabel">Full Amount</b>
            <div class="meta">Pay Upfront</div>
          </div>
        </div>
        <button class="btn primary" id="payPaypalBtn" style="width:100%;margin-top:16px;background:#ffc439;color:#0a0810;border-color:#ffc439;font-weight:900">PayPal</button>
        <button class="btn" id="payCardBtn" style="width:100%;margin-top:10px">💳 Debit or Credit Card</button>
        <p style="text-align:center;color:var(--muted);font-size:11px;margin-top:8px">Powered by PayPal</p>
      `:`
        <button class="btn primary" id="sendInquiryBtn" style="width:100%;margin-top:16px">Send Inquiry</button>
      `}
      <p id="inquiryMsg" style="color:var(--danger);min-height:18px;margin-top:8px"></p>
    </div>

    <div class="tags" style="margin-top:16px">${(s.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
  `;

  document.getElementById('projectModal').classList.add('open');

  if(state.language==='ja' && m?.tos && !m.tos_ja){
    const status=document.getElementById('inquiryTosTranslationStatus');
    if(status)status.textContent='Translating Terms of Service…';
    fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'translate_profile_tos',profile_id:m.id})})
      .then(r=>r.json().then(d=>({ok:r.ok,d}))).then(({ok,d})=>{
        if(ok && d.translation){m.tos_ja=d.translation;const el=document.getElementById('inquiryTosText');if(el)el.innerHTML=formatDescription(d.translation);if(status)status.remove();}
        else if(status)status.textContent='Japanese translation is temporarily unavailable; showing the original TOS.';
      }).catch(()=>{if(status)status.textContent='Japanese translation is temporarily unavailable; showing the original TOS.'});
  }

  document.getElementById('modalDirectChatBtn')?.addEventListener('click', async()=>{
    if(!m) return;
    const conv = await createOrGetConversation(m.id, s.id);
    if(conv) { closeModal(); openDashboard(); switchDashTab('messages'); selectConversation(conv.id); }
  });

  let paymentType='deposit';
  let pendingAttachmentUrl=null;

  // Initialize the pricing UI immediately when the service modal opens.
  // Previously the total remained at $0.00 until an add-on was toggled or
  // another interaction caused refreshPaymentUI() to run.

  function getSelectedAddonOptions(){
    return Array.from(document.querySelectorAll('.modalAddonCheck:checked')).map(cb=>{const ao=addOns[Number(cb.dataset.idx)];return {ao,durationSeconds:addonIsDuration(ao)?parseDurationInput(document.querySelector(`[data-duration-idx=\"${cb.dataset.idx}\"]`)?.value):null}}).filter(x=>x.ao);
  }
  function computeTotals(){
    const selectedOptions=getSelectedAddonOptions();
    const invalidDuration=selectedOptions.find(x=>addonIsDuration(x.ao)&&(x.durationSeconds===null));
    const selected=selectedOptions.map(x=>x.ao);
    const addonTotal=selectedOptions.reduce((n,x)=>n+addonAmount(basePrice,x.ao,{durationSeconds:x.durationSeconds}),0);
    const total=basePrice+addonTotal;
    return {total,deposit:total/2,selected,selectedOptions,addonTotal,invalidDuration};
  }
  function refreshPriceBreakdown(){
    const box=document.getElementById('svcPriceBreakdown'); if(!box)return;
    const {total,selectedOptions}=computeTotals();
    const lines=[`<div style=\"display:flex;justify-content:space-between;gap:12px\"><span>Base service</span><b>${formatMoneyForLanguage(basePrice)}</b></div>`];
    selectedOptions.forEach(x=>{const amount=addonAmount(basePrice,x.ao,{durationSeconds:x.durationSeconds});const dur=addonIsDuration(x.ao)&&x.durationSeconds!==null?` · ${formatDurationSeconds(x.durationSeconds)}`:'';lines.push(`<div style=\"display:flex;justify-content:space-between;gap:12px;color:var(--muted)\"><span>↳ ${esc(x.ao.title)}${dur}</span><b>+${formatMoneyForLanguage(amount)}</b></div>`)});
    if(!selectedOptions.length)lines.push('<div class=\"meta\">Select an add-on to update the total automatically.</div>');
    document.getElementById('svcPriceLines').innerHTML=lines.join('');
    document.getElementById('svcCalculatedTotal').textContent=formatMoneyForLanguage(total);
  }
  function formatMoneyForLanguage(usd){const n=Number(usd)||0;if(state.language==='ja'&&lunaristUsdJpyRate)return '¥'+Math.round(n*lunaristUsdJpyRate).toLocaleString('ja-JP')+' JPY';return '$'+n.toFixed(2)+' USD'}
  function refreshPaymentUI(){
    if(!canCheckout)return;
    const {total,deposit,invalidDuration}=computeTotals(); refreshPriceBreakdown();
    const currencyLabel=state.language==='ja'&&lunaristUsdJpyRate?'JPY':'USD';
    document.getElementById('depositAmountLabel').textContent='50% Deposit ('+formatMoneyForLanguage(deposit)+')';
    document.getElementById('fullAmountLabel').textContent='Full Amount ('+formatMoneyForLanguage(total)+')';
    document.getElementById('inquirySubtext').textContent=state.language==='ja'?`「${s.title}」へのお問い合わせ · ${formatMoneyForLanguage(paymentType==='deposit'?deposit:total)}（${paymentType==='deposit'?'50%枠確保デポジット':'全額'}）を支払うとウェイトリストに自動登録されます。`:`Inquiry for ${s.title} · Pay ${formatMoneyForLanguage(paymentType==='deposit'?deposit:total)} (${paymentType==='deposit'?'50% Slot Deposit':'Full Amount'}) to auto-register on the waitlist.`;
    const depEl=document.getElementById('depositOption'),fullEl=document.getElementById('fullOption');
    depEl.style.borderColor=paymentType==='deposit'?'var(--gold)':'var(--line)'; fullEl.style.borderColor=paymentType==='full'?'var(--gold)':'var(--line)';
    if(invalidDuration){document.getElementById('inquiryMsg').textContent=state.language==='ja'?'動画時間を入力してください。':'Enter a valid video duration (mm:ss).'}else{document.getElementById('inquiryMsg').textContent='';}
  }
  // Render the real base service price immediately on modal open.
  refreshPaymentUI();

  const depositOptionEl=document.getElementById('depositOption');
  const fullOptionEl=document.getElementById('fullOption');
  depositOptionEl?.addEventListener('click',()=>{paymentType='deposit';refreshPaymentUI();});
  fullOptionEl?.addEventListener('click',()=>{paymentType='full';refreshPaymentUI();});
  [depositOptionEl,fullOptionEl].forEach(el=>el?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}}));
  if(depositOptionEl){depositOptionEl.setAttribute('role','button');depositOptionEl.setAttribute('tabindex','0');}
  if(fullOptionEl){fullOptionEl.setAttribute('role','button');fullOptionEl.setAttribute('tabindex','0');}
  async function translateVisibleAddons(){if(state.language!=='ja')return;for(const [idx,ao] of addOns.entries()){const el=document.querySelector(`[data-addon-title=\"${idx}\"]`);if(!el)continue;const t=await translateAddonText(ao.title);el.textContent=t;const help=document.querySelector(`[data-duration-help=\"${idx}\"]`);if(help)help.textContent='動画の合計時間を入力してください。';}}

  document.querySelectorAll('.modalAddonCheck').forEach(cb=>cb.onchange=()=>{const idx=Number(cb.dataset.idx);const ctl=document.querySelector(`[data-duration-control=\"${idx}\"]`);if(ctl)ctl.style.display=cb.checked?'block':'none';if(!cb.checked){const input=document.querySelector(`[data-duration-idx=\"${idx}\"]`);if(input)input.value='';}refreshPaymentUI();});
  document.querySelectorAll('.duration-addon-input').forEach(input=>input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9:]/g,'').slice(0,7);refreshPaymentUI();}));
  if(state.language==='ja'){
    getUsdJpyRate().then(()=>refreshPaymentUI());
    translateVisibleAddons();
    const descEl=document.getElementById('serviceDescriptionText');
    if(descEl && s.description){translateServiceDescription(s.description).then(t=>{if(state.language==='ja'&&descEl)descEl.innerHTML=formatDescription(t);});}
  }

  document.getElementById('inqAttachment')?.addEventListener('change',async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    const statusEl=document.getElementById('inqAttachStatus');
    if(file.size>5*1024*1024){toast('File must be under 5MB');e.target.value='';return}
    statusEl.textContent='Uploading…';
    try{
      const ext=(file.name.split('.').pop()||'bin').toLowerCase();
      const path=`inquiries/${crypto.randomUUID()}.${ext}`;
      const up=await supabaseClient.storage.from('commission-uploads').upload(path,file,{upsert:false,contentType:file.type||undefined});
      if(up.error)throw up.error;
      pendingAttachmentUrl=supabaseClient.storage.from('commission-uploads').getPublicUrl(path).data.publicUrl;
      statusEl.textContent='Attached: '+file.name;
    }catch(err){statusEl.textContent='Upload failed.';toast(err.message||'Could not upload attachment')}
  });

  function collectInquiry(){
    const name=document.getElementById('inqName').value.trim();
    const email=document.getElementById('inqEmail').value.trim();
    const social=document.getElementById('inqSocial').value.trim();
    const agree=document.getElementById('inqAgreeTos').checked;
    const msgEl=document.getElementById('inquiryMsg');
    if(!name||!email||!social){msgEl.textContent='Please fill in your name, email and social handle.';return null}
    if(!agree){msgEl.textContent='Please agree to the Terms of Service to continue.';return null}
    const totals=computeTotals();
    if(totals.invalidDuration){msgEl.textContent=state.language==='ja'?'動画時間を正しい mm:ss 形式で入力してください。':'Please enter a valid video duration in mm:ss format.';return null}
    msgEl.textContent='';
    return {
      name,email,social,
      company:document.getElementById('inqCompany').value.trim(),
      target_deadline:document.getElementById('inqDeadline').value||null,
      message:document.getElementById('inqBrief').value.trim(),
      attachment_url:pendingAttachmentUrl,
      addon_titles:Array.from(document.querySelectorAll('.modalAddonCheck:checked')).map(cb=>addOns[Number(cb.dataset.idx)].title),
      addon_options:getSelectedAddonOptions().map(x=>({title:x.ao.title,duration_seconds:x.durationSeconds}))
    };
  }

  async function submitPayment(){
    const info=collectInquiry();if(!info)return;
    const btns=[document.getElementById('payPaypalBtn'),document.getElementById('payCardBtn')];
    btns.forEach(b=>b&&(b.disabled=true));
    document.getElementById('inquiryMsg').style.color='var(--muted)';
    document.getElementById('inquiryMsg').textContent='Redirecting to PayPal…';
    try{
      const r=await fetch('/api/paypal-checkout',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({
        service_id:s.id,
        addon_titles:info.addon_titles,
        addon_options:info.addon_options,
        currency:state.language==='ja'?'JPY':'USD',
        payment_type:paymentType,
        customer:{name:info.name,email:info.email,company:info.company,social:info.social,target_deadline:info.target_deadline,message:info.message,attachment_url:info.attachment_url}
      })});
      const od=await r.json();
      if(!r.ok)throw new Error(od?.error||'Unable to start checkout.');
      const approve=(od.links||[]).find(l=>l.rel==='approve'||l.rel==='payer-action');
      if(approve?.href){window.location.href=approve.href}
      else throw new Error('PayPal did not return a checkout link.');
    }catch(e){
      document.getElementById('inquiryMsg').style.color='var(--danger)';
      document.getElementById('inquiryMsg').textContent=e.message||'Something went wrong starting checkout.';
      btns.forEach(b=>b&&(b.disabled=false));
    }
  }
  document.getElementById('payPaypalBtn')?.addEventListener('click',submitPayment);
  document.getElementById('payCardBtn')?.addEventListener('click',submitPayment);

  document.getElementById('sendInquiryBtn')?.addEventListener('click',async()=>{
    const info=collectInquiry();if(!info)return;
    const btn=document.getElementById('sendInquiryBtn');btn.disabled=true;
    try{
      const r=await fetch('/api/paypal-checkout',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({
        action:'inquiry_only',
        service_id:s.id,
        addon_titles:info.addon_titles,
        addon_options:info.addon_options,
        currency:state.language==='ja'?'JPY':'USD',
        customer:{name:info.name,email:info.email,company:info.company,social:info.social,target_deadline:info.target_deadline,message:info.message,attachment_url:info.attachment_url}
      })});
      const rr=await r.json();
      if(!r.ok)throw new Error(rr?.error||'Unable to send inquiry.');
      
      if(m) {
        const conv = await createOrGetConversation(m.id, s.id);
        if(conv) {
          const initTxt = `👋 New Inquiry for "${s.title}":\n${info.message||'No brief provided'}`;
          await supabaseClient.from('messages').insert({ conversation_id: conv.id, sender_id: state.currentUser.id, content: initTxt, body: initTxt, attachment_url: info.attachment_url });
          await sendNotification(m.id, 'New Service Inquiry', `Received a new inquiry for ${s.title}`, 'inquiry', 'dashboard:messages');
        }
      }

      toast('Inquiry sent — conversation started!');
      closeModal();
      openDashboard();
      switchDashTab('messages');
    }catch(e){
      document.getElementById('inquiryMsg').textContent=e.message||'Something went wrong sending your inquiry.';
      btn.disabled=false;
    }
  });

  state._renderingService=true; applyLanguage(state.language||'en'); state._renderingService=false;
  const agreeName=document.getElementById('inqTosAgreementName');
  if(agreeName) agreeName.textContent=state.language==='ja'?(m?.tos?'利用規約':'アーティストの規約'):(m?.tos?'Terms of Service':"artist's terms");

  const mb=document.querySelector('[data-modal-member]');
  if(mb)mb.onclick=()=>{if(m){closeModal();goRoute('member:'+m.id)}};
  document.querySelectorAll('[data-project]').forEach(c=>c.onclick=()=>{closeModal();openProject(c.dataset.project)});
}

function emptyState(title='Nothing here yet.',text='Lunarist is waiting for its next creative signal.'){return `<div class="empty" style="grid-column:1/-1"><strong style="color:var(--text);display:block;margin-bottom:6px">${esc(title)}</strong>${esc(text)}</div>`}
function home(){const rec=personalized(),trending=[...data.projects].sort((a,b)=>b.likes-a.likes),recent=[...data.projects].sort((a,b)=>(Date.parse(b.created_at||'')||0)-(Date.parse(a.created_at||'')||0));return `<div class="container home-page"><section class="hero"><div class="eyebrow">A creative network by Lunarist Studio</div><h1>Unleash<br><em>Your Dream.</em></h1><p>Lunarist is a living portfolio where every artist can publish, every project can be discovered, and every visitor gets a different creative journey.</p><div class="heroactions">
<button class="btn primary" data-route="discover">Explore the work</button><button class="btn" data-route="services">Find a service</button></div></section><section class="section"><div class="sectionhead"><div><h2>For you</h2><p>Curated from what you explore.</p></div><span class="eyebrow">Personalized</span></div><div class="grid">${rec.length?rec.slice(0,5).map((p,i)=>card(p,i===0)).join(''):emptyState('No published work yet.','Create the first Lunarist project from your member space.')}</div></section><section class="section"><div class="sectionhead"><div><h2>Trending this week</h2><p>What the Lunarist community is watching.</p></div><span class="eyebrow">Popular</span></div><div class="grid">${trending.length?trending.slice(0,4).map(p=>card(p)).join(''):emptyState()}</div></section><section class="section"><div class="split"><div class="panel"><div class="sectionhead"><div><h2>Artists</h2><p>Find the right creative voice.</p></div><button class="btn" data-route="artists">View all</button></div><div class="artistgrid">${data.members.length?data.members.map(artistCard).join(''):emptyState('No public artist profiles yet.','Create an account to become one.')}</div></div><div class="panel"><div class="eyebrow">Discovery engine</div><h2 style="font-size:30px;letter-spacing:-.04em">Not everything has to match your taste.</h2><p style="color:var(--muted)">Lunarist mixes relevance with exploration, so your feed can introduce you to artists and disciplines you would not normally click.</p><button class="btn pink" data-action="reset-interest">Reset my feed</button></div></div></section><section class="section"><div class="sectionhead"><div><h2>New arrivals</h2><p>Fresh published work from the studio.</p></div></div><div class="grid">${recent.length?recent.slice(0,4).map(p=>card(p)).join(''):emptyState()}</div></section></div>`}
function artistCard(m){return `<article class="artistcard" data-member="${m.id}">${avatar(m)}<div class="artistname">${esc(m.name)}</div><div class="role">${esc(m.role)}</div>${m.is_admin?'<span class="badge" style="display:inline-block;margin-top:8px">Administrator</span>':''}<div class="tags">${(m.skills||[]).slice(0,2).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div style="margin-top:12px;font-size:11px;color:${m.available?'var(--green)':'var(--muted)'}">${m.available?'● Available':'● Booked'}</div></article>`}
function discover(){
  const roleOf = m => {
    if(!m) return '';
    if(m.is_admin) return 'Administrator';
    return String(m.role||'').trim() || (m.account_type==='member' ? 'Lunarist Member' : 'User');
  };
  const roleOptions = [
    'Astral Weavers',
    'Blizzcasters',
    'Minstrels',
    'Echobinders',
    'Leader',
    'Administrator',
    ...data.members.map(m=>roleOf(m)).filter(Boolean).filter(role=>!/director/i.test(role))
  ].filter((v,i,a)=>a.indexOf(v)===i);

  let list=data.projects.filter(p=>{
    const categoryMatch =
      state.filter==='All' ||
      state.filter==='Recommended' ||
      state.filter==='Trending' ||
      state.filter==='Newest' ||
      p.category===state.filter ||
      (p.tags||[]).includes(state.filter);
    const roleMatch =
      state.roleFilter==='All Roles' ||
      roleOf(member(p.member))===state.roleFilter;
    return categoryMatch && roleMatch;
  });

  if(state.query){
    const q=state.query.toLowerCase();
    list=list.filter(p=>{
      const m=member(p.member);
      return (p.title+' '+p.category+' '+(p.tags||[]).join(' ')+' '+(m?.name||'')+' '+roleOf(m))
        .toLowerCase().includes(q);
    });
  }

  const aiDiscoverActive=!state.query&&state.roleFilter==='All Roles'&&(state.filter==='All'||state.filter==='Recommended');
  if(aiDiscoverActive&&state.aiRanking?.discoverProjectIds?.length){
    list=aiOrder(list,state.aiRanking.discoverProjectIds);
  }else{
    list.sort((a,b)=>
      state.filter==='Recommended'?score(b)-score(a):
      state.filter==='Trending'?b.likes-a.likes:
      state.filter==='Newest'?(Date.parse(b.created_at||'')||0)-(Date.parse(a.created_at||'')||0):
      score(b)-score(a)
    );
  }

  const cats=['All','Recommended','Trending','Newest',...new Set(data.projects.map(p=>p.category))];

  return `<div class="container"><section class="section" style="padding-top:55px">
    <div class="sectionhead">
      <div><div class="eyebrow">Explore Lunarist</div><h2 style="font-size:46px">Discover work.</h2><p>Search projects, styles, artists and roles.</p></div>
      <input class="search" id="searchInput" placeholder="Search projects, artists, skills…" value="${esc(state.query)}">
    </div>
    <div class="discover-filter-group">
      <div class="discover-filter-label">Browse</div>
      <div class="discoverbar">${cats.map(c=>`<button class="filter ${state.filter===c?'active':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    </div>
    <div class="discover-filter-group discover-role-select-group">
      <label class="discover-filter-label" for="discoverRoleFilter">Role</label>
      <select id="discoverRoleFilter" class="discover-role-select" aria-label="Filter Discover by role">
        <option value="All Roles" ${state.roleFilter==='All Roles'?'selected':''}>All Roles</option>
        ${roleOptions.map(r=>`<option value="${esc(r)}" ${state.roleFilter===r?'selected':''}>${esc(r)}</option>`).join('')}
      </select>
    </div>
    <div class="grid" id="discoverGrid">${list.length?list.map(p=>card(p)).join(''):emptyState('No work found.','Try another search or role filter.')}</div>
  </section></div>`;
}
function artists(){return `<div class="container"><section class="section" style="padding-top:55px"><div class="eyebrow">The Lunarist collective</div><h2 style="font-size:52px;letter-spacing:-.05em;margin:10px 0">Meet the artists.</h2><p style="color:var(--muted);max-width:650px">Every member owns their profile and projects. Clients can discover people by discipline, style and availability.</p><div class="artistgrid" style="margin-top:28px">${data.members.length?data.members.map(artistCard).join(''):emptyState('No public artist profiles yet.','Create an account to become one.')}</div></section></div>`}

function profilePage(m){
  const ps=data.projects.filter(p=>p.member===m.id);
  const ss=sortServicesByOrder(data.services.filter(s=>s.member===m.id));
  applyTheme(m.theme || 'moonlight');
  updateSeoMeta(`${m.name} (@${m.username})`, m.bio, m.avatar);
  
  const formattedTos = String((state.language==='ja' && m.tos_ja ? m.tos_ja : m.tos)||'').trim();
  const isClientProfile = m.account_type !== 'member' && !m.is_admin;
  const canViewClientDashboard = isClientProfile && (state.currentUser?.id === m.id || !!state.currentMember?.is_admin);
  const clientDash = canViewClientDashboard ? `<div class="panel" id="publicClientDashboard" style="margin-top:42px"><div class="eyebrow">Client Dashboard</div><h2 style="margin:4px 0">My commissions &amp; reviews</h2><p class="meta">Your completed commissions, current orders, and reviews are all collected here.</p><div id="publicClientCommissions" style="margin-top:16px"><div class="meta">Loading your commissions…</div></div></div>` : '';

  return `<div class="container"><section class="section" style="padding-top:55px"><div class="row" style="justify-content:space-between"><button class="btn" data-route="artists">← Artists</button><div class="row"><button class="btn pink" id="profDirectChatBtn">💬 Chat with ${esc(m.name)}</button><button class="btn" id="copyProfileLink" data-username="${esc(m.username)}">Copy link</button></div></div><div class="panel" style="margin-top:16px;padding:30px"><div class="row" style="align-items:flex-start"><img class="avatar" style="width:86px;height:86px" src="${esc(m.avatar)}" alt="" onerror="handleImageError(this)"><div><div class="eyebrow">@${esc(m.username)}${m.is_admin?' · Administrator':(m.account_type==='member'?' · Lunarist Member':' · Client')}</div><h2 style="font-size:42px;margin:3px 0">${esc(m.name)}</h2><div style="color:var(--muted)">${esc(m.role)}</div><p style="max-width:650px;color:var(--muted)">${formatDescription(m.bio)}</p><div class="tags">${(m.skills||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div style="margin-top:14px;color:${m.available?'var(--green)':'var(--muted)'}">${m.available?'● Available for commissions':'● Currently booked'}</div><div id="profileSocialLinks" data-social-profile-id="${esc(m.id)}"></div></div></div></div><div class="sectionhead" style="margin-top:38px"><div><h2>Services</h2><p>${ss.length} listed</p></div></div><div class="grid">${ss.length?ss.map(serviceCard).join(''):emptyState('No services listed yet.')}</div><div class="sectionhead" style="margin-top:38px"><div><h2>Selected work</h2><p>${ps.length} published projects</p></div></div><div class="grid">${ps.length?ps.map(p=>card(p)).join(''):emptyState('No published projects yet.')}</div><div class="sectionhead" style="margin-top:42px"><div><div class="eyebrow">Client reviews</div><h2>Reviews from clients</h2><p id="artistReviewSummary">Loading reviews…</p></div></div><div id="artistReviews" class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="panel"><div class="meta">Loading reviews…</div></div></div>${formattedTos?`<div class="sectionhead" style="margin-top:42px"><div><div class="profile-tos-badge">📜 Artist Policies</div><h2 style="margin-top:6px">Terms of Service</h2></div></div><div class="profile-tos-card"><div class="profile-tos-body" id="profileTosBody">${formatDescription(formattedTos)}</div></div>`:''}${clientDash}</section></div>`
}

async function ensureProfileTosJapanese(m){
  if(!m || !m.id || !String(m.tos||'').trim() || String(m.tos_ja||'').trim()) return m?.tos_ja||'';
  const body=document.getElementById('profileTosBody');
  if(body){body.innerHTML='<div class="meta" style="padding:4px 0">日本語の利用規約を翻訳中…</div>'}
  try{
    const r=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'translate_profile_tos',profile_id:m.id})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok || !d.translation) throw new Error(d.error||'Translation failed');
    m.tos_ja=d.translation;
    const known=member(m.id);
    if(known) known.tos_ja=d.translation;
    if(state.currentMember?.id===m.id) state.currentMember.tos_ja=d.translation;
    const currentBody=document.getElementById('profileTosBody');
    if(currentBody) currentBody.innerHTML=formatDescription(d.translation);
    return d.translation;
  }catch(e){
    console.error('Profile TOS translation failed',e);
    const currentBody=document.getElementById('profileTosBody');
    if(currentBody) currentBody.innerHTML=formatDescription(m.tos);
    return '';
  }
}

async function loadArtistReviews(artistId){
  const wrap=document.getElementById('artistReviews'); const summary=document.getElementById('artistReviewSummary');
  if(!wrap||!artistId)return;
  const {data:rows,error}=await supabaseClient.from('client_reviews').select('id,rating,review,created_at,client:client_id(display_name,username,avatar_url)').eq('artist_id',artistId).eq('published',true).order('created_at',{ascending:false}).limit(12);
  if(error){wrap.innerHTML=`<div class="panel"><div class="meta">Reviews are temporarily unavailable.</div></div>`;return;}
  const reviews=rows||[]; const avg=reviews.length?reviews.reduce((n,r)=>n+Number(r.rating||0),0)/reviews.length:0;
  if(summary)summary.textContent=reviews.length?`${avg.toFixed(1)} / 5 · ${reviews.length} client review${reviews.length===1?'':'s'}`:'No client reviews yet.';
  if(!reviews.length){wrap.innerHTML=`<div class="panel" style="grid-column:1/-1"><div class="meta">Be the first client to leave a review after your completed commission.</div></div>`;return;}
  wrap.innerHTML=reviews.map(r=>{const c=r.client||{};return `<div class="panel" style="padding:18px"><div class="row"><img class="avatar" style="width:34px;height:34px" src="${esc(c.avatar_url||'https://i.pravatar.cc/160?u='+c.username)}" onerror="handleImageError(this)"><div class="grow"><b>${esc(c.display_name||c.username||'Client')}</b><div class="meta">${new Date(r.created_at).toLocaleDateString()}</div></div><span style="color:var(--gold);font-size:16px">${'★'.repeat(Number(r.rating||0))}${'☆'.repeat(5-Number(r.rating||0))}</span></div><p style="margin:12px 0 0;color:var(--muted)">${esc(r.review)}</p></div>`}).join('');
}

function render(preserveScroll){
  if(state.route==='admin' && document.getElementById('adminPageView') && !state._forceAdminRender){
    return;
  }
  state._forceAdminRender=false;
  const _scrollY=preserveScroll?window.scrollY:0;
  document.querySelectorAll('.navbtn[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===state.route));
  if(!state.route.startsWith('member:')){ 
    applyTheme(state.currentMember?.theme || 'moonlight');
    updateSeoMeta('', '', '');
  }
  let html=state.loadError?`<div class="container"><section class="section" style="padding-top:90px"><div class="empty"><strong style="color:var(--danger);display:block;margin-bottom:8px">Lunarist couldn't load its database.</strong><span>${esc(state.loadError)}</span><div class="heroactions" style="justify-content:center"><button class="btn primary" id="retryBtn">Retry</button></div></div></section></div>`:state.route==='home'?home():state.route==='discover'?discover():state.route==='services'?services():state.route==='artists'?artists():state.route==='commissions'?`<div class="container"><section class="section" style="padding-top:55px"><div class="sectionhead"><div><div class="eyebrow">Client Dashboard</div><h1 style="margin:4px 0">My Commissions</h1><p>Track your commissions, approve deliveries, and leave reviews for completed work.</p></div></div><div id="dash-commissions" style="margin-top:20px"></div></section></div>`:state.route==='admin'?`<div class="container"><section class="section" style="padding-top:55px" id="adminPageView"></section></div>`:state.route.startsWith('member:')?profilePage(member(state.route.split(':')[1])):home();
  document.getElementById('view').innerHTML=html;
  bind();
  if(state.route.startsWith('member:')) {
    const pid=state.route.split(':')[1];
    loadArtistReviews(pid);
    const pm=member(pid);
    if(pm && state.language==='ja' && String(pm.tos||'').trim() && !String(pm.tos_ja||'').trim()) ensureProfileTosJapanese(pm);
    if(pm && pm.account_type!=='member' && !pm.is_admin && (state.currentUser?.id===pm.id || !!state.currentMember?.is_admin)) renderPublicClientDashboard(pm.id);
  }
  if(state.route==='commissions') renderClientCommissionsTab();
  if(state.route!=='admin') trackSitePageView();
  if(state.route==='admin') renderAdminStudioPage();
  applyLanguage(state.language || localStorage.getItem('lunarist_lang') || 'en');
  window.scrollTo({top:preserveScroll?_scrollY:0,behavior:'instant'})
}

function bind(){
  document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{document.getElementById('navlinks').classList.remove('open');goRoute(b.dataset.route)});
  document.querySelectorAll('[data-project]').forEach(c=>c.onclick=()=>{const p=data.projects.find(x=>x.id===c.dataset.project);if(p)trackSiteEvent('project_click',{entityType:'project',entityId:p.id,category:p.category});openProject(c.dataset.project)});
  document.querySelectorAll('[data-service]').forEach(c=>c.onclick=()=>{const sv=data.services.find(x=>x.id===c.dataset.service);if(sv)trackSiteEvent('service_click',{entityType:'service',entityId:sv.id,category:sv.category});openService(c.dataset.service)});
  document.querySelectorAll('[data-member]').forEach(c=>c.onclick=()=>goRoute('member:'+c.dataset.member));
  document.getElementById('copyProfileLink')?.addEventListener('click',(e)=>{const url=location.origin+'/'+e.currentTarget.dataset.username;navigator.clipboard?.writeText(url).then(()=>toast('Profile link copied')).catch(()=>toast(url))});
  document.getElementById('profDirectChatBtn')?.addEventListener('click', async()=>{
    const m = member(state.route.split(':')[1]);
    if(!m) return;
    if(!state.currentUser){
      openAuth('signin');
      document.getElementById('authSubtitle').textContent='Sign in to chat with this artist.';
      document.getElementById('authModal')?.classList.add('open');
      return;
    }
    const conv = await createOrGetConversation(m.id);
    if(conv) { openDashboard(); switchDashTab('messages'); selectConversation(conv.id); }
  });
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render(true)});
  document.getElementById('discoverRoleFilter')?.addEventListener('change',e=>{state.roleFilter=e.target.value||'All Roles';render(true)});
  const s=document.getElementById('searchInput');if(s)s.oninput=e=>{const value=e.target.value;const caret=e.target.selectionStart??value.length;state.query=value;render(true);requestAnimationFrame(()=>{const next=document.getElementById('searchInput');if(next){next.focus({preventScroll:true});const pos=Math.min(caret,next.value.length);try{next.setSelectionRange(pos,pos)}catch(_){}}})};
  document.querySelector('[data-action="reset-interest"]')?.addEventListener('click',async()=>{state.session.interests={};state.session.viewed=[];data.recommendations=[];saveSession();await refreshRecommendations();toast('Your discovery profile was reset');render(true)});
  document.getElementById('retryBtn')?.addEventListener('click',()=>loadData());

  document.getElementById('notifToggleBtn')?.addEventListener('click', () => {
    document.getElementById('notifPopover').classList.toggle('open');
  });

  document.getElementById('markNotifsReadBtn')?.addEventListener('click', async () => {
    if(!state.currentUser) return;
    await supabaseClient.from('notifications').update({ is_read: true }).eq('user_id', state.currentUser.id);
    loadUserNotifications();
  });
}

function isXStatusUrl(raw){
  const s=String(raw||'').trim();
  if(!s)return false;
  try{
    const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);
    const h=u.hostname.toLowerCase().replace(/^www\./,'');
    return (h==='x.com'||h==='twitter.com'||h==='mobile.twitter.com') && /\/status\/\d+/i.test(u.pathname);
  }catch{return false}
}
let _twitterWidgetsPromise=null;
function loadTwitterWidgets(){
  if(window.twttr && window.twttr.widgets)return Promise.resolve(window.twttr);
  if(_twitterWidgetsPromise)return _twitterWidgetsPromise;
  _twitterWidgetsPromise=new Promise((resolve)=>{
    const existing=document.querySelector('script[src*="platform.twitter.com/widgets.js"]');
    if(existing){existing.addEventListener('load',()=>resolve(window.twttr));return}
    const s=document.createElement('script');
    s.src='https://platform.twitter.com/widgets.js';
    s.async=true;
    s.onload=()=>resolve(window.twttr);
    s.onerror=()=>resolve(null);
    document.head.appendChild(s);
  });
  return _twitterWidgetsPromise;
}
function twitchEmbedUrl(raw){
  const s=String(raw||'').trim();
  if(!s)return '';
  try{
    const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);
    const host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(host!=='twitch.tv'&&host!=='m.twitch.tv')return '';
    const parts=u.pathname.split('/').filter(Boolean);
    const parent=encodeURIComponent(location.hostname||'lunaristudio.vercel.app');
    if(parts[0]?.toLowerCase()==='videos'&&parts[1]){
      return 'https://player.twitch.tv/?video='+encodeURIComponent(parts[1])+'&parent='+parent;
    }
    if(parts[0]&&parts[0].toLowerCase()!=='clip'&&parts[0].toLowerCase()!=='directory'){
      return 'https://player.twitch.tv/?channel='+encodeURIComponent(parts[0])+'&parent='+parent;
    }
  }catch{}
  return '';
}

async function openProject(id){
  const p=data.projects.find(x=>x.id===id);if(!p)return;
  await track(p);
  const m=member(p.member);
  const linkedServices=data.services.filter(sv=>(sv.projectIds||[]).includes(p.id));

  updateSeoMeta(p.title, p.desc, p.image);

  const rawMediaLink=p.video||p.media_url||'';
  const twitchVideoUrl=twitchEmbedUrl(rawMediaLink);
  const xStatusUrl=isXStatusUrl(rawMediaLink)?rawMediaLink:'';
  const playbackUrl=!xStatusUrl && (twitchVideoUrl || (p.video ? (p.video + (p.video.includes('?')?'&':'?') + 'autoplay=1') : ''));
  const modalMediaEl=document.getElementById('modalMedia');
  if(xStatusUrl){
    // X (Twitter) status pages refuse to be framed, so this can't be an
    // <iframe src="https://x.com/..."> like the other platforms. Use X's
    // own embed widget instead, which is the only way it allows this.
    modalMediaEl.innerHTML=`<div style="width:100%;height:100%;overflow:auto;background:#000;display:flex;align-items:center;justify-content:center;padding:14px"><blockquote class="twitter-tweet" data-theme="dark"><a href="${esc(xStatusUrl)}"></a></blockquote></div>`;
    loadTwitterWidgets().then(w=>{ if(w&&w.widgets)w.widgets.load(modalMediaEl); });
  }else{
    modalMediaEl.classList.remove('auto-ratio');
    modalMediaEl.style.removeProperty('--media-width');
    if(playbackUrl){
      modalMediaEl.innerHTML=`<iframe src="${esc(playbackUrl)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy" referrerpolicy="origin"></iframe>`;
      // Embedded platforms have a known presentation ratio; keep it compact instead of stretching the old fixed-height box.
      modalMediaEl.classList.add('auto-ratio');
      modalMediaEl.style.setProperty('--media-width', `${Math.min(window.innerWidth*(window.innerWidth<=720?.94:.88),960)}px`);
    }else{
      modalMediaEl.innerHTML=`<img src="${esc(p.image)}" alt="" onload="applyNaturalMediaRatio(this.parentElement,this,{modal:true})" onerror="handleImageError(this)">`;
    }
  }
  
  document.getElementById('modalContent').innerHTML=`
    <div class="eyebrow">${esc(p.category)} ${p.lunarist_direct?`<span class="badge lunarist-direct-badge" title="Commissioned and purchased directly through Lunarist Studio" style="margin-left:8px;vertical-align:middle">✦ Lunarist Studio Commission</span>`:''}</div>
    <h2>${esc(p.title)}</h2>
    <div class="artist" style="gap:12px;margin-bottom:14px">
      ${avatar(m)}
      <div>
        <div style="font-weight:700">${esc(m?.name||'Unknown artist')}</div>
        <div class="meta" style="margin-top:0">${esc(m?.role||'')}</div>
      </div>
      <button class="btn" data-modal-member="${m?.id||''}" style="margin-left:auto;font-size:12px;padding:6px 12px">View Artist profile →</button>
    </div>
    <p>${formatDescription(p.desc)}</p>
    <div class="stats"><span class="stat">👁 ${formatViews(p.views)} views</span><button class="stat" id="likeBtn">♡ ${Number(p.likes||0)} like</button><button class="stat" id="saveBtn">${state.savedIds.has(p.id)?'✅ Saved':'🔖 Save'}</button></div>
    <div class="tags">${(p.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
    
    ${linkedServices.length?`
      <div style="margin-top:20px;padding:16px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.02)">
        <div class="eyebrow" style="margin-bottom:8px">Commission / Order Package</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${linkedServices.map(sv=>`
            <div class="row" style="justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,.025);border:1px solid var(--line);border-radius:12px">
              <div>
                <b style="display:block;font-size:14px">${esc(sv.title)}</b>
                <span class="meta">${sv.price_from?'From '+esc(sv.price_from):''} ${sv.delivery_time?'· '+esc(sv.delivery_time):''}</span>
              </div>
              <button class="btn primary" data-open-service="${sv.id}" style="font-size:12px;padding:8px 14px">💼 View Service</button>
            </div>
          `).join('')}
        </div>
      </div>
    `:''}
  `;

  document.getElementById('projectModal').classList.add('open');
  document.getElementById('likeBtn').onclick=()=>{p.likes++;track(p,'like');document.getElementById('likeBtn').textContent='♥ '+p.likes+' like';toast('Added to your interests')};
  document.getElementById('saveBtn').onclick=()=>toggleSaveProject(p.id);
  document.querySelector('[data-modal-member]').onclick=()=>{if(m){closeModal();goRoute('member:'+m.id)}};
  document.querySelectorAll('[data-open-service]').forEach(b=>b.onclick=()=>{closeModal();openService(b.dataset.openService)});
}

function closeModal(){document.getElementById('projectModal').classList.remove('open');const mm=document.getElementById('modalMedia');mm.innerHTML='';mm.classList.remove('auto-ratio');mm.style.removeProperty('--media-width');updateSeoMeta('','','')}
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove('show'),1800)}
function openAuth(mode='signin'){
  state.authMode=mode;
  const m=mode==='signup';
  const invite=String(state.inviteCode||localStorage.getItem('lunarist_pending_invite')||'').trim().toUpperCase();
  if(invite) state.inviteCode=invite;
  document.getElementById('authTitle').textContent=m?'Create your Lunarist account':'Sign in';
  document.getElementById('authSubtitle').textContent=m?(invite?'You were invited to join Lunarist as a Member.':'Member accounts require a one-time invitation.'):'Sign in securely with your Google account.';
  document.getElementById('authEmailWrap').style.display=m?'flex':'none';
  document.getElementById('authUsernameWrap').style.display=m?'flex':'none';
  document.getElementById('authDisplayWrap').style.display=m?'flex':'none';
  document.getElementById('authInviteWrap').style.display=m?'flex':'none';
  document.getElementById('authEmail').value='';
  document.getElementById('authInvite').value=invite;
  document.getElementById('authInvite').readOnly=!!invite;
  document.getElementById('authToggle').textContent=m?'I already have an account':'Lunarist Member Register';
  document.getElementById('authModeHint').textContent=m?(invite?'One-time invitation detected.':'A valid invitation code is required for Member signup.'):'Google is the only available sign-in method.';
  document.getElementById('authMessage').textContent='';
  const google=document.getElementById('googleAuth');
  google.textContent=m?'Continue with Google (invitation required)':'Continue with Google';
  if(m && invite) setTimeout(()=>document.getElementById('authInvite')?.focus(),50);
}
function closeAuth(){document.getElementById('authModal').classList.remove('open')}
async function reserveInvitation(code,email){
  code=String(code||'').trim().toUpperCase();email=String(email||'').trim().toLowerCase();
  if(!code||!email)return null;
  const nonce=crypto.randomUUID().replace(/-/g,'')+Math.random().toString(36).slice(2,10);
  const r=await fetch('/api/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reserve',code,email,nonce})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to reserve invitation.');
  localStorage.setItem('lunarist_invite_reservation',JSON.stringify({code,email,nonce,at:Date.now()}));
  localStorage.setItem('lunarist_pending_invite',code);state.inviteCode=code;return d;
}
function pendingInvitationReservation(){try{const r=JSON.parse(localStorage.getItem('lunarist_invite_reservation')||'null');if(r&&r.code&&r.email&&r.nonce)return r}catch{}return null}
async function redeemInvitation(code,nonce){
  code=String(code||'').trim().toUpperCase(); if(!code)return false;
  const r=await fetch('/api/invitations',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({action:'redeem',code,nonce:nonce||pendingInvitationReservation()?.nonce||''})});
  const d=await r.json(); if(!r.ok)throw new Error(d.error||'Invitation could not be redeemed.');
  localStorage.removeItem('lunarist_pending_invite');localStorage.removeItem('lunarist_invite_reservation');state.inviteCode='';return true;
}
async function redeemPendingInvitation(){
  if(!state.currentUser)return;
  const r=pendingInvitationReservation(); const code=state.inviteCode||localStorage.getItem('lunarist_pending_invite'); if(!code)return;
  try{await redeemInvitation(code,r?.nonce);await refreshUser();toast('Welcome to Lunarist — your Member invitation is active.')}catch(e){
    if(!/already used|invalid|expired|only be used when creating/i.test(e.message||''))toast(e.message||'Invitation could not be redeemed.');
    localStorage.removeItem('lunarist_pending_invite');localStorage.removeItem('lunarist_invite_reservation');state.inviteCode='';
  }
}
async function signInWithGoogle(){
  const btn=document.getElementById('googleAuth');btn.disabled=true;
  try{
    const isSignup=state.authMode==='signup';
    let redirect=window.location.origin+window.location.pathname+'?oauth=google';
    if(isSignup){
      const email=document.getElementById('authEmail').value.trim().toLowerCase();
      const invite=document.getElementById('authInvite').value.trim().toUpperCase();
      if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error('Enter the Google account email you will use to sign in.');
      if(!invite||!/^[A-Z0-9]{8,32}$/.test(invite))throw new Error('A valid one-time invitation code is required for Google signup.');
      const reservation=await reserveInvitation(invite,email);
      redirect=window.location.origin+'/?oauth=google&invite='+encodeURIComponent(invite)+'&nonce='+encodeURIComponent(reservation.nonce);
      const username=document.getElementById('authUsername').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32);
      const display=document.getElementById('authDisplay').value.trim();
      localStorage.setItem('lunarist_google_profile',JSON.stringify({username,display_name:display}));
    }
    const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect}});if(error)throw error;
  }catch(e){document.getElementById('authMessage').textContent=e.message||'Google sign-in failed.';btn.disabled=false}
}

async function refreshUser(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  state.currentUser=session?.user||null;
  if(state.currentUser){
    let {data:p}=await supabaseClient.from('profiles').select('id,username,display_name,role,bio,avatar_url,skills,available,is_admin,account_type,tos,tos_ja,theme,socials').eq('id',state.currentUser.id).maybeSingle();
    if(!p){
      const fallback={id:state.currentUser.id,username:(state.currentUser.email||'member').split('@')[0].replace(/[^a-z0-9_]/gi,'').slice(0,32)||'member',display_name:state.currentUser.email||'Lunarist member',role:'',bio:'',skills:[],available:true,account_type:'user',theme:'moonlight'};
      const r=await supabaseClient.from('profiles').insert(fallback).select().single();
      if(!r.error)p=r.data;
    }
    const isStudioAdmin = !!p?.is_admin || state.currentUser?.email === 'lunariststudio@gmail.com';
    state.currentMember=p?{
      id:p.id,
      username:p.username,
      name:p.display_name,
      role:p.role||'',
      bio:p.bio||'',
      tos:p.tos||'',
      tos_ja:p.tos_ja||'',
      theme:p.theme||'moonlight',
      avatar:p.avatar_url||'https://i.pravatar.cc/160?u='+p.id,
      skills:p.skills||[],
      available:p.available!==false,
      is_admin:isStudioAdmin,
      account_type:isStudioAdmin?'member':(p.account_type||'user'),
      socials:p.socials||{}
    }:null;
    state.selectedTheme = state.currentMember?.theme || 'moonlight';
    applyTheme(state.selectedTheme);
    document.getElementById('accountName').textContent=state.currentMember?.name||'Member';
    document.getElementById('accountAvatar').outerHTML=`<img class="avatar" id="accountAvatar" src="${esc(state.currentMember?.avatar||'')}" alt="" onerror="handleImageError(this)">`;
    loadUserNotifications();
    await loadSavedIds();
    startBackgroundMessageSync();
  }else{
    const navAdmin = document.getElementById('navAdminBtn');
    if(navAdmin) navAdmin.style.display='none';
    document.getElementById('accountName').textContent='Guest';
    document.getElementById('accountAvatar').outerHTML='<span class="avatar" id="accountAvatar">G</span>';
    state.currentMember=null;
    state.savedIds=new Set();
    stopBackgroundMessageSync();
    applyTheme('moonlight');
  }
}

async function loadSavedIds(){
  if(!state.currentUser){state.savedIds=new Set();return}
  const {data,error}=await supabaseClient.from('saved_projects').select('project_id').eq('user_id',state.currentUser.id);
  state.savedIds=new Set(error?[]:(data||[]).map(x=>x.project_id));
}

async function toggleSaveProject(id){
  if(!state.currentUser){openAuth('signin');return}
  const p=data.projects.find(x=>x.id===id);
  const saved=state.savedIds.has(id);
  const btn=document.getElementById('saveBtn');
  if(saved){
    const {error}=await supabaseClient.from('saved_projects').delete().eq('user_id',state.currentUser.id).eq('project_id',id);
    if(error){toast(error.message);return}
    state.savedIds.delete(id);
    if(btn)btn.textContent='🔖 Save';
    toast('Removed from Saved');
  }else{
    const {error}=await supabaseClient.from('saved_projects').insert({user_id:state.currentUser.id,project_id:id});
    if(error){toast(error.message);return}
    state.savedIds.add(id);
    if(btn)btn.textContent='✅ Saved';
    if(p)track(p,'save');
    toast('Saved to your account');
  }
  if(document.getElementById('drawer')?.classList.contains('open')) renderSavedTab();
}

function renderSavedTab(){
  const container=document.getElementById('dash-saved');
  if(!container) return;
  const saved=data.projects.filter(p=>state.savedIds.has(p.id));
  container.innerHTML=`<div class="panel"><div class="eyebrow">Saved</div><h3 style="margin:4px 0">Your saved projects</h3><p class="meta">Projects you've bookmarked, synced to your Lunarist account.</p><div class="grid" id="savedGrid" style="margin-top:16px${saved.length?';grid-template-columns:repeat(2,minmax(0,1fr))':''}">${saved.length?saved.map(p=>card(p)).join(''):emptyState('Nothing saved yet.','Tap 🔖 Save on any project to bookmark it here.')}</div></div>`;
  container.querySelectorAll('[data-project]').forEach(el=>el.onclick=()=>{closeDash();openProject(el.dataset.project)});
}

function switchDashTab(tabName) {
  const valid = ['overview','messages','saved','projects','profile','services'];
  if(!valid.includes(tabName)) tabName='overview';
  document.querySelectorAll('[data-dash]').forEach(x=>x.classList.toggle('active', x.dataset.dash===tabName));
  document.querySelectorAll('.dashsection').forEach(x=>x.classList.toggle('active', x.id==='dash-'+tabName));
  const navCommission=document.getElementById('navCommissionsBtn');
  if(navCommission) navCommission.classList.toggle('active', tabName==='commissions');
  const drawer=document.getElementById('drawer');
  if(drawer) drawer.dataset.activeTab=tabName;
  applyLanguage(state.language || localStorage.getItem('lunarist_lang') || 'en');
}



async function openCommissionsPage(){
  if(!state.currentUser){openAuth('signin');return}
  await refreshUser();
  const m=state.currentMember;
  if(!m){toast('Your profile could not be loaded.');return}
  const {data:clientCommissions,error}=await supabaseClient.from('commissions').select('id,service_id,artist_id,client_id,status,payment_type,deposit_amount,total_amount,amount,currency,target_deadline,created_at,updated_at,project_title,client_name,company,paypal_order_id,paypal_capture_id,service:service_id(id,title,thumbnail_url),artist:artist_id(id,display_name,username,avatar_url),client_reviews(id,rating,review,published,created_at)').eq('client_id',m.id).order('created_at',{ascending:false});
  state.myCommissions=clientCommissions||[];
  state.myCommissionError=error?.message||null;
  state.route='commissions';
  const path=pathForRoute('commissions');
  if(location.pathname!==path) history.pushState({route:'commissions'},'',path);
  render();
}

async function openDashboard(initialTab='overview'){
  if(!state.currentUser){openAuth('signin');return}
  await refreshUser();
  await loadUserConversations();
  const m=state.currentMember;
  if(!m){toast('Your profile could not be loaded.');return}
  
  const [{data:ps},{data:ss},{data:clientCommissions,error:commissionError}]=await Promise.all([
    supabaseClient.from('projects').select('*').eq('owner_id',m.id).order('created_at',{ascending:false}),
    supabaseClient.from('services').select('id,owner_id,artist_id,title,description,category,tags,price_from,amount,delivery_time,thumbnail_url,status,published,featured,views,add_ons,sort_order,created_at,updated_at,service_projects(project_id)').or(`owner_id.eq.${m.id},artist_id.eq.${m.id}`).order('sort_order',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}),
    supabaseClient.from('commissions').select('id,service_id,artist_id,client_id,status,payment_type,deposit_amount,total_amount,amount,currency,target_deadline,created_at,updated_at,project_title,client_name,company,paypal_order_id,paypal_capture_id,service:service_id(id,title,thumbnail_url),artist:artist_id(id,display_name,username,avatar_url),client_reviews(id,rating,review,published,created_at)').eq('client_id',m.id).order('created_at',{ascending:false})
  ]);
  state.myCommissions=clientCommissions||[];
  state.myCommissionError=commissionError?.message||null;
  
  state.myProjects=(ps||[]).sort((a,b)=>(a.position||0)-(b.position||0));
  const userServices = ((ss && ss.length) ? ss : data.services.filter(s => s.member === m.id)).slice().sort((a,b)=>{ const ao=Number(a.sort_order); const bo=Number(b.sort_order); const an=Number.isFinite(ao)?ao:2147483647; const bn=Number.isFinite(bo)?bo:2147483647; return an-bn || String(b.created_at||'').localeCompare(String(a.created_at||'')); });


  document.getElementById('dashTitle').textContent=m.name+' · '+roleLabel(m);
  document.getElementById('dash-overview').innerHTML=`<div class="panel"><div class="eyebrow">Overview</div><h3 style="font-size:26px;margin:5px 0">Welcome back, ${esc(m.name)}.</h3><p style="color:var(--muted)">Your profile and projects are stored in Supabase. Published work appears in Discover.</p><div class="stats"><span class="stat">${roleLabel(m)}</span><span class="stat">${(state.myProjects).length} projects</span><span class="stat">${(state.myProjects).reduce((n,p)=>n+Number(p.views||0),0).toLocaleString()} views</span></div>${(m.account_type!=='member'&&!m.is_admin)?'<p class="meta" style="margin-top:10px">You\'re a Lunarist User — ask a Studio admin to promote you to Lunarist Member to publish work.</p>':''}</div>`;
  const canPublish=m.account_type==='member'||m.is_admin;
  document.getElementById('dash-projects').innerHTML=canPublish?`<div class="panel"><div class="row"><div class="grow"><div class="eyebrow">My projects</div><h3 style="margin:4px 0">Create and manage work</h3></div><button class="btn primary" id="addProject">+ New project</button></div><div id="projectList" style="margin-top:12px">${(state.myProjects).length?(state.myProjects).map((p,idx)=>`<div class="listitem draggable" draggable="true" data-id="${p.id}" data-index="${idx}"><div class="drag-handle" title="Drag to reorder">⋮⋮</div><img class="listthumb" src="${esc(p.thumbnail_url||p.media_url||'')}" onerror="handleImageError(this)"><div class="grow"><b>${esc(p.title)}</b><div class="meta">${esc(p.category)} · ${esc(p.status|| (p.published?'published':'draft'))} · ${formatViews(p.views)} views</div></div><button class="btn" data-edit-project="${p.id}">Edit</button></div>`).join(''):emptyState('No projects yet.','Publish your first piece of work.')}</div><div id="projectForm" style="margin-top:16px"></div></div>`:`<div class="panel">${emptyState('Lunarist Members can publish work.','You currently have a User account. Ask a Studio admin to promote you to Lunarist Member to create and submit projects.')}</div>`;
  
  renderMessagesTab();
  renderSavedTab();

  document.getElementById('dash-profile').innerHTML=`
    <div class="panel">
      <div class="eyebrow">Edit profile</div>
      <div class="row" style="margin:12px 0 18px">
        <img class="avatar" id="pfAvatarPreview" style="width:64px;height:64px" src="${esc(m.avatar||'')}" alt="" onerror="handleImageError(this)">
        <div>
          <button class="btn" id="pfAvatarBtn" type="button">Change photo</button>
          <input type="file" id="pfAvatarFile" accept="image/*" style="display:none">
          <div class="meta" id="pfAvatarStatus">JPG or PNG, square works best.</div>
        </div>
      </div>
      <div class="formgrid">
        <div class="field"><label>Display name</label><input id="pfName" value="${esc(m.name)}"></div>
        <div class="field"><label>Username</label><input id="pfUsername" value="${esc(m.username)}" maxlength="32" pattern="[a-z0-9_]+"><div class="meta">${esc(location.host)}/<span id="pfUsernamePreview">${esc(m.username)}</span></div></div>
        <div class="field full"><label>Role</label><input id="pfRole" value="${esc(m.role)}"></div>
        <div class="field full"><label>Bio</label><div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button type="button" class="btn" data-ai-improve="pfBio">✨ Improve with AI</button></div><textarea id="pfBio">${esc(m.bio)}</textarea></div>

        <div class="field full" style="margin-top:6px">
          <label style="font-size:12px;font-weight:700;color:var(--moon)">Terms of Service (TOS)</label>
          <div class="meta" style="margin-bottom:6px">Specify your client policies, payment terms, revision limits, or commercial use rules. Supports bullet points.</div>
          <textarea id="pfTos" style="min-height:180px;line-height:1.6;font-family:inherit" placeholder="• 50% upfront payment required before starting work&#10;• Includes 2 free revisions per project&#10;• Commercial license available as an add-on">${esc(m.tos||'')}</textarea>
          <div class="row" style="justify-content:space-between;margin-top:8px;gap:8px;flex-wrap:wrap">
            <div class="meta" id="pfTosJaStatus">${m.tos_ja?'Japanese translation ready.':'Japanese translation will be generated automatically when you save.'}</div>
            <button class="btn" type="button" id="translateTosJaBtn">🇯🇵 Translate to Japanese</button>
          </div>
        </div>
        <div class="field"><label>Availability</label><select id="pfAvail"><option value="1" ${m.available?'selected':''}>Available</option><option value="0" ${!m.available?'selected':''}>Booked</option></select></div>
      </div>
      <button class="btn primary" style="margin-top:16px" id="saveProfile">Save profile</button>
      <button class="btn" style="margin:16px 0 0 8px" id="signOut">Sign out</button>
    </div>
  `;
  
  document.getElementById('dash-services').innerHTML=canPublish?`<div class="panel"><div class="row"><div class="grow"><div class="eyebrow">My services</div><h3 style="margin:4px 0">Offer commissions & packages</h3><div class="meta" style="margin-top:4px">Drag the handle to control the order clients see your services.</div></div><button class="btn primary" id="addService">+ New service</button></div><div id="serviceList" class="service-reorder-list" style="margin-top:12px">${userServices.length?userServices.map((s,idx)=>`<div class="listitem draggable" draggable="true" data-id="${esc(s.id)}"><div class="drag-handle" title="Drag to reorder">⋮⋮</div><img class="listthumb" src="${esc(s.thumbnail_url||'')}" onerror="handleImageError(this)"><div class="grow"><b>${esc(s.title)}</b><div class="meta">${esc(s.category)} · ${esc(s.status||(s.published?'published':'draft'))} · ${(s.service_projects||s.projectIds||[]).length} linked project(s)</div></div><button class="btn" data-edit-service="${s.id}">Edit</button></div>`).join(''):emptyState('No services yet.','List a service artists can hire you for.')}</div><div id="serviceForm" style="margin-top:16px"></div></div>`:`<div class="panel">${emptyState('Lunarist Members can offer services.','You currently have a User account. Ask a Studio admin to promote you to Lunarist Member to create services.')}</div>`;
  document.getElementById('drawer').classList.add('open');
  bindDashboard(state.myProjects,userServices)
}

function setupServiceDragAndDrop(){
  const container=document.getElementById('serviceList');
  if(!container)return;

  container.querySelectorAll('.listitem.draggable').forEach(item=>{
    item.addEventListener('dragstart',(e)=>{
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',item.dataset.id);
    });

    item.addEventListener('dragend',async()=>{
      item.classList.remove('dragging');
      await saveNewServiceOrder();
    });

    item.addEventListener('dragover',(e)=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      const draggingItem=container.querySelector('.dragging');
      if(!draggingItem||draggingItem===item)return;

      const rect=item.getBoundingClientRect();
      const next=(e.clientY-rect.top)/(rect.bottom-rect.top)>0.5;
      container.insertBefore(draggingItem,next?item.nextSibling:item);
    });
  });

  async function saveNewServiceOrder(){
    const items=Array.from(container.querySelectorAll('.listitem.draggable'));
    const updates=items.map((el,index)=>({
      id:el.dataset.id,
      sort_order:index
    }));

    if(Array.isArray(window.data?.services)){
      window.data.services.sort((a,b)=>{
        const idxA=updates.findIndex(u=>u.id===a.id);
        const idxB=updates.findIndex(u=>u.id===b.id);
        return (idxA<0?999999:idxA)-(idxB<0?999999:idxB);
      });
      updates.forEach(u=>{
        const s=window.data.services.find(x=>x.id===u.id);
        if(s)s.sort_order=u.sort_order;
      });
    }

    if(Array.isArray(window.state?.myServices)){
      window.state.myServices.sort((a,b)=>{
        const idxA=updates.findIndex(u=>u.id===a.id);
        const idxB=updates.findIndex(u=>u.id===b.id);
        return (idxA<0?999999:idxA)-(idxB<0?999999:idxB);
      });
    }

    for(const update of updates){
      await supabaseClient.from('services').update({sort_order:update.sort_order}).eq('id',update.id).eq('owner_id',state.currentUser.id);
    }
    toast('Service order saved');
    await loadData();
  }
}

function commissionClientStatusLabel(status){
  return commissionStatusLabel(status);
}

async function renderPublicClientDashboard(clientId){
  const container=document.getElementById('publicClientCommissions');
  if(!container)return;
  const {data:rows,error}=await supabaseClient.from('commissions').select('id,status,total_amount,amount,currency,target_deadline,created_at,updated_at,project_title,service:service_id(id,title,thumbnail_url),artist:artist_id(id,display_name,username,avatar_url),client_reviews(id,rating,review,published,created_at)').eq('client_id',clientId).order('created_at',{ascending:false});
  if(error){container.innerHTML=`<div class="meta">Unable to load commissions: ${esc(error.message)}</div>`;return;}
  if(!rows?.length){container.innerHTML=`<div class="empty">No commissions yet. Your artist commissions will appear here.</div>`;return;}
  container.innerHTML=rows.map(c=>{
    const a=c.artist||{},sv=c.service||{},rv=Array.isArray(c.client_reviews)?c.client_reviews[0]:null;
    return `<article class="panel" style="padding:16px;margin-top:10px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><div class="eyebrow">${esc(sv.title||c.project_title||'Commission')}</div><div class="meta">Artist: ${esc(a.display_name||a.username||'Artist')}</div></div><span class="pill">${esc(commissionClientStatusLabel(c.status))}</span></div><div class="stats" style="margin-top:10px"><span class="stat">${esc(c.currency||'USD')} ${Number(c.total_amount||c.amount||0).toFixed(2)}</span>${c.target_deadline?`<span class="stat">Due ${esc(c.target_deadline)}</span>`:''}<span class="stat">${new Date(c.created_at).toLocaleDateString()}</span></div>${rv?`<div style="margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:12px"><div class="eyebrow">Your review</div><div style="color:var(--gold)">${'★'.repeat(Number(rv.rating||0))}${'☆'.repeat(5-Number(rv.rating||0))}</div><div class="meta">${esc(rv.review)}</div></div>`:''}</article>`;
  }).join('');
}

function renderClientCommissionsTab(){
  const container=document.getElementById('dash-commissions');
  if(!container) return;
  const rows=Array.isArray(state.myCommissions)?state.myCommissions:[];
  if(state.myCommissionError){
    container.innerHTML=`<div class="panel"><div class="eyebrow">My Commissions</div><h3 style="margin:5px 0">Unable to load commissions</h3><p class="meta">${esc(state.myCommissionError)}</p></div>`;
    return;
  }
  if(!rows.length){
    container.innerHTML=`<div class="panel">${emptyState('No commissions yet.','When you commission a Lunarist artist, your orders and completed work will appear here.')}</div>`;
    return;
  }
  container.innerHTML=`<div class="panel"><div class="eyebrow">Client Dashboard</div><h3 style="margin:4px 0">My Commissions</h3><p class="meta">Track every commission you have commissioned, approve delivery, and leave a review when the work is complete.</p><div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">${rows.map(c=>{
    const artist=c.artist||{}; const service=c.service||{}; const review=Array.isArray(c.client_reviews)?c.client_reviews[0]:null;
    const idx=commissionStatusIndex(c.status||'waitlist');
    const canApprove=c.status==='delivered'; const canReview=c.status==='completed'&&!review;
    return `<article class="panel" style="padding:16px;background:rgba(255,255,255,.02)">
      <div class="row" style="align-items:flex-start;justify-content:space-between;gap:12px">
        <div class="grow"><div class="eyebrow">Commission</div><h3 style="margin:3px 0 6px">${esc(service.title||c.project_title||'Commission')}</h3><div class="meta artist"><img class="avatar" style="width:26px;height:26px" src="${esc(artist.avatar_url||'https://i.pravatar.cc/160?u='+artist.id)}" onerror="handleImageError(this)"><span>${esc(artist.display_name||artist.username||'Lunarist Artist')}</span></div></div>
        <span class="pill">${esc(commissionClientStatusLabel(c.status))}</span>
      </div>
      <div class="stats" style="margin:12px 0"><span class="stat">${esc(c.currency||'USD')} ${Number(c.total_amount||c.amount||0).toFixed(2)}</span>${c.target_deadline?`<span class="stat">Due ${esc(c.target_deadline)}</span>`:''}<span class="stat">${new Date(c.created_at).toLocaleDateString()}</span></div>
      <div style="display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px;margin:10px 0 16px">${PUBLIC_COMMISSION_STATUSES.map((st,i)=>`<div title="${esc(st.label)}"><div style="height:5px;border-radius:99px;background:${i<=idx?'var(--moon)':'rgba(255,255,255,.1)'}"></div><div class="meta" style="font-size:9px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(st.label)}</div></div>`).join('')}</div>
      ${canApprove?`<button class="btn primary" data-approve-commission="${c.id}">✓ Approve delivery & complete</button>`:''}
      ${review?`<div style="margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025)"><div class="eyebrow">Your review</div><div style="color:var(--gold);font-size:18px;margin:3px 0">${'★'.repeat(Number(review.rating||0))}${'☆'.repeat(5-Number(review.rating||0))}</div><div style="font-size:13px;color:var(--muted)">${esc(review.review)}</div></div>`:''}
      ${canReview?`<div class="client-review-form" data-review-form="${c.id}" style="margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:14px"><div class="eyebrow">Review your completed commission</div><div class="field" style="margin-top:8px"><label>Rating</label><select data-review-rating="${c.id}"><option value="5">★★★★★ — Excellent</option><option value="4">★★★★☆ — Great</option><option value="3">★★★☆☆ — Good</option><option value="2">★★☆☆☆ — Needs work</option><option value="1">★☆☆☆☆ — Poor</option></select></div><div class="field" style="margin-top:8px"><label>Your review</label><textarea data-review-text="${c.id}" placeholder="Tell future clients about your experience…"></textarea></div><button class="btn pink" style="margin-top:8px" data-submit-review="${c.id}">Publish review</button></div>`:''}
    </article>`;
  }).join('')}</div></div>`;

  document.querySelectorAll('[data-approve-commission]').forEach(btn=>btn.onclick=async()=>{
    btn.disabled=true;
    const {error}=await supabaseClient.from('commissions').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',btn.dataset.approveCommission).eq('client_id',state.currentUser.id).eq('status','delivered');
    if(error){toast(error.message);btn.disabled=false;return;}
    toast('Commission completed.');
    await openDashboard();
    });
  document.querySelectorAll('[data-submit-review]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.submitReview; const rating=Number(document.querySelector(`[data-review-rating="${id}"]`)?.value||5); const text=document.querySelector(`[data-review-text="${id}"]`)?.value.trim()||'';
    if(text.length<10){toast('Please write at least 10 characters.');return;}
    btn.disabled=true;
    const commission=rows.find(x=>x.id===id);
    const {error}=await supabaseClient.from('client_reviews').insert({commission_id:id,client_id:state.currentUser.id,artist_id:commission.artist_id,rating,review:text});
    if(error){toast(error.message);btn.disabled=false;return;}
    toast('Thank you — your review is published.');
    await openDashboard();
    });
  switchDashTab(initialTab);
  applyLanguage(state.language || 'en');
}

function updateMessagesUnreadBadge() {
  const badge = document.getElementById('messagesUnreadBadge');
  if(!badge) return;
  const count = (state.conversations || []).reduce((total, c) => total + ((c.messages || []).filter(m => !m.is_read && m.sender_id !== state.currentUser?.id).length || 0), 0);
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.style.display = count ? 'inline-block' : 'none';
}

function renderMessagesTab() {
  updateMessagesUnreadBadge();
  const container = document.getElementById('dash-messages');
  if(!container) return;

  if(!state.conversations.length) {
    container.innerHTML = `<div class="panel">${emptyState('No conversations yet.','Message an artist from their profile or inquiry on a service to start collaborating.')}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="panel">
      <div class="eyebrow">Direct Messaging</div>
      <h3 style="margin:4px 0 14px">Active Collaborations</h3>
      <div class="split" style="grid-template-columns:1fr;gap:12px">
        <div id="conversationsList" style="display:flex;flex-direction:column;gap:8px">
          ${state.conversations.map(c => {
            const partner = c.client_id === state.currentUser.id ? c.artist : c.client;
            const lastMsg = c.messages?.[c.messages.length - 1];
            const unreadCount = c.messages?.filter(m => !m.is_read && m.sender_id !== state.currentUser.id).length || 0;
            return `
              <div class="listitem" style="cursor:pointer;padding:10px 14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.02)" data-select-conv="${c.id}">
                <img class="avatar" src="${esc(partner?.avatar_url || 'https://i.pravatar.cc/160?u='+partner?.id)}" style="width:36px;height:36px" onerror="handleImageError(this)">
                <div class="grow">
                  <b>${esc(partner?.display_name || partner?.username || 'User')}</b>
                  ${c.service?.title ? `<span class="tag" style="margin-left:6px">${esc(c.service.title)}</span>` : ''}
                  <div class="meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px">${esc(lastMsg?.content || 'Started conversation')}</div>
                </div>
                ${unreadCount ? `<span class="unread-badge">${unreadCount}</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
        <div id="activeChatBox" style="display:none"></div>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-select-conv]').forEach(el => {
    el.onclick = () => selectConversation(el.dataset.selectConv);
  });
}

async function selectConversation(convId) {
  state.activeConversation = state.conversations.find(c => c.id === convId);
  if(!state.activeConversation) return;

  const { data: messages } = await supabaseClient.from('messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true });

  const partner = state.activeConversation.client_id === state.currentUser.id ? state.activeConversation.artist : state.activeConversation.client;

  const chatBox = document.getElementById('activeChatBox');
  if(!chatBox) return;
  chatBox.style.display = 'block';

  chatBox.innerHTML = `
    <div class="chat-head" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:2px 2px 12px;border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <img class="avatar" src="${esc(partner?.avatar_url || 'https://i.pravatar.cc/160?u='+partner?.id)}" style="width:38px;height:38px" onerror="handleImageError(this)">
        <div style="min-width:0">
          <b style="font-size:15px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(partner?.display_name || partner?.username || 'User')}</b>
          <div class="meta" style="margin:2px 0 0">Active Session</div>
        </div>
      </div>
      <button type="button" class="chat-profile-chip" id="chatPartnerProfile" title="Open profile">
        <img class="avatar" src="${esc(partner?.avatar_url || 'https://i.pravatar.cc/160?u='+partner?.id)}" style="width:30px;height:30px" onerror="handleImageError(this)">
        <span>${esc(partner?.display_name || partner?.username || 'Profile')}</span>
      </button>
    </div>
    <div class="chat-thread-container chat-dropzone" id="chatDropzone">
      <div class="chat-messages-list" id="chatMsgFeed">
        ${(messages||[]).map(m => {
          const isMine = m.sender_id === state.currentUser.id;
          const url=String(m.attachment_url||'');
          const isImage=/\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(url);
          const attachment=url ? (isImage ? `<button type="button" class="chat-attachment-view-btn" onclick="openAttachmentViewer('${esc(url)}','Attachment')"><img class="chat-inline-image" src="${esc(url)}" alt="Attachment" onerror="this.style.display='none'"></button>` : `<button type="button" class="chat-file-link" onclick="openAttachmentViewer('${esc(url)}','Attachment')">📎 View attachment</button>`) : '';
          return `
            <div class="chat-bubble ${isMine ? 'mine' : 'other'}">
              ${m.content ? `<div>${esc(m.content).replace(/\n/g,'<br>')}</div>` : ''}
              ${attachment}
              <div class="chat-meta">${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="chat-composer">
        <div class="chat-attachment-preview" id="chatAttachmentPreview">
          <div class="chat-file-icon" id="chatAttachmentIcon">📎</div>
          <div class="chat-file-chip"><b id="chatAttachmentName">Attachment</b><span class="meta" id="chatAttachmentSize"></span></div>
          <button class="iconbtn" type="button" id="chatAttachmentRemove" title="Remove attachment">×</button>
        </div>
        <div class="chat-input-row">
          <div class="chat-input-wrap">
            <button class="chat-attach-btn" type="button" id="chatAttachBtn" title="Attach a file">📎</button>
            <textarea id="chatInputText" rows="1" placeholder="Write a message…"></textarea>
            <input id="chatFileInput" type="file" hidden accept="image/*,.pdf,.zip,.rar,.txt,.doc,.docx,.psd,.ai,.fig,.mp4,.mov,.webm">
          </div>
          <button class="btn primary chat-send-btn" id="chatSendBtn" type="button" title="Send message">➤</button>
        </div>
        <div class="chat-status" id="chatStatus">Attach files up to 10MB · Drop a file into the chat</div>
      </div>
    </div>
  `;

  document.getElementById('chatPartnerProfile')?.addEventListener('click',()=>{
    if(partner?.id){
      const target = member(partner.id);
      if(target) goRoute('member:'+partner.id);
      else if(state.currentMember?.is_admin) goRoute('member:'+partner.id);
    }
  });

  const feed = document.getElementById('chatMsgFeed');
  if(feed) feed.scrollTop = feed.scrollHeight;

  let pendingChatFile = null;
  const fileInput=document.getElementById('chatFileInput');
  const attachBtn=document.getElementById('chatAttachBtn');
  const preview=document.getElementById('chatAttachmentPreview');
  const statusEl=document.getElementById('chatStatus');
  const textInput=document.getElementById('chatInputText');
  const dropzone=document.getElementById('chatDropzone');

  function humanFileSize(bytes){
    if(bytes<1024)return bytes+' B';
    if(bytes<1024*1024)return (bytes/1024).toFixed(1)+' KB';
    return (bytes/1024/1024).toFixed(1)+' MB';
  }
  function setPendingFile(file){
    if(!file)return;
    if(file.size>10*1024*1024){toast('Chat files must be under 10MB');return;}
    pendingChatFile=file;
    document.getElementById('chatAttachmentName').textContent=file.name;
    document.getElementById('chatAttachmentSize').textContent=humanFileSize(file.size);
    document.getElementById('chatAttachmentIcon').textContent=file.type.startsWith('image/')?'🖼️':'📎';
    preview.classList.add('show');
    statusEl.textContent='Ready to attach · '+humanFileSize(file.size);
  }
  function clearPendingFile(){pendingChatFile=null;if(fileInput)fileInput.value='';preview?.classList.remove('show');if(statusEl)statusEl.textContent='Attach files up to 10MB · Drop a file into the chat';}
  attachBtn?.addEventListener('click',()=>fileInput?.click());
  fileInput?.addEventListener('change',e=>setPendingFile(e.target.files?.[0]));
  document.getElementById('chatAttachmentRemove')?.addEventListener('click',clearPendingFile);
  ['dragenter','dragover'].forEach(ev=>dropzone?.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('dragover')}));
  ['dragleave','drop'].forEach(ev=>dropzone?.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('dragover')}));
  dropzone?.addEventListener('drop',e=>setPendingFile(e.dataTransfer.files?.[0]));

  textInput?.addEventListener('input',()=>{textInput.style.height='auto';textInput.style.height=Math.min(textInput.scrollHeight,120)+'px'});

  const sendMsg = async () => {
    const txt = textInput.value.trim();
    if(!txt && !pendingChatFile) return;
    const sendBtn=document.getElementById('chatSendBtn');
    sendBtn.disabled=true;
    if(statusEl)statusEl.textContent=pendingChatFile?'Uploading attachment…':'Sending…';
    try{
      let attachmentUrl=null;
      if(pendingChatFile){
        const ext=(pendingChatFile.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
        const path=`chat/${state.currentUser.id}/${crypto.randomUUID()}-${ext}`;
        const up=await supabaseClient.storage.from('commission-uploads').upload(path,pendingChatFile,{upsert:false,contentType:pendingChatFile.type||'application/octet-stream'});
        if(up.error)throw up.error;
        attachmentUrl=supabaseClient.storage.from('commission-uploads').getPublicUrl(path).data.publicUrl;
      }
      const { data: newMsg, error } = await supabaseClient.from('messages').insert({
        conversation_id: convId,
        sender_id: state.currentUser.id,
        content: txt,
        body: txt,
        attachment_url: attachmentUrl
      }).select().single();
      if(error)throw error;
      await supabaseClient.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convId);
      await sendNotification(partner.id, 'New Message', `${state.currentMember?.name || 'Someone'} sent you a message`, 'message', `chat:${convId}`);
      clearPendingFile();
      textInput.value=''; textInput.style.height='auto';
      await selectConversation(convId);
    }catch(e){
      toast(e.message||'Could not send message');
      if(statusEl)statusEl.textContent='Send failed · please try again';
    }finally{sendBtn.disabled=false;}
  };

  document.getElementById('chatSendBtn').onclick = sendMsg;
  textInput.onkeydown = e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMsg(); } };

  await supabaseClient.from('messages').update({ is_read: true }).eq('conversation_id', convId).neq('sender_id', state.currentUser.id);
  if(state.activeConversation?.messages) state.activeConversation.messages.forEach(m => { if(m.sender_id !== state.currentUser.id) m.is_read = true; });
  updateMessagesUnreadBadge();
}

function bindDashboard(ps,ss){
  document.querySelectorAll('[data-dash]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-dash]').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.dashsection').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('dash-'+b.dataset.dash).classList.add('active')});
  let pendingAvatarUrl=null;
  const pfUsername=document.getElementById('pfUsername');
  if(pfUsername){
    pfUsername.oninput=()=>{const clean=pfUsername.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32);if(clean!==pfUsername.value)pfUsername.value=clean;document.getElementById('pfUsernamePreview').textContent=clean||'username'};
  }

  document.getElementById('pfAvatarBtn')?.addEventListener('click',()=>document.getElementById('pfAvatarFile').click());
  document.getElementById('pfAvatarFile')?.addEventListener('change',async(e)=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){toast('Please choose an image file');return}if(file.size>5*1024*1024){toast('Image must be under 5MB');return}const statusEl=document.getElementById('pfAvatarStatus');statusEl.textContent='Uploading…';try{const url=await uploadProjectFile(file,'avatar');pendingAvatarUrl=url;document.getElementById('pfAvatarPreview').src=url;statusEl.textContent='New photo ready — click Save profile to apply.'}catch(err){statusEl.textContent='Upload failed.';toast(err.message||'Could not upload photo')}});
  
  document.getElementById('translateTosJaBtn')?.addEventListener('click',async()=>{
    const text=document.getElementById('pfTos')?.value.trim();
    const status=document.getElementById('pfTosJaStatus');
    if(!text){toast('Enter your English TOS first.');return}
    const btn=document.getElementById('translateTosJaBtn');btn.disabled=true;
    if(status)status.textContent='Translating with DeepL…';
    try{
      const r=await fetch('/api/translate',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({action:'translate_tos',text})});
      const d=await r.json();if(!r.ok)throw new Error(d?.error||'Translation failed.');
      state.currentMember.tos_ja=d.translation||'';
      if(status)status.textContent='Japanese translation ready. Save profile to publish it.';
      toast('Japanese TOS translated');
    }catch(e){if(status)status.textContent=e.message||'Translation failed.';toast(e.message||'Translation failed.')}finally{btn.disabled=false}
  });

  document.querySelector('[data-ai-improve="pfBio"]')?.addEventListener('click',()=>lunaristAIImprove('pfBio','This is a short creator profile bio. Keep the creator’s identity and claims intact, make it distinctive and concise.'));

  document.getElementById('saveProfile')?.addEventListener('click',async()=>{
    const username=pfUsername.value.trim();if(!username){toast('Username cannot be empty');return}
    const tosText=document.getElementById('pfTos').value.trim();
    const tosChanged=tosText!==String(state.currentMember?.tos||'').trim();
    let tosJa=state.currentMember?.tos_ja||'';
    if(tosChanged)tosJa='';
    const tosStatus=document.getElementById('pfTosJaStatus');
    if(tosStatus)tosStatus.textContent='Translating Terms of Service to Japanese…';
    try{
      if(tosText && (tosChanged || !String(state.currentMember?.tos_ja||'').trim())){
        const tr=await fetch('/api/translate',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({action:'translate_tos',text:tosText})});
        const td=await tr.json();
        if(!tr.ok)throw new Error(td?.error||'Japanese translation failed.');
        tosJa=td.translation||'';
      }else if(!tosText){tosJa='';}
    }catch(e){
      tosJa=''; if(tosStatus)tosStatus.textContent='Japanese translation failed — your English TOS will still be saved without a cached Japanese version.';
      console.warn(e);
    }
    const payload={
      display_name:document.getElementById('pfName').value.trim(),
      username,
      role:document.getElementById('pfRole').value.trim(),
      bio:document.getElementById('pfBio').value.trim(),
      tos:tosText,
      tos_ja:tosJa,
      available:document.getElementById('pfAvail').value==='1',
      updated_at:new Date().toISOString()
    };
    if(pendingAvatarUrl)payload.avatar_url=pendingAvatarUrl;
    const {data,error}=await supabaseClient.from('profiles').update(payload).eq('id',state.currentUser.id).select().single();
    if(error){toast(error.code==='23505'?'That username is already taken.':error.message);return}
    toast('Profile saved');
    await refreshUser();
    updateAccountButton();
    await loadData();
    if(state.route.startsWith('member:')&&state.route.split(':')[1]===state.currentUser.id)goRoute('member:'+state.currentUser.id,true);
    openDashboard()
  });

  document.getElementById('signOut')?.addEventListener('click',async()=>{await supabaseClient.auth.signOut();closeDash();toast('Signed out');await refreshUser();render()});
  document.getElementById('addProject')?.addEventListener('click',()=>showProjectForm());
  document.querySelectorAll('[data-edit-project]').forEach(b=>b.onclick=()=>showProjectForm(ps.find(p=>p.id===b.dataset.editProject)));
  document.getElementById('addService')?.addEventListener('click',()=>showServiceForm());
  document.querySelectorAll('[data-edit-service]').forEach(b=>b.onclick=()=>showServiceForm((ss||[]).find(s=>s.id===b.dataset.editService)));

  setupProjectDragAndDrop();
  setupServiceDragAndDrop();
}

function setupProjectDragAndDrop(){
  const container=document.getElementById('projectList');
  if(!container)return;

  container.querySelectorAll('.listitem.draggable').forEach(item=>{
    item.addEventListener('dragstart',(e)=>{
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',item.dataset.id);
    });

    item.addEventListener('dragend',async()=>{
      item.classList.remove('dragging');
      await saveNewProjectOrder();
    });

    item.addEventListener('dragover',(e)=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      const draggingItem=container.querySelector('.dragging');
      if(!draggingItem||draggingItem===item)return;

      const rect=item.getBoundingClientRect();
      const next=(e.clientY-rect.top)/(rect.bottom-rect.top)>0.5;
      container.insertBefore(draggingItem,next?item.nextSibling:item);
    });
  });

  async function saveNewProjectOrder(){
    const items=Array.from(container.querySelectorAll('.listitem.draggable'));
    const updates=items.map((el,index)=>({
      id:el.dataset.id,
      position:index+1
    }));

    if(state.myProjects&&state.myProjects.length){
      state.myProjects.sort((a,b)=>{
        const idxA=updates.findIndex(u=>u.id===a.id);
        const idxB=updates.findIndex(u=>u.id===b.id);
        return idxA-idxB;
      });
    }

    for(const update of updates){
      await supabaseClient.from('projects').update({position:update.position}).eq('id',update.id);
    }
    toast('Project order saved');
    await loadData();
  }
}

function showServiceForm(existing=null){
  const f=document.getElementById('serviceForm');if(!f)return;
  const myProjects=state.myProjects||[];
  const linked=new Set((existing?.service_projects||existing?.projectIds||[]).map(x=>typeof x==='object'?x.project_id:x));
  const isMember=state.currentMember?.account_type==='member'||state.currentMember?.is_admin;
  const existingAddons = Array.isArray(existing?.add_ons) ? existing.add_ons : [];

  f.innerHTML=`<div class="panel" style="background:rgba(255,255,255,.02)"><div class="eyebrow">${existing?'Edit':'New'} service</div><div class="formgrid" style="margin-top:12px"><div class="field full"><label>Title</label><input id="svTitle" value="${esc(existing?.title||'')}" placeholder="Motion design package"></div><div class="field"><label>Category</label><select id="svCategorySelect"></select><input id="svCategoryNew" placeholder="Enter new category…" style="display:none;margin-top:6px"></div><div class="field"><label>Tags</label><input id="svTags" value="${esc((existing?.tags||[]).join(', '))}" placeholder="motion, branding"></div><div class="field full"><label>Description</label><div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button type="button" class="btn" data-ai-improve="svDesc">✨ Improve with AI</button></div><textarea id="svDesc">${esc(existing?.description||'')}</textarea></div><div class="field"><label>Starting price</label><input id="svPrice" value="${esc(existing?.price_from||'')}" placeholder="$300"><div id="svAutoPricePreview" class="meta" style="margin-top:8px;color:var(--gold);font-weight:800">Automatic total: $0.00</div></div><div class="field"><label>Delivery time</label><input id="svDelivery" value="${esc(existing?.delivery_time||'')}" placeholder="5–7 days"></div><div class="field full"><label>Thumbnail URL</label><input id="svThumb" value="${esc(existing?.thumbnail_url||'')}" placeholder="https://…"></div><div class="field"><label>Thumbnail upload</label><input id="svThumbFile" type="file" accept="image/*"></div><div class="field"><label>Status</label><select id="svStatus">${isMember?`<option value="published" ${(!existing?.status||existing?.status==='published'||existing?.published)?'selected':''}>Published</option><option value="draft" ${existing?.status==='draft'?'selected':''}>Draft</option>`:`<option value="draft" ${(!existing?.status||existing?.status==='draft')?'selected':''}>Draft</option><option value="pending" ${existing?.status==='pending'?'selected':''}>Submit for review</option>`}<option value="archived" ${existing?.status==='archived'?'selected':''}>Archived</option></select></div>
  <div class="field full service-addons-field">
    <div class="service-addons-heading"><div><label>Service Add-ons</label><div class="meta">Give clients optional upgrades or automatic video-duration pricing.</div></div><span class="addon-count-badge" id="addonCountBadge">0 options</span></div>
    <div id="addonContainer" style="margin-top:8px;display:flex;flex-direction:column;gap:10px">
      ${existingAddons.map((ao,i)=>{
        const isDur=addonIsDuration(ao);
        const included=Number(ao.included_seconds??ao.includedSeconds??180)||180;
        const unit=Number(ao.unit_seconds??ao.unitSeconds??30)||30;
        return `
        <div class="addonRow addon-row-shell">
          <div class="addon-main-row">
            <label class="addon-toggle"><input type="checkbox" class="aoEnabled" checked><span>Enabled</span></label>
            <div class="addon-title-wrap"><span class="addon-mini-label">Add-on name</span><input class="aoTitle addon-title" placeholder="e.g. Commercial License" value="${esc(ao.title||'')}"></div>
            <div class="addon-type-wrap"><span class="addon-mini-label">Pricing type</span><select class="aoType addon-type">
              <option value="fixed" ${(!isDur&&(!ao.type||ao.type==='fixed'))?'selected':''}>Fixed ($)</option>
              <option value="percent" ${(!isDur&&ao.type==='percent')?'selected':''}>Percentage (%)</option>
              <option value="duration" ${isDur?'selected':''}>Video duration</option>
            </select></div>
            <div class="addon-price-wrap"><span class="addon-mini-label">Price</span><input class="aoPrice addon-price" type="number" placeholder="${isDur?'Per interval':ao.type==='percent'?'Percent':'Price'}" value="${ao.price??''}"></div>
            <button type="button" class="btn removeAddonBtn addon-remove" aria-label="Remove add-on">×</button>
          </div>
          <div class="aoDurationSettings addon-duration-settings" style="${isDur?'display:grid':'display:none'}">
            <div class="addon-duration-intro"><span class="addon-duration-icon">◷</span><div><b>Video duration pricing</b><span>Charge extra time automatically at checkout.</span></div></div>
            <label class="addon-setting"><span>Included time</span><div class="addon-setting-input"><input class="aoIncluded" type="number" min="0" step="30" value="${included}" title="Included seconds"><em>sec</em></div></label>
            <label class="addon-setting"><span>Charge every</span><div class="addon-setting-input"><input class="aoUnit" type="number" min="1" step="1" value="${unit}" title="Charge interval in seconds"><em>sec</em></div></label>
          </div>
        </div>`;
      }).join('')}
    </div>
    <button type="button" class="btn addon-add-btn" id="addAddonRowBtn">+ Add extra option</button>
  </div>
  <div class="field full"><label>Portfolio examples</label><div class="meta">Link your published projects as samples of this service.</div><div style="margin-top:8px;display:flex;flex-direction:column;gap:8px;max-height:220px;overflow:auto">${myProjects.length?myProjects.map(p=>`<label class="portfolio-check-item"><input type="checkbox" class="svProjectLink" value="${p.id}" ${linked.has(p.id)?'checked':''}><img src="${esc(p.thumbnail_url||p.media_url||'')}" class="portfolio-check-thumb" onerror="handleImageError(this)"><span style="font-weight:600">${esc(p.title)}</span></label>`).join(''):'<span class="meta">Create a project first to link it here.</span>'}</div></div></div><div class="heroactions"><button class="btn primary" id="saveService">${existing?'Save changes':'Create service'}</button>${existing?`<button class="btn" id="deleteService">Delete</button>`:''}<button class="btn" id="cancelService">Cancel</button></div><p id="serviceMsg" style="color:var(--muted)"></p></div>`;
  
  const defaultCats=['Motion Design','3D Modeling','Branding','UI/UX Design','Illustration','Video Editing'];
  const existingCats=Array.from(new Set([...defaultCats,...(data.services||[]).map(s=>s.category).filter(Boolean),...(existing?.category?[existing.category]:[])])).sort();
  const catSelect=document.getElementById('svCategorySelect'),catNewInput=document.getElementById('svCategoryNew');
  catSelect.innerHTML=existingCats.map(c=>`<option value="${esc(c)}" ${existing?.category===c?'selected':''}>${esc(c)}</option>`).join('')+`<option value="__NEW__">+ Add new category…</option>`;
  if(existing?.category&&!existingCats.includes(existing.category)){catSelect.value='__NEW__';catNewInput.style.display='block';catNewInput.value=existing.category}
  catSelect.onchange=()=>{if(catSelect.value==='__NEW__'){catNewInput.style.display='block';catNewInput.focus()}else{catNewInput.style.display='none'}};
  
  const addonContainer = document.getElementById('addonContainer');
  function setupAddonRow(row){
    const typeSel=row.querySelector('.aoType');
    const price=row.querySelector('.aoPrice');
    const settings=row.querySelector('.aoDurationSettings');
    const update=()=>{
      const type=typeSel?.value||'fixed';
      if(settings) settings.style.display=type==='duration'?'grid':'none';
      if(price) price.placeholder=type==='duration'?'Charge per interval':type==='percent'?'Percent (%)':'Price ($)';
      refreshServiceEditorPrice();
    };
    row.querySelector('.removeAddonBtn')?.addEventListener('click',()=>{row.remove();refreshServiceEditorPrice();});
    typeSel?.addEventListener('change',update);
    row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refreshServiceEditorPrice));
    update();
  }

  const addAddonRow = (title='', price='', type='fixed', included=180, unit=30) => {
    const row = document.createElement('div');
    row.className = 'addonRow addon-row-shell';
    row.innerHTML = `<div class="addon-main-row"><label class="addon-toggle"><input type="checkbox" class="aoEnabled" checked><span>Enabled</span></label><div class="addon-title-wrap"><span class="addon-mini-label">Add-on name</span><input class="aoTitle addon-title" placeholder="e.g. Commercial License" value="${esc(title)}"></div><div class="addon-type-wrap"><span class="addon-mini-label">Pricing type</span><select class="aoType addon-type"><option value="fixed" ${type==='fixed'?'selected':''}>Fixed ($)</option><option value="percent" ${type==='percent'?'selected':''}>Percentage (%)</option><option value="duration" ${type==='duration'?'selected':''}>Video duration</option></select></div><div class="addon-price-wrap"><span class="addon-mini-label">Price</span><input class="aoPrice addon-price" type="number" placeholder="${type==='duration'?'Per interval':type==='percent'?'Percent':'Price'}" value="${price}"></div><button type="button" class="btn removeAddonBtn addon-remove" aria-label="Remove add-on">×</button></div><div class="aoDurationSettings addon-duration-settings" style="${type==='duration'?'display:grid':'display:none'}"><div class="addon-duration-intro"><span class="addon-duration-icon">◷</span><div><b>Video duration pricing</b><span>Charge extra time automatically at checkout.</span></div></div><label class="addon-setting"><span>Included time</span><div class="addon-setting-input"><input class="aoIncluded" type="number" min="0" step="30" value="${included}"><em>sec</em></div></label><label class="addon-setting"><span>Charge every</span><div class="addon-setting-input"><input class="aoUnit" type="number" min="1" step="1" value="${unit}"><em>sec</em></div></label></div>`;
    addonContainer.appendChild(row);
    setupAddonRow(row);
  };

  function refreshServiceEditorPrice(){
    const base=parseServicePrice(document.getElementById('svPrice')?.value,0);
    const rows=Array.from(document.querySelectorAll('.addonRow'));
    let total=base;
    rows.forEach(row=>{
      if(row.querySelector('.aoEnabled')?.checked===false)return;
      const p=Number(row.querySelector('.aoPrice')?.value||0);
      const type=row.querySelector('.aoType')?.value||'fixed';
      if(Number.isFinite(p)&&p>0 && type!=='duration') total += type==='percent' ? (base*p/100) : p;
    });
    const el=document.getElementById('svAutoPricePreview');
    if(el)el.textContent='Automatic total: $'+total.toFixed(2)+(rows.some(r=>r.querySelector('.aoType')?.value==='duration'&&r.querySelector('.aoEnabled')?.checked!==false)?' + duration add-on calculated at inquiry':'')+' (base + add-ons)';
    const badge=document.getElementById('addonCountBadge');
    if(badge){const active=rows.filter(r=>r.querySelector('.aoEnabled')?.checked!==false).length;badge.textContent=rows.length+' option'+(rows.length===1?'':'s')+(active!==rows.length?' · '+active+' active':'');}
  }

  document.getElementById('svPrice')?.addEventListener('input',refreshServiceEditorPrice);
  document.querySelectorAll('.addonRow').forEach(setupAddonRow);
  document.getElementById('addAddonRowBtn').onclick = () => addAddonRow();
  refreshServiceEditorPrice();

  document.getElementById('cancelService').onclick=()=>f.innerHTML='';
  document.querySelector('[data-ai-improve="svDesc"]')?.addEventListener('click',()=>lunaristAIImprove('svDesc','This is a service description intended to help potential clients understand what they can commission. Keep the offer concrete and client-friendly.'));

  document.getElementById('saveService').onclick=async()=>{
    const title=document.getElementById('svTitle').value.trim(),categorySelectVal=catSelect.value,categoryNewVal=catNewInput.value.trim(),category=categorySelectVal==='__NEW__'?categoryNewVal:categorySelectVal,tags=document.getElementById('svTags').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12);
    let status=document.getElementById('svStatus').value;
    if(!title||!category){document.getElementById('serviceMsg').textContent='Title and category are required.';return}
    if(isMember&&status!=='archived'&&status!=='draft'){status='published'}
    
    const addonRows = Array.from(document.querySelectorAll('.addonRow'));
    const add_ons = addonRows.map(r=>{
      const t = r.querySelector('.aoTitle')?.value.trim();
      const p = parseFloat(r.querySelector('.aoPrice')?.value);
      const ty = r.querySelector('.aoType')?.value || 'fixed';
      const enabled = r.querySelector('.aoEnabled')?.checked !== false;
      const durationByTitle=/video\s+over\s+3\s+minutes/i.test(t||'')||/3\s*minutes.*30\s*sec/i.test(t||'')||/30\s*sec.*3\s*minutes/i.test(t||'');
      if(!enabled || !t || isNaN(p)) return null;
      if(ty==='duration' || durationByTitle){
        const included=Math.max(0,Number(r.querySelector('.aoIncluded')?.value||180));
        const unit=Math.max(1,Number(r.querySelector('.aoUnit')?.value||30));
        return {title:t,price:p||10,type:'duration',duration:true,included_seconds:included,unit_seconds:unit};
      }
      return {title:t,price:p,type:ty};
    }).filter(Boolean);

    const thumbFile=document.getElementById('svThumbFile').files?.[0]||null;
    let thumbnail_url=document.getElementById('svThumb').value.trim()||null;
    const checkedProjectIds=Array.from(document.querySelectorAll('.svProjectLink:checked')).map(el=>el.value);
    if(!thumbnail_url&&!thumbFile&&checkedProjectIds.length){const linkedProj=myProjects.find(p=>p.id===checkedProjectIds[0]);if(linkedProj)thumbnail_url=linkedProj.thumbnail_url||linkedProj.media_url||null;}
    try{if(thumbFile)thumbnail_url=await uploadProjectFile(thumbFile,'service-thumb')}catch(e){document.getElementById('serviceMsg').textContent='Upload failed: '+(e.message||'Unable to upload file.');return}
    
    const keySlug=(title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+state.currentUser.id.slice(0,8)).slice(0,120);
    const enteredPrice=document.getElementById('svPrice').value.trim();
    const amountNum=parseServicePrice(enteredPrice,0);
    if(amountNum<=0){document.getElementById('serviceMsg').textContent='Enter a valid starting price, e.g. 30 or $30.';return}
    const payload={key:keySlug,slug:keySlug,label:title,amount:amountNum,artist_id:state.currentUser.id,owner_id:state.currentUser.id,title,category,tags,description:document.getElementById('svDesc').value.trim(),price_from:document.getElementById('svPrice').value.trim(),delivery_time:document.getElementById('svDelivery').value.trim(),thumbnail_url,status,published:status==='published',add_ons};
    
    let result=existing?await supabaseClient.from('services').update(payload).eq('id',existing.id).or(`owner_id.eq.${state.currentUser.id},artist_id.eq.${state.currentUser.id}`).select().single():await supabaseClient.from('services').insert(payload).select().single();
    if(result.error){document.getElementById('serviceMsg').textContent=result.error.message;return}
    
    const serviceId=result.data.id;
    const checked=new Set(checkedProjectIds);
    const toAdd=[...checked].filter(id=>!linked.has(id));
    const toRemove=[...linked].filter(id=>!checked.has(id));
    if(toAdd.length){const r=await supabaseClient.from('service_projects').insert(toAdd.map(project_id=>({service_id:serviceId,project_id})));if(r.error){toast(r.error.message)}}
    if(toRemove.length){const r=await supabaseClient.from('service_projects').delete().eq('service_id',serviceId).in('project_id',toRemove);if(r.error){toast(r.error.message)}}
    
    toast(existing?'Service updated':'Service created');
    await loadData();
    openDashboard()
  };
  if(existing)document.getElementById('deleteService').onclick=async()=>{if(!confirm('Delete this service?'))return;const r=await supabaseClient.from('services').delete().eq('id',existing.id).or(`owner_id.eq.${state.currentUser.id},artist_id.eq.${state.currentUser.id}`);if(r.error){toast(r.error.message);return}toast('Service deleted');await loadData();openDashboard()}
}

function showProjectForm(existing=null){
  const f=document.getElementById('projectForm');if(!f)return;
  const isMember=state.currentMember?.account_type==='member'||state.currentMember?.is_admin;
  
  f.innerHTML=`<div class="panel" style="background:rgba(255,255,255,.02)"><div class="eyebrow">${existing?'Edit':'New'} project</div><div class="formgrid" style="margin-top:12px"><div class="field full"><label>Title</label><input id="pjTitle" value="${esc(existing?.title||'')}" placeholder="Project title"></div><div class="field"><label>Category</label><select id="pjCategorySelect"></select><input id="pjCategoryNew" placeholder="Enter new category…" style="display:none;margin-top:6px"></div><div class="field"><label>Tags</label><input id="pjTags" value="${esc((existing?.tags||[]).join(', '))}" placeholder="motion, branding"></div><div class="field full"><label>Description</label><div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button type="button" class="btn" data-ai-improve="pjDesc">✨ Improve with AI</button></div><textarea id="pjDesc">${esc(existing?.description||'')}</textarea></div><div class="field full"><label>Thumbnail URL</label><input id="pjThumb" value="${esc(existing?.thumbnail_url||'')}" placeholder="https://…"></div><div class="field"><label>Media URL</label><input id="pjMedia" value="${esc(existing?.media_url||'')}" placeholder="https://…"></div><div class="field"><label>Thumbnail upload</label><input id="pjThumbFile" type="file" accept="image/*"></div>
  <div class="field"><label>Media upload</label><input id="pjMediaFile" type="file" accept="image/*,video/*,.pdf,.zip"></div>
  <div class="field full">
    <label>Social media / video</label>
    <div style="display:grid;grid-template-columns:180px 1fr;gap:10px;align-items:start">
      <select id="pjSocialPlatform" aria-label="Social platform">
        <option value="youtube">YouTube</option>
        <option value="twitch">Twitch</option>
        <option value="instagram">Instagram</option>
        <option value="x">X</option>
      </select>
      <input id="pjSocialUrl" value="${esc(embedToWatchUrl(existing?.media_url)||existing?.media_url||'')}" placeholder="Paste a YouTube, Twitch, Instagram, or X link…">
    </div>
    <div class="meta" id="pjSocialStatus">Paste a link to auto-fill the title, thumbnail, description and available social metrics.</div>
  </div>
  <div class="field"><label>Media type</label><select id="pjType"><option value="image" ${existing?.media_type!=='video'?'selected':''}>Image</option><option value="video" ${existing?.media_type==='video'?'selected':''}>Video</option></select></div><div class="field"><label>Status</label><select id="pjStatus">${isMember?`<option value="published" ${(!existing?.status||existing?.status==='published'||existing?.published)?'selected':''}>Published</option><option value="draft" ${existing?.status==='draft'?'selected':''}>Draft</option>`:`<option value="draft" ${(!existing?.status||existing?.status==='draft')?'selected':''}>Draft</option><option value="pending" ${existing?.status==='pending'?'selected':''}>Submit for review</option>`}<option value="archived" ${existing?.status==='archived'?'selected':''}>Archived</option></select></div></div><div class="heroactions"><button class="btn primary" id="saveProject">${existing?'Save changes':'Create project'}</button>${existing?`<button class="btn" id="deleteProject">Delete</button>`:''}<button class="btn" id="cancelProject">Cancel</button></div><p id="projectMsg" style="color:var(--muted)"></p></div>`;
  
  const defaultCats=['Motion Design','3D Modeling','Branding','UI/UX Design','Illustration','Video Editing'];
  const existingCats=Array.from(new Set([...defaultCats,...(data.projects||[]).map(p=>p.category).filter(Boolean),...(existing?.category?[existing.category]:[])])).sort();
  const catSelect=document.getElementById('pjCategorySelect'),catNewInput=document.getElementById('pjCategoryNew');
  catSelect.innerHTML=existingCats.map(c=>`<option value="${esc(c)}" ${existing?.category===c?'selected':''}>${esc(c)}</option>`).join('')+`<option value="__NEW__">+ Add new category…</option>`;
  if(existing?.category&&!existingCats.includes(existing.category)){catSelect.value='__NEW__';catNewInput.style.display='block';catNewInput.value=existing.category}
  catSelect.onchange=()=>{if(catSelect.value==='__NEW__'){catNewInput.style.display='block';catNewInput.focus()}else{catNewInput.style.display='none'}};
  
  document.getElementById('cancelProject').onclick=()=>f.innerHTML='';
  const pjSocialPlatform=document.getElementById('pjSocialPlatform');
  const pjSocialUrl=document.getElementById('pjSocialUrl');
  const pjSocialStatus=document.getElementById('pjSocialStatus');

  function detectSocialPlatform(raw){
    try{
      const u=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(String(raw||''))?String(raw).trim():'https://'+String(raw||'').trim());
      const h=u.hostname.toLowerCase().replace(/^www\./,'');
      if(h==='youtube.com'||h==='m.youtube.com'||h==='music.youtube.com'||h==='youtu.be')return 'youtube';
      if(h==='twitch.tv'||h==='m.twitch.tv')return 'twitch';
      if(h==='instagram.com'||h.endsWith('.instagram.com'))return 'instagram';
      if(h==='x.com'||h==='twitter.com')return 'x';
    }catch{}
    return null;
  }

  function applySocialPlatformFromUrl(){
    const detected=detectSocialPlatform(pjSocialUrl.value);
    if(detected) pjSocialPlatform.value=detected;
    return detected||pjSocialPlatform.value;
  }

  let socialFetchedViews=null;
  let socialFetchedLikes=null;
  let socialFetchedPlatform=null;

  async function fetchSocialIntoForm(){
    const url=pjSocialUrl.value.trim();
    if(!url)return;
    const platform=applySocialPlatformFromUrl();
    const names={youtube:'YouTube',twitch:'Twitch',instagram:'Instagram',x:'X'};
    pjSocialStatus.textContent='Fetching from '+(names[platform]||'social media')+'…';
    try{
      let endpoint='', mediaUrl=url, mediaType='video';
      if(platform==='youtube'){
        const vid=extractYoutubeId(url);
        if(!vid)throw new Error("That doesn't look like a YouTube link.");
        endpoint='/api/youtube?videoId='+encodeURIComponent(vid);
        mediaUrl='https://www.youtube.com/embed/'+vid;
      }else if(platform==='twitch'){
        endpoint='/api/twitch?url='+encodeURIComponent(url);
      }else if(platform==='instagram'){
        endpoint='/api/instagram?url='+encodeURIComponent(url);
        mediaType='image';
      }else if(platform==='x'){
        endpoint='/api/x?url='+encodeURIComponent(url);
        mediaType='image';
      }else throw new Error('Unsupported social platform.');

      const r=await fetch(endpoint,{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||'Could not fetch this social link.');
      if(platform==='twitch'){
        const twitchUrl=twitchEmbedUrl(d.url||url);
        if(twitchUrl)mediaUrl=twitchUrl;
      }
      socialFetchedPlatform=platform;
      socialFetchedViews=Number(d.viewCount??d.views??0)||0;
      socialFetchedLikes=Number(d.likeCount??d.likes??0)||0;

      document.getElementById('pjMedia').value=mediaUrl;
      document.getElementById('pjType').value=d.mediaType||mediaType;
      const thumb=d.thumbnail||d.thumbnail_url||d.thumbnailUrl||d.image||d.preview_image_url;
      if(thumb)document.getElementById('pjThumb').value=thumb;
      const title=d.title||d.name||'';
      const desc=d.description||d.caption||d.text||'';
      // YouTube quota fallback returns the public watch-page metadata. For a
      // fresh social fetch, always populate empty fields; when quota is
      // exhausted, also replace stale auto-filled values so the Project form
      // reflects the fetched video rather than remaining blank.
      if(title && (platform==='youtube' && d.quotaExceeded || !document.getElementById('pjTitle').value.trim())){
        document.getElementById('pjTitle').value=title;
      }
      if(desc && (platform==='youtube' && d.quotaExceeded || !document.getElementById('pjDesc').value.trim())){
        document.getElementById('pjDesc').value=desc;
      }

      const metrics=[];
      const views=Number(d.viewCount??d.views??d.viewers??0);
      const likes=Number(d.likeCount??d.likes??0);
      const reposts=Number(d.repostCount??d.reposts??0);
      if(views)metrics.push((d.isLive?'Live viewers':'Views')+': '+views.toLocaleString());
      if(likes)metrics.push('Likes: '+likes.toLocaleString());
      if(reposts)metrics.push('Reposts: '+reposts.toLocaleString());
      const creator=d.author||d.username||d.author_username;
      if(creator)metrics.unshift('By '+creator);
      if(platform==='twitch' && !likes) metrics.push('Twitch does not provide a like count');
      pjSocialStatus.textContent='Loaded '+(names[platform]||platform)+(metrics.length?' — '+metrics.join(' · '):'');
    }catch(e){
      pjSocialStatus.textContent=e.message||'Could not fetch this social link.';
    }
  }

  if(pjSocialUrl.value.trim()){
    const detected=detectSocialPlatform(pjSocialUrl.value);
    if(detected)pjSocialPlatform.value=detected;
  }
  pjSocialPlatform.addEventListener('change',()=>{pjSocialStatus.textContent='Paste a '+({youtube:'YouTube',twitch:'Twitch',instagram:'Instagram',x:'X'}[pjSocialPlatform.value]||'social')+' link to fetch it.'});
  pjSocialUrl.addEventListener('change',fetchSocialIntoForm);
  pjSocialUrl.addEventListener('paste',()=>setTimeout(fetchSocialIntoForm,80));
  pjSocialUrl.addEventListener('blur',()=>{if(pjSocialUrl.value.trim())fetchSocialIntoForm()});

  document.querySelector('[data-ai-improve="pjDesc"]')?.addEventListener('click',()=>lunaristAIImprove('pjDesc','This is a portfolio project description for a creative marketplace.'));

  document.getElementById('saveProject').onclick=async()=>{
    const title=document.getElementById('pjTitle').value.trim(),categorySelectVal=catSelect.value,categoryNewVal=catNewInput.value.trim(),category=categorySelectVal==='__NEW__'?categoryNewVal:categorySelectVal,tags=document.getElementById('pjTags').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12);
    let status=document.getElementById('pjStatus').value;
    if(!title||!category){document.getElementById('projectMsg').textContent='Title and category are required.';return}
    if(isMember&&status!=='archived'&&status!=='draft'){status='published'}
    
    const thumbFile=document.getElementById('pjThumbFile').files?.[0]||null,mediaFile=document.getElementById('pjMediaFile').files?.[0]||null;
    let thumbnail_url=document.getElementById('pjThumb').value.trim()||null,media_url=document.getElementById('pjMedia').value.trim()||null;
    try{
      if(thumbFile)thumbnail_url=await uploadProjectFile(thumbFile,'thumbnail');
      if(mediaFile)media_url=await uploadProjectFile(mediaFile,'media');
    }catch(e){document.getElementById('projectMsg').textContent='Upload failed: '+(e.message||'Unable to upload file.');return}
    
    const payload={
      owner_id: state.currentUser.id,
      title,
      slug:(title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+state.currentUser.id.slice(0,8)).slice(0,120),
      category,
      tags,
      description:document.getElementById('pjDesc').value.trim(),
      thumbnail_url,
      media_url,
      media_type:document.getElementById('pjType').value,
      status,
      published:status==='published',
      ...(existing ? {} : {
        views: socialFetchedViews ?? 0,
        likes: socialFetchedLikes ?? 0
      })
    };
    
    let result=existing?await supabaseClient.from('projects').update(payload).eq('id',existing.id).eq('owner_id',state.currentUser.id).select().single():await supabaseClient.from('projects').insert(payload).select().single();
    if(result.error){document.getElementById('projectMsg').textContent=result.error.message;return}
    
    toast(existing?'Project updated':'Project created');
    await loadData();
    openDashboard()
  };
  
  if(existing)document.getElementById('deleteProject').onclick=async()=>{if(!confirm('Delete this project?'))return;const r=await supabaseClient.from('projects').delete().eq('id',existing.id).eq('owner_id',state.currentUser.id);if(r.error){toast(r.error.message);return}toast('Project deleted');await loadData();openDashboard()}
}

async function loadAdvancedAnalytics(allProjects,allServices){
  const {data,error}=await supabaseClient.rpc('admin_analytics',{p_days:state.analyticsDays||30});
  if(error)return {error:error.message};
  const d=data&&typeof data==='object'?data:{};
  const t=d.totals||{}, c=d.commission||{};
  const daily=Array.isArray(d.daily)?d.daily:[];
  const projectRows=Array.isArray(d.projects)?d.projects:[];
  const serviceRows=Array.isArray(d.services)?d.services:[];
  const categoryRows=Array.isArray(d.categories)?d.categories:[];
  const pageRows=Array.isArray(d.pages)?d.pages:[];
  const sourceRows=Array.isArray(d.sources)?d.sources:[];
  const deviceRows=Array.isArray(d.devices)?d.devices:[];
  const artistRows=Array.isArray(d.top_artists)?d.top_artists:[];
  const sessions=Number(t.sessions||0),visitors=Number(t.visitors||0);
  return {
    ...d, totalVisitors:visitors,totalVisits:sessions,totalEvents:Number(t.total_events||0),
    pageViews:Number(t.page_views||0),projectViews:Number(t.project_views||0),serviceViews:Number(t.service_views||0),
    projectClicks:Number(t.project_clicks||0),serviceClicks:Number(t.service_clicks||0),likes:Number(t.likes||0),saves:Number(t.saves||0),
    engagementRate:sessions?Math.round((Number(t.engaged_sessions||0)/sessions)*100):0,engagedSessions:Number(t.engaged_sessions||0),
    avgVisitsPerVisitor:visitors?(sessions/visitors):0,repeatVisitors:Number(t.repeat_visitors||0),returningRate:visitors?Math.round((Number(t.repeat_visitors||0)/visitors)*100):0,
    avgEventsPerSession:Number(d.quality?.avg_events_per_session||0),discoveryCtr:Number(t.page_views||0)?Math.round((Number(t.discovery_clicks||0)/Number(t.page_views||0))*100):0,
    revenue:Number(c.revenue||0),pipeline:Number(c.pipeline||0),inquiries:Number(c.inquiries||0),qualified:Number(c.qualified||0),paid:Number(c.paid||0),
    inquiryToPaid:Number(c.inquiries||0)?Math.round((Number(c.paid||0)/Number(c.inquiries||0))*100):0,
    qualifiedToPaid:Number(c.qualified||0)?Math.round((Number(c.paid||0)/Number(c.qualified||0))*100):0,
    avgOrderValue:Number(c.paid||0)?Number(c.revenue||0)/Number(c.paid||0):0,
    daily,projectRows,serviceRows,categoryRows,pageRows,sourceRows,deviceRows,artistRows
  };
}
async function loadAdminInvitations(sec){
  const list=document.getElementById('memberInviteList');
  const create=document.getElementById('createMemberInvite');
  const result=document.getElementById('inviteCreateResult');
  if(!list||!create)return;
  const renderRows=(rows)=>{
    if(!rows.length){list.innerHTML='<div class="meta">No invitations yet.</div>';return}
    list.innerHTML=rows.map(inv=>{
      const used=!!inv.used_at;
      const expired=!!inv.expires_at && new Date(inv.expires_at)<=new Date() && !used;
      const status=used?'Used':expired?'Expired':'Available';
      const statusClass=used?'tag':expired?'tag':'tag';
      const link=location.origin+'/?invite='+encodeURIComponent(inv.code);
      return `<div class="listitem" style="align-items:flex-start;gap:12px"><div class="grow"><b style="font-family:IBM Plex Mono,monospace;letter-spacing:.08em">${esc(inv.code)}</b><div class="meta">${status} · created ${new Date(inv.created_at).toLocaleString()} · ${inv.expires_at?'expires '+new Date(inv.expires_at).toLocaleString():'no expiry'}</div>${used?`<div class="meta">Redeemed ${new Date(inv.used_at).toLocaleString()}</div>`:''}</div><div class="heroactions" style="margin:0;flex-wrap:wrap"><button class="btn" data-copy-invite="${esc(link)}" ${used||expired?'disabled':''}>Copy link</button>${!used&&!expired?`<button class="btn" data-revoke-invite="${esc(inv.id)}">Revoke</button>`:''}</div></div>`;
    }).join('');
    list.querySelectorAll('[data-copy-invite]').forEach(btn=>btn.onclick=async()=>{try{await navigator.clipboard.writeText(btn.dataset.copyInvite);toast('Invitation link copied')}catch{toast(btn.dataset.copyInvite)}});
    list.querySelectorAll('[data-revoke-invite]').forEach(btn=>btn.onclick=async()=>{if(!confirm('Revoke this invitation? It will no longer be usable.'))return;const r=await fetch('/api/invitations',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({action:'revoke',id:btn.dataset.revokeInvite})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to revoke');toast('Invitation revoked');loadAdminInvitations(sec)});
  };
  create.onclick=async()=>{create.disabled=true;try{const r=await fetch('/api/invitations',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({action:'create',expires_days:30})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to create invitation');const link=location.origin+'/?invite='+encodeURIComponent(d.code);result.innerHTML=`<div class="panel" style="margin:0;background:rgba(201,182,255,.06)"><div class="eyebrow">New one-time invitation</div><div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><input id="newInviteCode" value="${esc(d.code)}" readonly style="max-width:180px;font-family:IBM Plex Mono,monospace;letter-spacing:.08em"><button class="btn" id="copyNewInvite">Copy code</button><button class="btn primary" id="copyNewInviteLink">Copy invitation link</button></div><div class="meta" style="margin-top:8px">${esc(link)}</div></div>`;document.getElementById('copyNewInvite').onclick=()=>navigator.clipboard.writeText(d.code).then(()=>toast('Code copied'));document.getElementById('copyNewInviteLink').onclick=()=>navigator.clipboard.writeText(link).then(()=>toast('Invitation link copied'));await loadAdminInvitations(sec)}catch(e){toast(e.message||'Unable to create invitation')}finally{create.disabled=false}};
  try{const r=await fetch('/api/invitations?action=list',{headers:await apiAuthHeaders()});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load invitations');renderRows(Array.isArray(d)?d:[])}catch(e){list.innerHTML='<div class="meta">'+esc(e.message||'Unable to load invitations.')+'</div>'}
}

async function renderAdminStudioPage(activeTab='members', analyticsOverride=null, adminDataOverride=null){
  if(!state.currentUser||!state.currentMember?.is_admin){
    document.getElementById('adminPageView').innerHTML='<div class="panel"><h3>Access Restricted</h3><p style="color:var(--muted)">You must be an administrator to view this page.</p></div>';
    return;
  }
  const sec = document.getElementById('adminPageView'); if(!sec) return;
  sec.innerHTML='<div class="panel"><div class="eyebrow">Studio Admin</div><h3>Loading Moderation Dashboard…</h3></div>';

  // The Admin Studio shell must render immediately. Load its database data after
  // the shell is visible so a slow Supabase request can never look like a frozen page.
  if(!adminDataOverride){
    const loadAdminData=async()=>{
      const result=await Promise.race([
        Promise.all([
          supabaseClient.from('projects').select('id,owner_id,title,category,status,featured,created_at,updated_at,views,likes').order('updated_at',{ascending:false}).limit(200),
          supabaseClient.from('services').select('id,owner_id,artist_id,title,category,status,price_from,delivery_time,created_at,updated_at').order('updated_at',{ascending:false}).limit(200),
          supabaseClient.from('profiles').select('*',{count:'exact',head:true}),
          supabaseClient.from('projects').select('*',{count:'exact',head:true}),
          supabaseClient.from('services').select('*',{count:'exact',head:true}),
          supabaseClient.from('profiles').select('id,username,display_name,role,is_admin,account_type,available,tos,theme').order('display_name').limit(200),
          supabaseClient.from('projects').select('id,title,category,featured,status,views,likes').eq('featured',true).order('updated_at',{ascending:false}).limit(20),
          supabaseClient.from('studio_settings').select('key,value').order('key')
        ]).then(r=>({ok:true,r})),
        new Promise(resolve=>setTimeout(()=>resolve({ok:false,error:'Admin data is taking too long to respond. The dashboard shell is available; refresh to retry.'}),5000))
      ]);
      if(!result.ok){
        const errData={projects:[],servicesArr:[],memberCount:0,projectCount:0,serviceCount:0,members:[],featured:[],settings:[],pErr:{message:result.error},sErr:null};
        sec.innerHTML='<div class="panel"><div class="eyebrow">Studio Admin</div><h3>Admin Studio is ready</h3><p style="color:var(--muted)">'+esc(result.error)+'</p><button class="btn primary" id="retryAdminStudio" style="margin-top:12px">Retry</button></div>';
        document.getElementById('retryAdminStudio')?.addEventListener('click',()=>renderAdminStudioPage(activeTab));
        return;
      }
      const [p,s,m,pc,sc,mem,f,settings]=result.r;
      const adminData={
        projects:p.data||[],servicesArr:s.data||[],memberCount:m.count||0,projectCount:pc.count||0,serviceCount:sc.count||0,
        members:mem.data||[],featured:f.data||[],settings:settings.data||[],pErr:p.error,sErr:s.error
      };
      renderAdminStudioPage(activeTab,null,adminData);
    };
    loadAdminData().catch(e=>{
      sec.innerHTML='<div class="panel"><div class="eyebrow">Studio Admin</div><h3>Admin Studio is ready</h3><p style="color:var(--muted)">'+esc(e?.message||'Unable to load admin data.')+'</p><button class="btn primary" id="retryAdminStudio" style="margin-top:12px">Retry</button></div>';
      document.getElementById('retryAdminStudio')?.addEventListener('click',()=>renderAdminStudioPage(activeTab));
    });
    return;
  }

  const {projects,servicesArr,memberCount,projectCount,serviceCount,members,featured,settings,pErr,sErr}=adminDataOverride;

  // Analytics is deliberately decoupled from the Admin Studio shell.
  // Never await it here: a slow/stalled analytics query must not keep the entire
  // dashboard in "Loading Moderation Dashboard…".
  const analyticsFallback={
    loading:true,error:null,totalEvents:0,totalVisitors:0,totalVisits:0,
    totalRevenue:0,pendingRevenue:0,avgOrderValue:0,conversionRate:0,
    depositCount:0,fullCount:0,topServices:[],topCategories:[],
    trendDays:[],trend:{},funnel:{}
  };
  let analytics=analyticsOverride||analyticsFallback;
  if(!analyticsOverride){
    Promise.race([
      loadAdvancedAnalytics(projects||[],servicesArr||[]),
      new Promise(resolve=>setTimeout(()=>resolve({
        error:'Analytics took too long to respond. The rest of Admin Studio is available; switch away from Analytics and back to retry.',
        loading:false
      }),7000))
    ]).then(result=>{
      if(!result || typeof result!=='object')result={error:'Unable to load analytics.',loading:false};
      renderAdminStudioPage(activeTab,result,adminDataOverride);
    }).catch(error=>{
      renderAdminStudioPage(activeTab,{...analyticsFallback,loading:false,error:error?.message||'Unable to load analytics.'},adminDataOverride);
    });
  }

  if(pErr || sErr){
    sec.innerHTML='<div class="panel"><h3>Studio unavailable</h3><p style="color:var(--muted)">'+esc((pErr||sErr).message)+'</p></div>';
    return;
  }

  const allProjects = projects || [];
  const allServices = servicesArr || [];
  const pendingProjects = allProjects.filter(p=>p.status==='pending');
  const pendingServices = allServices.filter(s=>s.status==='pending');
  const totalPending = pendingProjects.length + pendingServices.length;
  const settingsMap = Object.fromEntries((settings||[]).map(x=>[x.key,x.value]));

  const getMemberName = (id) => {
    const m = (members||[]).find(x=>x.id===id);
    return m ? (m.display_name || '@'+m.username) : 'Unknown';
  };

  const projectRow = p => `
    <div class="listitem" style="align-items:center">
      <div class="grow">
        <b>${esc(p.title)}</b>
        <div class="meta">📁 Project · ${esc(p.category||'Uncategorized')} · By ${esc(getMemberName(p.owner_id))} ${p.featured?'· ⭐ Featured':''}</div>
      </div>
      <div class="row" style="gap:6px">
        <select data-admin-pj-status="${p.id}" style="width:auto;padding:6px 10px">
          <option value="draft" ${p.status==='draft'?'selected':''}>Draft</option>
          <option value="pending" ${p.status==='pending'?'selected':''}>Pending</option>
          <option value="published" ${p.status==='published'?'selected':''}>Published</option>
          <option value="archived" ${p.status==='archived'?'selected':''}>Archived</option>
        </select>
        ${p.status==='pending'?`<button class="btn primary" style="padding:6px 12px;font-size:12px" data-admin-pj-approve="${p.id}">Approve</button>`:''}
        <button class="btn" style="padding:6px 12px;font-size:12px" data-admin-feature="${p.id}">${p.featured?'Unfeature':'Feature'}</button>
      </div>
    </div>`;

  const serviceRow = s => `
    <div class="listitem" style="align-items:center">
      <div class="grow">
        <b>${esc(s.title)}</b>
        <div class="meta">💼 Service · ${esc(s.category||'Uncategorized')} · By ${esc(getMemberName(s.owner_id||s.artist_id))} ${s.price_from?'· From '+esc(s.price_from):''}</div>
      </div>
      <div class="row" style="gap:6px">
        <select data-admin-sv-status="${s.id}" style="width:auto;padding:6px 10px">
          <option value="draft" ${s.status==='draft'?'selected':''}>Draft</option>
          <option value="pending" ${s.status==='pending'?'selected':''}>Pending</option>
          <option value="published" ${s.status==='published'?'selected':''}>Published</option>
          <option value="archived" ${s.status==='archived'?'selected':''}>Archived</option>
        </select>
        ${s.status==='pending'?`<button class="btn primary" style="padding:6px 12px;font-size:12px" data-admin-sv-approve="${s.id}">Approve</button>`:''}
      </div>
    </div>`;

  const memberRows = (members||[]).map(m=>`
    <div class="listitem" style="align-items:center">
      <div class="grow">
        <b>${esc(m.display_name||m.username||'Unnamed member')}</b>
        <div class="meta">@${esc(m.username||'member')} · ${esc(m.role||'Member')} · ${m.is_admin?'Administrator':(m.account_type==='member'?'Lunarist Member':'User')}</div>
      </div>
      <div class="row" style="gap:8px">
        <button class="btn" style="padding:6px 12px;font-size:12px" data-admin-profile="${m.id}">Profile</button>
        ${m.is_admin?'':`<button class="btn" style="padding:6px 12px;font-size:12px" data-toggle-membertype="${m.id}" data-current="${m.account_type||'user'}">${m.account_type==='member'?'Revoke Member':'Promote to Member'}</button>`}
      </div>
    </div>`).join('')||'<div class="meta">No members found</div>';

  const analyticsProjectHtml = analytics.projectRows?.length ? analytics.projectRows.slice(0,8).map(p=>'<div class="listitem"><div class="grow"><b>'+esc(p.title||'Untitled')+'</b><div class="meta">'+esc(p.category||'Uncategorized')+' · '+Number(p.unique_visitors||0).toLocaleString()+' visitors</div></div><span class="meta">'+Number(p.views||0)+' views · '+Number(p.clicks||0)+' clicks</span></div>').join('') : '<div class="meta">No project activity in this period.</div>';
  const analyticsServiceHtml = analytics.serviceRows?.length ? analytics.serviceRows.slice(0,8).map(x=>'<div class="listitem"><div class="grow"><b>'+esc(x.title||'Untitled')+'</b><div class="meta">'+esc(x.category||'Uncategorized')+' · '+Number(x.unique_visitors||0).toLocaleString()+' visitors</div></div><span class="meta">'+Number(x.views||0)+' views · '+Number(x.clicks||0)+' clicks</span></div>').join('') : '<div class="meta">No service activity in this period.</div>';
  const analyticsSourceHtml = analytics.sourceRows?.length ? analytics.sourceRows.slice(0,8).map(x=>'<div class="listitem"><div class="grow"><b>'+esc(x.source)+'</b></div><span class="meta">'+Number(x.sessions||0)+' sessions · '+Number(x.visitors||0)+' visitors · '+Number(x.page_views||0)+' page views</span></div>').join('') : '<div class="meta">No source data yet.</div>';
  const analyticsPageHtml = analytics.pageRows?.length ? analytics.pageRows.slice(0,8).map(x=>'<div class="listitem"><div class="grow"><b>'+esc(x.route||'/')+'</b></div><span class="meta">'+Number(x.views||0)+' views · '+Number(x.visitors||0)+' visitors</span></div>').join('') : '<div class="meta">No page views yet.</div>';

  sec.innerHTML = `
    <div class="sectionhead">
      <div>
        <div class="eyebrow">Studio Management</div>
        <h2 style="font-size:42px;margin:4px 0">Admin Studio</h2>
        <p>Manage members, review pending submissions, and configure studio settings.</p>
      </div>
    </div>

    <div class="panel" style="margin-bottom:20px">
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">
        <div class="stat"><b>${Number(totalPending)}</b><span>Pending Review</span></div>
        <div class="stat"><b>${Number(memberCount||0)}</b><span>Members</span></div>
        <div class="stat"><b>${Number(projectCount||0)}</b><span>Projects</span></div>
        <div class="stat"><b>${Number(serviceCount||0)}</b><span>Services</span></div>
        <div class="stat"><b>${Number(analytics.totalEvents||0)}</b><span>Events (14d)</span></div>
      </div>
    </div>

    <div class="heroactions" style="margin:16px 0;flex-wrap:wrap">
      <button class="filter ${activeTab==='overview'?'active':''}" data-studio-tab="overview">Queue (${totalPending})</button>
      <button class="filter ${activeTab==='projects'?'active':''}" data-studio-tab="projects">Projects (${allProjects.length})</button>
      <button class="filter ${activeTab==='services'?'active':''}" data-studio-tab="services">Services (${allServices.length})</button>
      <button class="filter ${activeTab==='members'?'active':''}" data-studio-tab="members">Members (${Number(memberCount||0)})</button>
      <button class="filter ${activeTab==='invitations'?'active':''}" data-studio-tab="invitations">Invitations</button>
      <button class="filter ${activeTab==='analytics'?'active':''}" data-studio-tab="analytics">Analytics</button>
      <button class="filter ${activeTab==='settings'?'active':''}" data-studio-tab="settings">Settings</button>
    </div>

    <div data-studio-panel="overview" style="${activeTab==='overview'?'':'display:none'}">
      <div class="panel">
        <div class="eyebrow">Review Queue</div>
        <h3>${totalPending ? totalPending + ' item(s) awaiting moderation' : 'Review queue is empty 🎉'}</h3>
        <div style="margin-top:12px">
          ${pendingProjects.length ? `<div class="eyebrow" style="margin:12px 0 6px">Pending Projects (${pendingProjects.length})</div>` + pendingProjects.map(projectRow).join('') : ''}
          ${pendingServices.length ? `<div class="eyebrow" style="margin:12px 0 6px">Pending Services (${pendingServices.length})</div>` + pendingServices.map(serviceRow).join('') : ''}
          ${!totalPending ? '<div class="meta" style="padding:16px 0">No pending projects or services to review right now.</div>' : ''}
        </div>
      </div>
    </div>

    <div data-studio-panel="projects" style="${activeTab==='projects'?'':'display:none'}">
      <div class="panel">
        <div class="eyebrow">All Submitted Projects</div>
        <div style="margin-top:12px">${allProjects.map(projectRow).join('') || '<div class="meta">No projects found.</div>'}</div>
      </div>
    </div>

    <div data-studio-panel="services" style="${activeTab==='services'?'':'display:none'}">
      <div class="panel">
        <div class="eyebrow">All Submitted Services</div>
        <div style="margin-top:12px">${allServices.map(serviceRow).join('') || '<div class="meta">No services found.</div>'}</div>
      </div>
    </div>

    <div data-studio-panel="members" style="${activeTab==='members'?'':'display:none'}">
      <div class="panel">
        <div class="eyebrow">Members Management</div>
        <div style="margin-top:12px">${memberRows}</div>
      </div>
    </div>

    <div data-studio-panel="invitations" style="${activeTab==='invitations'?'':'display:none'}">
      <div class="panel">
        <div class="row" style="align-items:flex-start;gap:14px;flex-wrap:wrap">
          <div class="grow"><div class="eyebrow">Member Invitations</div><h3 style="margin:4px 0">One-time member access</h3><p class="meta">Create an invitation link or code. Each invitation can be redeemed once and then becomes invalid.</p></div>
          <button class="btn primary" id="createMemberInvite">+ Create invitation</button>
        </div>
        <div id="inviteCreateResult" style="margin-top:14px"></div>
        <div id="memberInviteList" style="margin-top:16px"><div class="meta">Loading invitations…</div></div>
      </div>
    </div>

    <div data-studio-panel="analytics" style="${activeTab==='analytics'?'':'display:none'}">
      ${analytics.loading?'<div class="panel admin-analytics-loading"><div class="eyebrow">Lunarist Intelligence</div><h3>Loading analytics…</h3><p class="meta">Building your traffic, discovery and business picture.</p></div>':analytics.error?'<div class="panel admin-analytics-error"><div class="eyebrow">Analytics</div><h3>Analytics unavailable</h3><p class="meta">'+esc(analytics.error)+'</p><button class="btn primary" id="refreshAnalytics">Retry</button></div>':`
      <div class="admin-analytics-shell">
        <div class="panel admin-analytics-hero"><div><div class="eyebrow">Lunarist Intelligence</div><h2>Analytics</h2><p class="meta">First-party traffic, session quality, and real discovery interactions. Project clicks and service clicks are tracked separately.</p></div><div class="admin-analytics-controls"><select id="analyticsRange" class="search"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="365">1 year</option></select><button class="btn" id="refreshAnalytics">↻ Refresh</button></div></div>
        <div class="admin-analytics-kpis">
          <div class="admin-kpi"><span>Unique visitors</span><b>${Number(analytics.totalVisitors||0).toLocaleString()}</b><small>Distinct first-party visitors</small></div>
          <div class="admin-kpi"><span>Sessions</span><b>${Number(analytics.totalVisits||0).toLocaleString()}</b><small>${Number(analytics.avgVisitsPerVisitor||0).toFixed(1)} per visitor</small></div>
          <div class="admin-kpi"><span>Page views</span><b>${Number(analytics.pageViews||0).toLocaleString()}</b><small>Tracked page views</small></div>
          <div class="admin-kpi admin-kpi-accent"><span>Discovery clicks</span><b>${(Number(analytics.projectClicks||0)+Number(analytics.serviceClicks||0)).toLocaleString()}</b><small>Project + service clicks</small></div>
          <div class="admin-kpi"><span>Project clicks</span><b>${Number(analytics.projectClicks||0).toLocaleString()}</b><small>Real project opens</small></div>
          <div class="admin-kpi"><span>Service clicks</span><b>${Number(analytics.serviceClicks||0).toLocaleString()}</b><small>Real service opens</small></div>
          <div class="admin-kpi"><span>Engagement rate</span><b>${Number(analytics.engagementRate||0)}%</b><small>Sessions with meaningful action</small></div>
          <div class="admin-kpi"><span>Revenue</span><b>$${Number(analytics.revenue||0).toFixed(2)}</b><small>Paid commissions</small></div>
          <div class="admin-kpi"><span>Inquiry → paid</span><b>${Number(analytics.inquiryToPaid||0)}%</b><small>Commission conversion</small></div>
          <div class="admin-kpi"><span>Avg. order</span><b>$${Number(analytics.avgOrderValue||0).toFixed(2)}</b><small>Average paid commission</small></div>
          <div class="admin-kpi"><span>Returning visitors</span><b>${Number(analytics.returningRate||0)}%</b><small>${Number(analytics.repeatVisitors||0).toLocaleString()} visitors with 2+ sessions</small></div>
          <div class="admin-kpi"><span>Discovery CTR</span><b>${Number(analytics.discoveryCtr||0)}%</b><small>Clicks per tracked page view</small></div>
        </div>
        <div class="admin-analytics-grid"><div class="panel admin-analytics-card admin-analytics-wide"><div class="admin-card-head"><div><div class="eyebrow">Traffic & engagement</div><h3>Audience activity</h3></div><span class="admin-live-dot">● Live first-party data</span></div><div class="admin-chart-lg"><canvas id="chartAnalyticsTraffic"></canvas></div></div><div class="panel admin-analytics-card"><div class="admin-card-head"><div><div class="eyebrow">Discovery</div><h3>Click mix</h3></div></div><div class="admin-click-mix"><div><span>Projects</span><b>${Number(analytics.projectClicks||0).toLocaleString()}</b><i style="width:${Math.min(100,(Number(analytics.projectClicks||0)/Math.max(1,Number(analytics.projectClicks||0)+Number(analytics.serviceClicks||0)))*100)}%"></i></div><div><span>Services</span><b>${Number(analytics.serviceClicks||0).toLocaleString()}</b><i style="width:${Math.min(100,(Number(analytics.serviceClicks||0)/Math.max(1,Number(analytics.projectClicks||0)+Number(analytics.serviceClicks||0)))*100)}%"></i></div></div><div class="admin-mini-stats"><b>${Number(analytics.discoveryCtr||0)}%</b> discovery click-through from page views · <b>${Number(analytics.avgEventsPerSession||0).toFixed(1)}</b> tracked events/session</div></div></div>
        <div class="admin-analytics-grid"><div class="panel admin-analytics-card"><div class="admin-card-head"><div><div class="eyebrow">Commissions</div><h3>Conversion funnel</h3></div></div><div class="admin-chart-md"><canvas id="chartAnalyticsFunnel"></canvas></div></div><div class="panel admin-analytics-card"><div class="admin-card-head"><div><div class="eyebrow">Categories</div><h3>Clicks by category</h3></div></div><div class="admin-chart-md"><canvas id="chartAnalyticsCategories"></canvas></div><p class="admin-chart-note">Project and service clicks stay separated so category performance reflects actual website interactions.</p></div></div>
        <div class="admin-analytics-grid"><div class="panel admin-analytics-card"><div class="admin-card-head"><div><div class="eyebrow">Discovery</div><h3>Top projects</h3></div></div><div class="admin-ranking">${analyticsProjectHtml}</div></div><div class="panel admin-analytics-card"><div class="admin-card-head"><div><div class="eyebrow">Services</div><h3>Top services</h3></div></div><div class="admin-ranking">${analyticsServiceHtml}</div></div></div>
        <div class="admin-analytics-grid"><div class="panel admin-analytics-card"><div class="admin-card-head"><div><div class="eyebrow">Acquisition</div><h3>Where people come from</h3></div></div><div class="admin-ranking">${analyticsSourceHtml}</div></div><div class="panel admin-analytics-card"><div class="admin-card-head"><div><div class="eyebrow">Audience</div><h3>Devices</h3></div></div><div class="admin-chart-sm"><canvas id="chartAnalyticsDevices"></canvas></div></div></div>
        <div class="panel admin-analytics-card"><div class="admin-card-head"><div><div class="eyebrow">Audience pages</div><h3>Most visited routes</h3></div></div><div class="admin-ranking">${analyticsPageHtml}</div></div>
        <div class="panel admin-analytics-card admin-ai-card"><div class="admin-card-head"><div><div class="eyebrow">AI analysis</div><h3>What should we improve?</h3><p class="meta">OpenAI receives aggregate analytics only and turns patterns into practical next actions.</p></div><button class="btn pink" id="runAnalyticsAI">✨ Analyze with Lunarist</button></div><div id="analyticsAIResult" style="margin-top:14px"><div class="meta">Run an analysis for the selected period.</div></div></div>
      </div>
      `}</div>
    <div data-studio-panel="settings" style="${activeTab==='settings'?'':'display:none'}">
      <div class="panel">
        <div class="eyebrow">Studio Settings</div>
        <div class="field" style="margin-top:10px"><label>Studio name</label><input id="studioName" value="${esc(settingsMap.site_name||'Lunarist Studio')}"></div>
        <div class="field" style="margin-top:10px"><label>Tagline</label><input id="studioTagline" value="${esc(settingsMap.tagline||'Unleash Your Dream.')}"></div>
        <button class="btn primary" id="saveStudioSettings" style="margin-top:14px">Save settings</button>
        <p id="studioSettingsMsg" class="meta" style="margin-top:8px"></p>
      </div>
    </div>
  `;

  let chartsReady=false;
  const chartInstances={};
  function initAnalyticsCharts(){
    if(chartsReady||analytics.error||analytics.loading||typeof Chart==='undefined')return;
    chartsReady=true;
    const base={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#9c96ad'}}},scales:{x:{ticks:{color:'#9c96ad'},grid:{color:'rgba(255,255,255,.05)'}},y:{ticks:{color:'#9c96ad'},grid:{color:'rgba(255,255,255,.05)'},beginAtZero:true}}};
    const days=Array.isArray(analytics.daily)?analytics.daily:[],labels=days.map(x=>String(x.day_key||'').slice(5));
    const tc=document.getElementById('chartAnalyticsTraffic');
    if(tc)chartInstances.traffic=new Chart(tc,{type:'line',data:{labels,datasets:[{label:'Visitors',data:days.map(x=>Number(x.visitors||0)),tension:.3,borderColor:'#c9b6ff'},{label:'Page views',data:days.map(x=>Number(x.page_views||0)),tension:.3,borderColor:'#8ee0ba'},{label:'Discovery clicks',data:days.map(x=>Number(x.project_clicks||0)+Number(x.service_clicks||0)),tension:.3,borderColor:'#ff86c8'}]},options:base});
    const fc=document.getElementById('chartAnalyticsFunnel');
    if(fc)chartInstances.funnel=new Chart(fc,{type:'bar',data:{labels:['Inquiries','Qualified','Paid'],datasets:[{data:[Number(analytics.inquiries||0),Number(analytics.qualified||0),Number(analytics.paid||0)],backgroundColor:['#c9b6ff','#8ee0ba','#e8cf91']}]},options:{...base,plugins:{legend:{display:false}}}});
    const dc=document.getElementById('chartAnalyticsDevices'),dr=analytics.deviceRows||[];
    if(dc)chartInstances.devices=new Chart(dc,{type:'doughnut',data:{labels:dr.map(x=>x.device),datasets:[{data:dr.map(x=>Number(x.visits||0)),backgroundColor:['#c9b6ff','#8ee0ba','#ff86c8','#e8cf91']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#9c96ad'}}}}});
    const cc=document.getElementById('chartAnalyticsCategories'),cr=analytics.categoryRows||[];
    if(cc)chartInstances.categories=new Chart(cc,{type:'bar',data:{labels:cr.slice(0,10).map(x=>x.category),datasets:[{label:'Project clicks',data:cr.slice(0,10).map(x=>Number(x.project_clicks||0)),backgroundColor:'#8ee0ba'},{label:'Service clicks',data:cr.slice(0,10).map(x=>Number(x.service_clicks||0)),backgroundColor:'#ff86c8'}]},options:{...base,indexAxis:'y'}});
  }
  if(activeTab==='analytics')initAnalyticsCharts();
  if(activeTab==='invitations')loadAdminInvitations(sec);
  sec.querySelector('#analyticsRange')?.addEventListener('change',e=>{state.analyticsDays=Number(e.target.value)||30;state._forceAdminRender=true;renderAdminStudioPage('analytics');});
  sec.querySelector('#refreshAnalytics')?.addEventListener('click',()=>{state._forceAdminRender=true;renderAdminStudioPage('analytics');});
  sec.querySelector('#runAnalyticsAI')?.addEventListener('click',async()=>{
    const btn=sec.querySelector('#runAnalyticsAI'),out=sec.querySelector('#analyticsAIResult');if(!btn||!out)return;
    btn.disabled=true;btn.textContent='✨ Analyzing…';out.innerHTML='<div class="meta">OpenAI is reading the aggregate dashboard data…</div>';
    try{
      const r=await fetch('/api/openai',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({action:'analytics_insights',analytics:{days:state.analyticsDays||30,totals:analytics.totals,daily:analytics.daily,projects:analytics.projectRows,services:analytics.serviceRows,categories:analytics.categoryRows,sources:analytics.sourceRows,devices:analytics.deviceRows,commission:analytics.commission}})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to analyze analytics');
      out.innerHTML='<div style="display:grid;gap:10px">'+(d.summary?'<div class="panel" style="margin:0;background:rgba(201,182,255,.05)">'+esc(d.summary)+'</div>':'')+(Array.isArray(d.insights)?d.insights.map(x=>'<div class="listitem"><div class="grow"><b>'+esc(x.title||'Insight')+'</b><div class="meta">'+esc(x.detail||'')+'</div></div><span class="tag">'+esc(x.priority||'medium')+'</span></div>').join(''):'')+(Array.isArray(d.actions)&&d.actions.length?'<div><div class="eyebrow" style="margin-bottom:6px">Next actions</div>'+d.actions.map(x=>'<div class="meta" style="padding:4px 0">→ '+esc(x)+'</div>').join('')+'</div>':'')+'</div>';
    }catch(e){out.innerHTML='<div class="meta" style="color:var(--danger)">'+esc(e.message||'Analytics AI failed.')+'</div>'}
    finally{btn.disabled=false;btn.textContent='✨ Analyze with Lunarist';}
  });

  sec.querySelectorAll('[data-studio-tab]').forEach(btn=>btn.onclick=()=>{
    sec.querySelectorAll('[data-studio-tab]').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    sec.querySelectorAll('[data-studio-panel]').forEach(x=>x.style.display=x.dataset.studioPanel===btn.dataset.studioTab?'block':'none');
    if(btn.dataset.studioTab==='analytics')initAnalyticsCharts();
    if(btn.dataset.studioTab==='invitations')loadAdminInvitations(sec);
  });

  sec.querySelectorAll('[data-admin-profile]').forEach(btn=>btn.onclick=()=>{ const target=member(btn.dataset.adminProfile); if(target) goRoute('member:'+target.id); });

  sec.querySelectorAll('[data-admin-pj-status]').forEach(el=>el.onchange=async()=>{
    const id = el.dataset.adminPjStatus;
    const r=await supabaseClient.from('projects').update({status:el.value,published:el.value==='published',updated_at:new Date().toISOString()}).eq('id',id);
    if(r.error){toast(r.error.message)}else{
      toast('Project status updated');
      const item = allProjects.find(x=>x.id===id);
      if(item) await sendNotification(item.owner_id, 'Project Status Changed', `Your project "${item.title}" is now ${el.value}`, 'approval', 'dashboard:projects');
      await loadData();
      renderAdminStudioPage('projects');
    }
  });

  sec.querySelectorAll('[data-admin-pj-approve]').forEach(btn=>btn.onclick=async()=>{
    const id = btn.dataset.adminPjApprove;
    const r=await supabaseClient.from('projects').update({status:'published',published:true,updated_at:new Date().toISOString()}).eq('id',id);
    if(r.error){toast(r.error.message)}else{
      toast('Project approved & published!');
      const item = allProjects.find(x=>x.id===id);
      if(item) await sendNotification(item.owner_id, 'Project Approved 🎉', `Your project "${item.title}" has been published to Discover!`, 'approval', 'dashboard:projects');
      await loadData();
      renderAdminStudioPage('overview');
    }
  });

  sec.querySelectorAll('[data-admin-sv-status]').forEach(el=>el.onchange=async()=>{
    const id = el.dataset.adminSvStatus;
    const r=await supabaseClient.from('services').update({status:el.value,published:el.value==='published',updated_at:new Date().toISOString()}).eq('id',id);
    if(r.error){toast(r.error.message)}else{
      toast('Service status updated');
      const item = allServices.find(x=>x.id===id);
      if(item) await sendNotification(item.owner_id||item.artist_id, 'Service Status Changed', `Your service "${item.title}" is now ${el.value}`, 'approval', 'dashboard:services');
      await loadData();
      renderAdminStudioPage('services');
    }
  });

  sec.querySelectorAll('[data-admin-sv-approve]').forEach(btn=>btn.onclick=async()=>{
    const id = btn.dataset.adminSvApprove;
    const r=await supabaseClient.from('services').update({status:'published',published:true,updated_at:new Date().toISOString()}).eq('id',id);
    if(r.error){toast(r.error.message)}else{
      toast('Service approved & published!');
      const item = allServices.find(x=>x.id===id);
      if(item) await sendNotification(item.owner_id||item.artist_id, 'Service Approved 🎉', `Your service "${item.title}" is now live!`, 'approval', 'dashboard:services');
      await loadData();
      renderAdminStudioPage('overview');
    }
  });

  sec.querySelectorAll('[data-admin-feature]').forEach(el=>el.onclick=async()=>{
    const id=el.dataset.adminFeature;
    const item=allProjects.find(x=>x.id===id);
    const r=await supabaseClient.from('projects').update({featured:!item?.featured,updated_at:new Date().toISOString()}).eq('id',id);
    if(r.error){toast(r.error.message)}else{toast(item?.featured?'Removed from featured':'Added to featured');await loadData();renderAdminStudioPage('projects')}
  });

  sec.querySelectorAll('[data-toggle-membertype]').forEach(el => el.onclick = async () => {
    const id = el.dataset.toggleMembertype;
    const next = el.dataset.current === 'member' ? 'user' : 'member';
    el.disabled = true;

    try {
      const res = await fetch('/api/lunarist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-member', targetId: id, nextType: next })
      });
      const result = await res.json();

      if (!res.ok || result.error) {
        toast('Error: ' + (result.error || 'Failed to update member'));
        el.disabled = false;
      } else {
        toast(next === 'member' ? 'Promoted to Lunarist Member' : 'Reverted to User');
        await sendNotification(id, 'Account Role Updated', `You have been ${next === 'member' ? 'promoted to Lunarist Member' : 'reverted to User'}.`, 'system', 'dashboard:profile');
        await loadData();
        await refreshUser();
        renderAdminStudioPage('members');
      }
    } catch (err) {
      toast('Error connecting to server');
      el.disabled = false;
    }
  });

  document.getElementById('saveStudioSettings')?.addEventListener('click',async()=>{
    const msg=document.getElementById('studioSettingsMsg');
    const rows=[['site_name',document.getElementById('studioName').value.trim()],['tagline',document.getElementById('studioTagline').value.trim()]];
    for(const [key,value] of rows){
      const r=await supabaseClient.from('studio_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'});
      if(r.error){msg.textContent=r.error.message;return}
    }
    msg.textContent='Settings saved.';toast('Studio settings saved');
  });
}

function closeDash(){document.getElementById('drawer').classList.remove('open')}

/* Public Commission Status — Phase 9 */
const PUBLIC_COMMISSION_STATUSES = [
  {key:'waitlist', label:'Waitlist', desc:'Your commission is currently waiting to be started.'},
  {key:'unpaid', label:'Unpaid', desc:'The commission has been accepted and is awaiting payment.'},
  {key:'paid', label:'Paid', desc:'Payment has been received and the commission is ready to begin.'},
  {key:'wip1', label:'WIP 1', desc:'Work in progress — first production phase.'},
  {key:'wip2', label:'WIP 2', desc:'Work in progress — second production phase.'},
  {key:'wip3', label:'WIP 3', desc:'Work in progress — final production phase.'},
  {key:'delivered', label:'Delivered', desc:'The work has been delivered to the client.'},
  {key:'revisions', label:'Revisions', desc:'The client revision stage is currently active.'},
  {key:'completed', label:'Completed', desc:'The commission is completed.'}
];

function commissionStatusLabel(status){
  return PUBLIC_COMMISSION_STATUSES.find(x=>x.key===status)?.label || status || 'Waitlist';
}
function commissionStatusDesc(status){
  return PUBLIC_COMMISSION_STATUSES.find(x=>x.key===status)?.desc || '';
}
function commissionStatusIndex(status){
  const i=PUBLIC_COMMISSION_STATUSES.findIndex(x=>x.key===status);
  return i<0?0:i;
}
function ensureCommissionStatusModal(){
  if(document.getElementById('publicCommissionStatusModal')) return;
  const el=document.createElement('div');
  el.id='publicCommissionStatusModal';
  el.className='modal';
  el.innerHTML=`
    <div class="modalbox" style="max-width:760px;width:min(92vw,760px);max-height:88vh;overflow:auto">
      <div class="sectionhead" style="margin-bottom:12px">
        <div><div class="eyebrow">Commission</div><h2 id="publicCommissionTitle">Commission Status</h2></div>
        <button class="btn" type="button" id="publicCommissionClose">Close</button>
      </div>
      <div id="publicCommissionBody"></div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open')});
  document.getElementById('publicCommissionClose').onclick=()=>el.classList.remove('open');
}
async function openPublicCommissionStatus(username){
  ensureCommissionStatusModal();
  const modal=document.getElementById('publicCommissionStatusModal');
  const body=document.getElementById('publicCommissionBody');
  const title=document.getElementById('publicCommissionTitle');
  modal.classList.add('open');
  body.innerHTML='<div class="panel"><div class="meta">Loading commission status…</div></div>';

  try{
    const u=String(username||'').trim();
    const r=await fetch('/api/lunarist?resource=commissions&username='+encodeURIComponent(u));
    if(!r.ok) throw new Error(await r.text());
    const rows=await r.json();
    const commissions=Array.isArray(rows)?rows:[];
    title.textContent=(u?'@'+u+' — ':'')+'Commission Status';

    if(!commissions.length){
      body.innerHTML='<div class="panel"><h3>No public commissions yet</h3><p class="meta">There are no commissions currently visible for this artist.</p></div>';
      return;
    }

    body.innerHTML=commissions.map(c=>{
      const client=c.client_name||c.customer_name||c.client?.display_name||c.client?.username||'Client';
      const service=c.service_title||c.service_name||c.service?.title||'Commission Service';
      const status=c.status||'waitlist';
      const idx=commissionStatusIndex(status);
      return `<div class="panel" style="margin-bottom:14px">
        <div class="row" style="justify-content:space-between;gap:12px;align-items:flex-start">
          <div>
            <div class="eyebrow">Commission</div>
            <h3 style="margin:4px 0 8px">${esc(service)}</h3>
            <div class="meta"><b>Client:</b> ${esc(client)}</div>
          </div>
          <span class="pill">${esc(commissionStatusLabel(status))}</span>
        </div>
        <div class="commission-status-track" style="display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:5px;margin-top:18px">
          ${PUBLIC_COMMISSION_STATUSES.map((s,i)=>`
            <div title="${esc(s.label)}" style="text-align:center">
              <div style="height:6px;border-radius:99px;background:${i<=idx?'var(--accent)':'rgba(255,255,255,.10)'}"></div>
              <div class="meta" style="font-size:10px;margin-top:5px">${esc(s.label)}</div>
            </div>`).join('')}
        </div>
        <p class="meta" style="margin-top:14px">${esc(commissionStatusDesc(status))}</p>
      </div>`;
    }).join('');
  }catch(e){
    body.innerHTML='<div class="panel"><h3>Commission status unavailable</h3><p class="meta">'+esc(e.message||'Unable to load commission status.')+'</p></div>';
  }
}

async function apiAuthHeaders(){
  const headers={'Content-Type':'application/json'};
  try{const {data}=await supabaseClient.auth.getSession(); if(data?.session?.access_token)headers.Authorization=`Bearer ${data.session.access_token}`;}catch{}
  return headers;
}
async function loadConfig(){const r=await fetch('/api/config');if(!r.ok)throw new Error('Lunarist configuration is missing on Vercel.');const c=await r.json();if(!c.url||!c.anonKey)throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required.');supabaseClient=window.supabaseClient=window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});supabaseClient.auth.onAuthStateChange((event,session)=>{setTimeout(async()=>{try{await refreshUser();updateAccountButton();if(session&&pendingInvitationReservation())try{await redeemPendingInvitation()}catch(e){console.warn('Invitation redemption after auth:',e?.message||e)}}catch(e){console.error('Auth state refresh failed:',e)}},0)});await refreshUser()}
async function loadData(){
  state.loadError=null;
  try{
    if(!supabaseClient)await loadConfig();
    const [pr,pp,sv]=await Promise.all([
      fetch('/api/lunarist?resource=profiles').then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()}),
      fetch('/api/lunarist?resource=projects').then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()}),
      fetch('/api/lunarist?resource=services').then(async r=>{if(!r.ok)throw new Error(await r.text());return r.json()})
    ]);
    data.members=(Array.isArray(pr)?pr:[]).map(x=>({
      id:x.id,
      username:x.username,
      name:x.display_name,
      role:x.role||'',
      bio:x.bio||'',
      tos:x.tos||'',
      tos_ja:x.tos_ja||'',
      theme:x.theme||'moonlight',
      avatar:x.avatar_url||'https://i.pravatar.cc/160?u='+x.id,
      skills:x.skills||[],
      available:x.available!==false,
      account_type:x.account_type||'member',
      is_admin:!!x.is_admin,
      socials:x.socials||{}
    }));

     try {
       const {data: publicTosRows, error: publicTosError} = await supabaseClient
         .from('profiles')
         .select('id,tos,tos_ja')
         .not('tos','is',null);
       if (!publicTosError && Array.isArray(publicTosRows)) {
         const tosById = new Map(publicTosRows.map(x=>[x.id,{en:x.tos||'',ja:x.tos_ja||''}]));
         data.members.forEach(m=>{
           if (tosById.has(m.id)) { const t=tosById.get(m.id); m.tos=t.en; m.tos_ja=t.ja; }
         });
       }
     } catch(e) {}
    
    data.projects=(Array.isArray(pp)?pp:[]).map(x=>({
      id:x.id,
      member:x.owner_id||x.artist_id,
      title:x.title,
      category:x.category,
      tags:x.tags||[],
      views:Number(x.views||0),
      likes:Number(x.likes||0),
      created_at:x.created_at,
      position:x.position,
      video:x.media_type==='video'?x.media_url:'',
      image:x.thumbnail_url||x.media_url||'',
      desc:x.description||'',
      description:x.description||'',
      published:x.published,
      status:x.status||(x.published?'published':'draft'),
      featured:!!x.featured,
      lunarist_direct:!!x.lunarist_direct,
      thumbnail_url:x.thumbnail_url,
      media_url:x.media_url,
      media_type:x.media_type,
      slides:Array.isArray(x.slides)?x.slides:[]
    }));

    data.services=(Array.isArray(sv)?sv:[]).map(x=>({id:x.id,member:x.owner_id||x.artist_id,title:x.title,category:x.category,tags:x.tags||[],price_from:x.price_from||'',amount:Number(x.amount||0),delivery_time:x.delivery_time||'',thumbnail_url:x.thumbnail_url||'',views:Number(x.views||0),created_at:x.created_at,description:x.description||'',add_ons:x.add_ons||[],sort_order:Number.isFinite(Number(x.sort_order))?Number(x.sort_order):null,projectIds:(x.service_projects||[]).map(sp=>sp.project_id)}));
    
    state.backendReady=true;
    if(!state.routeInitialized){state.route=routeFromPath();state.routeInitialized=true}
    await refreshRecommendations();
    render();
    refreshAIRecommendations();

    data.projects.forEach(async (p) => {
      const vid = extractYoutubeId(p.media_url) || extractYoutubeId(p.video) || extractYoutubeId(p.thumbnail_url);
      if (vid) {
        try {
          const r = await fetch('/api/youtube?videoId=' + encodeURIComponent(vid));
          const res = await r.json();
          if (res) {
            const patch={};
            if(res.viewCount !== undefined && res.viewCount !== null && Number.isFinite(Number(res.viewCount))){
              p.views=Number(res.viewCount);
              patch.views=p.views;
            }
            if(res.likeCount !== undefined && res.likeCount !== null && Number.isFinite(Number(res.likeCount))){
              p.likes=Number(res.likeCount);
              patch.likes=p.likes;
            }
            if(Object.keys(patch).length){
              supabaseClient.from('projects').update(patch).eq('id', p.id).then(() => {});
              render(true);
            }
          }
        } catch(e) {}
      }
    });

  }catch(e){
    state.backendReady=false;
    state.loadError=e.message||'Unable to connect to Supabase.';
    render()
  }
}

function updateAccountButton(){
  const b=document.getElementById('accountBtn');
  const isAdmin = state.currentMember?.is_admin;
  const navAdmin = document.getElementById('navAdminBtn');
  if(navAdmin) navAdmin.style.display = isAdmin ? 'inline-flex' : 'none';
  if(state.currentUser){
    b.title='Open member space · '+roleLabel(state.currentMember);
    document.getElementById('accountName').textContent=state.currentMember?.name||state.currentUser.email||'Member';
  }else{
    b.title='Sign in';
    document.getElementById('accountName').textContent='Guest';
  }
}

/* Navigation + language */
const I18N={
  en:{
    home:'Home',discover:'Discover',services:'Services',artists:'Artists',myCommissions:'My Commissions',adminStudio:'Admin Studio',
    overview:'Overview',messages:'Messages 💬',projects:'My Projects',profile:'Profile',servicesTab:'Services',savedTab:'Saved 🔖',
    memberSpace:'Member space',yourLunarist:'Your Lunarist',directMessaging:'Direct Messaging',activeCollaborations:'Active Collaborations',
    myServices:'My services',myProjects:'My projects',editProfile:'Edit profile',clientDashboard:'Client Dashboard',
    myCommissionsAndReviews:'My commissions & reviews',trackCommissions:'Track every commission you have commissioned, approve delivery, and leave a review when the work is complete.',
    welcomeBack:'Welcome back',overviewDescription:'Your profile and projects are stored in Supabase. Published work appears in Discover.',
    hireCollective:'Hire the collective',servicesTitle:'Services.',servicesDescription:'Book Lunarist members directly for commissions and packages.',
    discoverWork:'Discover work.',discoverDescription:'Lunarist mixes relevance with exploration, so your feed can introduce you to artists and disciplines you would not normally click.',
    findVoice:'Find the right creative voice.',meetArtists:'Meet the artists.',forYou:'For you',curated:'Curated from what you explore.',
    selectedWork:'Selected work',publishedProjects:'published projects',listed:'listed',
    noProjects:'No projects yet.',noServices:'No services yet.',noCommissions:'No commissions yet.',noConversations:'No conversations yet.',
    noProjectsDesc:'Publish your first piece of work.',noServicesDesc:'List a service artists can hire you for.',noCommissionsDesc:'When you commission a Lunarist artist, your orders and completed work will appear here.',
    noConversationsDesc:'Message an artist from their profile or inquiry on a service to start collaborating.',
    createManage:'Create and manage work',offerPackages:'Offer commissions & packages',
    profileColor:'Profile Color Scheme',selectTheme:'Select a color theme accent for your profile and space.',
    terms:'Terms of Service (TOS)',availability:'Availability',available:'Available',booked:'Booked',saveProfile:'Save profile',signOut:'Sign out',
    changePhoto:'Change photo',displayName:'Display name',username:'Username',role:'Role',bio:'Bio',
    attachFiles:'Attach files up to 10MB · Drop a file into the chat',attachment:'Attachment',
    automaticPricing:'Automatic price calculation',baseService:'Base service',automaticTotal:'Automatic total',
    fullAmount:'Full Amount',deposit:'50% Deposit',copyLink:'Copy link',close:'Close',cancel:'Cancel',approve:'Approve',edit:'Edit',delete:'Delete',
    clientReviews:'Client reviews',reviewsFromClients:'Reviews from clients',reviewCompleted:'Review your completed commission',publishReview:'Publish review',
    admin:'Administrator',member:'Lunarist Member',client:'Client',availableForCommissions:'Available for commissions',currentlyBooked:'Currently booked',
    inquire:'Inquire',chat:'Chat',search:'Search',menu:'Menu',guest:'Guest',
    activeSession:'Active Session',startedConversation:'Started conversation',loading:'Loading…',loadingReviews:'Loading reviews…',loadingCommissions:'Loading your commissions…'
  },
  ja:{
    home:'ホーム',discover:'発見',services:'サービス',artists:'アーティスト',myCommissions:'マイ・コミッション',adminStudio:'管理スタジオ',
    overview:'概要',messages:'メッセージ 💬',projects:'マイ・プロジェクト',profile:'プロフィール',servicesTab:'サービス',savedTab:'保存済み 🔖',
    memberSpace:'メンバースペース',yourLunarist:'あなたのLunarist',directMessaging:'ダイレクトメッセージ',activeCollaborations:'進行中のコラボレーション',
    myServices:'マイサービス',myProjects:'マイプロジェクト',editProfile:'プロフィールを編集',clientDashboard:'クライアントダッシュボード',
    myCommissionsAndReviews:'マイ・コミッションとレビュー',trackCommissions:'すべてのコミッションを確認し、納品を承認して、完了後にレビューを投稿できます。',
    welcomeBack:'おかえりなさい',overviewDescription:'プロフィールとプロジェクトはSupabaseに保存されています。公開作品は「発見」に表示されます。',
    hireCollective:'クリエイティブチームに依頼',servicesTitle:'サービス。',servicesDescription:'Lunaristメンバーへ直接コミッションやパッケージを依頼できます。',
    discoverWork:'作品を発見。',discoverDescription:'Lunaristは関連性と探索を組み合わせ、普段ならクリックしないアーティストや分野との出会いを届けます。',
    findVoice:'あなたに合うクリエイティブな才能を探す。',meetArtists:'アーティストを見る。',forYou:'あなたへのおすすめ',curated:'あなたの閲覧内容からキュレーションしています。',
    selectedWork:'注目の作品',publishedProjects:'公開プロジェクト',listed:'件掲載',
    noProjects:'プロジェクトはまだありません。',noServices:'サービスはまだありません。',noCommissions:'コミッションはまだありません。',noConversations:'会話はまだありません。',
    noProjectsDesc:'最初の作品を公開しましょう。',noServicesDesc:'依頼を受けられるサービスを登録しましょう。',noCommissionsDesc:'Lunaristのアーティストへ依頼すると、注文と完了した作品がここに表示されます。',
    noConversationsDesc:'アーティストのプロフィールまたはサービスの問い合わせからメッセージを送り、コラボレーションを始めましょう。',
    createManage:'作品を作成・管理',offerPackages:'コミッションとパッケージを提供',
    profileColor:'プロフィールのカラースキーム',selectTheme:'プロフィールとスペースのアクセントカラーを選択します。',
    terms:'利用規約 (TOS)',availability:'受付状況',available:'受付中',booked:'予約済み',saveProfile:'プロフィールを保存',signOut:'サインアウト',
    changePhoto:'写真を変更',displayName:'表示名',username:'ユーザー名',role:'役割',bio:'自己紹介',
    attachFiles:'最大10MBのファイルを添付 · チャットへドラッグ＆ドロップ',attachment:'添付ファイル',
    automaticPricing:'自動価格計算',baseService:'基本サービス',automaticTotal:'自動合計',fullAmount:'全額',deposit:'50%デポジット',copyLink:'リンクをコピー',close:'閉じる',cancel:'キャンセル',approve:'承認',edit:'編集',delete:'削除',
    clientReviews:'クライアントレビュー',reviewsFromClients:'クライアントからのレビュー',reviewCompleted:'完了したコミッションをレビュー',publishReview:'レビューを公開',
    admin:'管理者',member:'Lunaristメンバー',client:'クライアント',availableForCommissions:'コミッション受付中',currentlyBooked:'現在予約済み',
    inquire:'問い合わせ',chat:'チャット',search:'検索',menu:'メニュー',guest:'ゲスト',activeSession:'アクティブセッション',startedConversation:'会話を開始しました',loading:'読み込み中…',loadingReviews:'レビューを読み込み中…',loadingCommissions:'コミッションを読み込み中…'
  }
};

const UI_TRANSLATIONS={
  en:{
    'A creative network by Lunarist Studio':'A creative network by Lunarist Studio','Creative network · 2026':'Creative network · 2026',
    'Lunarist is a living portfolio where every artist can publish, every project can be discovered, and every visitor gets a different creative journey.':'Lunarist is a living portfolio where every artist can publish, every project can be discovered, and every visitor gets a different creative journey.',
    'Every member owns their profile and projects. Clients can discover people by discipline, style and availability.':'Every member owns their profile and projects. Clients can discover people by discipline, style and availability.',
    'Explore Lunarist':'Explore Lunarist','Explore the work':'Explore the work','Meet our artists':'Meet our artists.','Fresh published work from the studio.':'Fresh published work from the studio.',
    'Discover work.':'Discover work.','Find the right creative voice.':'Find the right creative voice.','Curated from what you explore.':'Curated from what you explore.',
    'Hire the collective':'Hire the collective','Book Lunarist members directly for commissions and packages.':'Book Lunarist members directly for commissions and packages.',
    'Edit profile':'Edit profile','Create and manage work':'Create and manage work','Offer commissions & packages':'Offer commissions & packages','Direct Messaging':'Direct Messaging','Active Collaborations':'Active Collaborations',
    'Client Dashboard':'Client Dashboard','My commissions & reviews':'My commissions & reviews','Track every commission you have commissioned, approve delivery, and leave a review when the work is complete.':'Track every commission you have commissioned, approve delivery, and leave a review when the work is complete.',
    'Automatic price calculation':'Automatic price calculation','Base service':'Base service','Full Amount':'Full Amount','50% Deposit':'50% Deposit','Add-ons & Custom Options':'Add-ons & Custom Options','Inquire':'Inquire','Your Name / Handle *':'Your Name / Handle *','Company / Agency Name (Optional)':'Company / Agency Name (Optional)','Your Email Address *':'Your Email Address *','Social Media e.g. @Handle *':'Social Media e.g. @Handle *','Target Deadline / Preferred Delivery Date (Optional)':'Target Deadline / Preferred Delivery Date (Optional)','Project Brief & Description (Optional)':'Project Brief & Description (Optional)','Upload Brief / Asset Attachment (Optional)':'Upload Brief / Asset Attachment (Optional)','I have read and agree to the':'I have read and agree to the','Terms of Service (TOS)':'Terms of Service (TOS)','Send Inquiry':'Send Inquiry','Powered by PayPal':'Powered by PayPal','This service has no optional add-ons.':'This service has no optional add-ons.','Portfolio examples':'Portfolio examples','Chat with Artist':'Chat with Artist','View profile':'View profile','Select an add-on to update the total automatically.':'Select an add-on to update the total automatically.','Save Slot':'Save Slot','Pay Upfront':'Pay Upfront','(Required)':'(Required)',"artist's terms":"artist's terms",
    'Client reviews':'Client reviews','Reviews from clients':'Reviews from clients','Loading reviews…':'Loading reviews…','Loading your commissions…':'Loading your commissions…',
    'Attach files up to 10MB · Drop a file into the chat':'Attach files up to 10MB · Drop a file into the chat','Started conversation':'Started conversation',
    'Available for commissions':'Available for commissions','Currently booked':'Currently booked','No published projects yet.':'No published projects yet.','No services listed yet.':'No services listed yet.',
    'Selected work':'Selected work','Services':'Services','Terms of Service':'Terms of Service','Artist Policies':'Artist Policies','Profile Color Scheme':'Profile Color Scheme',
    'Select a color theme accent for your profile and space.':'Select a color theme accent for your profile and space.',
    'JPG or PNG, square works best.':'JPG or PNG, square works best.','Change photo':'Change photo','Display name':'Display name','Username':'Username','Role':'Role','Bio':'Bio','Availability':'Availability',
    'Save profile':'Save profile','Sign out':'Sign out','No commissions yet.':'No commissions yet.','When you commission a Lunarist artist, your orders and completed work will appear here.':'When you commission a Lunarist artist, your orders and completed work will appear here.',
    'No conversations yet.':'No conversations yet.','Message an artist from their profile or inquiry on a service to start collaborating.':'Message an artist from their profile or inquiry on a service to start collaborating.',
    'No projects yet.':'No projects yet.','Publish your first piece of work.':'Publish your first piece of work.','No services yet.':'No services yet.','List a service artists can hire you for.':'List a service artists can hire you for.',
    'Search services, artists…':'Search services, artists…','Search projects, artists…':'Search projects, artists…','Loading commission status…':'Loading commission status…'
  },
  ja:{
    'A creative network by Lunarist Studio':'Lunarist Studioによるクリエイティブネットワーク','Creative network · 2026':'クリエイティブネットワーク · 2026',
    'Lunarist is a living portfolio where every artist can publish, every project can be discovered, and every visitor gets a different creative journey.':'Lunaristは、すべてのアーティストが作品を公開し、すべてのプロジェクトを発見でき、訪れる人それぞれに異なるクリエイティブ体験を届けるポートフォリオです。',
    'Every member owns their profile and projects. Clients can discover people by discipline, style and availability.':'すべてのメンバーがプロフィールと作品を管理します。クライアントは分野、スタイル、受付状況から才能を探せます。',
    'Explore Lunarist':'Lunaristを見る','Explore the work':'作品を見る','Meet our artists':'アーティストを見る。','Fresh published work from the studio.':'スタジオから公開された最新作品。',
    'Discover work.':'作品を発見。','Find the right creative voice.':'あなたに合うクリエイティブな才能を探す。','Curated from what you explore.':'あなたの閲覧内容からキュレーションしています。',
    'Hire the collective':'クリエイティブチームに依頼','Book Lunarist members directly for commissions and packages.':'Lunaristメンバーへ直接コミッションやパッケージを依頼できます。',
    'Edit profile':'プロフィールを編集','Create and manage work':'作品を作成・管理','Offer commissions & packages':'コミッションとパッケージを提供','Direct Messaging':'ダイレクトメッセージ','Active Collaborations':'進行中のコラボレーション',
    'Client Dashboard':'クライアントダッシュボード','My commissions & reviews':'マイ・コミッションとレビュー','Track every commission you have commissioned, approve delivery, and leave a review when the work is complete.':'すべてのコミッションを確認し、納品を承認して、完了後にレビューを投稿できます。',
    'Automatic price calculation':'自動価格計算','Base service':'基本サービス','Full Amount':'全額','50% Deposit':'50%デポジット','Add-ons & Custom Options':'追加オプション','Inquire':'お問い合わせ','Your Name / Handle *':'お名前 / ハンドル *','Company / Agency Name (Optional)':'会社名 / エージェンシー名（任意）','Your Email Address *':'メールアドレス *','Social Media e.g. @Handle *':'SNS（@ハンドルなど） *','Target Deadline / Preferred Delivery Date (Optional)':'希望納期 / 希望納品日（任意）','Project Brief & Description (Optional)':'プロジェクト概要・説明（任意）','Upload Brief / Asset Attachment (Optional)':'概要・素材ファイル（任意）','I have read and agree to the':'以下に同意します：','Terms of Service (TOS)':'利用規約（TOS）','Send Inquiry':'お問い合わせを送信','Powered by PayPal':'PayPalで処理','This service has no optional add-ons.':'このサービスには追加オプションがありません。','Portfolio examples':'ポートフォリオ例','Chat with Artist':'アーティストにチャット','View profile':'プロフィールを見る','Select an add-on to update the total automatically.':'追加オプションを選択すると合計金額が自動更新されます。','Save Slot':'枠を確保','Pay Upfront':'前払い','(Required)':'（必須）',"artist's terms":"アーティストの規約",
    'Client reviews':'クライアントレビュー','Reviews from clients':'クライアントからのレビュー','Loading reviews…':'レビューを読み込み中…','Loading your commissions…':'コミッションを読み込み中…',
    'Attach files up to 10MB · Drop a file into the chat':'最大10MBのファイルを添付 · チャットへドラッグ＆ドロップ','Started conversation':'会話を開始しました',
    'Available for commissions':'コミッション受付中','Currently booked':'現在予約済み','No published projects yet.':'公開された作品はまだありません。','No services listed yet.':'サービスはまだ登録されていません。',
    'Selected work':'注目の作品','Services':'サービス','Terms of Service':'利用規約','Artist Policies':'アーティストポリシー','Profile Color Scheme':'プロフィールのカラースキーム',
    'Select a color theme accent for your profile and space.':'プロフィールとスペースのアクセントカラーを選択します。',
    'JPG or PNG, square works best.':'JPGまたはPNG、正方形がおすすめです。','Change photo':'写真を変更','Display name':'表示名','Username':'ユーザー名','Role':'役割','Bio':'自己紹介','Availability':'受付状況',
    'Save profile':'プロフィールを保存','Sign out':'サインアウト','No commissions yet.':'コミッションはまだありません。','When you commission a Lunarist artist, your orders and completed work will appear here.':'Lunaristのアーティストへ依頼すると、注文と完了した作品がここに表示されます。',
    'No conversations yet.':'会話はまだありません。','Message an artist from their profile or inquiry on a service to start collaborating.':'アーティストのプロフィールまたはサービスの問い合わせからメッセージを送り、コラボレーションを始めましょう。',
    'No projects yet.':'プロジェクトはまだありません。','Publish your first piece of work.':'最初の作品を公開しましょう。','No services yet.':'サービスはまだありません。','List a service artists can hire you for.':'依頼を受けられるサービスを登録しましょう。',
    'Search services, artists…':'サービス、アーティストを検索…','Search projects, artists…':'プロジェクト、アーティストを検索…','Loading commission status…':'コミッション状況を読み込み中…'
  }
};

function translateInterface(lang){
  const en=UI_TRANSLATIONS.en||{};
  const ja=UI_TRANSLATIONS.ja||{};
  const target=lang==='ja'?ja:en;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    const parent=node.parentElement;
    if(!parent || ['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(parent.tagName) || parent.closest('script,style,textarea,input')) return;
    const raw=node.nodeValue; const key=raw.trim();
    if(!key) return;
    let translated=target[key];
    if(!translated){
      const keys=Object.keys(en);
      for(const k of keys){
        if(lang==='ja' && en[k]===key){translated=ja[k];break;}
        if(lang==='en' && ja[k]===key){translated=en[k];break;}
      }
    }
    if(translated && translated!==key) node.nodeValue=raw.replace(key,translated);
  });
  document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{
    const key=el.getAttribute('placeholder');
    if(target[key]) el.setAttribute('placeholder',target[key]);
    else { for(const k of Object.keys(en)){ if(lang==='ja' && en[k]===key){el.setAttribute('placeholder',ja[k]);break;} if(lang==='en' && ja[k]===key){el.setAttribute('placeholder',en[k]);break;} } }
  });
  document.querySelectorAll('[title]').forEach(el=>{
    const key=el.getAttribute('title');
    if(target[key]) el.setAttribute('title',target[key]);
    else { for(const k of Object.keys(en)){ if(lang==='ja' && en[k]===key){el.setAttribute('title',ja[k]);break;} if(lang==='en' && ja[k]===key){el.setAttribute('title',en[k]);break;} } }
  });
}
function applyLanguage(lang){
  const safe=I18N[lang]?lang:'en'; state.language=safe;
  const dict=I18N[safe]; document.documentElement.lang=safe==='ja'?'ja':'en'; localStorage.setItem('lunarist_lang',safe);
  document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;if(dict[k])el.textContent=dict[k]});
  document.querySelectorAll('.lang-switch [data-lang]').forEach(el=>el.classList.toggle('active',el.dataset.lang===safe));
  document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in-view'));
  translateInterface(safe);
  if(!state._renderingService && document.getElementById('projectModal')?.classList.contains('open') && state.openServiceId){openService(state.openServiceId);}
}
function initLanguage(){const saved=localStorage.getItem('lunarist_lang')||'en';applyLanguage(saved);document.querySelectorAll('.lang-switch [data-lang]').forEach(el=>el.onclick=()=>{applyLanguage(el.dataset.lang);render();});}
function initReveal(){const els=document.querySelectorAll('.reveal');if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in-view'));return}const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -30px'});els.forEach(e=>io.observe(e));}

document.getElementById('accountBtn').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(state.currentUser){openDashboard();}else{openAuth('signin');document.getElementById('authModal')?.classList.add('open');}});document.getElementById('modalClose').onclick=closeModal;document.getElementById('projectModal').onclick=e=>{if(e.target.id==='projectModal')closeModal()};document.getElementById('drawerClose').onclick=closeDash;document.getElementById('drawer').onclick=e=>{if(e.target.id==='drawer')closeDash()};document.getElementById('menuBtn').onclick=()=>document.getElementById('navlinks').classList.toggle('open');document.getElementById('navCommissionsBtn').onclick=async()=>{document.getElementById('navlinks').classList.remove('open');await openCommissionsPage()};initLanguage();initReveal();document.getElementById('authClose').onclick=closeAuth;document.getElementById('authModal').onclick=e=>{if(e.target.id==='authModal')closeAuth()};document.getElementById('authToggle').onclick=()=>openAuth(state.authMode==='signin'?'signup':'signin');document.getElementById('googleAuth').onclick=signInWithGoogle;
async function capturePaypalReturnIfPresent(){
  const params=new URLSearchParams(location.search);
  const paypalStatus=params.get('paypal');
  const orderId=params.get('token');
  if(paypalStatus==='success'&&orderId){
    try{
      const r=await fetch('/api/paypal',{method:'POST',headers:await apiAuthHeaders(),body:JSON.stringify({action:'capture',order_id:orderId})});
      const d=await r.json();
      if(r.ok&&(d.status==='COMPLETED'||d.alreadyCaptured)){toast('Payment confirmed — thank you!')}
      else{toast('We could not confirm your payment automatically. The artist has your order on file.')}
    }catch(e){}
  }
  if(paypalStatus==='cancel'){toast('Checkout was cancelled — no charge was made.')}
  if(paypalStatus){
    params.delete('paypal');params.delete('token');params.delete('PayerID');
    const clean=location.pathname+(params.toString()?'?'+params.toString():'');
    history.replaceState({},'',clean);
  }
}
(async()=>{
  const params=new URLSearchParams(location.search);
  const invite=(params.get('invite')||'').trim().toUpperCase();
  const nonce=(params.get('nonce')||'').trim();
  const validInvite=/^[A-Z0-9]{8,32}$/.test(invite);
  if(validInvite){
    state.inviteCode=invite;
    localStorage.setItem('lunarist_pending_invite',invite);
    document.documentElement.dataset.invitationLink='true';
  }
  if(validInvite&&nonce){
    const old=pendingInvitationReservation();
    localStorage.setItem('lunarist_invite_reservation',JSON.stringify({code:invite,nonce,email:old?.email||'',at:Date.now()}));
  }
  await loadData();
  updateAccountButton();
  await redeemPendingInvitation();
  await capturePaypalReturnIfPresent();
  if(validInvite&&!state.currentUser){
    // Invitation links always open the Member signup/invitation tab and prefill the code.
    openAuth('signup');
    document.getElementById('authModal')?.classList.add('open');
    const inviteInput=document.getElementById('authInvite');
    if(inviteInput){inviteInput.value=invite;inviteInput.readOnly=true;setTimeout(()=>inviteInput.focus(),80);}
  }
})();
