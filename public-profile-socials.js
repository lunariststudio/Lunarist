// Public profile Social & Website renderer. Reads the same `profiles.socials` JSON used by Profile Settings.
(function(){
  'use strict';
  if(typeof window==='undefined'||window.__lunaristPublicSocials)return;
  window.__lunaristPublicSocials=true;
  const ITEMS=[
    ['website','Website','↗'],['instagram','Instagram','◎'],['x','X / Twitter','𝕏'],['tiktok','TikTok','♪'],
    ['youtube','YouTube','▶'],['twitch','Twitch','◉'],['bluesky','Bluesky','✦'],['artstation','ArtStation','◆'],['pixiv','Pixiv','P']
  ];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=v=>{try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
  const links=s=>ITEMS.map(([k,label,icon])=>{const u=safeUrl(s?.[k]);return u?`<a class="lunarist-public-social" href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow"><span class="lunarist-public-social-icon">${icon}</span><span>${esc(label)}</span></a>`:''}).filter(Boolean).join('');
  function socialsFor(member){const s=member?.socials||member?.social_links;return s&&typeof s==='object'&&!Array.isArray(s)?s:{};}
  async function getMember(){const m=window.state?.currentMember;if(m)return m;const id=window.state?.currentProfileId||window.state?.viewingMemberId||window.state?.selectedMemberId;const sb=window.supabaseClient;if(!id||!sb)return null;try{const {data}=await sb.from('profiles').select('id,socials,social_links').eq('id',id).maybeSingle();return data||null}catch{return null}}
  function findProfileRoot(){const selectors=['.profile-modal','.artist-profile','.profile-view','.member-profile','#profileModal','.modal.open','.drawer.open'];for(const sel of selectors){for(const el of document.querySelectorAll(sel)){if(el.offsetParent!==null&&/bio|about|profile/i.test(el.innerText||''))return el}}return null;}
  async function render(){const root=findProfileRoot();if(!root)return false;if(root.querySelector('#lunaristPublicSocials'))return true;const m=await getMember();const html=links(socialsFor(m));if(!html)return true;const box=document.createElement('section');box.id='lunaristPublicSocials';box.innerHTML=`<div class="lps-title">Social &amp; Website</div><div class="lps-links">${html}</div>`;const bio=[...root.querySelectorAll('label,h2,h3,h4,p,div')].find(el=>/^bio$/i.test((el.textContent||'').trim()));(bio?.parentElement||root).appendChild(box);return true;}
  const style=document.createElement('style');style.textContent='#lunaristPublicSocials{margin-top:18px;padding:16px 0;border-top:1px solid var(--line)}#lunaristPublicSocials .lps-title{font-weight:800;font-size:14px;margin-bottom:10px}#lunaristPublicSocials .lps-links{display:flex;flex-wrap:wrap;gap:8px}.lunarist-public-social{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.035);color:var(--text);font-size:12px;text-decoration:none;transition:.18s}.lunarist-public-social:hover{border-color:var(--moon);transform:translateY(-1px)}.lunarist-public-social-icon{font-weight:800;color:var(--moon)}';document.head.appendChild(style);
  const observer=new MutationObserver(()=>{clearTimeout(observer.t);observer.t=setTimeout(render,100)});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-member-id']});
  setInterval(()=>render(),1000);
})();
