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
  // Stable anchors added directly in the profile templates — no more
  // guessing the right spot by scanning page text, which was flaky.
  const ANCHOR_IDS=['dashProfileSocialEditor','clientProfileSocialEditor'];
  const STYLE_ID='lunaristSocialWebsiteStyle';
  const norm=v=>String(v||'').trim();
  const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function toast(message){try{window.toast?.(message)}catch{} }
  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;
    const st=document.createElement('style'); st.id=STYLE_ID;
    st.textContent=`
      .lunarist-social-settings{margin-top:16px;padding:18px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025)}
      .lunarist-social-settings .lsw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
      .lunarist-social-settings .lsw-title{font-weight:850;font-size:17px;letter-spacing:-.02em}
      .lunarist-social-settings .lsw-sub{color:var(--muted);font-size:12px;margin-top:3px;line-height:1.45}
      .lunarist-social-settings .lsw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .lunarist-social-settings .lsw-field{display:flex;flex-direction:column;gap:6px;min-width:0}
      .lunarist-social-settings .lsw-field.lsw-full{grid-column:1/-1}
      .lunarist-social-settings label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
      .lunarist-social-settings input{width:100%;max-width:100%;border:1px solid var(--line);background:#0a0910;color:var(--text);padding:11px 12px;border-radius:11px;outline:none}
      .lunarist-social-settings input:focus{border-color:var(--moon)}
      .lunarist-social-settings .lsw-hint{font-size:10px;color:var(--muted);margin-top:2px}
      .lunarist-social-settings .lsw-save{margin-top:12px}
      @media(max-width:720px){.lunarist-social-settings .lsw-grid{grid-template-columns:1fr}.lunarist-social-settings .lsw-field.lsw-full{grid-column:auto}}
    `;
    document.head.appendChild(st);
  }
  function profileForAnchor(anchorId){
    // dashProfileSocialEditor = the signed-in MEMBER editing their own profile.
    // clientProfileSocialEditor = the signed-in CLIENT editing their own profile.
    // Both always edit "yourself", never someone else's profile.
    return window.state?.currentMember||null;
  }
  async function loadSocials(m){
    if(m?.socials&&typeof m.socials==='object')return m.socials;
    const user=window.state?.currentUser;const client=window.supabaseClient;
    if(!user||!client)return {};
    try{
      const {data}=await client.from('profiles').select('socials').eq('id',user.id).maybeSingle();
      const s=data?.socials&&typeof data.socials==='object'?data.socials:{};
      if(window.state.currentMember)window.state.currentMember.socials=s;
      return s;
    }catch{return {}}
  }
  function validUrl(value){if(!value)return true;try{const u=new URL(value);return /^https?:$/.test(u.protocol)}catch{return false}}
  async function saveSocials(section){
    const user=window.state?.currentUser;const client=window.supabaseClient;
    if(!user||!client)return false;
    const values={};
    section.querySelectorAll('[data-social-key]').forEach(i=>{values[i.dataset.socialKey]=norm(i.value)});
    for(const [key,label] of SOCIALS){
      if(values[key]&&!validUrl(values[key])){
        toast(`${label} must be a valid http(s) URL.`);
        section.querySelector(`[data-social-key="${key}"]`)?.focus();
        return false;
      }
    }
    const cleaned={};Object.entries(values).forEach(([k,v])=>{if(v)cleaned[k]=v});
    const {data,error}=await client.from('profiles').update({socials:cleaned}).eq('id',user.id).select('socials').maybeSingle();
    if(error){toast('Could not save social links: '+error.message);return false}
    if(window.state?.currentMember)window.state.currentMember.socials=data?.socials||cleaned;
    if(window.data?.members){const mm=data.members.find(x=>x.id===user.id);if(mm)mm.socials=data?.socials||cleaned;}
    toast('Social links saved.');
    return true;
  }
  async function fillAnchor(anchor){
    if(anchor.dataset.lunaristSocialFilled)return;
    const m=profileForAnchor(anchor.id);
    if(!m)return; // not signed in yet — try again on the next tick
    anchor.dataset.lunaristSocialFilled='1';
    injectStyles();
    const s=await loadSocials(m);
    const fields=SOCIALS.map(([key,label,placeholder,hint])=>`<div class="lsw-field ${key==='website'?'lsw-full':''}"><label for="${anchor.id}-${key}">${esc(label)}</label><input id="${anchor.id}-${key}" type="url" inputmode="url" autocomplete="url" placeholder="${esc(placeholder)}" value="${esc(s[key]||'')}" data-social-key="${esc(key)}"><div class="lsw-hint">${esc(hint)}</div></div>`).join('');
    anchor.innerHTML=`<div class="lunarist-social-settings"><div class="lsw-head"><div><div class="lsw-title">Social &amp; Website</div><div class="lsw-sub">Add links that appear on your Lunarist profile. Leave any field empty to hide it.</div></div></div><div class="lsw-grid">${fields}</div><button type="button" class="btn lsw-save">Save social links</button></div>`;
    anchor.querySelector('.lsw-save').addEventListener('click',async()=>{
      const section=anchor.querySelector('.lunarist-social-settings');
      const btn=anchor.querySelector('.lsw-save');
      if(btn.disabled)return;
      btn.disabled=true;
      try{await saveSocials(section)}finally{btn.disabled=false}
    });
  }
  function scan(){
    for(const id of ANCHOR_IDS){
      const anchor=document.getElementById(id);
      if(anchor)fillAnchor(anchor);
    }
  }
  let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(scan,80)};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  schedule();setInterval(scan,1500);
})();
