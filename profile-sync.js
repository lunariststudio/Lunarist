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

    // getUser() is authoritative; fall back to the cached session only when needed.
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

    // Never insert a new profile just because a read failed. That was the source
    // of duplicate/missing-profile states for existing Google-authenticated users.
    if (!profile && profileError) {
      console.error('[Lunarist] Profile read failed:', profileError);
      // Try the public API as a read-only fallback so existing member profiles
      // can still populate the UI while Supabase auth/RLS is recovering.
      try {
        const r = await fetch('/api/lunarist?resource=profiles&_=' + Date.now(), { cache: 'no-store' });
        const rows = r.ok ? await r.json() : [];
        profile = Array.isArray(rows) ? rows.find(x => x.id === user.id) || null : null;
      } catch (e) {
        console.warn('[Lunarist] Profile API fallback failed', e);
      }
    }

    // Only create a profile when Supabase explicitly says the row does not exist.
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
    return state.currentMember;
  }

  // Replace the global function used by dashboard/commission/profile actions.
  window.refreshUser = syncProfile;
})();
