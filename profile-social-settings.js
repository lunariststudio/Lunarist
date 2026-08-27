(function(){
  'use strict';
  if(typeof window==='undefined') return;
  const SOCIALS=[
    ['website','Website','https://','Your personal website or portfolio'],
    ['instagram','Instagram','https://instagram.com/','Instagram profile URL'],
    ['x','X / Twitter','https://x.com/','X / Twitter profile URL'],
    ['tiktok','TikTok','https://tiktok.com/@','TikTok profile URL'],
    ['youtube','YouTube','https://youtube.com/','YouTube channel URL'],
    ['twitch','Twitch','https://twitch.tv/','Twitch channel URL'],
    ['bluesky','Bluesky','https://bsky.app/profile/','Bluesky profile URL'],
    ['artstation','ArtStation','https://www.artstation.com/','ArtStation profile URL'],
    ['pixiv','Pixiv','https://www.pixiv.net/users/','Pixiv profile URL']
  ];
  const SECTION_ID='lunaristSocialWebsiteSection';
  const STYLE_ID='lunaristSocialWebsiteStyle';
  const norm=v=>String(v||'').trim();
  const esc=s=>String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[c]));
  function toast(message){try{window.toast?.(message)}catch{} }
  function profile(){return window.state?.currentMember||null}
  function socials(){const s=profile()?.socials;return s&&typeof s==='object'&&!Array.isArray(s)?s:{}}
  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const st=document.createElement('style'); st.id=STYLE_ID;
    st.textContent=`
      #${SECTION_ID}{margin-top:16px;padding:18px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025)}
      #${SECTION_ID} .lsw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
      #${SECTION_ID} .lsw-title{font-weight:850;font-size:17px;letter-spacing:-.02em}
      #${SECTION_ID} .lsw-sub{color:var(--muted);font-size:12px;margin-top:3px;line-height:1.45}
      #${SECTION_ID} .lsw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      #${SECTION_ID} .lsw-field{display:flex;flex-direction:column;gap:6px;min-width:0}
      #${SECTION_ID} .lsw-field.lsw-full{grid-column:1/-1}
      #${SECTION_ID} label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
      #${SECTION_ID} input{width:100%;max-width:100%;border:1px solid var(--line);background:#0a0910;color:var(--text);padding:11px 12px;border-radius:11px;outline:none}
      #${SECTION_ID} input:focus{border-color:var(--moon)}
      #${SECTION_ID} .lsw-hint{font-size:10px;color:var(--muted);margin-top:2px}
      @media(max-width:720px){#${SECTION_ID} .lsw-grid{grid-template-columns:1fr}#${SECTION_ID} .lsw-field.lsw-full{grid-column:auto}}
    `;
    document.head.appendChild(st);
  }
  function findBioAnchor(){
    const fields=[...document.querySelectorAll('.field')];
    for(const field of fields){const label=field.querySelector('label');if(label&&/^bio$/i.test(norm(label.textContent)))return field}
    const labels=[...document.querySelectorAll('label')];
    for(const label of labels){if(/^bio$/i.test(norm(label.textContent)))return label.closest('.field')||label.parentElement}
    return null;
  }
  function inProfileSettings(el){
    if(!el)return false;
    const root=el.closest('.drawer,.modal,.panel,form');
    const text=norm(root?.textContent);
    return /profile settings|edit profile/i.test(text)||!!root?.querySelector?.('[id*=profile]');
  }
  function findHost(){
    const bio=findBioAnchor();
    if(bio&&inProfileSettings(bio))return bio.parentElement||bio;
    const candidates=[...document.querySelectorAll('.dashsection,.panel,.drawerpanel,form')];
    return candidates.find(el=>/profile settings|edit profile/i.test(norm(el.textContent))&&/bio/i.test(norm(el.textContent)))||null;
  }
  function valuesFromDOM(){const out={};SOCIALS.forEach(([key])=>{const input=document.getElementById('lsw-'+key);if(input)out[key]=norm(input.value)});return out}
  async function loadSocials(){
    if(window.state?.currentMember?.socials)return window.state.currentMember.socials;
    const user=window.state?.currentUser;const client=window.supabaseClient;
    if(!user||!client)return {};
    try{const {data}=await client.from('profiles').select('socials').eq('id',user.id).maybeSingle();const s=data?.socials&&typeof data.socials==='object'?data.socials:{};if(window.state.currentMember)window.state.currentMember.socials=s;return s}catch{return {}}
  }
  async function render(){
    const existing=document.getElementById(SECTION_ID);if(existing)return true;
    const host=findHost();if(!host)return false;
    injectStyles();const s=await loadSocials();
    const section=document.createElement('section');section.id=SECTION_ID;
    const fields=SOCIALS.map(([key,label,placeholder,hint])=>`<div class="lsw-field ${key==='website'?'lsw-full':''}"><label for="lsw-${key}">${esc(label)}</label><input id="lsw-${key}" type="url" inputmode="url" autocomplete="url" placeholder="${esc(placeholder)}" value="${esc(s[key]||'')}" data-social-key="${esc(key)}"><div class="lsw-hint">${esc(hint)}</div></div>`).join('');
    section.innerHTML=`<div class="lsw-head"><div><div class="lsw-title">Social &amp; Website</div><div class="lsw-sub">Add links that appear on your Lunarist profile. Leave any field empty to hide it.</div></div></div><div class="lsw-grid">${fields}</div>`;
    host.insertAdjacentElement('afterend',section);
    section.addEventListener('input',e=>{const key=e.target?.dataset?.socialKey;if(!key)return;if(window.state?.currentMember)window.state.currentMember.socials={...(window.state.currentMember.socials||{}),[key]:norm(e.target.value)}});
    return true;
  }
  function validUrl(value){if(!value)return true;try{const u=new URL(value);return /^https?:$/.test(u.protocol)}catch{return false}}
  async function saveSocials(){
    const user=window.state?.currentUser;const client=window.supabaseClient;if(!user||!client||!document.getElementById(SECTION_ID))return true;
    const values=valuesFromDOM();
    for(const [key,label] of SOCIALS){if(values[key]&&!validUrl(values[key])){toast(`${label} must be a valid http(s) URL.`);document.getElementById('lsw-'+key)?.focus();return false}}
    const cleaned={};Object.entries(values).forEach(([k,v])=>{if(v)cleaned[k]=v});
    const {data,error}=await client.from('profiles').update({socials:cleaned}).eq('id',user.id).select('socials').maybeSingle();
    if(error){toast('Could not save social links.');return false}
    if(window.state?.currentMember)window.state.currentMember.socials=data?.socials||cleaned;
    return true;
  }
  let saveBusy=false;
  document.addEventListener('click',async e=>{
    if(!document.getElementById(SECTION_ID)||saveBusy)return;
    const btn=e.target.closest('button,input[type=submit]');if(!btn)return;
    const text=norm(btn.textContent||btn.value);if(!/(save|update)/i.test(text)||btn.closest('#'+SECTION_ID)||!inProfileSettings(btn))return;
    saveBusy=true;try{await saveSocials()}finally{saveBusy=false}
  },true);
  const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(()=>{render()},80)});obs.observe(document.body,{childList:true,subtree:true});
  let tries=0;const timer=setInterval(()=>{render().then(ok=>{if(ok||++tries>240)clearInterval(timer)})},250);
  window.addEventListener('beforeunload',()=>{clearInterval(timer);obs.disconnect()});
})();
