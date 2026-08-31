// Lunarist Client Space — Commission detail panel.
(function(){
  if(typeof window==='undefined') return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=v=>{const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n):'—'};
  const status=c=>String(c?.status||c?.commission_status||c?.state||'').toLowerCase();
  const label=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
  const open=async(c)=>{
    if(document.querySelector('.lunarist-commission-detail')) return;
    let timeline=[];
    try{
      const sb=window.supabase||window._supabase||window.supabaseClient;
      const id=c?.id||c?.commission_id;
      if(sb&&id){ const r=await sb.from('commission_status_history').select('*').eq('commission_id',id).order('created_at',{ascending:true}); timeline=r.data||[]; }
    }catch(e){}
    const s=status(c), title=c?.title||c?.service_title||c?.service_name||'Commission';
    const artist=c?.artist_name||c?.artist?.name||c?.artist?.display_name||'Artist';
    const panel=document.createElement('div'); panel.className='lunarist-commission-detail';
    panel.innerHTML=`<div class="lcd-backdrop"></div><aside class="lcd-panel" role="dialog" aria-modal="true" aria-label="Commission details">
      <header class="lcd-head"><div><span class="lcd-eyebrow">COMMISSION</span><h2>${esc(title)}</h2></div><button class="lcd-close" aria-label="Close">×</button></header>
      <div class="lcd-body">
        <section class="lcd-card"><div class="lcd-grid"><div><small>Artist</small><strong>${esc(artist)}</strong></div><div><small>Status</small><strong class="lcd-status">${esc(label(s))}</strong></div><div><small>Amount</small><strong>${money(c?.total_amount??c?.amount??c?.price)}</strong></div><div><small>Deadline</small><strong>${esc(c?.deadline||c?.due_date||'—')}</strong></div></div></section>
        <section class="lcd-card"><h3>Progress</h3><div class="lcd-timeline">${timeline.length?timeline.map(x=>`<div class="lcd-event"><span class="lcd-dot"></span><div><strong>${esc(label(x.status||x.event||'Update'))}</strong><small>${x.created_at?new Date(x.created_at).toLocaleString():''}</small></div></div>`).join(''):`<div class="lcd-event"><span class="lcd-dot"></span><div><strong>${esc(label(s)||'Pending')}</strong><small>Current commission status</small></div></div>`}</div></section>
        <section class="lcd-card"><h3>Commission details</h3><dl class="lcd-details"><div><dt>Service</dt><dd>${esc(c?.service_name||c?.service_title||'—')}</dd></div><div><dt>Payment</dt><dd>${esc(label(c?.payment_status||c?.payment_state)||'—')}</dd></div><div><dt>Commission ID</dt><dd>${esc(c?.id||c?.commission_id||'—')}</dd></div></dl></section>
        <section class="lcd-card"><h3>Files & conversation</h3><p class="lcd-muted">Open the commission conversation to view shared files and messages.</p><button class="lcd-secondary" data-lcd-chat>Open Conversation</button></section>
      </div>
    </aside></div>`;
    document.body.appendChild(panel);
    const close=()=>{panel.remove();document.removeEventListener('keydown',key)};
    const key=e=>{if(e.key==='Escape')close()}; document.addEventListener('keydown',key);
    panel.querySelector('.lcd-close').onclick=close; panel.querySelector('.lcd-backdrop').onclick=close;
    panel.querySelector('[data-lcd-chat]').onclick=()=>{ close(); document.dispatchEvent(new CustomEvent('lunarist:open-commission-chat',{detail:{commission:c}})); };
  };
  const scan=()=>{document.querySelectorAll('[data-commission-id],[data-commission]').forEach(card=>{
    if(card.dataset.lcdBound) return; card.dataset.lcdBound='1'; card.style.cursor='pointer';
    card.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,textarea,.lunarist-next-action')) return; let raw=card.getAttribute('data-commission'), c={}; try{if(raw?.trim().startsWith('{'))c=JSON.parse(raw)}catch(_){} c.id=c.id||card.dataset.commissionId; c.status=c.status||((card.innerText||'').match(/delivered|completed|revision|unpaid|in progress/i)||[''])[0]; open(c);});
  })};
  const css=document.createElement('style');css.textContent='.lunarist-commission-detail{position:fixed;inset:0;z-index:99999}.lcd-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(5px)}.lcd-panel{position:absolute;right:0;top:0;height:100%;width:min(560px,100%);background:var(--card,#15131c);border-left:1px solid var(--line,rgba(255,255,255,.1));box-shadow:-20px 0 60px rgba(0,0,0,.35);display:flex;flex-direction:column}.lcd-head{display:flex;justify-content:space-between;gap:20px;padding:24px;border-bottom:1px solid var(--line,rgba(255,255,255,.1))}.lcd-head h2{margin:4px 0 0;font-size:22px}.lcd-eyebrow,.lcd-muted,.lcd-card small{color:var(--muted,#999);font-size:11px}.lcd-close{border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer}.lcd-body{overflow:auto;padding:18px 24px 36px}.lcd-card{border:1px solid var(--line,rgba(255,255,255,.1));border-radius:16px;padding:16px;margin-bottom:14px}.lcd-card h3{margin:0 0 14px;font-size:14px}.lcd-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.lcd-grid div{display:flex;flex-direction:column;gap:4px}.lcd-status{color:var(--accent,#c6a7ff)}.lcd-details{margin:0}.lcd-details div{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid var(--line,rgba(255,255,255,.07))}.lcd-details div:last-child{border-bottom:0}.lcd-details dt{color:var(--muted,#999)}.lcd-details dd{margin:0;text-align:right}.lcd-event{display:flex;gap:12px;position:relative;padding-bottom:16px}.lcd-event:last-child{padding-bottom:0}.lcd-dot{width:9px;height:9px;border-radius:50%;background:currentColor;margin-top:5px;flex:none}.lcd-event:not(:last-child):before{content:"";position:absolute;left:4px;top:14px;bottom:0;border-left:1px solid var(--line,rgba(255,255,255,.12))}.lcd-event div{display:flex;flex-direction:column;gap:3px}.lcd-secondary{border:1px solid var(--line,rgba(255,255,255,.12));background:transparent;color:inherit;border-radius:10px;padding:9px 12px;cursor:pointer}@media(max-width:520px){.lcd-panel{width:100%}.lcd-head,.lcd-body{padding-left:16px;padding-right:16px}}';document.head.appendChild(css);
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true}); scan();
})();
