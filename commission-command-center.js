// Lunarist Commission Command Center — role-aware UX enhancement.
(function(){
  if(typeof window==='undefined') return;
  const boot=()=>{
    if(window.__lunaristCommissionCommandCenter) return true;
    if(typeof window.supabaseClient==='undefined'||typeof window.state==='undefined') return false;
    window.__lunaristCommissionCommandCenter=true;

    const css=document.createElement('style');
    css.id='lunarist-commission-command-center-css';
    css.textContent=`
      .lcc-wrap{margin:0 0 16px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(201,182,255,.07),rgba(255,255,255,.025));border-radius:18px;padding:16px}
      .lcc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lcc-title{font-weight:900;font-size:18px;letter-spacing:-.02em}.lcc-sub{color:var(--muted);font-size:12px;margin-top:3px}
      .lcc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.lcc-stat{border:1px solid var(--line);border-radius:12px;padding:11px;background:rgba(255,255,255,.025)}.lcc-stat b{display:block;font-size:20px}.lcc-stat span{color:var(--muted);font-size:10px}
      .lcc-actions{display:flex;flex-direction:column;gap:7px;margin-top:12px}.lcc-action{border:1px solid rgba(255,134,200,.22);background:rgba(255,134,200,.045);border-radius:12px;padding:10px 12px}.lcc-action strong{display:block}.lcc-action small{display:block;color:var(--muted);margin-top:2px}.lcc-action button{margin-top:8px}
      .lcc-timeline{display:flex;flex-direction:column;gap:0;margin-top:12px}.lcc-step{display:grid;grid-template-columns:18px 1fr;gap:9px;position:relative;padding-bottom:11px}.lcc-step:not(:last-child):before{content:'';position:absolute;left:8px;top:16px;bottom:0;width:1px;background:var(--line)}.lcc-dot{width:16px;height:16px;border-radius:50%;border:1px solid var(--line);background:var(--panel);z-index:1}.lcc-dot.done{background:var(--moon);border-color:var(--moon)}.lcc-step b{font-size:12px}.lcc-step span{display:block;color:var(--muted);font-size:11px}.lcc-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.lcc-badge{font-size:10px;border:1px solid var(--line);border-radius:999px;padding:5px 8px;color:var(--muted)}.lcc-badge.urgent{color:var(--danger);border-color:rgba(255,125,142,.35)}.lcc-badge.soon{color:var(--gold);border-color:rgba(232,207,145,.35)}
      @media(max-width:900px){.lcc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.lcc-head{flex-direction:column}.lcc-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(css);

    const escHtml=s=>{const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML};
    const money=(c)=>`${c?.currency||'USD'} ${Number(c?.total_amount??c?.amount??0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})}`;
    const label=s=>String(s||'waitlist').replace(/_/g,' ').replace(/^./,m=>m.toUpperCase());
    const steps=['waitlist','unpaid','paid','wip1','wip2','wip3','delivered','revisions','completed'];
    const idx=s=>Math.max(0,steps.indexOf(s));
    const days=d=>{if(!d)return null;return Math.ceil((new Date(`${d}T23:59:59`).getTime()-Date.now())/86400000)};
    const deadlineText=d=>{const n=days(d);if(n===null)return 'No deadline';if(n<0)return `${Math.abs(n)} day${Math.abs(n)===1?'':'s'} overdue`;if(n===0)return 'Due today';if(n===1)return 'Due tomorrow';return `Due in ${n} days`};
    const isClient=()=>!!state.currentMember&&!state.currentMember.is_admin&&state.currentMember.account_type!=='member';
    const isArtist=()=>!!state.currentMember&&!state.currentMember.is_admin&&!isClient();

    async function load(){
      if(!state.currentUser)return;
      const mine=isClient()?'client_id':'artist_id';
      const {data,error}=await supabaseClient.from('commissions').select('id,artist_id,client_id,status,amount,total_amount,currency,target_deadline,created_at,updated_at,project_title,service:service_id(title),artist:artist_id(display_name,username),client:client_id(display_name,username)').eq(mine,state.currentUser.id).order('created_at',{ascending:false});
      if(error||!Array.isArray(data))return;
      window.__lccCommissions=data;
      render(data);
    }

    function findHost(){
      if(isClient())return document.getElementById('client-space-commissions');
      const candidates=[...document.querySelectorAll('.panel,.section,.dashsection,main')];
      return candidates.find(el=>/my commissions|my commission|commissions/i.test(el.textContent||''))||null;
    }

    function render(list){
      const host=findHost();if(!host)return;
      const old=document.getElementById('lcc-command-center');if(old)old.remove();
      const active=list.filter(c=>!['completed','cancelled'].includes(c.status));
      const needsClient=list.filter(c=>c.status==='delivered').length;
      const needsArtist=list.filter(c=>['waitlist','paid','revisions'].includes(c.status)).length;
      const urgent=list.filter(c=>{const n=days(c.target_deadline);return n!==null&&n<=3&&!['completed','cancelled'].includes(c.status)}).length;
      const completed=list.filter(c=>c.status==='completed').length;
      const role=isClient()?'Client':'Artist';
      const actions=[];
      if(isClient()&&needsClient)actions.push(`<div class="lcc-action"><strong>✓ ${needsClient} delivery${needsClient===1?'':'ies'} waiting for approval</strong><small>Review delivered work and complete the commission when everything is ready.</small><button class="btn pink" data-lcc-jump="client-space-commissions">Open commissions</button></div>`);
      if(isArtist()&&needsArtist)actions.push(`<div class="lcc-action"><strong>⚡ ${needsArtist} commission${needsArtist===1?'':'s'} need your attention</strong><small>Check new requests, paid work, or revision requests.</small></div>`);
      if(urgent)actions.push(`<div class="lcc-action"><strong>⏱ ${urgent} deadline${urgent===1?'':'s'} coming soon</strong><small>Open the relevant commission and keep the client updated.</small></div>`);
      if(!actions.length)actions.push(`<div class="lcc-action"><strong>You're all caught up.</strong><small>${completed} completed commission${completed===1?'':'s'} in your history.</small></div>`);

      const wrap=document.createElement('div');wrap.id='lcc-command-center';wrap.className='lcc-wrap';
      wrap.innerHTML=`<div class="lcc-head"><div><div class="eyebrow">${role} Commission Center</div><div class="lcc-title">Everything that needs your attention</div><div class="lcc-sub">A quick view of status, deadlines and next actions.</div></div><div class="lcc-badges"><span class="lcc-badge">${active.length} active</span>${urgent?`<span class="lcc-badge urgent">${urgent} urgent</span>`:''}</div></div><div class="lcc-grid"><div class="lcc-stat"><b>${list.length}</b><span>Total commissions</span></div><div class="lcc-stat"><b>${active.length}</b><span>Active</span></div><div class="lcc-stat"><b>${completed}</b><span>Completed</span></div><div class="lcc-stat"><b>${money(list[0]||{})}</b><span>Latest value</span></div></div><div class="lcc-actions">${actions.join('')}</div>`;
      host.prepend(wrap);
      wrap.querySelectorAll('[data-lcc-jump]').forEach(b=>b.onclick=()=>{const t=document.getElementById(b.dataset.lccJump);if(t){t.scrollIntoView({behavior:'smooth',block:'start'})}});

      // Add deadline/status badges to visible commission cards without replacing existing controls.
      const cards=[...host.querySelectorAll('.panel')].filter(x=>x!==wrap&&!x.closest('#lcc-command-center'));
      cards.forEach(card=>{
        if(card.querySelector('.lcc-badges'))return;
        const text=(card.textContent||'').toLowerCase();
        const match=list.find(c=>{const title=String(c.project_title||c.service?.title||'').toLowerCase();return title&&text.includes(title.slice(0,30))});
        if(!match)return;
        const n=days(match.target_deadline);
        if(n===null&&match.status!=='delivered')return;
        const badges=document.createElement('div');badges.className='lcc-badges';
        badges.innerHTML=`<span class="lcc-badge">${escHtml(label(match.status))}</span>${n!==null?`<span class="lcc-badge ${n<=3?'soon':''} ${n<0?'urgent':''}">${escHtml(deadlineText(match.target_deadline))}</span>`:''}${match.total_amount||match.amount?`<span class="lcc-badge">${escHtml(money(match))}</span>`:''}`;
        card.appendChild(badges);
      });
    }

    async function addTimeline(){
      if(!state.currentUser)return;
      const host=findHost();if(!host)return;
      const list=window.__lccCommissions||[];if(!list.length)return;
      const existing=document.getElementById('lcc-timeline-panel');if(existing)existing.remove();
      const c=list.find(x=>x.status!=='completed')||list[0];
      if(!c)return;
      const {data}=await supabaseClient.from('commission_status_history').select('old_status,new_status,changed_by,created_at').eq('commission_id',c.id).order('created_at',{ascending:true});
      if(!Array.isArray(data)||!data.length)return;
      const panel=document.createElement('div');panel.id='lcc-timeline-panel';panel.className='panel';panel.style.marginBottom='16px';
      panel.innerHTML=`<div class="eyebrow">Latest commission timeline</div><h3 style="margin:4px 0">${escHtml(c.service?.title||c.project_title||'Commission')}</h3><div class="lcc-timeline">${data.map((h,i)=>`<div class="lcc-step"><span class="lcc-dot done"></span><div><b>${escHtml(label(h.new_status))}</b><span>${new Date(h.created_at).toLocaleString()}</span></div></div>`).join('')}</div>`;
      const center=document.getElementById('lcc-command-center');(center?center.parentNode:host).appendChild(panel);
    }

    let lastKey='';
    const refresh=()=>{
      const key=`${location.pathname}|${state.currentUser?.id||''}|${isClient()?'client':'artist'}`;
      if(key===lastKey)return;
      lastKey=key;
      setTimeout(async()=>{await load();await addTimeline()},180);
    };
    const originalRender=window.render;
    if(typeof originalRender==='function')window.render=function(){const r=originalRender.apply(this,arguments);setTimeout(refresh,120);return r};
    const originalGoRoute=window.goRoute;
    if(typeof originalGoRoute==='function')window.goRoute=function(){const r=originalGoRoute.apply(this,arguments);setTimeout(refresh,180);return r};
    setInterval(()=>{if(document.visibilityState==='visible')refresh()},3000);
    refresh();
    return true;
  };
  if(!boot()){
    let n=0;const t=setInterval(()=>{if(boot()||++n>120)clearInterval(t)},250);
  }
})();
