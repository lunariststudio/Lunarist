// Lunarist profile sync hotfix.
// Runs after index.html and replaces the fragile profile/session refresh with
// a resilient version that never creates a duplicate profile when a read fails.
(async function () {
  if (typeof supabaseClient === 'undefined' || typeof state === 'undefined') return;

  const originalRefreshUser = typeof refreshUser === 'function' ? refreshUser : null;

  async function syncProfile() {
    let user = null;
    try {
      const auth = await supabaseClient.auth.getUser();
      user = auth?.data?.user || null;
    } catch (e) {
      console.warn('[Lunarist] getUser failed', e);
    }

    if (!user) {
      try {
        const sessionResult = await supabaseClient.auth.getSession();
        user = sessionResult?.data?.session?.user || null;
      } catch (e) {
        console.warn('[Lunarist] getSession fallback failed', e);
      }
    }

    state.currentUser = user;
    if (!user) {
      state.currentMember = null;
      const name = document.getElementById('accountName');
      if (name) name.textContent = 'Guest';
      const avatar = document.getElementById('accountAvatar');
      if (avatar) avatar.outerHTML = '<span class="avatar" id="accountAvatar">G</span>';
      if (typeof applyTheme === 'function') applyTheme('moonlight');
      return null;
    }

    let profile = null;
    let profileError = null;
    try {
      const result = await supabaseClient
        .from('profiles')
        .select('id,username,display_name,role,bio,avatar_url,skills,available,is_admin,account_type,tos,tos_ja,theme')
        .eq('id', user.id)
        .maybeSingle();
      profile = result?.data || null;
      profileError = result?.error || null;
    } catch (e) {
      profileError = e;
    }

    if (!profile && profileError) {
      console.error('[Lunarist] Profile read failed:', profileError);
      try {
        const r = await fetch('/api/lunarist?resource=profiles&_=' + Date.now(), { cache: 'no-store' });
        const rows = r.ok ? await r.json() : [];
        profile = Array.isArray(rows) ? rows.find(x => x.id === user.id) || null : null;
      } catch (e) {
        console.warn('[Lunarist] Profile API fallback failed', e);
      }
    }

    if (!profile && !profileError) {
      const fallback = {
        id: user.id,
        username: (user.email || 'member').split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 32) || 'member',
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Lunarist member',
        role: '', bio: '', skills: [], available: true, account_type: 'user', theme: 'moonlight'
      };
      try {
        const created = await supabaseClient.from('profiles').insert(fallback).select().single();
        if (!created.error) profile = created.data;
      } catch (e) {
        console.warn('[Lunarist] Profile creation failed', e);
      }
    }

    if (!profile) {
      state.currentMember = null;
      return null;
    }

    const isStudioAdmin = !!profile.is_admin || user.email === 'lunariststudio@gmail.com';
    state.currentMember = {
      id: profile.id,
      username: profile.username || '',
      name: profile.display_name || user.email || 'Member',
      role: profile.role || '',
      bio: profile.bio || '',
      tos: profile.tos || '',
      tos_ja: profile.tos_ja || '',
      theme: profile.theme || 'moonlight',
      avatar: profile.avatar_url || ('https://i.pravatar.cc/160?u=' + profile.id),
      skills: profile.skills || [],
      available: profile.available !== false,
      is_admin: isStudioAdmin,
      account_type: isStudioAdmin ? 'member' : (profile.account_type || 'user')
    };

    state.selectedTheme = state.currentMember.theme;
    if (typeof applyTheme === 'function') applyTheme(state.selectedTheme);

    const name = document.getElementById('accountName');
    if (name) name.textContent = state.currentMember.name || 'Member';
    const avatar = document.getElementById('accountAvatar');
    if (avatar) {
      avatar.outerHTML = `<img class="avatar" id="accountAvatar" src="${esc(state.currentMember.avatar || '')}" alt="" onerror="handleImageError(this)">`;
    }
    if (typeof loadUserNotifications === 'function') loadUserNotifications();
    if (typeof loadSavedIds === 'function') { try { await loadSavedIds(); } catch (e) {} }
    return state.currentMember;
  }

  window.refreshUser = syncProfile;
})();

// YouTube view/like count sync — keeps project stats fresh without
// stealing scroll position or fighting the built-in Saved tab.
(function(){
  if(typeof window==='undefined') return;
  const boot=()=>{
    if(typeof supabaseClient==='undefined' || typeof state==='undefined' || typeof data==='undefined') return false;

    function findVideoId(p){
      if(typeof extractYoutubeId==='function'){
        return extractYoutubeId(p.media_url)||extractYoutubeId(p.video)||extractYoutubeId(p.thumbnail_url);
      }
      const re=/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/;
      for(const raw of [p.media_url,p.video,p.thumbnail_url]){
        const s=String(raw||'').trim();
        if(!s)continue;
        const m=s.match(re);
        if(m)return m[1];
        if(/^[A-Za-z0-9_-]{11}$/.test(s))return s;
      }
      return null;
    }

    async function syncYoutubeLikes(){
      if(!Array.isArray(data.projects)||!data.projects.length)return;
      let changed=false;
      for(const p of data.projects){
        const vid=findVideoId(p);
        if(!vid)continue;
        try{
          const r=await fetch('/api/youtube?videoId='+encodeURIComponent(vid),{cache:'no-store'});
          if(!r.ok)continue;
          const d=await r.json();
          if(d.likeCount!==undefined&&d.likeCount!==null){const n=Number(d.likeCount);if(Number.isFinite(n)&&p.likes!==n){p.likes=n;changed=true;supabaseClient.from('projects').update({likes:n}).eq('id',p.id).then(()=>{})}}
          if(d.viewCount!==undefined&&d.viewCount!==null){const n=Number(d.viewCount);if(Number.isFinite(n)&&p.views!==n){p.views=n;changed=true;supabaseClient.from('projects').update({views:n}).eq('id',p.id).then(()=>{})}}
        }catch(e){}
      }
      // Only re-render when a number actually changed, and always keep the
      // user's scroll position — this loop runs every 15s in the background.
      if(changed && typeof render==='function')render(true);
    }

    const timer=setInterval(syncYoutubeLikes,15000);
    window.addEventListener('beforeunload',()=>clearInterval(timer));
    setTimeout(syncYoutubeLikes,1000);
    return true;
  };
  let tries=0;const wait=setInterval(()=>{if(boot()||++tries>80)clearInterval(wait)},250);
})();
