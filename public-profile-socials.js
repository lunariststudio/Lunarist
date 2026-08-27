// Public profile Social & Website renderer for both artist and regular public profiles.
(function(){
'use strict';
if(typeof window==='undefined'||window.__lunaristPublicSocialsV2)return; window.__lunaristPublicSocialsV2=true;
const ITEMS=[['website','Website','↗'],['instagram','Instagram','◎'],['x','X / Twitter','𝕏'],['tiktok','TikTok','♪'],['youtube','YouTube','▶'],['twitch','Twitch','◉'],['bluesky','Bluesky','✦'],['artstation','ArtStation','◆'],['pixiv','Pixiv','P']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||'').trim());return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
function getSocials(m){const s=m?.socials||m?.social_links;return s&&typeof s==='object'&&!Array.isArray(s)?s:null}
function makeLinks(s){return ITEMS.map(([k,label,icon])=>{const u=safeUrl(s?.[k]);return u?`<a class="lunarist-public-social" href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow"><span class="lunarist-public-social-icon">${icon}</span><span>${esc(label)}</span></a>`:''}).filter(Boolean).join('')}
function profileCandidates(){
 const a=[]; const st=window.state||{};
 ['currentMember','currentProfile','selectedMember','viewingMember','artist','profile'].forEach(k=>{if(st[k])a.push(st[k])});
 if(st.currentMember)a.push(st.currentMember);
 const path=location.pathname.replace(/\/+$/,'').split('/').filter(Boolean); const q=new URLSearchParams(location.search);
 ['username','artist','profile','user'].forEach(k=>{if(q.get(k))a.push({username:q.get(k)})});
 const last=path[path.length-1]; if(last&&!/^(home|discover|artists|artist|profile|settings|login|signup|member|members|dashboard)$/i.test(last))a.push({username:decodeURIComponent(last).replace(/^@/, '')});
 const hash=location.hash.match(/(?:artist|profile|user)[=/:-]?([^/?#]+)/i); if(hash)a.push({username:decodeURIComponent(hash[1]).replace(/^@/,'')});
 return a;
}
async function resolveProfile(){
 const candidates=profileCandidates(); const sb=window.supabaseClient||window.supabase;
 for(const c of candidates){if(getSocials(c))return c; if(!sb||!c.username)continue; try{const r=await sb.from('profiles').select('id,username,display_name,role,account_type,bio,socials,social_links').ilike('username',c.username).maybeSingle(); if(r?.data)return r.data}catch{}}
 const st=window.state||{}; const id=st.currentProfileId||st.viewingMemberId||st.selectedMemberId||st.artistId||st.profileId;
 if(sb&&id){try{const r=await sb.from('profiles').select('id,username,display_name,role,account_type,bio,socials,social_links').eq('id',id).maybeSingle();if(r?.data)return r.data}catch{}}
 return null;
}
function roots(){const sels=['.artist-profile','.artist-public-profile','.public-profile','.profile-page','.profile-view','.member-profile','#artistProfile','#profilePage','#profileModal','.modal.open','.drawer.open'];const out=[];for(const s of sels)document.querySelectorAll(s).forEach(e=>{if(e.offsetParent!==null&&!out.includes(e))out.push(e)});return out}
function looksLikeProfile(el){const t=(el.innerText||'').toLowerCase();return t.includes('bio')||t.includes('commission')||t.includes('portfolio')||t.includes('services')}
function injectStyle(){if(document.getElementById('lunaristPublicSocialStyle'))return;const st=document.createElement('style');st.id='lunaristPublicSocialStyle';st.textContent=`#lunaristPublicSocials{margin:20px 0 0;padding:16px 0;border-top:1px solid var(--line,#292532)}#lunaristPublicSocials .lps-title{font-weight:800;font-size:14px;margin-bottom:10px}#lunaristPublicSocials .lps-links{display:flex;flex-wrap:wrap;gap:8px}.lunarist-public-social{display:inline-flex!important;align-items:center;gap:7px;padding:8px 12px;border:1px solid var(--line,#292532);border-radius:999px;background:rgba(255,255,255,.035);color:var(--text,#fff)!important;text-decoration:none!important;font-size:12px;cursor:pointer}.lunarist-public-social:hover{border-color:var(--moon,#fff);transform:translateY(-1px)}.lunarist-public-social-icon{font-weight:800;color:var(--moon,#fff)}`;document.head.appendChild(st)}
async function render(){const ms=await resolveProfile();const s=getSocials(ms);if(!s)return false;const html=makeLinks(s);if(!html)return false;const rs=roots().filter(looksLikeProfile);if(!rs.length)return false;injectStyle();for(const root of rs){let box=root.querySelector('#lunaristPublicSocials');if(!box){box=document.createElement('section');box.id='lunaristPublicSocials';const heading=[...root.querySelectorAll('h1,h2,h3,h4,strong,div,span')].find(e=>/^bio$/i.test((e.textContent||'').trim()));(heading?.parentElement||root).appendChild(box)}box.innerHTML=`<div class="lps-title">Social &amp; Website</div><div class="lps-links">${html}</div>`}return true}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(render,150)}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-member-id','data-profile-id']});
window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);setInterval(render,1500);schedule();
})();
