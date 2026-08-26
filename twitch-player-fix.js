(() => {
  'use strict';

  function twitchEmbedUrlStable(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';

    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'twitch.tv' && host !== 'm.twitch.tv') return '';

      const parts = u.pathname.split('/').filter(Boolean);
      const parent = location.hostname || 'lunaristudio.vercel.app';
      const params = new URLSearchParams({ parent });

      // Twitch Clips use a different official embed endpoint.
      if (parts[0]?.toLowerCase() === 'clip' && parts[1]) {
        params.set('clip', parts[1]);
        params.set('autoplay', 'false');
        return `https://clips.twitch.tv/embed?${params.toString()}`;
      }

      if (parts[0]?.toLowerCase() === 'videos' && parts[1]) {
        params.set('video', parts[1]);
      } else if (parts[0] && !['directory', 'search', 'settings'].includes(parts[0].toLowerCase())) {
        params.set('channel', parts[0]);
      } else {
        return '';
      }

      // Do not let the browser/Twitch attempt an unmuted autoplay. This is a
      // common source of PLAYBACK_BLOCKED and inconsistent iframe loading.
      params.set('autoplay', 'false');
      params.set('muted', 'true');
      return `https://player.twitch.tv/?${params.toString()}`;
    } catch (_) {
      return '';
    }
  }

  // openProject() uses the global twitchEmbedUrl() binding. Replace it before
  // users can open a project so both old and new Twitch URLs are normalized.
  window.twitchEmbedUrl = twitchEmbedUrlStable;

  function stabilizeIframe(iframe) {
    if (!iframe || iframe.dataset.twitchStable === '1') return;
    const src = iframe.getAttribute('src') || '';
    if (!/twitch\.tv/i.test(src)) return;

    try {
      const u = new URL(src, location.href);
      if (u.hostname !== 'player.twitch.tv' && u.hostname !== 'clips.twitch.tv') return;
      u.searchParams.set('autoplay', 'false');
      if (u.hostname === 'player.twitch.tv') u.searchParams.set('muted', 'true');
      if (!u.searchParams.get('parent')) u.searchParams.set('parent', location.hostname || 'lunaristudio.vercel.app');
      iframe.src = u.toString();
      iframe.dataset.twitchStable = '1';
    } catch (_) {}
  }

  function scan(root = document) {
    if (root.matches?.('iframe')) stabilizeIframe(root);
    root.querySelectorAll?.('iframe').forEach(stabilizeIframe);
  }

  scan();
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
