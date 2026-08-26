/* Lunarist Twitch integration
   Add <script src="/twitch-autofill.js"></script> after the existing scripts.
   The helper is non-destructive: it only exposes Twitch detection/fetching.
*/
(function () {
  'use strict';

  function isTwitchUrl(raw) {
    try {
      const u = new URL(/^https?:\/\//i.test(String(raw || ''))
        ? raw : 'https://' + raw);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      return host === 'twitch.tv' || host === 'm.twitch.tv';
    } catch (_) {
      return false;
    }
  }

  async function fetchTwitchProjectData(url) {
    if (!isTwitchUrl(url)) throw new Error('That does not look like a Twitch URL.');

    const response = await fetch('/api/twitch?url=' + encodeURIComponent(url), {
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to fetch Twitch data.');

    return {
      platform: 'twitch',
      url: url,
      title: data.title || '',
      description: data.description || '',
      author: data.author || data.username || '',
      thumbnail: data.thumbnail || '',
      game: data.game || '',
      isLive: !!data.isLive,
      viewers: Number(data.viewers || 0),
      viewCount: Number(data.viewCount || 0),
      duration: data.duration || '',
      durationSeconds: Number(data.durationSeconds || 0),
      publishedAt: data.publishedAt || null
    };
  }

  window.LunaristTwitch = {
    isTwitchUrl,
    fetch: fetchTwitchProjectData
  };
})();
