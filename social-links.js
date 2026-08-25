// Lunarist social links — shared by Clients and Members/Artists.
(function(){
  if(typeof window==='undefined') return;
  const STYLE_ID='lunarist-social-links-style';
  const labels={x:'X',instagram:'Instagram',youtube:'YouTube',website:'Website'};
  const icons={x:'𝕏',instagram:'◎',youtube:'▶',website:'↗'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=(value,type)=>{
    let v=String(value||'').trim(); if(!v)return '';
    if(!/^https?:\/\//i.test(v)){
      if(type==='instagram')v='https://instagram.com/'+v.replace(/^@/,'');
      else if(type==='youtube')v='https://youtube.com/@'+v.replace(/^@/,'');
      else if(type==='x')v='https://x.com/'+v.replace(/^@/,'');
      else if(type==='website')v='https://'+v;
    }
    try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}
  };
  function style(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
      .lunarist-social-editor{margin-top:18px;padding:18px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025)}
      .lunarist-social-editor h3{margin:0 0 4px;font-size:16px}.lunarist-social-editor p{margin:0 0 14px;color:var(--muted);font-size:12px}
      .lunarist-social-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.lunarist-social-field{min-width:0}.lunarist-social-field label{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}.lunarist-social-field input{width:100%;box-sizing:border-box;border:1px solid var(--line);background:#0a0910;color:var(--text);padding:10px 11px;border-radius:10px;outline:none}.lunarist-social-field input:focus{border-color:var(--moon)}
      .lunarist-social-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.lunarist-social-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.lunarist-social-link{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.035);color:var(--text);font-size:12px;text-decoration:none}.lunarist-social-link:hover{border-color:var(--moon);background:rgba(255,255,255,.07)}.lunarist-social-icon{font-weight:900;min-width:15px;text-align:center}.lunarist-social-public{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
      @media(max-width:700px){.lunarist-social-grid{grid-template-columns:1fr}.lunarist-social-actions{justify-content:stretch}.lunarist-social-actions .btn{flex:1}}
    `;document.head.appendChild(s);
  }
  function member(){return window.state?.currentMember||null}
  function links(m){const v=m?.social_links||m?.socials||{};return{x:v.x||v.twitter||'',instagram:v.instagram||'',youtube:v.youtube||'',website:v.website||v.web||''}}
  function html(m){const l=links(m);return Object.entries(l).filter(([,v])=>v).map(([k,v])=>`<a class="lunarist-social-link" href="${esc(v)}" target="_blank" rel="noopener noreferrer"><span class="lunarist-social-icon">${icons[k]}</span>${labels[k]}</a>`).join('')}
  function host(){
    const client=document.getElementById('client-space-profile');if(client)return client;
    const nodes=[...document.querySelectorAll('.drawer,.modal,[role="dialog"]')];
    return nodes.reverse().find(n=>{const t=(n.innerText||'').toLowerCase();return t.includes('edit profile')||t.includes('profile color scheme')})||null;
  }
  function valuesBox(m){
    const l=links(m);return `<div class="lunarist-social-editor"><h3>Social &amp; Website</h3><p>Add clickable links to your public Lunarist profile. Leave blank to hide a platform.</p><div class="lunarist-social-grid">${Object.keys(labels).map(k=>`<div class="lunarist-social-field"><label>${labels[k]}</label><input data-lunarist-social="${k}" value="${esc(l[k])}" placeholder="${k==='website'?'https://yourwebsite.com':k==='youtube'?'https://youtube.com/@username':`https://${k}.com/username`}"></div>`).join('')}</div><div class="lunarist-social-actions"><button type="button" class="btn" id="lunaristSaveSocial">Save social links</button></div></div>`;
  }
  function injectEditor(){
    const m=member();const h=host();if(!m||!h||h.querySelector('.lunarist-social-editor'))return;
    const box=document.createElement('div');box.innerHTML=valuesBox(m);const editor=box.firstElementChild;
    if(h.id==='client-space-profile'){
      const panel=h.querySelector('.panel');(panel||h).appendChild(editor);
    }else{
      const tos=h.querySelector('.profile-tos-card');
      if(tos)tos.parentElement.insertBefore(editor,tos);else h.appendChild(editor);
    }
    editor.querySelector('#lunaristSaveSocial').onclick=save;
  }
  async function save(){
    const h=host(),m=member();if(!h||!m||!window.supabaseClient||!state.currentUser)return;
    const out={};let bad=false;
    h.querySelectorAll('[data-lunarist-social]').forEach(i=>{const k=i.dataset.lunaristSocial;const raw=i.value.trim();const n=normalize(raw,k);if(raw&&!n){bad=true;i.style.borderColor='var(--danger,#ff7d8e)'}else{i.style.borderColor='';}out[k]=n});
    if(bad){toast('Please enter valid social or website URLs.');return}
    const r=await supabaseClient.from('profiles').update({social_links:out,updated_at:new Date().toISOString()}).eq('id',state.currentUser.id);
    if(r.error){toast('Social links could not be saved: '+r.error.message);return}
    if(state.currentMember)state.currentMember.social_links=out;
    if(window.data?.members){const mm=data.members.find(x=>x.id===state.currentUser.id);if(mm)mm.social_links=out;}
    toast('Social links saved.');renderPublic();
  }
  function renderPublic(){
    const m=member();if(!m)return;const content=html(m);if(!content)return;
    const roots=[...document.querySelectorAll('.profile-card,.profile,.client-public-profile,.artistcard,.panel')];
    const h=roots.reverse().find(n=>{const t=(n.innerText||'').toLowerCase();return t.includes(String(m.username||'').toLowerCase())&&t.includes(String(m.name||m.display_name||'').toLowerCase())});
    if(!h||h.querySelector('.lunarist-social-public'))return;
    const box=document.createElement('div');box.className='lunarist-social-public';box.innerHTML=`<div class="eyebrow">Find me elsewhere</div><div class="lunarist-social-links">${content}</div>`;h.appendChild(box);
  }
  function boot(){style();injectEditor();renderPublic()}
  const observer=new MutationObserver(()=>boot());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(boot,250);setInterval(boot,1500);
})();
