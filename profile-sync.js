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
    return state.currentMember;
  }

  window.refreshUser = syncProfile;
})();

// Saved projects + YouTube engagement sync.
(function(){
  if(typeof window==='undefined') return;
  const boot=()=>{
    if(typeof supabaseClient==='undefined' || typeof state==='undefined') return false;

    const savedIds=new Set();
    let savedLoadedFor=null;

    async function loadSavedIds(){
      if(!state.currentUser){savedIds.clear();savedLoadedFor=null;return;}
      if(savedLoadedFor===state.currentUser.id) return;
      const {data,error}=await supabaseClient.from('saved_projects').select('project_id').eq('user_id',state.currentUser.id);
      if(!error){savedIds.clear();(data||[]).forEach(x=>savedIds.add(x.project_id));savedLoadedFor=state.currentUser.id;}
    }

    async function isSaved(id){await loadSavedIds();return savedIds.has(id)}

    async function toggleSave(id){
      if(!state.currentUser){if(typeof openAuth==='function')openAuth('signin');return false;}
      const currently=await isSaved(id);
      if(currently){
        const {error}=await supabaseClient.from('saved_projects').delete().eq('user_id',state.currentUser.id).eq('project_id',id);
        if(error)throw error;
        savedIds.delete(id);
        if(typeof toast==='function')toast('Removed from Saved');
        return false;
      }
      const {error}=await supabaseClient.from('saved_projects').insert({user_id:state.currentUser.id,project_id:id});
      if(error && error.code!=='23505')throw error;
      savedIds.add(id);
      if(typeof toast==='function')toast('Saved to your wishlist');
      return true;
    }

    // Saved is a standalone page now. Remove the legacy Member Space tab/section
    // so there is only one canonical Saved destination.
    function removeSavedFromMemberSpace(){
      document.querySelector('.dashnav [data-dash="saved"]')?.remove();
      document.getElementById('dash-saved')?.remove();
    }

    function injectSavedTab(){
      removeSavedFromMemberSpace();
    }

    async function renderSavedProjects(){
      // Kept for backwards compatibility with older injected markup. The
      // canonical Saved UI is /saved and is rendered by saved.html.
      removeSavedFromMemberSpace();
    }

    async function wireSaveButton(id){
      const btn=document.getElementById('saveBtn'); if(!btn)return;
      const saved=await isSaved(id);
      btn.textContent=saved?'🔖 Saved':'🔖 Save';
      btn.style.color=saved?'var(--pink)':'';
      btn.onclick=async()=>{
        btn.disabled=true;
        try{const next=await toggleSave(id);btn.textContent=next?'🔖 Saved':'🔖 Save';btn.style.color=next?'var(--pink)':'';}
        catch(e){if(typeof toast==='function')toast(e.message||'Unable to save this project.');}
        finally{btn.disabled=false;}
      };
    }

    const originalOpenProject=window.openProject;
    if(typeof originalOpenProject==='function' && !window.__lunaristSavedOpenPatched){
      window.__lunaristSavedOpenPatched=true;
      window.openProject=async function(id){await originalOpenProject(id);await wireSaveButton(id)};
    }

    function injectTopSaved(){
      if(!state.currentUser)return;
      const links=document.getElementById('navlinks'); if(!links||document.getElementById('navSavedBtn'))return;
      const b=document.createElement('button');
      b.id='navSavedBtn';
      b.className='navbtn';
      b.textContent='🔖 Saved';
      b.setAttribute('data-standalone-route','/saved');
      const commission=document.getElementById('navCommissionsBtn');
      if(commission)links.insertBefore(b,commission);else links.appendChild(b);
      b.onclick=()=>{
        links.classList.remove('open');
        window.location.assign('/saved');
      };
    }

    async function syncYoutubeLikes(){
      if(!Array.isArray(data.projects)||!data.projects.length)return;
      for(const p of data.projects){
        const url=String(p.media_url||p.video||'');
        const m=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
        if(!m)continue;
        try{
          const r=await fetch('/api/youtube?videoId='+encodeURIComponent(m[1]),{cache:'no-store'});
          if(!r.ok)continue;
          const d=await r.json();
          if(d.likeCount!==undefined&&d.likeCount!==null){const n=Number(d.likeCount);if(Number.isFinite(n)&&p.likes!==n){p.likes=n;supabaseClient.from('projects').update({likes:n}).eq('id',p.id).then(()=>{})}}
          if(d.viewCount!==undefined&&d.viewCount!==null){const n=Number(d.viewCount);if(Number.isFinite(n)&&p.views!==n){p.views=n;supabaseClient.from('projects').update({views:n}).eq('id',p.id).then(()=>{})}}
        }catch(e){}
      }
      if(typeof render==='function')render();
    }

    const observer=new MutationObserver(()=>{removeSavedFromMemberSpace();injectTopSaved()});
    observer.observe(document.body,{childList:true,subtree:true});
    const timer=setInterval(()=>{removeSavedFromMemberSpace();injectTopSaved();syncYoutubeLikes()},15000);
    window.addEventListener('beforeunload',()=>clearInterval(timer));
    setTimeout(()=>{removeSavedFromMemberSpace();injectTopSaved();syncYoutubeLikes()},1000);
    return true;
  };
  let tries=0;const wait=setInterval(()=>{if(boot()||++tries>80)clearInterval(wait)},250);
})();
