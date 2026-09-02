(function () {
  'use strict';

  if (window.__lunaristProfileEugeneCardTab) return;
  window.__lunaristProfileEugeneCardTab = true;

  const TAB = 'eugene-card';
  const SECTION_ID = 'dash-eugene-card';
  const CONNECT_ID = 'profileEugeneConnectBtn';
  const DISCONNECT_ID = 'profileEugeneDisconnectBtn';

  function getSession() {
    const sb = window.supabaseClient || window.supabase;
    return sb?.auth?.getSession?.().then(r => r?.data?.session || null).catch(() => null);
  }

  async function request(method, body) {
    const session = await getSession();
    if (!session?.access_token) throw new Error('Please sign in to Lunarist first.');
    const options = { method, cache: 'no-store', credentials: 'include', headers: { Authorization: `Bearer ${session.access_token}` } };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const r = await fetch('/api/eugene-connect', options);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || 'Eugene Card connection failed.');
    return data;
  }

  function installStyles() {
    if (document.getElementById('profile-eugene-card-tab-styles')) return;
    const style = document.createElement('style');
    style.id = 'profile-eugene-card-tab-styles';
    style.textContent = `
      #${SECTION_ID}{box-sizing:border-box}
      .profile-eugene-card{box-sizing:border-box;width:100%;max-width:575px;padding:25px;border:1px solid rgba(155,132,220,.32);border-radius:24px;background:linear-gradient(145deg,rgba(31,27,43,.92),rgba(18,16,27,.96));box-shadow:0 12px 35px rgba(0,0,0,.16)}
      .profile-eugene-card-head{display:flex;align-items:center;gap:17px}
      .profile-eugene-icon{width:57px;height:57px;flex:0 0 57px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#7860ff,#8650e9);color:#fff;font-size:26px;font-weight:900;box-shadow:0 8px 20px rgba(115,82,255,.22)}
      .profile-eugene-title{margin:0;font-size:21px;line-height:1.2;font-weight:800}
      .profile-eugene-status{margin-top:7px;font-size:15px;font-weight:800;color:var(--text,#fff)}
      .profile-eugene-copy{margin:27px 0 17px;color:var(--muted,#a8a0b6);font-size:15px;line-height:1.65}
      .profile-eugene-connect{min-width:230px;min-height:58px;border-radius:17px;font-size:16px;font-weight:800;background:#f6f3fb;color:#15121e;border:0}
      .profile-eugene-connect:hover{transform:translateY(-1px)}
      .profile-eugene-actions{display:flex;gap:10px;flex-wrap:wrap}
      .profile-eugene-disconnect{min-height:58px;border-radius:17px;font-weight:800}
      @media(max-width:600px){.profile-eugene-card{padding:20px;border-radius:20px}.profile-eugene-connect,.profile-eugene-disconnect{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    const nav = document.querySelector('.dashnav');
    const profile = document.getElementById('dash-profile');
    if (!nav || !profile) return false;

    let section = document.getElementById(SECTION_ID);
    if (!section) {
      section = document.createElement('section');
      section.className = 'dashsection';
      section.id = SECTION_ID;
      profile.parentNode?.insertBefore(section, profile.nextSibling);
    }

    let tab = nav.querySelector(`[data-dash="${TAB}"]`);
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'filter';
      tab.dataset.dash = TAB;
      tab.textContent = 'Eugene Card';
      nav.insertBefore(tab, nav.querySelector('[data-dash="services"]') || null);
    }

    if (!section.dataset.rendered) {
      section.innerHTML = `
        <div class="profile-eugene-card">
          <div class="profile-eugene-card-head">
            <div class="profile-eugene-icon" aria-hidden="true">✦</div>
            <div>
              <h3 class="profile-eugene-title">Eugene Card</h3>
              <div class="profile-eugene-status" id="profileEugeneStatus">Not connected</div>
            </div>
          </div>
          <p class="profile-eugene-copy" id="profileEugeneCopy">Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.</p>
          <div class="profile-eugene-actions">
            <button class="btn profile-eugene-connect" id="${CONNECT_ID}" type="button">Connect Eugene Card</button>
            <button class="btn profile-eugene-disconnect" id="${DISCONNECT_ID}" type="button" style="display:none">Disconnect</button>
          </div>
        </div>`;
      section.dataset.rendered = 'true';
    }

    if (!tab.dataset.bound) {
      tab.dataset.bound = 'true';
      tab.addEventListener('click', function () {
        nav.querySelectorAll('[data-dash]').forEach(x => x.classList.toggle('active', x === tab));
        nav.closest('.drawerpanel')?.querySelectorAll('.dashsection').forEach(x => x.classList.remove('active'));
        section.classList.add('active');
      });
    }

    const connect = document.getElementById(CONNECT_ID);
    const disconnect = document.getElementById(DISCONNECT_ID);
    if (connect && !connect.dataset.bound) {
      connect.dataset.bound = 'true';
      // The existing OAuth UI listens for this exact button label in capture phase.
      // Keep this button intentionally simple so there is only one OAuth implementation.
      connect.addEventListener('click', function () {
        connect.disabled = true;
        connect.textContent = 'Opening Eugene Card…';
      });
    }
    if (disconnect && !disconnect.dataset.bound) {
      disconnect.dataset.bound = 'true';
      disconnect.addEventListener('click', async function () {
        if (!window.confirm('Disconnect Eugene Card from this Lunarist account?')) return;
        disconnect.disabled = true;
        try {
          await request('POST', { action: 'disconnect' });
          await refresh();
        } catch (e) {
          window.toast?.(e.message || 'Unable to disconnect Eugene Card.');
        } finally {
          disconnect.disabled = false;
        }
      });
    }
    return true;
  }

  async function refresh() {
    if (!install()) return;
    const status = document.getElementById('profileEugeneStatus');
    const connect = document.getElementById(CONNECT_ID);
    const disconnect = document.getElementById(DISCONNECT_ID);
    const copy = document.getElementById('profileEugeneCopy');
    if (!status || !connect || !disconnect || !copy) return;
    try {
      const data = await request('GET');
      const connected = !!data.connected;
      status.textContent = connected ? 'Connected' : 'Not connected';
      status.dataset.status = connected ? 'connected' : 'not_connected';
      connect.textContent = connected ? 'Connected to Eugene Card' : 'Connect Eugene Card';
      connect.disabled = connected;
      disconnect.style.display = connected ? '' : 'none';
      copy.textContent = connected
        ? 'Your Lunarist account is linked to Eugene Card. You can disconnect it here at any time.'
        : 'Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.';
    } catch (_) {
      status.textContent = 'Not connected';
      connect.disabled = false;
      connect.textContent = 'Connect Eugene Card';
      disconnect.style.display = 'none';
    }
  }

  function boot() {
    installStyles();
    if (!install()) return;
    refresh();
    // openDashboard rebuilds the Profile section. Reinstall after it does so.
    const observer = new MutationObserver(() => {
      if (document.getElementById('drawer') && document.querySelector('.dashnav')) install();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(refresh, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
