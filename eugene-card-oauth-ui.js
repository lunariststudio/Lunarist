(function () {
  'use strict';
  if (window.__lunaristEugeneOAuthUI) return;
  window.__lunaristEugeneOAuthUI = true;

  const API = '/api/eugene-card';
  const EUGENE = 'https://eugene-card-1.vercel.app';
  const REDIRECT = `${EUGENE}/?connect=lunarist`;
  let starting = false;

  async function getSession() {
    try {
      const client = window.supabaseClient || window.supabase;
      if (!client || !client.auth || typeof client.auth.getSession !== 'function') return null;
      const result = await client.auth.getSession();
      return result && result.data && result.data.session ? result.data.session : null;
    } catch (_) {
      return null;
    }
  }

  function showError(message) {
    try {
      if (typeof window.toast === 'function') window.toast(message);
      else console.error('[Lunarist Eugene OAuth]', message);
    } catch (_) {}
  }

  async function startOAuth() {
    if (starting) return;
    starting = true;
    const button = document.getElementById('eugeneConnectBtn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Opening Eugene Card…';
    }
    try {
      const session = await getSession();
      if (!session || !session.access_token) {
        if (button) {
          button.disabled = false;
          button.textContent = 'Connect Eugene Card';
        }
        showError('Your Lunarist session could not be read. Please refresh Lunarist and try again.');
        return;
      }

      const response = await fetch(`${API}/session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store'
      });
      if (!response.ok) {
        let message = 'Could not start the Eugene Card connection.';
        try {
          const data = await response.json();
          if (data && data.error) message = data.error;
        } catch (_) {}
        throw new Error(message);
      }

      const url = new URL(`${API}/authorize`, window.location.origin);
      url.searchParams.set('client_id', 'eugene-card');
      url.searchParams.set('redirect_uri', REDIRECT);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'identity profile offline_access');
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('state', crypto.randomUUID());
      window.location.assign(url.toString());
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = 'Connect Eugene Card';
      }
      showError(error && error.message ? error.message : 'Could not start the Eugene Card connection.');
    } finally {
      starting = false;
    }
  }

  // Delegate the click so dynamically-rendered profile buttons work without
  // MutationObserver or DOM-wide status manipulation that can destabilize UI.
  document.addEventListener('click', function (event) {
    try {
      const target = event.target && event.target.closest ? event.target.closest('#eugeneConnectBtn') : null;
      if (!target || target.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      startOAuth();
    } catch (error) {
      showError(error && error.message ? error.message : 'Could not start the Eugene Card connection.');
    }
  }, true);

  async function handleAuthorizeBridge() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('eugene_authorize') !== '1' || window.__eugeneBridgeHandled) return;
    window.__eugeneBridgeHandled = true;
    try {
      const session = await getSession();
      if (!session || !session.access_token) {
        showError('Your Lunarist session could not be read. Please refresh Lunarist and try again.');
        return;
      }
      const response = await fetch(`${API}/session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Could not authorize Eugene Card.');

      const url = new URL(`${API}/authorize`, window.location.origin);
      url.searchParams.set('client_id', params.get('client_id') || 'eugene-card');
      url.searchParams.set('redirect_uri', params.get('redirect_uri') || REDIRECT);
      url.searchParams.set('response_type', params.get('response_type') || 'code');
      url.searchParams.set('scope', params.get('scope') || 'identity profile offline_access');
      url.searchParams.set('code_challenge_method', params.get('code_challenge_method') || 'S256');
      if (params.get('code_challenge')) url.searchParams.set('code_challenge', params.get('code_challenge'));
      if (params.get('state')) url.searchParams.set('state', params.get('state'));
      window.location.assign(url.toString());
    } catch (error) {
      showError(error && error.message ? error.message : 'Could not authorize Eugene Card.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleAuthorizeBridge, { once: true });
  } else {
    handleAuthorizeBridge();
  }
})();
