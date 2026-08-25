// Lunarist profile sync + editor modal hotfix.
(function () {
  if (typeof window === 'undefined') return;

  async function syncProfile() {
    if (typeof supabaseClient === 'undefined' || typeof state === 'undefined') return null;
    let user = null;
    try { user = (await supabaseClient.auth.getUser())?.data?.user || null; } catch (e) {}
    if (!user) {
      try { user = (await supabaseClient.auth.getSession())?.data?.session?.user || null; } catch (e) {}
    }

    state.currentUser = user;
    const accountName = document.getElementById('accountName');
    const accountAvatar = document.getElementById('accountAvatar');

    if (!user) {
      state.currentMember = null;
      if (accountName) accountName.textContent = 'Guest';
      if (accountAvatar) {
        const guest = document.createElement('span');
        guest.className = 'avatar';
        guest.id = 'accountAvatar';
        guest.textContent = 'G';
        accountAvatar.replaceWith(guest);
      }
      if (typeof applyTheme === 'function') applyTheme('moonlight');
      return null;
    }

    let profile = null;
    try {
      profile = (await supabaseClient.from('profiles')
        .select('id,username,display_name,role,bio,avatar_url,skills,available,is_admin,account_type,tos,tos_ja,theme')
        .eq('id', user.id).maybeSingle())?.data || null;
    } catch (e) {}

    if (!profile) {
      profile = {
        id: user.id,
        username: (user.email || 'member').split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 32) || 'member',
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Lunarist member',
        role: '', bio: '', skills: [], available: true, account_type: 'user', theme: 'moonlight',
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || ''
      };
    }

    const admin = !!profile.is_admin || user.email === 'lunariststudio@gmail.com';
    state.currentMember = {
      id: profile.id,
      username: profile.username || '',
      name: profile.display_name || user.email || 'Member',
      role: profile.role || '',
      bio: profile.bio || '',
      tos: profile.tos || '',
      tos_ja: profile.tos_ja || '',
      theme: profile.theme || 'moonlight',
      avatar: profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || ('https://i.pravatar.cc/160?u=' + profile.id),
      skills: profile.skills || [],
      available: profile.available !== false,
      is_admin: admin,
      account_type: admin ? 'member' : (profile.account_type || 'user')
    };

    state.selectedTheme = state.currentMember.theme;
    if (typeof applyTheme === 'function') applyTheme(state.selectedTheme);
    if (accountName) accountName.textContent = state.currentMember.name || 'Member';

    const avatarUrl = state.currentMember.avatar || ('https://i.pravatar.cc/160?u=' + user.id);
    let avatar = document.getElementById('accountAvatar');
    if (!avatar || avatar.tagName !== 'IMG') {
      const img = document.createElement('img');
      img.className = 'avatar';
      img.id = 'accountAvatar';
      if (avatar) avatar.replaceWith(img);
      else document.querySelector('.userchip')?.prepend(img);
      avatar = img;
    }
    avatar.src = avatarUrl;
    avatar.alt = '';
    avatar.style.display = 'block';
    avatar.style.opacity = '1';
    avatar.onerror = function () {
      this.onerror = null;
      this.src = 'https://i.pravatar.cc/160?u=' + encodeURIComponent(user.id);
    };

    if (typeof loadUserNotifications === 'function') loadUserNotifications();
    if (typeof loadSavedIds === 'function') { try { await loadSavedIds(); } catch (e) {} }
    return state.currentMember;
  }

  window.refreshUser = syncProfile;

  function installEditorModalPatch() {
    if (window.__lunaristEditorModalPatched) return true;
    if (typeof window.showProjectForm !== 'function' || typeof window.showServiceForm !== 'function') return false;

    const originalProject = window.showProjectForm;
    const originalService = window.showServiceForm;

    const css = document.createElement('style');
    css.id = 'lunarist-editor-modal-fix-css';
    css.textContent = `
      body.lunarist-editor-open { overflow:hidden !important; }
      #drawer.lunarist-editor-host-hidden { visibility:hidden !important; pointer-events:none !important; }
      #lunaristEditorModal { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(2,1,6,.82); backdrop-filter:blur(16px); }
      #lunaristEditorModal .lem-box { width:min(980px,96vw); max-height:92vh; overflow:auto; background:#100e18; border:1px solid var(--line,#2a2635); border-radius:24px; box-shadow:0 30px 90px rgba(0,0,0,.58); padding:22px; }
      #lunaristEditorModal .lem-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; position:sticky; top:-22px; z-index:5; background:#100e18; padding:2px 0 14px; }
      #lunaristEditorModal .lem-title { font-size:22px; font-weight:850; letter-spacing:-.02em; }
      #lunaristEditorModal .lem-close { width:40px; height:40px; border-radius:50%; border:1px solid var(--line,#2a2635); background:rgba(255,255,255,.05); color:var(--text,#fff); font-size:22px; flex:0 0 auto; }
      #lunaristEditorModal > .lem-box > #projectForm, #lunaristEditorModal > .lem-box > #serviceForm { margin:0 !important; }
      #lunaristEditorModal .panel { max-width:none; }
      @media(max-width:720px){ #lunaristEditorModal { padding:8px; align-items:stretch; } #lunaristEditorModal .lem-box { width:100%; max-height:100%; border-radius:18px; padding:15px; } }
      .userchip #accountAvatar { display:block !important; visibility:visible !important; opacity:1 !important; }
    `;
    document.head.appendChild(css);

    function closeEditor() {
      const modal = document.getElementById('lunaristEditorModal');
      const active = window.__lunaristEditorActive;
      if (!modal || !active) return;
      try {
        if (active.form.parentNode === modal.querySelector('.lem-box')) active.placeholder.replaceWith(active.form);
      } catch (e) {}
      window.__lunaristEditorObserver?.disconnect();
      modal.remove();
      document.getElementById('drawer')?.classList.remove('lunarist-editor-host-hidden');
      document.body.classList.remove('lunarist-editor-open');
      window.__lunaristEditorActive = null;
    }

    function openEditor(kind, existing) {
      const formId = kind === 'project' ? 'projectForm' : 'serviceForm';
      const drawer = document.getElementById('drawer');
      const form = document.getElementById(formId);
      if (!drawer || !form || !form.firstElementChild) return;

      document.getElementById('lunaristEditorModal')?.remove();
      const placeholder = document.createComment('lunarist-editor-placeholder');
      form.replaceWith(placeholder);

      const modal = document.createElement('div');
      modal.id = 'lunaristEditorModal';
      const box = document.createElement('div');
      box.className = 'lem-box';
      const head = document.createElement('div');
      head.className = 'lem-head';
      const title = document.createElement('div');
      title.className = 'lem-title';
      title.textContent = kind === 'project' ? (existing ? 'Edit Project' : 'Add Project') : (existing ? 'Edit Service' : 'Add Service');
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button'; closeBtn.className = 'lem-close'; closeBtn.textContent = '×'; closeBtn.setAttribute('aria-label','Close'); closeBtn.onclick = closeEditor;
      head.append(title, closeBtn);
      box.append(head, form); modal.appendChild(box); document.body.appendChild(modal);
      drawer.classList.add('lunarist-editor-host-hidden');
      document.body.classList.add('lunarist-editor-open');
      window.__lunaristEditorActive = { form, placeholder };
      modal.addEventListener('click', e => { if (e.target === modal) closeEditor(); });
      const observer = new MutationObserver(() => { if (!form.firstElementChild) { observer.disconnect(); closeEditor(); } });
      observer.observe(form, { childList:true });
      window.__lunaristEditorObserver = observer;
    }

    window.showProjectForm = function(existing) { originalProject(existing); setTimeout(() => openEditor('project', existing), 0); };
    window.showServiceForm = function(existing) { originalService(existing); setTimeout(() => openEditor('service', existing), 0); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && window.__lunaristEditorActive) closeEditor(); });

    window.__lunaristEditorModalPatched = true;
    return true;
  }

  let tries = 0;
  const installTimer = setInterval(() => { if (installEditorModalPatch() || ++tries > 120) clearInterval(installTimer); }, 100);
  const avatarTimer = setInterval(() => {
    const m = window.state?.currentMember;
    const img = document.getElementById('accountAvatar');
    if (m && img && img.tagName === 'IMG' && m.avatar && img.src !== m.avatar) img.src = m.avatar;
  }, 1000);
  window.addEventListener('beforeunload', () => { clearInterval(installTimer); clearInterval(avatarTimer); });
})();
