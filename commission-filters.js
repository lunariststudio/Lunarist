// Lunarist Client Space — commission filters.
(function(){
  if(typeof window==='undefined') return;
  const FILTERS=[
    ['all','All'],
    ['attention','Needs Action'],
    ['active','In Progress'],
    ['delivered','Delivered'],
    ['completed','Completed']
  ];
  const STATUS_GROUPS={
    attention:new Set(['unpaid','delivered','revisions']),
    active:new Set(['accepted','paid','wip1','wip2','wip3']),
    delivered:new Set(['delivered']),
    completed:new Set(['completed','cancelled'])
  };
  const STATUSES=['waitlist','unpaid','paid','accepted','wip1','wip2','wip3','delivered','revisions','completed','cancelled'];
  let active='all';
  let scheduled=false;

  function statusLabel(status){
    try{
      if(typeof window.commissionClientStatusLabel==='function') return String(window.commissionClientStatusLabel(status)||'').trim().toLowerCase();
    }catch(_e){}
    return String(status||'').replace(/_/g,' ').trim().toLowerCase();
  }
  function getStatus(card){
    if(card.dataset.lunaristCommissionStatus) return card.dataset.lunaristCommissionStatus;
    const text=(card.textContent||'').toLowerCase();
    for(const s of STATUSES){
      const label=statusLabel(s);
      if(label && text.includes(label)) return s;
    }
    return '';
  }
  function matches(status,filter){
    if(filter==='all') return true;
    return STATUS_GROUPS[filter]?.has(status)||false;
  }
  function render(){
    const root=document.getElementById('client-space-commissions');
    if(!root) return;
    let bar=root.querySelector('[data-lunarist-commission-filters]');
    if(!bar){
      bar=document.createElement('div');
      bar.dataset.lunaristCommissionFilters='1';
      bar.className='client-commission-filters';
      bar.setAttribute('role','tablist');
      bar.setAttribute('aria-label','Commission filters');
      bar.innerHTML=FILTERS.map(([id,label])=>`<button type="button" class="filter" data-lunarist-commission-filter="${id}" role="tab" aria-selected="false">${label}</button>`).join('');
      const head=root.querySelector('.sectionhead');
      if(head?.parentElement) head.parentElement.insertBefore(bar,head.nextSibling);
      else root.insertBefore(bar,root.firstChild);
      bar.addEventListener('click',e=>{
        const b=e.target.closest('[data-lunarist-commission-filter]');
        if(!b) return;
        active=b.dataset.lunaristCommissionFilter||'all';
        apply();
      });
    }
    apply();
  }
  function apply(){
    const root=document.getElementById('client-space-commissions');
    if(!root) return;
    const bar=root.querySelector('[data-lunarist-commission-filters]');
    if(!bar) return;
    const buttons=[...bar.querySelectorAll('[data-lunarist-commission-filter]')];
    buttons.forEach(b=>{
      const on=b.dataset.lunaristCommissionFilter===active;
      b.classList.toggle('active',on);
      b.setAttribute('aria-selected',on?'true':'false');
    });
    const cards=[...root.querySelectorAll('.panel')].filter(card=>!card.closest('[data-lunarist-commission-filters]'));
    let commissionCards=cards.filter(card=>{
      const t=(card.textContent||'').toLowerCase();
      return STATUSES.some(s=>{const l=statusLabel(s);return l&&t.includes(l);});
    });
    let visible=0;
    commissionCards.forEach(card=>{
      const status=getStatus(card);
      const show=matches(status,active);
      card.style.display=show?'':'none';
      if(show) visible++;
    });
    let empty=root.querySelector('[data-lunarist-commission-filter-empty]');
    if(!empty){
      empty=document.createElement('div');
      empty.dataset.lunaristCommissionFilterEmpty='1';
      empty.className='empty';
      empty.innerHTML='<strong>No commissions in this filter.</strong><div class="meta">Try another filter to see your other commissions.</div>';
      root.appendChild(empty);
    }
    empty.style.display=commissionCards.length && visible===0?'':'none';
  }
  function boot(){
    if(document.getElementById('lunarist-commission-filter-style')) return;
    const style=document.createElement('style');
    style.id='lunarist-commission-filter-style';
    style.textContent='.client-commission-filters{display:flex;gap:8px;overflow:auto;padding:2px 0 12px;margin-bottom:6px}.client-commission-filters .filter{flex:0 0 auto}.client-commission-filters .filter.active{color:var(--text);background:rgba(255,255,255,.12);border-color:var(--moon)}';
    document.head.appendChild(style);
    const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}});
    observer.observe(document.body,{childList:true,subtree:true});
    render();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
