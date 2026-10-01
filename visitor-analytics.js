/* Lunarist privacy-conscious audience analytics
 * - Uses a random first-party browser identifier; no IP, fingerprinting, or third-party analytics.
 * - One visitor record per browser profile.
 * - One visit record per browser session (sessionStorage).
 */
(() => {
  const VISITOR_KEY = 'lunarist_analytics_visitor_id_v1';
  const SESSION_KEY = 'lunarist_analytics_session_recorded_v1';

  function randomId(prefix) {
    try {
      if (crypto?.randomUUID) return prefix + crypto.randomUUID();
    } catch {}
    return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function getVisitorId() {
    try {
      let id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = randomId('v_');
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch {
      return randomId('v_');
    }
  }

  async function waitForSupabase(attempt = 0) {
    if (window.supabaseClient?.from) return window.supabaseClient;
    if (attempt >= 40) return null;
    await new Promise(resolve => setTimeout(resolve, 250));
    return waitForSupabase(attempt + 1);
  }

  async function recordAudience() {
    const client = await waitForSupabase();
    if (!client) return;

    const visitorId = getVisitorId();

    try {
      const firstVisitor = !localStorage.getItem('lunarist_analytics_registered_v1');
      if (firstVisitor) {
        const { error } = await client.from('site_visitors').insert({
          visitor_id: visitorId
        });
        if (!error || error.code === '23505') {
          try { localStorage.setItem('lunarist_analytics_registered_v1', '1'); } catch {}
        }
      }
    } catch (error) {
      console.debug('[Lunarist Analytics] visitor registration skipped', error);
    }

    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
      const { error } = await client.from('site_visits').insert({
        visitor_id: visitorId
      });
      if (!error) {
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      }
    } catch (error) {
      console.debug('[Lunarist Analytics] visit recording skipped', error);
    }
  }

  recordAudience();
})();
