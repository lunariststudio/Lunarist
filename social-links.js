// Lunarist social profile links — shared by Clients and Members/Artists.
(function(){
  if(typeof window==='undefined') return;
  const STYLE='lunarist-social-links-style';
  const KEY='lunarist-social-links-pending';
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=(value,type)=>{
    let v=String(value||'').trim(); if(!v)return '';
    if(type==='instagram'&&!/^https?:\/\//i.test(v))v='https://instagram.com/'+v.replace(/^@/,'');
    if(type==='youtube'&&!/^https?:\/\//i.test(v))v='https://youtube.com/@'+v.replace(/^@/,'');
    if(type==='x'&&!/^https?:\/\//i.test(v))v='https://x.com/'+v.replace(/^@/,'');
    if(type==='website'&&!/^https?:\/\//i.test(v))v='https://'+v;
    try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol))return '';return u.href}catch{return ''}
  };
  function installStyle(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
    .lunarist-social-editor{margin-top:18px;padding:16px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}
    .lunarist-social-editor h3{margin:0 0 4px;font-size:15px}.lunarist-social-editor p{margin:0 0 12px;color:var(--muted);font-size:11px}
    .lunarist-social-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lunarist-social-field label{display:block;font-size:11px;color:var(--muted);margin-bottom:5px}.lunarist-social-field input{width:100%;box-sizing:border-box}
    .lunarist-social-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.lunarist-social-link{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.035);color:var(--text);font-size:12px;text-decoration:none;transition:transform .15s,border-color .15s,background .15s}.lunarist-social-link:hover{transform:translateY(-1px);border-color:var(--moon);background:rgba(255,255,255,.07)}.lunarist-social-icon{font-weight:900;min-width:15px;text-align:center}
    .lunarist-social-public{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}.lunarist-social-public .eyebrow{margin-bottom:4px}
    @media(max-width:700px){.lunarist-social-grid{grid-template-columns:1fr}.lunarist-social-links{justify-content:center}}
  `;document.head.appendChild(s)}
  const labels={x:'X',instagram:'Instagram',youtube:'YouTube',website:'Website'};
  const icons={x:'𝕏',instagram:'◎',youtube:'▶',website:'↗'};
  function linksFrom(m){const x=m?.social_links||{};return {x:x.x||'',instagram:x.instagram||'',youtube:x.youtube||'',website:x.website||''}}
  function socialHtml(m){const l=linksFrom(m);return Object.entries(l).filter(([,v])=>v).map(([k,v])=>`<a class="lunarist-social-link" href="${escHtml(v)}" target="_blank" rel="noopener noreferrer"><span class="lunarist-social-icon">${icons[k]}</span>${labels[k]}</a>`).join('')}
  function currentProfile(){return state?.currentMember||null}
  function editorHost(){
    const nodes=[...document.querySelectorAll('.modal,.drawer,[role="dialog"],.panel')];
    return nodes.reverse().find(n=>{const t=(n.innerText||'').toLowerCase();return t.includes('profile')&&n.querySelector('input,textarea,button')});
  }
  function injectEditor(){
    const host=editorHost();if(!host||host.querySelector('.lunarist-social-editor'))return;
    const m=currentProfile();if(!m||!state.currentUser)return;
    const l=linksFrom(m);const box=document.createElement('div');box.className='lunarist-social-editor';box.innerHTML=`<h3>Social &amp; Website</h3><p>Add clickable links to your public Lunarist profile. Leave blank to hide a platform.</p><div class="lunarist-social-grid">${Object.keys(labels).map(k=>`<div class="lunarist-social-field"><label>${labels[k]}</label><input data-lunarist-social="${k}" value="${escHtml(l[k])}" placeholder="${k==='website'?'https://yourwebsite.com':k==='youtube'?'https://youtube.com/@username':`https://${k}.com/username`}"></div>`).join('')}</div>`;
    const form=host.querySelector('textarea')?.parentElement?.parentElement||host.querySelector('input')?.parentElement?.parentElement||host.querySelector('.heroactions')?.parentElement||host;
    form.appendChild(box);
  }
  function readEditor(){const host=editorHost();if(!host)return null;const out={};host.querySelectorAll('[data-lunarist-social]').forEach(i=>{const k=i.dataset.lunaristSocial;const n=normalize(i.value,k);if(i.value.trim()&&!n){i.style.borderColor='var(--danger,#ff6b7a)';}else{i.style.borderColor='';}out[k]=n});return out}
  async function persistSocial(){const links=readEditor();if(!links||!state.currentUser||!window.supabaseClient)return;const bad=Object.values(links).some((v,i)=>{const k=Object.keys(links)[i];return document.querySelector(`[data-lunarist-social="${k}"]`)?.value.trim()&&!v});if(bad){toast('Please enter valid social or website URLs.');return}const r=await supabaseClient.from('profiles').update({social_links:links,updated_at:new Date().toISOString()}).eq('id',state.currentUser.id);if(r.error){toast('Social links could not be saved: '+r.error.message);return}if(state.currentMember)state.currentMember.social_links=links;if(window.data?.members){const m=data.members.find(x=>x.id===state.currentUser.id);if(m)m.social_links=links}toast('Social links saved.');setTimeout(()=>renderSocialOnProfile(),50)}
  function renderSocialOnProfile(){
    const m=currentProfile();if(!m)return;
    const html=socialHtml(m);if(!html)return;
    const candidates=[...document.querySelectorAll('.profile-card,.profile,.panel,.modal,.drawer')];const host=candidates.reverse().find(n=>{const t=(n.innerText||'').toLowerCase();return t.includes(String(m.username||'').toLowerCase())||t.includes(String(m.name||'').toLowerCase())});if(!host||host.querySelector('.lunarist-social-public'))return;
    const box=document.createElement('div');box.className='lunarist-social-public';box.innerHTML=`<div class="eyebrow">Find me elsewhere</div><div class="lunarist-social-links">${html}</div>`;host.appendChild(box);
  }
  function renderPublicTarget(){
    // Add links to public artist/member/client profile views without changing their existing layout.
    const target=state?.route;
    let m=null;
    if(String(target||'').startsWith('member:')||String(target||'').startsWith('profile:')||String(target||'').startsWith('clientprofile:')){const id=String(target).split(':').slice(1).join(':');m=typeof member==='function'?member(id):null}
    if(!m&&window.__lunaristPublicProfileMember)m=window.__lunaristPublicProfileMember;
    if(!m)return;
    const html=socialHtml(m);if(!html)return;
    const v=document.getElementById('view');if(!v||v.querySelector('.lunarist-social-public'))return;
    const anchors=[...v.querySelectorAll('.panel,.hero,.profile-card,.section')];const host=anchors.find(n=>n.querySelector('h1,h2'))||v.querySelector('.container')||v;
    const box=document.createElement('div');box.className='lunarist-social-public';box.innerHTML=`<div class="eyebrow">Find me elsewhere</div><div class="lunarist-social-links">${html}</div>`;host.appendChild(box);
  }
  function boot(){
    installStyle();injectEditor();renderSocialOnProfile();renderPublicTarget();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const txt=(b.innerText||'').trim().toLowerCase();
    if(txt.includes('save')||txt.includes('update'))setTimeout(persistSocial,250);
  },true);
  const obs=new MutationObserver(()=>boot());obs.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(boot,1200);boot();
})();
