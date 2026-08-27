// Native public artist/profile Social & Website renderer.
(function(){
'use strict';
if(typeof window==='undefined')return;
window.__lunaristPublicSocialsV4=true;
const ITEMS=[['website','Website','↗'],['instagram','Instagram','◎'],['x','X / Twitter','𝕏'],['tiktok','TikTok','♪'],['youtube','YouTube','▶'],['twitch','Twitch','◉'],['bluesky','Bluesky','✦'],['artstation','ArtStation','◆'],['pixiv','Pixiv','P']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||'').trim());return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
const getSocials=m=>{const s=m?.socials||m?.social_links;return s&&typeof s==='object'&&!Array.isArray(s)?s:null};
const makeLinks=s=>ITEMS.map(([k,label,icon])=>{const u=safeUrl(s?.[k]);return u?`<a class="lunarist-public-social" href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow"><span class="lunarist-public-social-icon">${icon}</span><span>${esc(label)}</span></a>`:''}).filter(Boolean).join('');
function client(){try{if(typeof supabaseClient!=='undefined'&&supabaseClient)return supabaseClient}catch{}return window.supabaseClient||null}

// Resolve the profile CURRENTLY BEING VIEWED — never the signed-in viewer's
// own profile, which is a different person whenever you're looking at
// someone else's page.
async function resolveViewedProfile(){
  const route=String(window.state?.route||'');
  if(route.startsWith('member:')){
    const id=route.slice(7);
    const local=(window.data?.members||[]).find(x=>x.id===id);
    if(local&&getSocials(local))return local;
    const sb=client();
    if(sb&&id){
      try{const r=await sb.from('profiles').select('id,username,display_name,role,account_type,bio,socials').eq('id',id).maybeSingle();if(r.data)return r.data}catch{}
    }
    return local||null;
  }
  if(route.startsWith('clientprofile:')){
    return window.__lunaristPublicClientProfile||null;
  }
  return null;
}
function css(){if(document.getElementById('lunaristPublicSocialStyleV4'))return;const s=document.createElement('style');s.id='lunaristPublicSocialStyleV4';s.textContent=`#lunaristPublicSocials{display:block!important;margin:14px 0 0!important;padding:0!important}#lunaristPublicSocials .lps-title{font-weight:800;font-size:13px;margin:0 0 9px}.lps-links{display:flex;flex-wrap:wrap;gap:8px}.lunarist-public-social{display:inline-flex!important;align-items:center;gap:7px;padding:8px 12px;border:1px solid var(--line,#292532);border-radius:999px;background:rgba(255,255,255,.04);color:var(--text,#fff)!important;text-decoration:none!important;font-size:12px;cursor:pointer}.lunarist-public-social:hover{border-color:var(--moon,#fff);transform:translateY(-1px)}.lunarist-public-social-icon{font-weight:800}`;document.head.appendChild(s)}

async function render(){
  const slot=document.getElementById('profileSocialLinks');
  if(!slot)return;
  const p=await resolveViewedProfile();
  const s=p&&getSocials(p);
  const html=s?makeLinks(s):'';
  if(!html){if(slot.childElementCount)slot.innerHTML='';return}
  if(slot.dataset.socialRenderedFor===String(p.id)&&slot.querySelector('.lps-links'))return;
  css();
  slot.dataset.socialRenderedFor=String(p.id);
  slot.innerHTML=`<div id="lunaristPublicSocials"><div class="lps-title">Social &amp; Website</div><div class="lps-links">${html}</div></div>`;
}
let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>render().catch(()=>{}),120)};
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-member-id','data-profile-id']});
window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);schedule();setInterval(schedule,2000);
})();
