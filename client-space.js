// Lunarist Client Space — dedicated user/client portal.
(function(){
  if(typeof window==='undefined') return;
  const boot=()=>{
    if(window.__lunaristClientSpacePatched) return true;
    if(typeof window.render!=='function'||typeof window.goRoute!=='function'||typeof window.pathForRoute!=='function'||typeof window.routeFromPath!=='function') return false;
    const originalRender=window.render, originalGoRoute=window.goRoute, originalPath=window.pathForRoute, originalRoute=window.routeFromPath;
    const css=document.createElement('style');css.id='lunarist-client-space-css';css.textContent=`
      .client-space-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:20px;padding-bottom:3px}.client-space-tabs .filter{white-space:nowrap}
      .client-space-section{display:none}.client-space-section.active{display:block}
      .client-profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .client-review-card{padding:16px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}
      .client-review-stars{color:var(--gold);font-size:18px;letter-spacing:1px}
      .client-public-profile{max-width:900px;margin:0 auto}.client-public-card{display:grid;grid-template-columns:140px 1fr;gap:28px;align-items:start}
      .client-public-avatar{width:140px;height:140px;border-radius:50%;object-fit:cover;border:1px solid var(--line)}.client-public-username{color:var(--moon);font-weight:700}
      .client-public-url{display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;color:var(--muted);font-size:12px;word-break:break-all}
      .client-website-box{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin-top:14px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025)}
      .client-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}.client-stat-card{padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025)}.client-stat-card b{display:block;font-size:22px}.client-stat-card span{display:block;color:var(--muted);font-size:11px;margin-top:3px}
      .client-action{border:1px solid rgba(255,134,200,.25);background:rgba(255,134,200,.06);border-radius:16px;padding:14px}.client-action strong{display:block}.client-action .meta{margin-top:4px}
      .client-eugene-card{box-sizing:border-box;width:100%;max-width:575px;padding:25px;border:1px solid rgba(155,132,220,.32);border-radius:24px;background:linear-gradient(145deg,rgba(31,27,43,.92),rgba(18,16,27,.96));box-shadow:0 12px 35px rgba(0,0,0,.16)}.client-eugene-head{display:flex;align-items:center;gap:17px}.client-eugene-icon{width:57px;height:57px;flex:0 0 57px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#7860ff,#8650e9);color:#fff;font-size:26px;font-weight:900;box-shadow:0 8px 20px rgba(115,82,255,.22)}.client-eugene-title{margin:0;font-size:21px;line-height:1.2;font-weight:800}.client-eugene-status{margin-top:7px;font-size:15px;font-weight:800;color:var(--text,#fff)}.client-eugene-copy{margin:27px 0 17px;color:var(--muted,#a8a0b6);font-size:15px;line-height:1.65}.client-eugene-actions{display:flex;gap:10px;flex-wrap:wrap}.client-eugene-connect{min-width:230px;min-height:58px;border-radius:17px;font-size:16px;font-weight:800;background:#f6f3fb;color:#15121e;border:0}.client-eugene-disconnect{min-height:58px;border-radius:17px;font-weight:800}@media(max-width:600px){.client-eugene-card{padding:20px;border-radius:20px}.client-eugene-connect,.client-eugene-disconnect{width:100%}}
      .client-deadline{border:1px solid var(--line);border-radius:14px;padding:13px;background:rgba(255,255,255,.02)}.client-deadline.soon{border-color:rgba(232,207,145,.45)}.client-deadline.late{border-color:rgba(255,125,142,.45)}
      .client-progress{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px;margin-top:12px}.client-progress span{height:5px;border-radius:99px;background:rgba(255,255,255,.08)}.client-progress span.active{background:var(--moon)}
      .client-recommend-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.client-recommend-grid .card{min-width:0}
      @media(max-width:900px){.client-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.client-recommend-grid{grid-template-columns:1fr}}
      @media(max-width:720px){.client-profile-grid{grid-template-columns:1fr}.client-public-card{grid-template-columns:1fr;text-align:center}.client-public-avatar{margin:0 auto}.client-public-url{justify-content:center}.client-website-box{align-items:flex-start;flex-direction:column}.client-stat-grid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(css);

    const isClient=()=>!!state.currentMember&&!state.currentMember.is_admin&&state.currentMember.account_type!=='member';
    const clientByUsername=u=>{u=String(u||'').replace(/^@/,'').toLowerCase();return data.members.find(m=>!m.is_admin&&m.account_type!=='member'&&String(m.username||'').toLowerCase()===u)||null};
    const clientUrl=m=>m?.username?`${location.origin}/${encodeURIComponent(m.username)}`:'';
    const statusSteps=['waitlist','unpaid','paid','wip1','wip2','wip3','delivered','revisions','completed'];
    const statusLabel=s=>typeof commissionClientStatusLabel==='function'?commissionClientStatusLabel(s):String(s||'waitlist').replace(/^./,x=>x.toUpperCase());
    const statusIndex=s=>Math.max(0,statusSteps.indexOf(s||'waitlist'));
    const daysUntil=d=>{if(!d)return null;const t=new Date(d+'T23:59:59');return Math.ceil((t.getTime()-Date.now())/86400000)};
    const formatDeadline=d=>{if(!d)return 'No deadline';const n=daysUntil(d);if(n<0)return `${Math.abs(n)} day${Math.abs(n)===1?'':'s'} overdue`;if(n===0)return 'Due today';if(n===1)return 'Due tomorrow';return `Due in ${n} days`};

    function addNav(){
      const nav=document.getElementById('navlinks');if(!nav||document.getElementById('navClientSpaceBtn'))return;
      const b=document.createElement('button');b.className='navbtn';b.id='navClientSpaceBtn';b.dataset.clientRoute='clients';b.textContent=state.language==='ja'?'クライアントスペース':'Client Space';b.onclick=()=>openClientSpace('overview');
      const admin=document.getElementById('navAdminBtn');nav.insertBefore(b,admin||null);
    }

    function clientShell(){
      const m=state.currentMember||{},url=clientUrl(m);
      return `<div class="container"><section class="section" style="padding-top:55px"><div class="sectionhead"><div><div class="eyebrow">Client Space</div><h1 style="font-size:48px;margin:4px 0">${esc(m.name||'Client')} · Client Space</h1><p>Your private portal for commissions, saved inspiration, reviews and your public client profile.</p></div></div>${url?`<div class="client-website-box"><span><b>Your Client Space website</b><br><span class="meta">${esc(url)}</span></span><button class="btn" id="copyClientUrl">Copy link</button></div>`:''}<div class="client-space-tabs" id="clientSpaceTabs"><button class="filter active" data-client-tab="overview">Overview</button><button class="filter" data-client-tab="saved">🔖 Saved</button><button class="filter" data-client-tab="commissions">My Commissions</button><button class="filter" data-client-tab="reviews">Client Reviews</button><button class="filter" data-client-tab="profile">Profile</button><button class="filter" data-client-tab="eugene-card">Eugene Card</button></div><section class="client-space-section active" id="client-space-overview"></section><section class="client-space-section" id="client-space-saved"></section><section class="client-space-section" id="client-space-commissions"></section><section class="client-space-section" id="client-space-reviews"></section><section class="client-space-section" id="client-space-profile"></section><section class="client-space-section" id="client-space-eugene-card"></section></section></div>`;
    }

    async function getClientData(){
      if(!state.currentUser)return {commissions:[],reviews:[]};
      const [c,r]=await Promise.all([
        supabaseClient.from('commissions').select('id,artist_id,status,total_amount,amount,currency,target_deadline,created_at,project_title,service:service_id(id,title,thumbnail_url),artist:artist_id(id,display_name,username,avatar_url),client_reviews(id,rating,review,published,created_at)').eq('client_id',state.currentUser.id).order('created_at',{ascending:false}),
        supabaseClient.from('client_reviews').select('id,commission_id,artist_id,rating,review,published,created_at,artist:artist_id(id,display_name,username,avatar_url),commission:commission_id(id,project_title,status,service:service_id(title))').eq('client_id',state.currentUser.id).order('created_at',{ascending:false})
      ]);
      return {commissions:c.data||[],reviews:r.data||[]};
    }

    function recommendedServices(){
      const saved=data.projects.filter(p=>state.savedIds.has(p.id));
      const terms=new Set();saved.forEach(p=>{if(p.category)terms.add(String(p.category).toLowerCase());(p.tags||[]).forEach(t=>terms.add(String(t).toLowerCase()))});
      let services=(data.services||[]).filter(s=>s.status==='published'||s.published);
      const scored=services.map(s=>{const hay=[s.category,...(s.tags||[]),s.title,s.description].join(' ').toLowerCase();let score=0;terms.forEach(t=>{if(t&&hay.includes(t))score+=2});score+=Math.min(Number(s.views||0)/10000,1);return {s,score}}).sort((a,b)=>b.score-a.score);
      return (terms.size?scored.filter(x=>x.score>0):scored).slice(0,4).map(x=>x.s);
    }

    function renderOverview(){
      const el=document.getElementById('client-space-overview');if(!el)return;
      const m=state.currentMember||{},d=window.__lunaristClientData||{commissions:[],reviews:[]},url=clientUrl(m);
      const active=d.commissions.filter(c=>!['completed','cancelled'].includes(c.status));
      const pendingApproval=d.commissions.filter(c=>c.status==='delivered').length;
      const upcoming=active.filter(c=>c.target_deadline).sort((a,b)=>new Date(a.target_deadline)-new Date(b.target_deadline)).slice(0,3);
      const totalSpent=d.commissions.filter(c=>['paid','wip1','wip2','wip3','delivered','revisions','completed'].includes(c.status)).reduce((n,c)=>n+Number(c.total_amount||c.amount||0),0);
      const avgReview=d.reviews.length?(d.reviews.reduce((n,r)=>n+Number(r.rating||0),0)/d.reviews.length).toFixed(1):'—';
      const actions=[];
      if(pendingApproval)actions.push(`<div class="client-action"><strong>✓ ${pendingApproval} delivery${pendingApproval===1?'':'ies'} waiting for your approval</strong><div class="meta">Open My Commissions to approve delivered work.</div><button class="btn pink" style="margin-top:9px" data-client-action="commissions">Review delivery</button></div>`);
      const reviewDue=d.commissions.filter(c=>c.status==='completed'&&(!Array.isArray(c.client_reviews)||!c.client_reviews.length));
      if(reviewDue.length)actions.push(`<div class="client-action"><strong>★ ${reviewDue.length} commission${reviewDue.length===1?'':'s'} ready for review</strong><div class="meta">Share your experience with the artist.</div><button class="btn pink" style="margin-top:9px" data-client-action="reviews">Leave a review</button></div>`);
      if(!actions.length)actions.push(`<div class="client-action"><strong>You're all caught up.</strong><div class="meta">Save inspiration or explore services when you're ready for your next project.</div><div class="heroactions" style="margin-top:9px"><button class="btn primary" data-client-route-action="services">Explore Services</button><button class="btn" data-client-action="saved">View Saved</button></div></div>`);
      const recs=recommendedServices();
      el.innerHTML=`<div class="panel"><div class="eyebrow">Client Dashboard</div><div class="row" style="align-items:flex-start;gap:16px"><img class="avatar" style="width:72px;height:72px" src="${esc(m.avatar||'')}" onerror="handleImageError(this)"><div class="grow"><h2 style="margin:0 0 4px">Welcome back, ${esc(m.name||'Client')}.</h2><div class="meta">@${esc(m.username||'client')}</div><p class="meta">Your Client Space keeps the client side of Lunarist separate from Member publishing tools.</p>${url?`<div class="client-public-url">${esc(url)}</div>`:''}</div></div><div class="client-stat-grid"><div class="client-stat-card"><b>${state.savedIds.size}</b><span>Saved projects</span></div><div class="client-stat-card"><b>${active.length}</b><span>Active commissions</span></div><div class="client-stat-card"><b>${d.reviews.length?avgReview:'—'}</b><span>Average review</span></div><div class="client-stat-card"><b>${totalSpent?`${esc(d.commissions.find(c=>c.currency)?.currency||'USD')} ${totalSpent.toFixed(0)}`:'—'}</b><span>Total commissioned</span></div></div></div><div style="margin-top:16px"><div class="eyebrow">Action Center</div><div style="display:flex;flex-direction:column;gap:9px;margin-top:8px">${actions.join('')}</div></div>${upcoming.length?`<div style="margin-top:22px"><div class="sectionhead" style="margin-bottom:10px"><div><div class="eyebrow">Upcoming</div><h2 style="font-size:22px">Commission deadlines</h2></div><button class="btn" data-client-action="commissions">View all</button></div><div style="display:flex;flex-direction:column;gap:8px">${upcoming.map(c=>{const n=daysUntil(c.target_deadline),late=n<0;return `<div class="client-deadline ${late?'late':n<=3?'soon':''}"><div class="row"><div class="grow"><b>${esc(c.service?.title||c.project_title||'Commission')}</b><div class="meta">${esc(c.artist?.display_name||c.artist?.username||'Artist')} · ${esc(formatDeadline(c.target_deadline))}</div></div><span class="pill">${esc(statusLabel(c.status))}</span></div></div>`}).join('')}</div></div>`:''}${recs.length?`<div style="margin-top:26px"><div class="sectionhead" style="margin-bottom:10px"><div><div class="eyebrow">Recommended for you</div><h2 style="font-size:22px">Services matching your saved inspiration</h2><p>Based on the categories and tags in your saved projects.</p></div></div><div class="client-recommend-grid">${recs.map(serviceCard).join('')}</div></div>`:''}`;
      el.querySelectorAll('[data-client-action]').forEach(b=>b.onclick=()=>tab(b.dataset.clientAction));
      el.querySelectorAll('[data-client-route-action]').forEach(b=>b.onclick=()=>originalGoRoute(b.dataset.clientRouteAction));
      el.querySelectorAll('[data-service]').forEach(x=>x.onclick=()=>openService(x.dataset.service));
    }

    function renderSaved(){
      const el=document.getElementById('client-space-saved');if(!el)return;
      const saved=data.projects.filter(p=>state.savedIds.has(p.id));
      const recs=recommendedServices();
      el.innerHTML=`<div class="panel"><div class="eyebrow">Saved</div><h2 style="margin:4px 0">Your saved projects</h2><p class="meta">Your bookmarks are synced to your Lunarist account.</p><div class="grid" style="margin-top:16px">${saved.length?saved.map(p=>card(p)).join(''):emptyState('Nothing saved yet.','Tap 🔖 Save on any project to bookmark it here.')}</div></div>${recs.length?`<div class="panel" style="margin-top:14px"><div class="eyebrow">Next inspiration</div><h3 style="margin:4px 0">Services inspired by your bookmarks</h3><div class="client-recommend-grid" style="margin-top:12px">${recs.map(serviceCard).join('')}</div></div>`:''}`;
      el.querySelectorAll('[data-project]').forEach(x=>x.onclick=()=>openProject(x.dataset.project));el.querySelectorAll('[data-service]').forEach(x=>x.onclick=()=>openService(x.dataset.service));
    }

    function commissionCard(c){
      const a=c.artist||{},s=c.service||{},r=Array.isArray(c.client_reviews)?c.client_reviews[0]:null,idx=statusIndex(c.status),approve=c.status==='delivered',review=c.status==='completed'&&!r,n=daysUntil(c.target_deadline);
      return `<article class="panel" style="padding:16px;background:rgba(255,255,255,.02)"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px"><div class="grow"><div class="eyebrow">Commission</div><h3 style="margin:3px 0 6px">${esc(s.title||c.project_title||'Commission')}</h3><div class="meta artist"><img class="avatar" style="width:26px;height:26px" src="${esc(a.avatar_url||'https://i.pravatar.cc/160?u='+a.id)}" onerror="handleImageError(this)"><span>${esc(a.display_name||a.username||'Artist')}</span></div></div><span class="pill">${esc(statusLabel(c.status))}</span></div><div class="client-progress">${statusSteps.map((_,i)=>`<span class="${i<=idx?'active':''}"></span>`).join('')}</div><div class="stats"><span class="stat">${esc(c.currency||'USD')} ${Number(c.total_amount||c.amount||0).toFixed(2)}</span>${c.target_deadline?`<span class="stat ${n<0?'':''}">${esc(formatDeadline(c.target_deadline))}</span>`:''}<span class="stat">${new Date(c.created_at).toLocaleDateString()}</span></div><div class="heroactions" style="margin-top:8px">${approve?`<button class="btn primary" data-client-approve="${c.id}">✓ Approve delivery &amp; complete</button>`:''}${review?`<button class="btn pink" data-client-review="${c.id}">Leave review</button>`:''}${r?`<span class="meta" style="padding:10px 0">✓ Review submitted</span>`:''}</div></article>`;
    }

    async function renderCommissions(){
      const el=document.getElementById('client-space-commissions');if(!el)return;el.innerHTML='<div class="panel"><div class="meta">Loading your commissions…</div></div>';
      const d=window.__lunaristClientData||await getClientData();window.__lunaristClientData=d;
      if(!d.commissions.length){el.innerHTML=`<div class="panel">${emptyState('No commissions yet.','When you commission a Lunarist artist, your orders and completed work will appear here.')}</div>`;return}
      el.innerHTML=`<div class="panel"><div class="eyebrow">Client Portal</div><h2 style="margin:4px 0">My Commissions</h2><p class="meta">Track orders, follow production progress, approve delivered work, and review completed commissions.</p><div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">${d.commissions.map(commissionCard).join('')}</div></div>`;
      el.querySelectorAll('[data-client-approve]').forEach(b=>b.onclick=async()=>{b.disabled=true;const r=await supabaseClient.from('commissions').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',b.dataset.clientApprove).eq('client_id',state.currentUser.id).eq('status','delivered');if(r.error){toast(r.error.message);b.disabled=false;return}toast('Commission completed.');await refreshClientSpace('commissions')});
      el.querySelectorAll('[data-client-review]').forEach(b=>b.onclick=()=>{tab('reviews');setTimeout(()=>startReview(b.dataset.clientReview),0)});
    }

    function renderReviews(){
      const el=document.getElementById('client-space-reviews');if(!el)return;const d=window.__lunaristClientData||{commissions:[],reviews:[]};
      const pending=d.commissions.filter(c=>c.status==='completed'&&(!Array.isArray(c.client_reviews)||!c.client_reviews.length));const avg=d.reviews.length?(d.reviews.reduce((n,r)=>n+Number(r.rating||0),0)/d.reviews.length).toFixed(1):'—';
      el.innerHTML=`<div class="panel"><div class="eyebrow">Client Reviews</div><div class="row" style="justify-content:space-between;align-items:flex-end"><div><h2 style="margin:4px 0">Your reviews</h2><p class="meta">Reviews you have submitted to artists are collected here.</p></div><div style="text-align:right"><div style="color:var(--gold);font-size:20px">${d.reviews.length?'★':'☆'} ${avg}</div><div class="meta">${d.reviews.length} review${d.reviews.length===1?'':'s'}</div></div></div>${d.reviews.length?`<div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">${d.reviews.map(r=>{const a=r.artist||{},s=r.commission?.service?.title||r.commission?.project_title||'Commission';return `<div class="client-review-card"><div class="row"><img class="avatar" style="width:38px;height:38px" src="${esc(a.avatar_url||'https://i.pravatar.cc/160?u='+a.id)}" onerror="handleImageError(this)"><div class="grow"><b>${esc(a.display_name||a.username||'Artist')}</b><div class="meta">${esc(s)} · ${new Date(r.created_at).toLocaleDateString()}</div></div><span class="client-review-stars">${'★'.repeat(Number(r.rating||0))}${'☆'.repeat(5-Number(r.rating||0))}</span></div><p style="margin:10px 0 0;color:var(--muted)">${esc(r.review)}</p></div>`}).join('')}</div>`:'<div class="empty" style="margin-top:16px">You have not published any client reviews yet.</div>'}${pending.length?`<div style="margin-top:20px"><div class="eyebrow">Needs your review</div>${pending.map(c=>`<div class="client-review-card" style="margin-top:8px"><b>${esc(c.service?.title||c.project_title||'Completed commission')}</b><div class="meta">Completed commission · ${esc(c.artist?.display_name||c.artist?.username||'Artist')}</div><button class="btn pink" style="margin-top:10px" data-start-review="${c.id}">Leave review</button></div>`).join('')}</div>`:''}</div>`;
      el.querySelectorAll('[data-start-review]').forEach(b=>b.onclick=()=>startReview(b.dataset.startReview));
    }

    function startReview(id){
      const d=window.__lunaristClientData||{},c=d.commissions?.find(x=>x.id===id);if(!c)return;const el=document.getElementById('client-space-reviews'),host=el?.querySelector('.panel');if(!host)return;const a=c.artist||{};const box=document.createElement('div');box.className='client-review-card';box.style.marginTop='16px';
      box.innerHTML='<div class="eyebrow">Review your completed commission</div><div class="field" style="margin-top:8px"><label>Rating</label><select id="clientReviewRating"><option value="5">★★★★★ — Excellent</option><option value="4">★★★★☆ — Great</option><option value="3">★★★☆☆ — Good</option><option value="2">★★☆☆☆ — Needs work</option><option value="1">★☆☆☆☆ — Poor</option></select></div><div class="field" style="margin-top:8px"><label>Your review</label><textarea id="clientReviewText" placeholder="Tell future clients about your experience…"></textarea></div><div class="heroactions"><button class="btn pink" id="clientReviewSubmit">Publish review</button><button class="btn" id="clientReviewCancel">Cancel</button></div>';
      host.appendChild(box);
      document.getElementById('clientReviewSubmit').onclick=async()=>{const text=document.getElementById('clientReviewText').value.trim(),rating=Number(document.getElementById('clientReviewRating').value||5);if(text.length<10){toast('Please write at least 10 characters.');return}const b=document.getElementById('clientReviewSubmit');b.disabled=true;const r=await supabaseClient.from('client_reviews').insert({commission_id:id,client_id:state.currentUser.id,artist_id:a.id,rating,review:text});if(r.error){toast(r.error.message);b.disabled=false;return}toast('Thank you — your review is published.');await refreshClientSpace('reviews')};
      document.getElementById('clientReviewCancel').onclick=()=>box.remove();
    }

    function renderProfile(){
      const el=document.getElementById('client-space-profile');if(!el)return;const m=state.currentMember||{},url=clientUrl(m);
      el.innerHTML=`<div class="panel"><div class="eyebrow">Edit Client Profile</div><h2 style="margin:4px 0">Customize your profile</h2><p class="meta">Your client profile is stored in Supabase and is separate from member publishing controls.</p><div class="row" style="margin:14px 0 18px"><img class="avatar" style="width:72px;height:72px" id="clientPfAvatarPreview" src="${esc(m.avatar||'')}" onerror="handleImageError(this)"><div><button class="btn" id="clientPfAvatarBtn">Change photo</button><input type="file" id="clientPfAvatarFile" accept="image/*" style="display:none"><div class="meta" id="clientPfAvatarStatus">JPG or PNG, square works best.</div></div></div><div class="client-profile-grid"><div class="field"><label>Display name</label><input id="clientPfName" value="${esc(m.name||'')}"></div><div class="field"><label>Username</label><input id="clientPfUsername" value="${esc(m.username||'')}" maxlength="32"><div class="meta" style="margin-top:5px">Your public page: ${url?`<a href="${esc(url)}" target="_self">${esc(url)}</a>`:'save a username to create your page'}</div></div><div class="field full"><label>Bio</label><textarea id="clientPfBio">${esc(m.bio||'')}</textarea></div><div class="field full" id="clientProfileSocialEditor"></div><div class="field full"><label>Profile Color Scheme</label><div class="theme-picker-grid">${['moonlight','cyberpink','goldember','emeraldglow','midnight'].map(t=>`<button type="button" class="theme-option ${m.theme===t?'selected':''}" data-client-theme="${t}">${t}</button>`).join('')}</div></div></div><div class="heroactions"><button class="btn primary" id="clientSaveProfile">Save profile</button><button class="btn" id="clientSignOut">Sign out</button></div><p class="meta" id="clientProfileMsg"></p></div>`;
      document.querySelectorAll('[data-client-theme]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-client-theme]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');applyTheme(b.dataset.clientTheme)});
      document.getElementById('clientPfAvatarBtn').onclick=()=>document.getElementById('clientPfAvatarFile').click();
      document.getElementById('clientPfAvatarFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/')){toast('Please choose an image file');return}if(f.size>5*1024*1024){toast('Image must be under 5MB');return}const s=document.getElementById('clientPfAvatarStatus');s.textContent='Uploading…';try{const u=await uploadProjectFile(f,'avatar');document.getElementById('clientPfAvatarPreview').src=u;e.target.dataset.uploadedUrl=u;s.textContent='New photo ready — click Save profile to apply.'}catch(err){s.textContent='Upload failed.';toast(err.message||'Could not upload photo')}};
      document.getElementById('clientSaveProfile').onclick=async()=>{const username=document.getElementById('clientPfUsername').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32);if(!username){toast('Username cannot be empty');return}const selected=document.querySelector('[data-client-theme].selected')?.dataset.clientTheme||m.theme||'moonlight';const file=document.getElementById('clientPfAvatarFile');const payload={display_name:document.getElementById('clientPfName').value.trim(),username,bio:document.getElementById('clientPfBio').value.trim(),theme:selected,updated_at:new Date().toISOString()};if(file?.dataset.uploadedUrl)payload.avatar_url=file.dataset.uploadedUrl;const r=await supabaseClient.from('profiles').update(payload).eq('id',state.currentUser.id).select().single();if(r.error){toast(r.error.code==='23505'?'That username is already taken.':r.error.message);return}await refreshUser();toast('Client profile saved');addNav();renderClientSpacePage();tab('profile')};
      document.getElementById('clientSignOut').onclick=async()=>{await supabaseClient.auth.signOut();state.currentUser=null;state.currentMember=null;state.savedIds=new Set();toast('Signed out');goRoute('home')};
    }

    async function clientEugeneRequest(method='GET',body=null){
      if(!state.currentUser)throw Error('Please sign in to Lunarist first.');
      const session=(await supabaseClient.auth.getSession())?.data?.session;
      if(!session?.access_token)throw Error('Please sign in to Lunarist first.');
      const options={method,cache:'no-store',credentials:'include',headers:{Authorization:`Bearer ${session.access_token}`}};
      if(body){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body)}
      const r=await fetch('/api/eugene-connect',options);
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(data?.error||'Eugene Card connection failed.');
      return data;
    }

    function renderEugeneCard(){
      const host=document.getElementById('client-space-eugene-card');if(!host)return;
      host.innerHTML=`<div class="client-eugene-card"><div class="client-eugene-head"><div class="client-eugene-icon" aria-hidden="true">✦</div><div><h2 class="client-eugene-title">Eugene Card</h2><div class="client-eugene-status" id="clientEugeneStatus">Not connected</div></div></div><p class="client-eugene-copy" id="clientEugeneCopy">Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.</p><div class="client-eugene-actions"><button class="btn client-eugene-connect" id="clientEugeneConnectBtn" type="button">Connect Eugene Card</button><button class="btn client-eugene-disconnect" id="clientEugeneDisconnectBtn" type="button" style="display:none">Disconnect</button></div></div>`;
      const connect=document.getElementById('clientEugeneConnectBtn'),disconnect=document.getElementById('clientEugeneDisconnectBtn');
      if(connect&&!connect.dataset.bound){connect.dataset.bound='1';connect.addEventListener('click',()=>{connect.disabled=true;connect.textContent='Opening Eugene Card…'})}
      if(disconnect&&!disconnect.dataset.bound){disconnect.dataset.bound='1';disconnect.addEventListener('click',async()=>{if(!confirm('Disconnect Eugene Card from this Lunarist account?'))return;disconnect.disabled=true;try{await clientEugeneRequest('POST',{action:'disconnect'});await refreshEugeneCard()}catch(e){try{toast(e.message||'Unable to disconnect Eugene Card.')}catch{}}finally{disconnect.disabled=false}})}
      refreshEugeneCard();
    }

    async function refreshEugeneCard(){
      const status=document.getElementById('clientEugeneStatus'),connect=document.getElementById('clientEugeneConnectBtn'),disconnect=document.getElementById('clientEugeneDisconnectBtn'),copy=document.getElementById('clientEugeneCopy');
      if(!status||!connect||!disconnect||!copy)return;
      try{const data=await clientEugeneRequest('GET'),connected=!!data.connected;status.textContent=connected?'Connected':'Not connected';connect.textContent=connected?'Connected to Eugene Card':'Connect Eugene Card';connect.disabled=connected;disconnect.style.display=connected?'':'none';copy.textContent=connected?'Your Lunarist account is linked to Eugene Card. You can disconnect it here at any time.':'Connect your Lunarist account to your Eugene Card account. The connection is private to you and can be removed at any time.'}
      catch{status.textContent='Not connected';connect.disabled=false;connect.textContent='Connect Eugene Card';disconnect.style.display='none'}
    }

    function tab(name){
      const valid=['overview','saved','commissions','reviews','profile','eugene-card'];if(!valid.includes(name))name='overview';
      document.querySelectorAll('[data-client-tab]').forEach(b=>b.classList.toggle('active',b.dataset.clientTab===name));document.querySelectorAll('.client-space-section').forEach(s=>s.classList.toggle('active',s.id==='client-space-'+name));window.__lunaristClientTab=name;
      if(name==='overview')renderOverview();if(name==='saved')renderSaved();if(name==='commissions')renderCommissions();if(name==='reviews')renderReviews();if(name==='profile')renderProfile();if(name==='eugene-card')renderEugeneCard();
    }

    async function refreshClientSpace(active='overview'){if(!state.currentUser){openAuth('signin');return}await refreshUser();if(!isClient()){toast('Client Space is available for User/Client accounts.');return}await loadSavedIds();window.__lunaristClientData=await getClientData();renderClientSpacePage();tab(active)}

    function renderClientSpacePage(){
      const v=document.getElementById('view');if(!v)return;v.innerHTML=clientShell();
      document.querySelectorAll('[data-client-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.clientTab));renderOverview();addNav();
      const copy=document.getElementById('copyClientUrl');if(copy)copy.onclick=async()=>{const u=clientUrl(state.currentMember);try{await navigator.clipboard.writeText(u);toast('Client Space link copied.')}catch(e){toast(u)}};
      document.querySelectorAll('.navbtn[data-route]').forEach(b=>b.classList.remove('active'));document.getElementById('navClientSpaceBtn')?.classList.add('active');
    }

    async function fetchPublicClient(username){if(!supabaseClient)return null;const clean=String(username||'').replace(/^@/,'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32);if(!clean)return null;const {data:m,error}=await supabaseClient.from('profiles').select('id,display_name,username,bio,avatar_url,theme,account_type,is_admin').eq('username',clean).maybeSingle();if(error||!m||m.is_admin||m.account_type==='member')return null;return m}

    async function renderPublicClientProfile(target){
      const v=document.getElementById('view');if(!v)return;v.innerHTML='<div class="container"><section class="section" style="padding-top:70px"><div class="panel"><div class="meta">Loading client profile…</div></div></section></div>';
      let m=typeof target==='object'&&target?target:null;if(!m)m=await fetchPublicClient(target);
      if(!m){v.innerHTML=`<div class="container"><section class="section" style="padding-top:80px"><div class="empty"><strong>Client profile not found.</strong><span>This public username is unavailable or belongs to a Lunarist Member.</span><div class="heroactions" style="justify-content:center"><button class="btn primary" id="publicClientHomeBtn">Back home</button></div></div></section></div>`;document.getElementById('publicClientHomeBtn')?.addEventListener('click',()=>originalGoRoute('home'));return}
      applyTheme(m.theme||'moonlight');const url=clientUrl(m);updateSeoMeta(`${m.display_name||m.username||'Client'} · Client Space`,m.bio||'Lunarist client profile',m.avatar_url||'');
      v.innerHTML=`<div class="container"><section class="section client-public-profile" style="padding-top:70px"><div class="client-public-card panel"><img class="client-public-avatar" src="${esc(m.avatar_url||'')}" onerror="handleImageError(this)" alt="${esc(m.display_name||'Client')}"><div><div class="eyebrow">Lunarist Client</div><h1 style="font-size:48px;margin:4px 0 6px">${esc(m.display_name||'Client')}</h1><div class="client-public-username">@${esc(m.username||'client')}</div>${m.bio?`<p style="margin-top:18px;white-space:pre-wrap;color:var(--muted)">${esc(m.bio)}</p>`:'<p class="meta" style="margin-top:18px">Lunarist client profile.</p>'}<div class="client-public-url">${esc(url)}</div><div class="heroactions" style="margin-top:18px"><button class="btn primary" id="publicClientSpaceBtn">Client Space</button><button class="btn" id="publicClientBackBtn">Discover</button></div></div></div></section></div>`;
      document.getElementById('publicClientSpaceBtn').onclick=()=>{if(state.currentUser&&state.currentUser.id===m.id)openClientSpace('overview');else openAuth('signin')};document.getElementById('publicClientBackBtn').onclick=()=>originalGoRoute('discover');
    }

    function publicClientFromPath(){const s=decodeURIComponent(location.pathname.replace(/^\/+|\/+$/,''));if(!s||s.includes('/')||['discover','artists','services','commissions','admin','clients','api'].includes(s.toLowerCase()))return null;return s}
    function openClientSpace(active='overview'){if(!state.currentUser){openAuth('signin');return}state.route='clients';if(location.pathname!=='/clients')history.pushState({route:'clients'},'', '/clients');return refreshClientSpace(active)}

    window.openClientSpace=openClientSpace;window.refreshClientSpace=refreshClientSpace;window.renderClientSpacePage=renderClientSpacePage;window.setClientSpaceTab=tab;window.renderPublicClientProfile=renderPublicClientProfile;
    window.pathForRoute=function(route){if(route==='clients')return '/clients';if(String(route).startsWith('clientprofile:')){const token=String(route).slice(14);const m=member(token);return m?.username?'/'+encodeURIComponent(m.username):'/'+encodeURIComponent(token)}return originalPath(route)};
    window.routeFromPath=function(){const s=decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g,''));if(s==='clients')return 'clients';const publicName=publicClientFromPath();const localClient=publicName&&clientByUsername(publicName);if(localClient)return 'clientprofile:'+localClient.id;const original=originalRoute();if(original!=='home')return original;return publicName?'clientprofile:'+publicName:original};
    window.goRoute=function(route,replace){if(route==='clients'){state.route='clients';if(location.pathname!=='/clients')history[replace?'replaceState':'pushState']({route:'clients'},'', '/clients');return refreshClientSpace(window.__lunaristClientTab||'overview')}if(String(route).startsWith('clientprofile:')){const token=String(route).slice(14);state.route=route;const m=clientByUsername(token)||member(token);const path=m?.username?'/'+encodeURIComponent(m.username):'/'+encodeURIComponent(token);if(location.pathname!==path)history[replace?'replaceState':'pushState']({route},'',path);return renderPublicClientProfile(m||token)}return originalGoRoute(route,replace)};
    window.render=function(preserve){if(state.route==='clients'){renderClientSpacePage();refreshClientSpace(window.__lunaristClientTab||'overview');return}if(String(state.route).startsWith('clientprofile:')){const token=String(state.route).slice(14);const m=clientByUsername(token)||member(token);renderPublicClientProfile(m||token);return}return originalRender(preserve)};

    const originalOpenDashboard=window.openDashboard;
    if(typeof originalOpenDashboard==='function')window.openDashboard=async function(tabName='overview'){if(isClient())return openClientSpace(tabName==='saved'?'saved':'overview');return originalOpenDashboard(tabName)};
    function cleanMemberDrawer(){const d=document.getElementById('drawer');if(!d)return;d.querySelector('[data-dash="saved"]')?.remove();if(isClient()){d.querySelector('[data-dash="projects"]')?.remove();d.querySelector('[data-dash="services"]')?.remove()}}
    const obs=new MutationObserver(cleanMemberDrawer),drawer=document.getElementById('drawer');if(drawer)obs.observe(drawer,{childList:true,subtree:true});
    const clientVisibility=()=>{addNav();const b=document.getElementById('navClientSpaceBtn'),c=document.getElementById('navCommissionsBtn');if(b)b.style.display=isClient()?'':'none';if(c)c.style.display=isClient()?'none':'';cleanMemberDrawer()};setInterval(clientVisibility,1000);
    window.__lunaristClientSpacePatched=true;addNav();clientVisibility();return true;
  };
  let tries=0;const t=setInterval(()=>{if(boot()||++tries>120)clearInterval(t)},100);window.addEventListener('beforeunload',()=>clearInterval(t));
})();
