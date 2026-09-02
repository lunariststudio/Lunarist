// Lunarist profile sync + editor modal hotfix.
(function () {
  if (typeof window === 'undefined') return;

  const EUGENE_CARD_URL = 'https://eugene-card-1.vercel.app';
  let eugenePollTimer = null;

  async function getLunaristSessionToken() {
    if (typeof supabaseClient === 'undefined') return '';
    try { return (await supabaseClient.auth.getSession())?.data?.session?.access_token || ''; } catch (e) { return ''; }
  }

  async function eugeneRequest(method = 'GET', body = null) {
    const token = await getLunaristSessionToken();
    if (!token) throw new Error('Sign in is required.');
    const options = { method, cache: 'no-store', headers: { Authorization: `Bearer ${token}` } };
    if (body) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const r = await fetch('/api/eugene-connect', options);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || 'Eugene Card connection failed.');
    return data;
  }

  function installEugeneStyles() {
    if (document.getElementById('eugene-connect-style')) return;
    const style = document.createElement('style');
    style.id = 'eugene-connect-style';
    style.textContent = `
      #eugeneConnectCard{margin-top:16px;border:1px solid var(--line);background:linear-gradient(145deg,rgba(201,182,255,.07),rgba(255,255,255,.025));border-radius:20px;padding:20px;box-shadow:0 12px 38px rgba(0,0,0,.18)}
      #eugeneConnectCard .ec-head{display:flex;align-items:flex-start;gap:14px}
      #eugeneConnectCard .ec-icon{width:46px;height:46px;flex:0 0 46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:20px;box-shadow:0 8px 24px rgba(99,102,241,.22)}
      #eugeneConnectCard .ec-title{font-weight:850;font-size:17px;margin:0 0 3px}
      #eugeneConnectCard .ec-status{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800}
      #eugeneConnectCard .ec-dot{width:8px;height:8px;border-radius:50%;background:#8b8496;box-shadow:0 0 0 3px rgba(139,132,150,.12)}
      #eugeneConnectCard.connected .ec-dot{background:var(--green);box-shadow:0 0 0 3px rgba(142,224,186,.12)}
      #eugeneConnectCard .ec-email{margin-top:5px;color:var(--muted);font-size:12px;overflow-wrap:anywhere}
      #eugeneConnectCard .ec-copy{margin-top:10px;color:var(--muted);font-size:12px;line-height:1.55}
      #eugeneConnectCard .ec-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:720px){#eugeneConnectCard{padding:16px}}
    `;
    document.head.appendChild(style);
  }

  async function renderEugeneConnection() {
    const host = document.getElementById('dash-eugene');
    const user = window.state?.currentUser;
    if (!host || !user) return;
    installEugeneStyles();
    let card = document.getElementById('eugeneConnectCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'eugeneConnectCard';
      host.appendChild(card);
    }
    card.innerHTML = `<div class="ec-head"><div class="ec-icon">✦</div><div class="grow"><div class="ec-title">Eugene Card</div><div class="ec-status"><span class="ec-dot"></span><span id="eugeneConnectStatus">Checking connection…</span></div><div class="ec-email" id="eugeneConnectEmail"></div></div></div><div class="ec-copy" id="eugeneConnectCopy">Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.</div><div class="ec-actions"><button class="btn primary" id="eugeneConnectBtn" type="button">Connect Eugene Card</button><button class="btn" id="eugeneDisconnectBtn" type="button" style="display:none">Disconnect</button></div>`;

    const statusEl = document.getElementById('eugeneConnectStatus');
    const emailEl = document.getElementById('eugeneConnectEmail');
    const copyEl = document.getElementById('eugeneConnectCopy');
    const connectBtn = document.getElementById('eugeneConnectBtn');
    const disconnectBtn = document.getElementById('eugeneDisconnectBtn');

    async function refreshStatus() {
      try {
        const data = await eugeneRequest('GET');
        const connected = !!data.connected;
        card.classList.toggle('connected', connected);
        statusEl.textContent = connected ? 'Connected' : 'Not connected';
        emailEl.textContent = connected && data.connection?.eugene_email ? data.connection.eugene_email : '';
        connectBtn.textContent = connected ? 'Connected to Eugene Card' : 'Connect Eugene Card';
        connectBtn.disabled = connected;
        disconnectBtn.style.display = connected ? '' : 'none';
        copyEl.textContent = connected ? 'Your Lunarist account is linked to Eugene Card. You can disconnect it here at any time.' : 'Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.';
        return connected;
      } catch (e) {
        statusEl.textContent = 'Unable to check';
        emailEl.textContent = '';
        connectBtn.disabled = false;
        return false;
      }
    }

    connectBtn.onclick = () => {
      connectBtn.disabled = true;
      connectBtn.textContent = 'Opening Eugene Card…';
      const url = `${EUGENE_CARD_URL}/?connect=lunarist`;
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = url;
      statusEl.textContent = 'Waiting for Eugene Card…';
      copyEl.textContent = 'Eugene Card opened in a new tab. Approve the connection there; this panel will update automatically once it completes.';
      clearInterval(eugenePollTimer);
      const started = Date.now();
      eugenePollTimer = setInterval(async () => {
        if (Date.now() - started > 10 * 60 * 1000) { clearInterval(eugenePollTimer); connectBtn.disabled = false; connectBtn.textContent = 'Connect Eugene Card'; await refreshStatus(); return; }
        const connected = await refreshStatus();
        if (connected) clearInterval(eugenePollTimer);
      }, 2000);
    };

    disconnectBtn.onclick = async () => {
      if (!confirm('Disconnect Eugene Card from this Lunarist account?')) return;
      disconnectBtn.disabled = true;
      try { await eugeneRequest('POST', { action: 'disconnect' }); await refreshStatus(); }
      catch (e) { try { window.toast?.(e.message || 'Unable to disconnect Eugene Card.'); } catch (_) {} }
      finally { disconnectBtn.disabled = false; }
    };

    await refreshStatus();
  }

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

  function installEugeneProfileWatcher() {
    if (window.__lunaristEugeneProfileWatcher) return;
    window.__lunaristEugeneProfileWatcher = true;
    const ensure = () => {
      if (window.state?.currentUser && document.getElementById('drawer')?.classList.contains('open') && document.getElementById('dash-eugene')?.classList.contains('active')) {
        renderEugeneConnection();
      }
    };
    setInterval(ensure, 700);
    document.addEventListener('click', e => { if (e.target.closest('[data-dash="eugene"]')) setTimeout(ensure, 80); });
  }

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
  installEugeneProfileWatcher();
  window.addEventListener('beforeunload', () => { clearInterval(installTimer); clearInterval(avatarTimer); clearInterval(eugenePollTimer); });
})();
