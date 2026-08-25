// Lunarist profile sync hotfix.
// Existing sync logic preserved; editor modal enhancement appended below.
(async function () {
  if (typeof supabaseClient === 'undefined' || typeof state === 'undefined') return;
  async function syncProfile() {
    let user = null;
    try { user = (await supabaseClient.auth.getUser())?.data?.user || null; } catch(e) {}
    if (!user) { try { user = (await supabaseClient.auth.getSession())?.data?.session?.user || null; } catch(e) {} }
    state.currentUser = user;
    if (!user) { state.currentMember=null; const n=document.getElementById('accountName'); if(n)n.textContent='Guest'; if(typeof applyTheme==='function')applyTheme('moonlight'); return null; }
    let profile=null;
    try { profile=(await supabaseClient.from('profiles').select('id,username,display_name,role,bio,avatar_url,skills,available,is_admin,account_type,tos,tos_ja,theme').eq('id',user.id).maybeSingle())?.data||null; } catch(e) {}
    if (!profile) return null;
    const admin=!!profile.is_admin || user.email==='lunariststudio@gmail.com';
    state.currentMember={id:profile.id,username:profile.username||'',name:profile.display_name||user.email||'Member',role:profile.role||'',bio:profile.bio||'',tos:profile.tos||'',tos_ja:profile.tos_ja||'',theme:profile.theme||'moonlight',avatar:profile.avatar_url||('https://i.pravatar.cc/160?u='+profile.id),skills:profile.skills||[],available:profile.available!==false,is_admin:admin,account_type:admin?'member':(profile.account_type||'user')};
    state.selectedTheme=state.currentMember.theme;
    if(typeof applyTheme==='function')applyTheme(state.selectedTheme);
    const name=document.getElementById('accountName'); if(name)name.textContent=state.currentMember.name||'Member';
    if(typeof loadUserNotifications==='function')loadUserNotifications();
    if(typeof loadSavedIds==='function'){try{await loadSavedIds()}catch(e){}}
    return state.currentMember;
  }
  window.refreshUser=syncProfile;
})();

// Project + Service editor modal enhancement.
// It intentionally moves the existing form node rather than cloning it, so
// the current add/edit/save handlers in index.html remain attached.
(function(){
  if(typeof window==='undefined')return;
  const triggerRe=/(add|new|create|edit|update).*\\b(project|service)s?\\b|\\b(project|service)s?\\b.*(add|new|create|edit|update)/i;
  let active=null;
  const txt=e=>String(e?.innerText||e?.textContent||'').replace(/\\s+/g,' ').trim();
  const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
  const relevant=e=>e&&e.matches?.('button,a,[role="button"],input[type="button"],input[type="submit"]')&&triggerRe.test(txt(e));
  function addStyle(){
    if(document.getElementById('lunarist-editor-modal-css'))return;
    const s=document.createElement('style');s.id='lunarist-editor-modal-css';s.textContent='#lunaristEditorModal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,1,6,.82);backdrop-filter:blur(16px)}#lunaristEditorModal .lem-box{width:min(900px,96vw);max-height:92vh;overflow:auto;background:#100e18;border:1px solid var(--line,#2a2635);border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.55);padding:22px}#lunaristEditorModal .lem-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;position:sticky;top:-22px;background:#100e18;padding:2px 0 14px;z-index:2}#lunaristEditorModal .lem-title{font-size:22px;font-weight:850}#lunaristEditorModal .lem-close{width:38px;height:38px;border-radius:50%;border:1px solid var(--line,#2a2635);background:rgba(255,255,255,.05);color:var(--text,#fff);font-size:20px}#lunaristEditorModal form{margin:0!important;max-height:none!important;overflow:visible!important}body.lunarist-editor-open{overflow:hidden}';document.head.appendChild(s);
  }
  function chooseForm(btn){
    const activeSection=document.querySelector('.dashsection.active');
    const forms=[...(activeSection?.querySelectorAll('form')||[]),...document.querySelectorAll('.drawerpanel form,form')].filter((f,i,a)=>a.indexOf(f)===i&&visible(f)&&!f.closest('#lunaristEditorModal'));
    const btxt=txt(btn).toLowerCase();
    forms.sort((a,b)=>{
      const score=f=>{const t=txt(f).toLowerCase();let n=0;if(f.contains(btn))n+=100;if(activeSection&&f.closest('.dashsection.active'))n+=20;if(btxt.includes('project')&&/project|title|media|thumbnail/.test(t))n+=20;if(btxt.includes('service')&&/service|price|description|addon|add-on/.test(t))n+=20;if(/save|create|update|publish/.test(t))n+=5;return n};return score(b)-score(a);
    });
    return forms[0]||null;
  }
  function close(){
    if(!active)return;
    const a=active;active=null;
    try{if(a.next&&a.next.parentNode===a.parent)a.parent.insertBefore(a.form,a.next);else a.parent.appendChild(a.form);a.form.style.display=a.display||'';}catch(e){}
    a.modal.remove();document.body.classList.remove('lunarist-editor-open');
  }
  function open(btn,form){
    if(active||!form)return;addStyle();
    const parent=form.parentNode,next=form.nextSibling,display=form.style.display;
    const modal=document.createElement('div');modal.id='lunaristEditorModal';
    const box=document.createElement('div');box.className='lem-box';
    const head=document.createElement('div');head.className='lem-head';
    const title=document.createElement('div');title.className='lem-title';const b=txt(btn);title.textContent=/service/i.test(b)?(/add|new|create/i.test(b)?'Add Service':'Edit Service'):(/add|new|create/i.test(b)?'Add Project':'Edit Project');
    const x=document.createElement('button');x.type='button';x.className='lem-close';x.textContent='×';x.setAttribute('aria-label','Close');x.onclick=close;head.append(title,x);box.append(head,form);modal.appendChild(box);document.body.appendChild(modal);document.body.classList.add('lunarist-editor-open');modal.addEventListener('click',e=>{if(e.target===modal)close()});active={modal,form,parent,next,display};
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('button,a,[role="button"],input[type="button"],input[type="submit"]');
    if(!relevant(btn)||active)return;
    // Existing handler runs first and reveals/populates the editor.
    setTimeout(()=>{const form=chooseForm(btn);if(form)open(btn,form)},100);
  },false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)close()});
})();
