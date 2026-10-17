/* Lunarist Client Hub
 * Consolidated client portal: orders, approvals, reviews, saved inspiration,
 * messages, profile settings and the Eugene Card connection tab.
 * All privileged changes still require authenticated Supabase policies/RPCs.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  const boot = () => {
    if (window.__lunaristClientHubInstalled) return true;
    if (!window.state || typeof window.render !== 'function' ||
        typeof window.goRoute !== 'function' || typeof window.pathForRoute !== 'function' ||
        typeof window.routeFromPath !== 'function') return false;

    const base = {
      render: window.render,
      goRoute: window.goRoute,
      pathForRoute: window.pathForRoute,
      routeFromPath: window.routeFromPath,
      openDashboard: window.openDashboard,
      updatePrimaryNavVisibility: window.updatePrimaryNavVisibility,
      updateAccountButton: window.updateAccountButton
    };
    const hub = {
      tab: 'overview', filter: 'all', search: '', loading: false, loaded: false,
      requestId: 0, commissions: [], reviews: [], commissionError: '', reviewError: '',
      reviewFor: null, detailFor: null, histories: {}, historyLoading: {}, historyError: {},
      savingProfile: false, profileNotice: '',
      tabs: ['overview', 'orders', 'saved', 'messages', 'reviews', 'profile', 'eugene-card']
    };

    const rootStyle = document.createElement('style');
    rootStyle.id = 'lunarist-client-hub-styles';
    rootStyle.textContent = `
      .lunarist-client-hub{--lch-border:var(--line,rgba(255,255,255,.1));--lch-panel:rgba(255,255,255,.035);--lch-panel-strong:rgba(255,255,255,.06);--lch-purple:#bda8ff;--lch-pink:#ff9bd1;max-width:1320px;margin:0 auto}
      .lunarist-client-hub *{box-sizing:border-box}.lch-hero{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:center;padding:clamp(22px,4vw,38px);border:1px solid rgba(189,168,255,.22);border-radius:28px;background:radial-gradient(ellipse at 88% 0%,rgba(165,133,255,.2),transparent 36%),radial-gradient(ellipse at 5% 100%,rgba(255,155,209,.1),transparent 32%),linear-gradient(135deg,rgba(28,23,45,.88),rgba(16,15,24,.92));box-shadow:0 24px 70px rgba(0,0,0,.18)}
      .lch-hero:after{content:"";position:absolute;z-index:-1;width:210px;height:210px;right:-90px;bottom:-135px;border:1px solid rgba(255,255,255,.08);border-radius:50%;box-shadow:0 0 0 26px rgba(255,255,255,.018),0 0 0 54px rgba(255,255,255,.012)}
      .lch-overline{font:700 10px/1.4 'DM Mono',monospace;letter-spacing:.17em;text-transform:uppercase;color:var(--lch-purple)}.lch-hero h1{font-size:clamp(30px,4vw,48px);line-height:1.03;letter-spacing:-.055em;margin:9px 0 12px}.lch-lede{margin:0;color:var(--muted);font-size:14px;line-height:1.65;max-width:660px}.lch-hero-person{display:flex;align-items:center;gap:14px;min-width:0}.lch-hero-avatar{width:62px;height:62px;flex:0 0 62px;object-fit:cover;border:1px solid rgba(255,255,255,.22);border-radius:20px;background:rgba(255,255,255,.05)}.lch-hero-copy{min-width:0}.lch-hero-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:19px}.lch-profile-link{display:flex;align-items:center;gap:10px;justify-content:space-between;min-width:260px;max-width:340px;border:1px solid rgba(255,255,255,.11);border-radius:15px;background:rgba(0,0,0,.16);padding:13px 14px}.lch-profile-link-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:12px}.lch-copy-btn{white-space:nowrap;flex-shrink:0}
      .lch-workspace{min-width:0}.lch-tabs{display:flex;gap:7px;overflow-x:auto;padding:2px 1px 9px;margin:16px 0 12px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:thin}.lch-tabs .lch-tab{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:45px;flex:0 0 auto;white-space:nowrap;padding:10px 15px;border:1px solid var(--lch-border);border-radius:14px;background:var(--lch-panel);color:var(--muted);font-weight:800;font-size:12px;transition:background .18s,border-color .18s,color .18s;scroll-snap-align:start}.lch-tabs .lch-tab:hover{color:var(--text);border-color:rgba(189,168,255,.4)}.lch-tabs .lch-tab.active{background:linear-gradient(135deg,rgba(189,168,255,.17),rgba(255,155,209,.09));color:var(--text);border-color:rgba(189,168,255,.45);box-shadow:0 5px 22px rgba(0,0,0,.12)}.lch-tab-count{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:rgba(255,155,209,.16);color:var(--text);font-size:10px}
      .lunarist-client-hub .client-space-section{display:none;min-width:0}.lunarist-client-hub .client-space-section.active{display:block;animation:lch-in .18s ease-out}@keyframes lch-in{from{opacity:.55;transform:translateY(3px)}to{opacity:1;transform:none}}
      .lch-panel{min-width:0;border:1px solid var(--lch-border);border-radius:22px;padding:clamp(16px,2vw,23px);background:var(--lch-panel);box-shadow:0 12px 40px rgba(0,0,0,.09)}.lch-panel+.lch-panel{margin-top:14px}.lch-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:15px}.lch-section-head h2,.lch-section-head h3{margin:4px 0 0;font-size:clamp(20px,2.5vw,27px);letter-spacing:-.04em}.lch-muted{color:var(--muted);font-size:12px;line-height:1.6}.lch-overview-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(270px,.65fr);gap:14px;align-items:start}.lch-action-list{display:grid;gap:9px}.lch-action{display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid var(--lch-border);border-radius:16px;background:var(--lch-panel)}.lch-action-icon{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border-radius:12px;background:rgba(189,168,255,.1);color:var(--lch-purple);font-size:15px}.lch-action-body{min-width:0;flex:1}.lch-action-body strong{display:block;font-size:13px;line-height:1.45}.lch-action-body p{margin:4px 0 10px;color:var(--muted);font-size:11px;line-height:1.5}.lch-action-body .btn{min-height:36px;padding:8px 12px;font-size:11px}
      .lch-order-list{display:grid;gap:11px}.lch-order{min-width:0;border:1px solid var(--lch-border);border-radius:20px;background:var(--lch-panel);overflow:hidden;transition:border-color .18s,transform .18s}.lch-order:hover{border-color:rgba(189,168,255,.27)}.lch-order-main{display:grid;grid-template-columns:76px minmax(0,1fr) auto;gap:15px;align-items:start;padding:17px}.lch-order-thumb{width:76px;height:76px;object-fit:cover;border-radius:15px;background:rgba(255,255,255,.04);border:1px solid var(--lch-border)}.lch-order-title{margin:1px 0 6px;font-size:16px;letter-spacing:-.025em;line-height:1.35}.lch-order-artist{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:11px;min-width:0}.lch-order-artist img{width:23px;height:23px;object-fit:cover;border-radius:50%;flex:0 0 23px}.lch-order-artist button{padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lch-order-status{display:inline-flex;align-items:center;gap:6px;width:max-content;max-width:100%;border:1px solid var(--lch-border);border-radius:999px;padding:6px 9px;font-size:10px;font-weight:800;white-space:nowrap}.lch-order-status:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}.lch-order-status.is-attention{color:#ffd98d;border-color:rgba(255,217,141,.28);background:rgba(255,217,141,.06)}.lch-order-status.is-progress{color:#c7b7ff;border-color:rgba(189,168,255,.24);background:rgba(189,168,255,.06)}.lch-order-status.is-done{color:#a5e7cf;border-color:rgba(107,218,177,.24);background:rgba(107,218,177,.06)}.lch-order-status.is-closed{color:var(--muted)}.lch-order-metrics{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.lch-metric{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid var(--lch-border);border-radius:10px;font-size:10px;color:var(--muted);background:rgba(255,255,255,.018)}.lch-metric b{color:var(--text);font-weight:800}.lch-progress{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:0 17px 13px}.lch-progress-step{height:4px;border-radius:999px;background:rgba(255,255,255,.09)}.lch-progress-step.active{background:linear-gradient(90deg,var(--lch-purple),var(--lch-pink))}.lch-progress-labels{display:flex;justify-content:space-between;gap:8px;padding:0 17px 15px;color:var(--muted);font-size:9px}.lch-order-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 17px;border-top:1px solid var(--lch-border);background:rgba(0,0,0,.08)}.lch-order-footer-left{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.lch-order-footer .btn{min-height:37px;padding:8px 12px;font-size:11px}.lch-inline-detail{border-top:1px solid var(--lch-border);padding:17px;background:rgba(0,0,0,.08)}.lch-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lch-detail-block{min-width:0;padding:12px;border-radius:13px;border:1px solid var(--lch-border);background:rgba(255,255,255,.02)}.lch-detail-block h4{margin:0 0 7px;font-size:11px;color:var(--muted)}.lch-detail-value{font-size:12px;line-height:1.55;overflow-wrap:anywhere}.lch-history{display:grid;gap:0}.lch-history-item{display:grid;grid-template-columns:14px minmax(0,1fr);gap:9px;padding-bottom:12px;position:relative}.lch-history-item:not(:last-child):before{content:"";position:absolute;left:5px;top:11px;bottom:0;border-left:1px solid var(--lch-border)}.lch-history-dot{width:11px;height:11px;margin-top:2px;border-radius:50%;background:var(--lch-purple);border:2px solid rgba(189,168,255,.22);z-index:1}.lch-history-item b{display:block;font-size:11px}.lch-history-item small{display:block;color:var(--muted);font-size:10px;margin-top:2px}
      .lch-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}.lch-search{min-width:180px;flex:1;max-width:360px;padding:11px 13px;border:1px solid var(--lch-border);border-radius:13px;background:rgba(255,255,255,.035);color:var(--text);font:inherit;font-size:12px}.lch-filter-row{display:flex;gap:6px;flex-wrap:wrap}.lch-filter{border:1px solid var(--lch-border);border-radius:999px;background:transparent;color:var(--muted);padding:8px 11px;font-size:10px;font-weight:800}.lch-filter.active{color:var(--text);border-color:rgba(189,168,255,.42);background:rgba(189,168,255,.1)}
      .lch-review-list,.lch-saved-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lch-review-card{min-width:0;padding:17px;border:1px solid var(--lch-border);border-radius:18px;background:var(--lch-panel)}.lch-review-top{display:flex;align-items:center;gap:10px}.lch-review-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover}.lch-stars{color:#f2d38e;letter-spacing:1px}.lch-review-text{white-space:pre-wrap;color:var(--muted);font-size:12px;line-height:1.65;margin:12px 0 0;overflow-wrap:anywhere}.lch-review-form{margin-top:12px;padding:16px;border:1px solid rgba(189,168,255,.24);border-radius:17px;background:rgba(189,168,255,.045)}.lch-rating-select,.lch-field{width:100%;min-height:44px;padding:11px 12px;border:1px solid var(--lch-border);border-radius:12px;background:rgba(255,255,255,.035);color:var(--text);font:inherit;font-size:12px}.lch-field{display:block}.lch-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lch-form-field{display:grid;gap:6px;min-width:0}.lch-form-field label{color:var(--muted);font-size:11px;font-weight:700}.lch-form-field.full{grid-column:1/-1}.lch-field-area{min-height:110px;resize:vertical;line-height:1.5}.lch-rating{display:flex;gap:5px}.lch-rating button{width:38px;height:38px;border-radius:11px;border:1px solid var(--lch-border);background:rgba(255,255,255,.03);color:var(--muted);font-size:19px}.lch-rating button.selected{color:#f2d38e;border-color:rgba(242,211,142,.4);background:rgba(242,211,142,.08)}
      .lch-empty,.lch-loading,.lch-error{padding:36px 20px;border:1px dashed var(--lch-border);border-radius:19px;text-align:center}.lch-empty-icon{display:grid;place-items:center;width:48px;height:48px;margin:0 auto 12px;border:1px solid var(--lch-border);border-radius:16px;background:var(--lch-panel);font-size:20px}.lch-empty h3{margin:0 0 6px;font-size:17px}.lch-empty p,.lch-loading p,.lch-error p{max-width:470px;margin:0 auto 14px;color:var(--muted);font-size:12px;line-height:1.6}.lch-skeleton{height:118px;border-radius:17px;border:1px solid var(--lch-border);background:linear-gradient(100deg,rgba(255,255,255,.025) 20%,rgba(255,255,255,.065) 40%,rgba(255,255,255,.025) 60%);background-size:220% 100%;animation:lch-shimmer 1.2s ease-in-out infinite}@keyframes lch-shimmer{to{background-position:-220% 0}}
      .lch-avatar-edit{display:flex;gap:14px;align-items:center}.lch-profile-avatar{width:82px;height:82px;object-fit:cover;border-radius:22px;border:1px solid var(--lch-border)}.lch-profile-linkline{font-size:11px;color:var(--muted);overflow-wrap:anywhere;margin-top:4px}.lch-notice{font-size:12px;line-height:1.5;margin-top:10px;color:var(--lch-purple)}.lch-notice.error{color:#ffabb7}.lch-flash{position:sticky;top:10px;z-index:3;padding:11px 14px;border-radius:12px;border:1px solid var(--lch-border);background:rgba(27,23,39,.95);font-size:12px;margin-bottom:10px}
      #navClientSpaceBtn{display:none}.lunarist-client-hub-active #navClientSpaceBtn{display:inline-flex;color:var(--text);background:rgba(189,168,255,.09);border-color:rgba(189,168,255,.2)}
      @media(max-width:950px){.lch-overview-grid{grid-template-columns:1fr}.lch-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:680px){.lch-hero{grid-template-columns:1fr;gap:20px;padding:21px;border-radius:22px}.lch-hero h1{font-size:36px}.lch-hero-actions{flex-direction:column;align-items:stretch}.lch-profile-link{min-width:0;max-width:none;width:100%}.lch-order-main{grid-template-columns:58px minmax(0,1fr);gap:12px;padding:14px}.lch-order-thumb{width:58px;height:58px;border-radius:12px}.lch-order-status-wrap{grid-column:2}.lch-order-status-wrap .lch-order-status{margin-top:1px}.lch-order-title{font-size:14px}.lch-order-metrics{margin-top:9px}.lch-progress{padding:0 14px 11px}.lch-progress-labels{padding:0 14px 12px}.lch-order-footer{align-items:stretch;padding:12px 14px}.lch-order-footer-left{width:100%;font-size:10px}.lch-order-footer .btn{flex:1}.lch-review-list,.lch-saved-grid{grid-template-columns:1fr}.lch-detail-grid,.lch-form-grid{grid-template-columns:1fr}.lch-form-field.full{grid-column:auto}.lch-tabs{margin:12px -2px 11px}.lch-tabs .lch-tab{min-height:44px;padding:10px 12px}.lch-section-head{align-items:flex-start;flex-direction:column}.lch-toolbar{align-items:stretch}.lch-search{max-width:none;width:100%}}
      @media(max-width:380px){.lch-stats{gap:7px}.lch-stat{padding:12px}.lch-stat strong{font-size:23px}.lch-order-footer .btn{padding:8px 9px;font-size:10px}}
      @media(prefers-reduced-motion:reduce){.lunarist-client-hub .client-space-section.active,.lch-skeleton{animation:none!important}.lch-order,.lch-tabs .lch-tab{transition:none!important}}
    `;
    document.head.appendChild(rootStyle);

    const qs = (sel, root=document) => root.querySelector(sel);
    const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const clientRole = m => !!m && !m.is_admin && String(m.account_type || 'user') !== 'member';
    const isClient = () => clientRole(state.currentMember);
    const activeOrders = () => hub.commissions.filter(c => !['completed','cancelled','declined','archived'].includes(String(c.status||'').toLowerCase()));
    const needsApproval = () => hub.commissions.filter(c => c.status === 'delivered');
    const needsReview = () => hub.commissions.filter(c => c.status === 'completed' && !firstReview(c));
    const firstReview = c => Array.isArray(c?.client_reviews) ? c.client_reviews[0] : null;
    const clientUrl = m => m?.username ? `${location.origin}/${encodeURIComponent(m.username)}` : '';
    const normalizedStatus = c => String(c?.status || 'requested').toLowerCase();
    const STATUS = {
      waitlist:['Waitlist','attention',0], requested:['Requested','attention',0], new:['New request','attention',0], contacted:['Contacted','attention',0], accepted:['Accepted','attention',0],
      unpaid:['Payment pending','attention',0], pending_payment:['Payment pending','attention',0], paid:['Paid','progress',1],
      wip1:['In progress','progress',2], wip2:['In progress','progress',2], wip3:['In progress','progress',2], in_progress:['In progress','progress',2], revisions:['Revision requested','attention',2],
      delivered:['Delivered · review needed','attention',3], completed:['Completed','done',4], cancelled:['Cancelled','closed',-1], declined:['Declined','closed',-1], archived:['Archived','closed',-1], disputed:['Under review','attention',2]
    };
    const statusInfo = c => STATUS[normalizedStatus(c)] || [String(c?.status||'Requested').replace(/[_-]/g,' ').replace(/^./,x=>x.toUpperCase()),'closed',0];
    const statusLabel = c => statusInfo(c)[0];
    const progressIndex = c => statusInfo(c)[2];
    const money = c => {
      const amount = Number(c?.total_amount ?? c?.amount ?? 0);
      const currency = String(c?.currency || 'USD').toUpperCase();
      try { return new Intl.NumberFormat(state.language === 'ja' ? 'ja-JP' : undefined,{style:'currency',currency,maximumFractionDigits:2}).format(Number.isFinite(amount)?amount:0); }
      catch (_) { return `${currency} ${(Number.isFinite(amount)?amount:0).toFixed(2)}`; }
    };
    const dateLabel = value => { if(!value)return 'Date not set';const d=new Date(value);return Number.isNaN(d.getTime())?'Date not set':d.toLocaleDateString(state.language==='ja'?'ja-JP':undefined,{year:'numeric',month:'short',day:'numeric'}); };
    const deadline = value => {
      if(!value)return {label:'No deadline',tone:''};
      const end = new Date(`${String(value).slice(0,10)}T23:59:59`);
      if(Number.isNaN(end.getTime()))return {label:'No deadline',tone:''};
      const days = Math.ceil((end.getTime()-Date.now())/86400000);
      if(days < 0)return {label:`${Math.abs(days)} day${Math.abs(days)===1?'':'s'} overdue`,tone:'late'};
      if(days === 0)return {label:'Due today',tone:'soon'};
      if(days === 1)return {label:'Due tomorrow',tone:'soon'};
      return {label:`Due in ${days} days`,tone:days<=3?'soon':''};
    };
    const nameOfArtist = c => c?.artist?.display_name || c?.artist?.username || 'Lunarist artist';
    const titleOfOrder = c => c?.service?.title || c?.project_title || 'Creative commission';
    const imageForOrder = c => c?.service?.thumbnail_url || c?.artist?.avatar_url || '';
    const avatarFallback = id => `https://i.pravatar.cc/160?u=${encodeURIComponent(id || 'lunarist')}`;
    const callToast = msg => { if(typeof window.toast==='function')window.toast(msg); else console.info(msg); };

    function setNotice(message, isError=false) {
      hub.profileNotice = message ? {message, isError} : null;
      const el = qs('#lch-global-notice');
      if (el) {
        el.textContent = message || '';
        el.classList.toggle('error', !!isError);
        el.hidden = !message;
      }
    }

    function addNav() {
      const nav = document.getElementById('navlinks');
      if (!nav) return;
      let button = document.getElementById('navClientSpaceBtn');
      if (!button) {
        button = document.createElement('button');
        button.type = 'button'; button.className = 'navbtn'; button.id = 'navClientSpaceBtn';
        button.dataset.clientRoute = 'clients'; button.textContent = state.language === 'ja' ? 'クライアントハブ' : 'Client Hub';
        const admin = document.getElementById('navAdminBtn');
        nav.insertBefore(button, admin || null);
        button.addEventListener('click', () => { nav.classList.remove('open'); openClientHub('overview'); });
      }
      syncNav();
    }
    function syncNav() {
      const b = document.getElementById('navClientSpaceBtn');
      if (!b) return;
      const visible = !!state.currentUser && isClient();
      b.style.display = visible ? 'inline-flex' : 'none'; b.hidden = !visible;
      b.setAttribute('aria-hidden', visible ? 'false' : 'true');
      b.classList.toggle('active', state.route === 'clients');
      document.body.classList.toggle('lunarist-client-hub-active', state.route === 'clients');
    }

    function tabButton(tab, label, icon, count='') {
      return `<button type="button" class="lch-tab filter ${hub.tab===tab?'active':''}" data-client-tab="${tab}" data-tab-count="${tab}" role="tab" aria-selected="${hub.tab===tab?'true':'false'}"><span aria-hidden="true">${icon}</span><span>${label}</span>${count?`<span class="lch-tab-count">${count}</span>`:''}</button>`;
    }

    function shell() {
      const m = state.currentMember || {};
      const publicUrl = clientUrl(m);
      const active = activeOrders().length;
      const approval = needsApproval().length;
      const review = needsReview().length;
      return `<div class="container lunarist-client-hub" id="lunarist-client-hub"><section class="section" style="padding-top:clamp(22px,4vw,55px)">
        <div id="lch-global-notice" class="lch-flash" hidden aria-live="polite"></div>
        <header class="lch-hero"><div class="lch-hero-copy"><div class="lch-overline">Your Lunarist workspace</div><h1 id="lch-greeting">Good to see you, ${esc(m.name||'creator')}.</h1><p class="lch-lede">Keep commissions moving, collect inspiration, and stay connected to the artists bringing your ideas to life.</p><div class="lch-hero-actions"><button type="button" class="btn primary" data-lch-action="explore-services">Explore services <span aria-hidden="true">↗</span></button><button type="button" class="btn" data-client-tab="orders">View my orders</button></div></div><div class="lch-hero-side"><div class="lch-hero-person"><img class="lch-hero-avatar" id="lch-hero-avatar" src="${esc(m.avatar||avatarFallback(m.id))}" onerror="handleImageError(this)" alt=""><div><div class="lch-overline">Client account</div><strong id="lch-account-name">${esc(m.name||'Client')}</strong><div class="lch-muted" id="lch-account-username">@${esc(m.username||'client')}</div></div></div>${publicUrl?`<div class="lch-profile-link" style="margin-top:18px"><div style="min-width:0"><div class="lch-overline" style="letter-spacing:.1em">Your public page</div><div class="lch-profile-link-value" id="lch-profile-url">${esc(publicUrl)}</div></div><button type="button" class="btn lch-copy-btn" data-lch-action="copy-profile">Copy</button></div>`:''}</div></header>
        <div class="lch-stats" aria-label="Client activity"><div class="lch-stat"><div class="lch-stat-top"><span>Active orders</span><span class="lch-stat-icon">◷</span></div><strong id="lch-active-count">${active}</strong><small>Projects currently underway</small></div><div class="lch-stat"><div class="lch-stat-top"><span>Awaiting you</span><span class="lch-stat-icon">✦</span></div><strong id="lch-approval-count">${approval}</strong><small>Deliveries ready for review</small></div><div class="lch-stat"><div class="lch-stat-top"><span>Saved inspiration</span><span class="lch-stat-icon">⌑</span></div><strong id="lch-saved-count">${state.savedIds?.size||0}</strong><small>Ideas kept close</small></div><div class="lch-stat"><div class="lch-stat-top"><span>Your reviews</span><span class="lch-stat-icon">☆</span></div><strong id="lch-reviews-count">${hub.reviews.length}</strong><small>Experiences shared with artists</small></div></div>
        <div class="lch-workspace"><nav class="lch-tabs" id="clientSpaceTabs" role="tablist" aria-label="Client Hub sections">${tabButton('overview','Overview','⌂')}${tabButton('orders','Orders','▣',approval?String(approval):'')}${tabButton('saved','Saved','⌑')}${tabButton('messages','Messages','✉')}${tabButton('reviews','Reviews','☆',review?String(review):'')}${tabButton('profile','Profile','⚙')}</nav>
          <section class="client-space-section ${hub.tab==='overview'?'active':''}" id="client-space-overview" data-client-panel="overview" role="tabpanel"></section>
          <section class="client-space-section ${hub.tab==='orders'?'active':''}" id="client-space-orders" data-client-panel="orders" role="tabpanel"></section>
          <section class="client-space-section ${hub.tab==='saved'?'active':''}" id="client-space-saved" data-client-panel="saved" role="tabpanel"></section>
          <section class="client-space-section ${hub.tab==='messages'?'active':''}" id="client-space-messages" data-client-panel="messages" role="tabpanel"><div id="dash-messages"></div></section>
          <section class="client-space-section ${hub.tab==='reviews'?'active':''}" id="client-space-reviews" data-client-panel="reviews" role="tabpanel"></section>
          <section class="client-space-section ${hub.tab==='profile'?'active':''}" id="client-space-profile" data-client-panel="profile" role="tabpanel"></section>
        </div></section></div>`;
    }

    function ensureShell() {
      const view = document.getElementById('view');
      if (!view) return null;
      if (!document.getElementById('lunarist-client-hub')) view.innerHTML = shell();
      const root = document.getElementById('lunarist-client-hub');
      if (!root) return null;
      attachRootEvents(root);
      updateTabChrome();
      return root;
    }

    function attachRootEvents(root) {
      if (root.dataset.clientHubBound === '1') return;
      root.dataset.clientHubBound = '1';
      root.addEventListener('click', async event => {
        const tab = event.target.closest('[data-client-tab]');
        if (tab && root.contains(tab)) { event.preventDefault(); setTab(tab.dataset.clientTab); return; }
        const action = event.target.closest('[data-lch-action]');
        if (!action || !root.contains(action)) return;
        event.preventDefault();
        const name = action.dataset.lchAction;
        if (name === 'explore-services') { base.goRoute('services'); return; }
        if (name === 'copy-profile') { const m=state.currentMember||{};const url=clientUrl(m);try{await navigator.clipboard.writeText(url);callToast('Client profile link copied.')}catch(_){callToast(url)}return; }
        if (name === 'refresh') { await refreshHub(hub.tab); return; }
        if (name === 'details') { const id=action.dataset.orderId;hub.detailFor=hub.detailFor===id?null:id;renderOrders();if(hub.detailFor===id)loadHistory(id);return; }
        if (name === 'approve') { await approveOrder(action.dataset.orderId,action);return; }
        if (name === 'review') { hub.reviewFor=action.dataset.orderId;setTab('reviews');return; }
        if (name === 'artist') { const c=hub.commissions.find(x=>x.id===action.dataset.orderId);const id=c?.artist_id||c?.artist?.id;if(id)base.goRoute('member:'+id);return; }
        if (name === 'message-artist') { await messageArtist(action.dataset.orderId);return; }
        if (name === 'remove-review-form') { hub.reviewFor=null;renderReviews();return; }
        if (name === 'submit-review') { await submitReview(action.dataset.orderId,root);return; }
        if (name === 'cancel-profile') { renderProfile();return; }
        if (name === 'choose-avatar') { qs('#lch-avatar-file',root)?.click();return; }
        if (name === 'sign-out') { await signOut();return; }
        if (name === 'edit-profile') { setTab('profile');return; }
      });
      root.addEventListener('input', event => {
        if (event.target.matches('[data-lch-search]')) { const value=event.target.value||'',start=event.target.selectionStart,end=event.target.selectionEnd;hub.search=value;renderOrders(false);const next=qs('[data-lch-search]',root);if(next){next.focus({preventScroll:true});try{next.setSelectionRange(start,end);}catch(_){}} }
      });
      root.addEventListener('click', event => {
        const filter=event.target.closest('[data-lch-filter]');
        if(filter&&root.contains(filter)){hub.filter=filter.dataset.lchFilter||'all';renderOrders();}
        const rating=event.target.closest('[data-lch-rating]');
        if(rating&&root.contains(rating)){hub.rating=Number(rating.dataset.lchRating)||5;qsa('[data-lch-rating]',root).forEach(b=>{const selected=Number(b.dataset.lchRating)<=hub.rating;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected?'true':'false')});}
      });
      root.addEventListener('submit', event => {
        if(event.target.matches('[data-lch-profile-form]')){event.preventDefault();saveProfile(root);return;}
        if(event.target.matches('[data-lch-review-form]')){event.preventDefault();submitReview(event.target.dataset.lchReviewForm,root);}
      });
    }

    function updateSummary() {
      const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value);};
      const person=state.currentMember||{};
      set('lch-greeting',`Good to see you, ${person.name||'creator'}.`);
      set('lch-account-name',person.name||'Client');set('lch-account-username',`@${person.username||'client'}`);
      const avatar=qs('#lch-hero-avatar');if(avatar)avatar.src=person.avatar||avatarFallback(person.id);
      set('lch-profile-url',clientUrl(person));
      const nav=document.getElementById('navClientSpaceBtn');if(nav)nav.textContent=state.language==='ja'?'クライアントハブ':'Client Hub';
      set('lch-active-count',activeOrders().length);set('lch-approval-count',needsApproval().length);set('lch-saved-count',state.savedIds?.size||0);set('lch-reviews-count',hub.reviews.length);
      qsa('#clientSpaceTabs [data-tab-count]').forEach(button=>{
        const tab=button.dataset.tabCount;
        const count=tab==='orders'?needsApproval().length:tab==='reviews'?needsReview().length:0;
        let badge=button.querySelector('.lch-tab-count');
        if(count>0&&!badge){badge=document.createElement('span');badge.className='lch-tab-count';button.appendChild(badge);}
        if(badge){badge.textContent=String(count);badge.hidden=count===0;}
      });
    }
    function updateTabChrome() {
      const root=document.getElementById('lunarist-client-hub');if(!root)return;
      qsa('#clientSpaceTabs [data-client-tab]',root).forEach(b=>{const on=b.dataset.clientTab===hub.tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');});
      qsa('.client-space-section',root).forEach(s=>s.classList.toggle('active',s.id===`client-space-${hub.tab}`));
      updateSummary();syncNav();
    }

    function setTab(name) {
      if (!hub.tabs.includes(name)) name='overview';
      hub.tab=name;updateTabChrome();
      if(name==='overview')renderOverview();
      if(name==='orders')renderOrders();
      if(name==='saved')renderSaved();
      if(name==='messages')renderMessages();
      if(name==='reviews')renderReviews();
      if(name==='profile')renderProfile();
      if(name==='eugene-card') { /* Eugene Card connection UI is provided by its isolated integration module. */ }
      window.__lunaristClientTab=name;
      qs('#lunarist-client-hub')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    }

    function showLoading(targetId, count=2) {
      const el=document.getElementById(targetId);if(!el)return;
      el.innerHTML=`<div class="lch-loading"><div class="lch-skeleton" style="margin-bottom:10px"></div>${count>1?'<div class="lch-skeleton"></div>':''}</div>`;
    }
    function empty(icon,title,description,actionHtml='') {
      return `<div class="lch-empty"><div class="lch-empty-icon" aria-hidden="true">${icon}</div><h3>${title}</h3><p>${description}</p>${actionHtml}</div>`;
    }
    function renderError(targetId, title, errorText, retry=true) {
      const el=document.getElementById(targetId);if(!el)return;
      el.innerHTML=`<div class="lch-error"><div class="lch-empty-icon" aria-hidden="true">!</div><h3>${esc(title)}</h3><p>${esc(errorText||'Please try again in a moment.')}</p>${retry?'<button type="button" class="btn" data-lch-action="refresh">Try again</button>':''}</div>`;
    }
    function recServices() {
      const savedProjects=(data.projects||[]).filter(p=>state.savedIds?.has(p.id));
      const terms=new Set();savedProjects.forEach(p=>{if(p.category)terms.add(String(p.category).toLowerCase());(p.tags||[]).forEach(t=>terms.add(String(t).toLowerCase()))});
      const candidates=(data.services||[]).filter(s=>s.status==='published'||s.published!==false);
      const scored=candidates.map(s=>{const text=[s.category,s.title,s.description,...(s.tags||[])].join(' ').toLowerCase();let score=0;terms.forEach(t=>{if(t&&text.includes(t))score+=2});if(s.member&&savedProjects.some(p=>p.member===s.member))score+=2;return {service:s,score}}).sort((a,b)=>b.score-a.score);
      return (terms.size?scored.filter(x=>x.score>0):scored).slice(0,3).map(x=>x.service);
    }

    function renderOverview() {
      const el=document.getElementById('client-space-overview');if(!el)return;
      if(hub.loading&&!hub.loaded){showLoading(el.id,2);return;}
      if(hub.commissionError&&!hub.loaded){renderError(el.id,'Your workspace is unavailable',hub.commissionError);return;}
      const active=activeOrders();
      const approvals=needsApproval();
      const reviews=needsReview();
      const next=active.filter(c=>c.target_deadline).sort((a,b)=>String(a.target_deadline).localeCompare(String(b.target_deadline))).slice(0,3);
      const actions=[];
      if(approvals.length)actions.push(`<div class="lch-action"><div class="lch-action-icon">✦</div><div class="lch-action-body"><strong>${approvals.length} delivery${approvals.length===1?'':'ies'} ready for your review</strong><p>Check the artist's delivery and mark the commission complete when you're happy with the result.</p><button class="btn primary" type="button" data-client-tab="orders">Review delivery</button></div></div>`);
      if(reviews.length)actions.push(`<div class="lch-action"><div class="lch-action-icon">☆</div><div class="lch-action-body"><strong>${reviews.length} completed commission${reviews.length===1?'':'s'} awaiting a review</strong><p>Your feedback helps future clients find artists they can trust.</p><button class="btn" type="button" data-client-tab="reviews">Write a review</button></div></div>`);
      if(!actions.length)actions.push(`<div class="lch-action"><div class="lch-action-icon">☾</div><div class="lch-action-body"><strong>You're all caught up.</strong><p>Explore services for your next idea or save projects that inspire you.</p><button class="btn" type="button" data-lch-action="explore-services">Explore services ↗</button></div></div>`);
      const recs=recServices();
      el.innerHTML=`<div class="lch-overview-grid"><div class="lch-panel"><div class="lch-section-head"><div><div class="lch-overline">Your next steps</div><h2>Action centre</h2></div><button type="button" class="btn" data-lch-action="refresh">↻ Refresh</button></div><div class="lch-action-list">${actions.join('')}</div>${next.length?`<div style="margin-top:23px"><div class="lch-section-head"><div><div class="lch-overline">On the horizon</div><h3>Upcoming deadlines</h3></div><button type="button" class="btn" data-client-tab="orders">All orders</button></div><div class="lch-action-list">${next.map(c=>{const due=deadline(c.target_deadline);return `<div class="lch-action"><div class="lch-action-icon">◷</div><div class="lch-action-body"><strong>${esc(titleOfOrder(c))}</strong><p>${esc(nameOfArtist(c))} · ${esc(due.label)}</p><span class="lch-order-status ${due.tone==='late'?'is-attention':''}">${esc(statusLabel(c))}</span></div></div>`}).join('')}</div></div>`:''}</div><aside class="lch-panel"><div class="lch-overline">A little inspiration</div><h3 style="margin:5px 0 6px;font-size:20px;letter-spacing:-.03em">Find what comes next.</h3><p class="lch-muted" style="margin:0 0 15px">Discover new work or keep a few references ready for your next brief.</p><button type="button" class="btn primary" data-lch-action="explore-services" style="width:100%">Browse services ↗</button><button type="button" class="btn" data-client-tab="saved" style="width:100%;margin-top:8px">Open saved projects</button></aside></div>${recs.length?`<div class="lch-panel" style="margin-top:14px"><div class="lch-section-head"><div><div class="lch-overline">Selected for you</div><h3>Services worth a look</h3><div class="lch-muted">A starting point for your next creative collaboration.</div></div><button type="button" class="btn" data-lch-action="explore-services">See all</button></div><div class="lch-saved-grid">${recs.map(s=>serviceCard(s)).join('')}</div></div>`:''}`;
      bindProjectAndServiceCards(el);
    }

    function renderSaved() {
      const el=document.getElementById('client-space-saved');if(!el)return;
      const saved=(data.projects||[]).filter(p=>state.savedIds?.has(p.id));
      const recs=recServices();
      el.innerHTML=`<div class="lch-panel"><div class="lch-section-head"><div><div class="lch-overline">Your collection</div><h2>Saved inspiration</h2><p class="lch-muted">Project references you've bookmarked while exploring Lunarist.</p></div><button type="button" class="btn" data-lch-action="explore-services">Explore more ↗</button></div>${saved.length?`<div class="lch-saved-grid">${saved.map(p=>card(p)).join('')}</div>`:empty('⌑','Your collection is waiting','Save a project from Discover to keep a visual reference here.','<button type="button" class="btn primary" data-lch-action="explore-services">Explore services</button>')}</div>${recs.length?`<div class="lch-panel"><div class="lch-section-head"><div><div class="lch-overline">Inspired by your saves</div><h3>Related services</h3></div></div><div class="lch-saved-grid">${recs.map(s=>serviceCard(s)).join('')}</div></div>`:''}`;
      bindProjectAndServiceCards(el);
    }

    function bindProjectAndServiceCards(container) {
      qsa('[data-project]',container).forEach(el=>{if(el.dataset.lchBound==='1')return;el.dataset.lchBound='1';el.addEventListener('click',e=>{if(e.target.closest('button,a,input'))return;const p=data.projects.find(x=>x.id===el.dataset.project);if(p&&typeof window.trackSiteEvent==='function')window.trackSiteEvent('project_click',{entityType:'project',entityId:p.id,category:p.category});if(typeof window.openProject==='function')window.openProject(el.dataset.project);});});
      qsa('[data-service]',container).forEach(el=>{if(el.dataset.lchBound==='1')return;el.dataset.lchBound='1';el.addEventListener('click',e=>{if(e.target.closest('button,a,input'))return;const s=data.services.find(x=>x.id===el.dataset.service);if(s&&typeof window.trackSiteEvent==='function')window.trackSiteEvent('service_click',{entityType:'service',entityId:s.id,category:s.category});if(typeof window.openService==='function')window.openService(el.dataset.service);});});
    }

    function renderOrderProgress(c) {
      const idx=progressIndex(c);const closed=idx<0;
      const steps=['Request','Payment','In progress','Delivery','Complete'];
      return `<div class="lch-progress" aria-label="Commission progress">${steps.map((s,i)=>`<span class="lch-progress-step ${!closed&&i<=idx?'active':''}" title="${s}"></span>`).join('')}</div><div class="lch-progress-labels">${steps.map((s,i)=>`<span style="${!closed&&i===idx?'color:var(--text);font-weight:800':''}">${s}</span>`).join('')}</div>`;
    }
    function renderOrderCard(c) {
      const a=c.artist||{},s=c.service||{},r=firstReview(c),due=deadline(c.target_deadline),status=statusInfo(c),open=hub.detailFor===c.id;
      const approve=c.status==='delivered';const review=c.status==='completed'&&!r;
      const thumb=imageForOrder(c)||avatarFallback(a.id);
      const metrics=`<span class="lch-metric"><b>${esc(money(c))}</b></span>${c.target_deadline?`<span class="lch-metric ${due.tone==='late'?'is-attention':''}">◷ <b>${esc(due.label)}</b></span>`:''}<span class="lch-metric">Placed <b>${esc(dateLabel(c.created_at))}</b></span>`;
      return `<article class="lch-order" data-lch-order="${esc(c.id)}"><div class="lch-order-main"><img class="lch-order-thumb" src="${esc(thumb)}" alt="" loading="lazy" onerror="handleImageError(this)"><div style="min-width:0"><div class="lch-overline">Order · ${esc(String(c.id||'').slice(0,8).toUpperCase())}</div><h3 class="lch-order-title">${esc(titleOfOrder(c))}</h3><div class="lch-order-artist"><img src="${esc(a.avatar_url||avatarFallback(a.id))}" alt="" onerror="handleImageError(this)"><button type="button" data-lch-action="artist" data-order-id="${esc(c.id)}">${esc(nameOfArtist(c))}</button></div><div class="lch-order-metrics">${metrics}</div></div><div class="lch-order-status-wrap"><span class="lch-order-status ${status[1]==='attention'?'is-attention':status[1]==='progress'?'is-progress':status[1]==='done'?'is-done':'is-closed'}">${esc(status[0])}</span></div></div>${renderOrderProgress(c)}<footer class="lch-order-footer"><div class="lch-order-footer-left"><span class="lch-muted">Updated ${esc(dateLabel(c.updated_at||c.created_at))}</span></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button type="button" class="btn" data-lch-action="details" data-order-id="${esc(c.id)}">${open?'Hide details':'View details'}</button>${approve?`<button type="button" class="btn primary" data-lch-action="approve" data-order-id="${esc(c.id)}">Approve delivery</button>`:''}${review?`<button type="button" class="btn primary" data-lch-action="review" data-order-id="${esc(c.id)}">Leave review</button>`:''}</div></footer>${open?renderOrderDetails(c):''}</article>`;
    }

    function renderOrderDetails(c) {
      const a=c.artist||{},s=c.service||{},due=deadline(c.target_deadline),history=hub.histories[c.id];
      const historyHtml = hub.historyLoading[c.id]
        ? '<div class="lch-muted">Loading order history…</div>'
        : hub.historyError[c.id]
          ? "<div class=\"lch-muted\">The history isn't available yet.</div>"
          : Array.isArray(history) && history.length
            ? `<div class="lch-history">${history.map(x => `<div class="lch-history-item"><span class="lch-history-dot"></span><div><b>${esc(statusInfo({status:x.new_status})[0])}</b><small>${esc(dateLabel(x.created_at))}</small></div></div>`).join('')}</div>`
            : '<div class="lch-muted">Updates will appear here as your order progresses.</div>';
      return `<div class="lch-inline-detail"><div class="lch-detail-grid"><div class="lch-detail-block"><h4>PROJECT</h4><div class="lch-detail-value"><b>${esc(titleOfOrder(c))}</b><div class="lch-muted" style="margin-top:5px">${esc(s.title||'Creative commission')} · Created ${esc(dateLabel(c.created_at))}</div></div></div><div class="lch-detail-block"><h4>ARTIST & DELIVERY</h4><div class="lch-detail-value"><b>${esc(nameOfArtist(c))}</b><div class="lch-muted" style="margin-top:5px">${esc(due.label)}</div><div class="lch-muted" style="margin-top:5px">${esc(money(c))}</div></div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn" data-lch-action="artist" data-order-id="${esc(c.id)}">Artist profile</button><button type="button" class="btn" data-lch-action="message-artist" data-order-id="${esc(c.id)}">Message artist</button></div></div><div class="lch-detail-block"><h4>ORDER STATUS</h4><div class="lch-detail-value">${esc(statusLabel(c))}</div><div class="lch-muted" style="margin-top:5px">Last updated ${esc(dateLabel(c.updated_at||c.created_at))}</div></div><div class="lch-detail-block"><h4>STATUS HISTORY</h4>${historyHtml}</div></div>${c.status==='delivered'?'<p class="lch-muted" style="margin:13px 0 0">Please check the delivered work before approving. Approval marks this commission as completed.</p>':''}</div>`;
    }

    function renderOrders(rebind=true) {
      const el=document.getElementById('client-space-orders');if(!el)return;
      if(hub.loading&&!hub.loaded){showLoading(el.id,3);return;}
      if(hub.commissionError){renderError(el.id,'Orders could not be loaded',hub.commissionError);return;}
      let rows=hub.commissions.slice();
      if(hub.filter==='active')rows=rows.filter(c=>!['completed','cancelled','declined','archived'].includes(c.status));
      else if(hub.filter==='attention')rows=rows.filter(c=>c.status==='delivered'||c.status==='disputed'||c.status==='revisions'||c.status==='unpaid'||c.status==='pending_payment');
      else if(hub.filter==='completed')rows=rows.filter(c=>c.status==='completed');
      else if(hub.filter==='closed')rows=rows.filter(c=>['cancelled','declined','archived'].includes(c.status));
      const q=String(hub.search||'').trim().toLowerCase();if(q)rows=rows.filter(c=>[titleOfOrder(c),nameOfArtist(c),c.id,c.status,c.project_title].join(' ').toLowerCase().includes(q));
      const filters=[['all','All orders'],['active','In progress'],['attention','Needs attention'],['completed','Completed'],['closed','Closed']];
      el.innerHTML=`<div class="lch-panel"><div class="lch-section-head"><div><div class="lch-overline">Every collaboration, in one place</div><h2>My orders</h2><p class="lch-muted">Track progress, check deadlines, and review each delivery.</p></div><button type="button" class="btn" data-lch-action="refresh">↻ Refresh</button></div><div class="lch-toolbar"><input class="lch-search" type="search" aria-label="Search orders" placeholder="Search order or artist…" value="${esc(hub.search)}" data-lch-search><div class="lch-filter-row" role="group" aria-label="Filter orders">${filters.map(([id,label])=>`<button type="button" class="lch-filter ${hub.filter===id?'active':''}" data-lch-filter="${id}" aria-pressed="${hub.filter===id?'true':'false'}">${label}</button>`).join('')}</div></div>${rows.length?`<div class="lch-order-list">${rows.map(renderOrderCard).join('')}</div>`:empty('▣',q?'No matching orders':'Nothing here yet',q?'Try a different search term.':hub.commissions.length?'Try another filter to see your other orders.':'When you book a service, your order timeline and delivery details will appear here.','<button type="button" class="btn primary" data-lch-action="explore-services">Explore services ↗</button>')}</div>`;
      if(rebind)bindProjectAndServiceCards(el);
    }

    async function loadHistory(id) {
      if(!id||hub.historyLoading[id]||hub.histories[id])return;
      hub.historyLoading[id]=true;renderOrders(false);
      try {
        const sb=window.supabaseClient||window.supabase;
        const {data:rows,error}=await timedQuery(sb.from('commission_status_history').select('id,old_status,new_status,created_at').eq('commission_id',id).order('created_at',{ascending:true}),10000);
        if(error)throw error;
        hub.histories[id]=Array.isArray(rows)?rows:[];
      } catch(error) {hub.historyError[id]=error?.message||'History unavailable';}
      finally {hub.historyLoading[id]=false;if(hub.detailFor===id&&hub.tab==='orders')renderOrders(false);}
    }

    function timedQuery(query, ms=12000) {
      return new Promise((resolve,reject)=>{
        let settled=false;
        const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error('This request took too long. Please try again.'));}},ms);
        Promise.resolve(query).then(value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);},error=>{if(settled)return;settled=true;clearTimeout(timer);reject(error);});
      });
    }

    async function fetchClientData() {
      if(!state.currentUser?.id)throw new Error('Please sign in again to view your Client Hub.');
      const sb=window.supabaseClient||window.supabase;
      const commissionsQuery=sb.from('commissions').select('id,service_id,artist_id,client_id,status,payment_type,deposit_amount,total_amount,amount,currency,target_deadline,created_at,updated_at,project_title,client_name,company,paypal_order_id,paypal_capture_id,service:service_id(id,title,thumbnail_url,delivery_time),artist:artist_id(id,display_name,username,avatar_url),client_reviews(id,rating,review,published,created_at)').eq('client_id',state.currentUser.id).order('created_at',{ascending:false}).limit(100);
      const reviewsQuery=sb.from('client_reviews').select('id,commission_id,artist_id,rating,review,published,created_at,artist:artist_id(id,display_name,username,avatar_url),commission:commission_id(id,project_title,status,service:service_id(title))').eq('client_id',state.currentUser.id).order('created_at',{ascending:false}).limit(100);
      const results=await Promise.allSettled([timedQuery(commissionsQuery),timedQuery(reviewsQuery)]);
      const commissions=results[0].status==='fulfilled'?results[0].value:{data:null,error:results[0].reason};
      const reviews=results[1].status==='fulfilled'?results[1].value:{data:null,error:results[1].reason};
      return {commissions:Array.isArray(commissions.data)?commissions.data:[],reviews:Array.isArray(reviews.data)?reviews.data:[],commissionError:commissions.error||null,reviewError:reviews.error||null};
    }

    async function refreshHub(activeTab=hub.tab) {
      if(!state.currentUser){if(typeof window.openAuth==='function')window.openAuth('signin');return;}
      await refreshUserSafe();
      if(!isClient()) { callToast('Client Hub is available for User/Client accounts.');return; }
      hub.tab=hub.tabs.includes(activeTab)?activeTab:'overview';
      const root=ensureShell();if(!root)return;
      hub.loading=true;hub.loaded=false;hub.commissionError='';hub.reviewError='';updateTabChrome();
      if(hub.tab!=='eugene-card')showLoading('client-space-'+hub.tab,hub.tab==='orders'?3:2);
      const request=++hub.requestId;
      try {
        const [result]=await Promise.all([fetchClientData()]);
        if(request!==hub.requestId)return;
        hub.commissions=result.commissions;hub.reviews=result.reviews;
        hub.commissionError=result.commissionError?.message||'';hub.reviewError=result.reviewError?.message||'';
        hub.loaded=!hub.commissionError;hub.loading=false;
        if(hub.commissionError)callToast('Orders could not be refreshed. Your saved inspiration is still available.');
        renderCurrentTab();updateTabChrome();
      } catch(error) {
        if(request!==hub.requestId)return;
        hub.loading=false;hub.loaded=false;hub.commissionError=error?.message||'Unable to load your orders.';
        renderCurrentTab();
      }
      addNav();
    }
    async function refreshUserSafe(){try{if(typeof window.refreshUser==='function')await window.refreshUser();}catch(error){console.warn('Client Hub profile refresh failed',error);}}
    function renderCurrentTab() {
      if(hub.tab==='overview')renderOverview();if(hub.tab==='orders')renderOrders();if(hub.tab==='saved')renderSaved();if(hub.tab==='messages')renderMessages();if(hub.tab==='reviews')renderReviews();if(hub.tab==='profile')renderProfile();
    }

    async function approveOrder(id, button) {
      const order=hub.commissions.find(c=>c.id===id);if(!order||order.status!=='delivered')return;
      if(!confirm('Approve the delivered work and mark this commission as completed?'))return;
      if(button) {button.disabled=true;button.textContent='Confirming…';}
      try {
        const sb=window.supabaseClient||window.supabase;
        const {error}=await timedQuery(sb.rpc('client_approve_commission',{p_commission_id:id}),12000);
        if(error)throw error;
        callToast('Delivery approved. Your commission is complete.');hub.detailFor=null;await refreshHub('orders');
      } catch(error) {
        const msg=String(error?.message||'Unable to approve delivery.');
        const migrationMissing=/function .*client_approve_commission|could not find the function/i.test(msg);
        const friendly=migrationMissing?'Delivery approval needs the Client Hub database migration to be applied first.':msg;
        setNotice(friendly,true);
        callToast(migrationMissing?'Client Hub database migration is required.':msg);
        if(button){button.disabled=false;button.textContent='Approve delivery';}
      }
    }

    function renderReviews() {
      const el=document.getElementById('client-space-reviews');if(!el)return;
      if(hub.loading&&!hub.loaded){showLoading(el.id,2);return;}
      if(hub.reviewError && !hub.commissions.length){renderError(el.id,'Reviews could not be loaded',hub.reviewError);return;}
      const pending=needsReview();
      const avg=hub.reviews.length?(hub.reviews.reduce((n,r)=>n+Number(r.rating||0),0)/hub.reviews.length).toFixed(1):'—';
      const current=hub.reviewFor?hub.commissions.find(c=>c.id===hub.reviewFor):null;
      const form=current&&current.status==='completed'&&!firstReview(current)?reviewForm(current):'';
      const pendingHtml=pending.map(c=>`<div class="lch-review-card"><div class="lch-review-top"><img class="lch-review-avatar" src="${esc((c.artist||{}).avatar_url||avatarFallback(c.artist_id))}" alt="" onerror="handleImageError(this)"><div style="min-width:0;flex:1"><strong style="display:block;font-size:12px">${esc(titleOfOrder(c))}</strong><div class="lch-muted">${esc(nameOfArtist(c))}</div></div><span class="lch-order-status is-attention">Review due</span></div><button type="button" class="btn primary" style="margin-top:13px" data-lch-action="review" data-order-id="${esc(c.id)}">Write a review</button></div>`).join('');
      const reviewsHtml=hub.reviews.map(r=>{const a=r.artist||{},title=r.commission?.service?.title||r.commission?.project_title||'Creative commission';return `<article class="lch-review-card"><div class="lch-review-top"><img class="lch-review-avatar" src="${esc(a.avatar_url||avatarFallback(a.id))}" alt="" onerror="handleImageError(this)"><div style="min-width:0;flex:1"><strong style="display:block;font-size:12px">${esc(a.display_name||a.username||'Artist')}</strong><div class="lch-muted">${esc(title)} · ${esc(dateLabel(r.created_at))}</div></div><span class="lch-stars" aria-label="${Number(r.rating)||0} out of 5 stars">${'★'.repeat(Math.min(5,Number(r.rating)||0))}${'☆'.repeat(5-Math.min(5,Number(r.rating)||0))}</span></div><p class="lch-review-text">${esc(r.review)}</p></article>`}).join('');
      el.innerHTML=`<div class="lch-panel"><div class="lch-section-head"><div><div class="lch-overline">Your perspective matters</div><h2>Reviews & feedback</h2><p class="lch-muted">Published reviews are linked to a completed commission and its artist.</p></div><div style="text-align:right"><div class="lch-stars" style="font-size:19px">${hub.reviews.length?'★':'☆'} ${avg}</div><div class="lch-muted">${hub.reviews.length} review${hub.reviews.length===1?'':'s'}</div></div></div>${pending.length?`<h3 style="font-size:14px;margin:0 0 10px">Ready for your review</h3><div class="lch-review-list">${pendingHtml}</div>`:''}${form}<div class="lch-section-head" style="margin-top:24px"><div><h3>Your published reviews</h3></div></div>${hub.reviews.length?`<div class="lch-review-list">${reviewsHtml}</div>`:empty('☆','No reviews yet','After a commission is completed, you can leave a review for the artist.')}</div>`;
    }

    function reviewForm(c) {
      const rating=Number(hub.rating||5);
      return `<form class="lch-review-form" data-lch-review-form="${esc(c.id)}"><div class="lch-section-head"><div><div class="lch-overline">Completed commission</div><h3>Review ${esc(nameOfArtist(c))}</h3><p class="lch-muted">${esc(titleOfOrder(c))}</p></div><button type="button" class="btn" data-lch-action="remove-review-form">Cancel</button></div><div class="lch-form-field"><label>Your rating</label><div class="lch-rating" role="group" aria-label="Choose star rating">${[1,2,3,4,5].map(n=>`<button type="button" class="${n<=rating?'selected':''}" data-lch-rating="${n}" aria-label="${n} star${n===1?'':'s'}" aria-pressed="${n<=rating?'true':'false'}">★</button>`).join('')}</div></div><div class="lch-form-field" style="margin-top:13px"><label for="lch-review-text">Your experience</label><textarea id="lch-review-text" class="lch-field lch-field-area" minlength="10" maxlength="2000" required placeholder="What was it like working with this artist? (10–2,000 characters)"></textarea><div class="lch-muted">Reviews help the Lunarist community make thoughtful choices.</div></div><button type="submit" class="btn primary" style="margin-top:13px" data-lch-action="submit-review" data-order-id="${esc(c.id)}">Publish review</button></form>`;
    }

    async function submitReview(id, root) {
      const form=qs(`[data-lch-review-form="${CSS.escape(id)}"]`,root);if(!form)return;
      const text=qs('#lch-review-text',form)?.value.trim()||'';const rating=Number(hub.rating||5);
      if(text.length<10){setNotice('Please write at least 10 characters for your review.',true);return;}
      if(text.length>2000){setNotice('Your review must be 2,000 characters or fewer.',true);return;}
      const c=hub.commissions.find(x=>x.id===id);if(!c||c.status!=='completed'||firstReview(c)){setNotice('This commission is no longer eligible for a new review.',true);return;}
      const button=qs('[data-lch-action="submit-review"]',form);if(button){button.disabled=true;button.textContent='Publishing…';}
      try {
        const sb=window.supabaseClient||window.supabase;
        const {error}=await timedQuery(sb.from('client_reviews').insert({commission_id:id,client_id:state.currentUser.id,artist_id:c.artist_id||c.artist?.id,rating,review:text}),12000);
        if(error)throw error;
        hub.reviewFor=null;hub.rating=5;setNotice('Your review has been published.');callToast('Thank you for sharing your experience.');await refreshHub('reviews');
      } catch(error) {
        const message=String(error?.message||'Unable to publish review.');setNotice(/duplicate|unique/i.test(message)?'You have already reviewed this commission.':message,true);callToast(message);if(button){button.disabled=false;button.textContent='Publish review';}
      }
    }

    async function messageArtist(orderId) {
      const c=hub.commissions.find(x=>x.id===orderId);const artistId=c?.artist_id||c?.artist?.id;
      if(!artistId){callToast('Artist details are unavailable for this order.');return;}
      if(!state.currentUser){if(typeof window.openAuth==='function')window.openAuth('signin');return;}
      try {
        if(typeof window.createOrGetConversation!=='function'){callToast('Messaging is not available yet.');return;}
        const conv=await window.createOrGetConversation(artistId);
        if(conv){await openClientHub('messages');if(typeof window.selectConversation==='function')window.selectConversation(conv.id);}
      } catch(error) {callToast(error?.message||'Unable to open the conversation.');}
    }

    async function renderMessages() {
      const el=document.getElementById('dash-messages');if(!el)return;
      el.innerHTML='<div class="lch-panel"><div class="lch-skeleton"></div></div>';
      try {
        if(typeof window.loadUserConversations==='function')await timedQuery(window.loadUserConversations(),12000);
        if(typeof window.renderMessagesTab==='function')window.renderMessagesTab();
        else el.innerHTML=empty('✉','Messaging is unavailable','Please refresh and try again.');
      } catch(error) {renderError('client-space-messages','Messages are taking longer than expected',error?.message||'Try again.',true);}
    }

    function renderProfile() {
      const el=document.getElementById('client-space-profile');if(!el)return;
      const m=state.currentMember||{};const url=clientUrl(m);const notice=hub.profileNotice;
      el.innerHTML=`<div class="lch-panel"><div class="lch-section-head"><div><div class="lch-overline">Your public presence</div><h2>Profile settings</h2><p class="lch-muted">Set how artists and future collaborators see you. Your client profile is separate from artist publishing tools.</p></div></div>${notice?.message?`<div class="lch-flash ${notice.isError?'error':''}" role="status">${esc(notice.message)}</div>`:''}<form data-lch-profile-form><div class="lch-avatar-edit"><img class="lch-profile-avatar" id="lch-avatar-preview" src="${esc(m.avatar||avatarFallback(m.id))}" alt="" onerror="handleImageError(this)"><div><button type="button" class="btn" data-lch-action="choose-avatar">Change photo</button><input type="file" id="lch-avatar-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><div class="lch-muted" id="lch-avatar-status" style="margin-top:7px">JPG, PNG, WebP or GIF · Max 5 MB</div></div></div><div class="lch-form-grid" style="margin-top:20px"><div class="lch-form-field"><label for="lch-display-name">Display name</label><input class="lch-field" id="lch-display-name" name="display_name" maxlength="80" required value="${esc(m.name||'')}"></div><div class="lch-form-field"><label for="lch-username">Username</label><input class="lch-field" id="lch-username" name="username" minlength="3" maxlength="32" pattern="[a-zA-Z0-9_]{3,32}" required value="${esc(m.username||'')}" autocomplete="username"><div class="lch-profile-linkline">${url?`Public page: ${esc(url)}`:'Your page URL will appear here after saving.'}</div></div><div class="lch-form-field full"><label for="lch-bio">About you</label><textarea class="lch-field lch-field-area" id="lch-bio" name="bio" maxlength="1000" placeholder="What kinds of projects do you love to make?">${esc(m.bio||'')}</textarea></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px"><button type="submit" class="btn primary" data-lch-profile-save ${hub.savingProfile?'disabled':''}>${hub.savingProfile?'Saving…':'Save profile'}</button><button type="button" class="btn" data-lch-action="sign-out">Sign out</button></div></form></div>`;
      qs('#lch-avatar-file',el)?.addEventListener('change',async event=>{
        const file=event.target.files?.[0];if(!file)return;
        const status=qs('#lch-avatar-status',el);
        if(!file.type.startsWith('image/')){if(status)status.textContent='Please choose an image file.';return;}
        if(file.size>5*1024*1024){if(status)status.textContent='That image is over 5 MB. Choose a smaller file.';event.target.value='';return;}
        if(status)status.textContent='Uploading photo…';
        try {if(typeof window.uploadProjectFile!=='function')throw new Error('Photo uploads are unavailable.');const url=await window.uploadProjectFile(file,'avatar');event.target.dataset.uploadedUrl=url;const preview=qs('#lch-avatar-preview',el);if(preview)preview.src=url;if(status)status.textContent='Photo ready. Save your profile to apply it.';}
        catch(error){if(status)status.textContent='Upload failed. Please try again.';setNotice(error?.message||'Photo upload failed.',true);}
      });
    }

    async function saveProfile(root) {
      if(hub.savingProfile)return;
      const el=document.getElementById('client-space-profile');if(!el)return;
      const name=String(qs('#lch-display-name',el)?.value||'').trim();
      const username=String(qs('#lch-username',el)?.value||'').trim().toLowerCase();
      const bio=String(qs('#lch-bio',el)?.value||'').trim();
      const file=qs('#lch-avatar-file',el);
      const reserved=new Set(['discover','artists','services','commissions','clients','admin','studio','www','login','signup','signin','logout','settings','null','undefined','api','artist-commissions']);
      if(name.length<1){setNotice('Add a display name before saving.',true);return;}
      if(!/^[a-z0-9_]{3,32}$/.test(username)){setNotice('Username must be 3–32 characters using letters, numbers and underscores only.',true);return;}
      if(reserved.has(username)){setNotice('That username is reserved. Please choose another.',true);return;}
      if(!state.currentUser?.id){setNotice('Please sign in again before saving.',true);return;}
      hub.savingProfile=true;setNotice('Saving your profile…');
      const btn=qs('[data-lch-profile-save]',el);if(btn){btn.disabled=true;btn.textContent='Saving…';}
      try {
        const payload={display_name:name,username,bio,updated_at:new Date().toISOString()};
        if(file?.dataset.uploadedUrl)payload.avatar_url=file.dataset.uploadedUrl;
        const sb=window.supabaseClient||window.supabase;
        const {data:profile,error}=await timedQuery(sb.from('profiles').update(payload).eq('id',state.currentUser.id).select('id,username,display_name,bio,avatar_url,account_type,is_admin,role,theme,socials').single(),12000);
        if(error)throw error;
        if(profile){state.currentMember={...state.currentMember,id:profile.id,username:profile.username,name:profile.display_name,bio:profile.bio||'',avatar:profile.avatar_url||avatarFallback(profile.id),account_type:profile.account_type||state.currentMember?.account_type,is_admin:!!profile.is_admin,role:profile.role||'',theme:profile.theme||state.currentMember?.theme||'moonlight',socials:profile.socials||{}};
          const cached=(data.members||[]).find(m=>m.id===profile.id);if(cached)Object.assign(cached,{username:profile.username,name:profile.display_name,bio:profile.bio||'',avatar:profile.avatar_url||avatarFallback(profile.id)});
        }
        hub.profileNotice={message:'Profile saved successfully.',isError:false};callToast('Client profile saved.');hub.savingProfile=false;await refreshHub('profile');
      } catch(error) {
        hub.savingProfile=false;const message=String(error?.message||'Unable to save your profile.');
        setNotice(/duplicate|unique|profiles_username/i.test(message)?'That username is already taken.':message,true);callToast(message);renderProfile();
      }
    }

    async function signOut() {
      try {const sb=window.supabaseClient||window.supabase;const {error}=await sb.auth.signOut();if(error)throw error;hub.loaded=false;hub.commissions=[];hub.reviews=[];state.currentUser=null;state.currentMember=null;state.savedIds=new Set();document.body.classList.remove('lunarist-client-hub-active');callToast('Signed out.');base.goRoute('home');if(typeof window.updateAccountButton==='function')window.updateAccountButton();}
      catch(error){callToast(error?.message||'Unable to sign out.');}
    }

    async function openClientHub(tab='overview', replace=false) {
      if(!state.currentUser){if(typeof window.openAuth==='function')window.openAuth('signin');return;}
      await refreshUserSafe();
      if(!isClient()) {
        if(state.currentMember?.account_type==='member'&&!state.currentMember?.is_admin&&typeof window.openArtistCommissionCenter==='function'&&tab==='orders')return window.openArtistCommissionCenter();
        callToast('Client Hub is for User/Client accounts.');return;
      }
      const target=hub.tabs.includes(tab)?tab:'overview';hub.tab=target;state.route='clients';
      if(location.pathname!=='/clients')history[replace?'replaceState':'pushState']({route:'clients'},'', '/clients');
      ensureShell();updateTabChrome();await refreshHub(target);
    }

    async function renderPublicClientProfile(target) {
      const view=document.getElementById('view');if(!view)return;
      view.innerHTML='<div class="container"><section class="section" style="padding-top:70px"><div class="lch-panel"><div class="lch-skeleton"></div></div></section></div>';
      let profile=target&&typeof target==='object'?target:null;
      if(!profile)profile=await fetchPublicClient(target);
      if(!profile){view.innerHTML=`<div class="container"><section class="section" style="padding-top:80px">${empty('⌕','Client profile not found','This public username is unavailable or belongs to a Lunarist Member.','<button class="btn primary" type="button" id="lch-public-home">Back home</button>')}</section></div>`;qs('#lch-public-home')?.addEventListener('click',()=>base.goRoute('home'));return;}
      if(typeof window.applyTheme==='function')window.applyTheme(profile.theme||'moonlight');
      const url=clientUrl(profile);if(typeof window.updateSeoMeta==='function')window.updateSeoMeta(`${profile.display_name||profile.username||'Client'} · Client Space`,profile.bio||'Lunarist client profile',profile.avatar_url||'');
      const own=!!state.currentUser&&state.currentUser.id===profile.id;
      view.innerHTML=`<div class="container lunarist-client-hub"><section class="section client-public-profile" style="padding-top:clamp(30px,6vw,75px);max-width:960px;margin:0 auto"><div class="lch-panel" style="padding:clamp(22px,5vw,42px)"><div class="lch-hero-person"><img class="lch-hero-avatar" style="width:100px;height:100px;flex-basis:100px;border-radius:26px" src="${esc(profile.avatar_url||avatarFallback(profile.id))}" alt="" onerror="handleImageError(this)"><div style="min-width:0"><div class="lch-overline">Lunarist client</div><h1 style="font-size:clamp(32px,5vw,48px);letter-spacing:-.05em;margin:5px 0">${esc(profile.display_name||'Client')}</h1><div class="lch-muted">@${esc(profile.username||'client')}</div></div></div><p class="lch-muted" style="font-size:14px;white-space:pre-wrap;margin:22px 0">${esc(profile.bio||'A member of the Lunarist creative community.')}</p><div class="lch-profile-link" style="max-width:none"><span class="lch-profile-link-value">${esc(url)}</span><button type="button" class="btn" id="lch-copy-public">Copy link</button></div><div class="lch-hero-actions"><button type="button" class="btn primary" id="lch-open-own">${own?'Open your Client Hub':'Sign in to Lunarist'}</button><button type="button" class="btn" id="lch-public-discover">Discover</button></div></div></section></div>`;
      qs('#lch-copy-public')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);callToast('Profile link copied.')}catch(_){callToast(url)}});
      qs('#lch-open-own')?.addEventListener('click',()=>{if(own)openClientHub('overview');else if(typeof window.openAuth==='function')window.openAuth('signin')});
      qs('#lch-public-discover')?.addEventListener('click',()=>base.goRoute('discover'));
    }

    async function fetchPublicClient(username) {
      const clean=String(username||'').replace(/^@/,'').toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32);if(!clean)return null;
      const sb=window.supabaseClient||window.supabase;if(!sb)return null;
      try {const {data:profile,error}=await timedQuery(sb.from('profiles').select('id,display_name,username,bio,avatar_url,theme,account_type,is_admin').eq('username',clean).maybeSingle(),10000);if(error||!profile||profile.is_admin||profile.account_type==='member')return null;return profile;}catch(_){return null;}
    }

    function clientByUsername(username) {
      const clean=String(username||'').replace(/^@/,'').toLowerCase();
      return (data.members||[]).find(m=>!m.is_admin&&String(m.account_type||'user')!=='member'&&String(m.username||'').toLowerCase()===clean)||null;
    }

    window.openClientSpace = openClientHub;
    window.openClientHub = openClientHub;
    window.refreshClientSpace = refreshHub;
    window.renderClientSpacePage = ensureShell;
    window.setClientSpaceTab = setTab;
    window.renderPublicClientProfile = renderPublicClientProfile;

    window.pathForRoute = function(route) {
      if(route==='clients'||route==='commissions')return '/clients';
      if(String(route).startsWith('clientprofile:')){const token=String(route).slice(14);const m=typeof window.member==='function'?window.member(token):null;return m?.username?'/'+encodeURIComponent(m.username):'/'+encodeURIComponent(token);}
      return base.pathForRoute(route);
    };
    window.routeFromPath = function() {
      let seg='';try{seg=decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g,''));}catch(_){return 'home';}
      if(seg==='clients'||seg==='commissions')return 'clients';
      const local=seg?clientByUsername(seg):null;if(local)return 'clientprofile:'+local.id;
      const original=base.routeFromPath();
      if(original&&String(original).startsWith('member:')){const id=String(original).slice(7);const m=typeof window.member==='function'?window.member(id):null;if(m&&clientRole(m))return 'clientprofile:'+id;}
      return original;
    };
    window.goRoute = function(route, replace) {
      if(route==='clients'||route==='commissions')return openClientHub(route==='commissions'?'orders':hub.tab,!!replace);
      if(String(route).startsWith('clientprofile:')){
        const token=String(route).slice(14);const local=clientByUsername(token)||(typeof window.member==='function'?window.member(token):null);state.route=route;
        const path=local?.username?'/'+encodeURIComponent(local.username):'/'+encodeURIComponent(token);
        if(location.pathname!==path)history[replace?'replaceState':'pushState']({route},'',path);
        return renderPublicClientProfile(local||token);
      }
      return base.goRoute(route,replace);
    };
    window.render = function(preserveScroll) {
      if(state.route==='clients'){
        const root=ensureShell();if(root){updateTabChrome();if(!hub.loading&&!hub.loaded)refreshHub(hub.tab);}return;
      }
      if(String(state.route).startsWith('clientprofile:')){
        const token=String(state.route).slice(14);const local=clientByUsername(token)||(typeof window.member==='function'?window.member(token):null);renderPublicClientProfile(local||token);return;
      }
      document.body.classList.remove('lunarist-client-hub-active');return base.render(preserveScroll);
    };
    if(typeof base.openDashboard==='function')window.openDashboard=async function(initialTab='overview'){
      if(isClient())return openClientHub(hub.tabs.includes(initialTab)?initialTab:'overview');
      return base.openDashboard(initialTab);
    };
    if(typeof base.updatePrimaryNavVisibility==='function')window.updatePrimaryNavVisibility=function(...args){const value=base.updatePrimaryNavVisibility.apply(this,args);addNav();syncNav();return value;};
    if(typeof base.updateAccountButton==='function')window.updateAccountButton=function(...args){const value=base.updateAccountButton.apply(this,args);addNav();syncNav();return value;};

    addNav();syncNav();window.__lunaristClientHubInstalled=true;
    if(state.route==='clients'){ensureShell();refreshHub(hub.tab);}
    else if(String(state.route).startsWith('member:')){const id=String(state.route).slice(7),m=typeof window.member==='function'?window.member(id):null;if(m&&clientRole(m)){state.route='clientprofile:'+id;renderPublicClientProfile(m);}}
    const observer=new MutationObserver(()=>{addNav();if(state.route==='clients'&&!document.getElementById('lunarist-client-hub')){ensureShell();if(hub.loaded)renderCurrentTab();}});
    observer.observe(document.getElementById('navlinks')||document.body,{childList:true,subtree:true});
    return true;
  };
  let attempts=0;const timer=setInterval(()=>{if(boot()||++attempts>120)clearInterval(timer)},100);
  window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
})();
