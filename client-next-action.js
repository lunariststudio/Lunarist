// Lunarist Client Space — Next Action enhancement.
(function(){
  if(typeof window==='undefined') return;
  const boot=()=>{
    if(window.__lunaristClientNextAction) return true;
    const host=()=>document.querySelector('[data-client-space],#clientSpace,.client-space,.clientSpace') || document.body;
    const statusOf=(c)=>String(c?.status||c?.commission_status||c?.state||'').toLowerCase();
    const actionFor=(c)=>{
      const s=statusOf(c);
      if(['unpaid','pending_payment','payment_pending'].includes(s)) return ['Pay Now','primary'];
      if(['delivered','awaiting_approval','awaiting client approval'].includes(s)) return ['Approve Delivery','primary'];
      if(['revision_requested','revisions','revision'].includes(s)) return ['View Revision Request','pink'];
      if(['completed','complete'].includes(s)) return ['Leave Review','pink'];
      if(['cancelled','canceled','disputed'].includes(s)) return ['View Commission','default'];
      if(s) return ['View Progress','default'];
      return ['View Commission','default'];
    };
    const render=()=>{
      const root=host();
      if(!root) return;
      const cards=[...root.querySelectorAll('[data-commission-id],[data-commission]')];
      cards.forEach(card=>{
        if(card.querySelector('.lunarist-next-action')) return;
        let raw=card.getAttribute('data-commission')||card.getAttribute('data-commission-id');
        let c={}; try{ if(raw && raw.trim().startsWith('{')) c=JSON.parse(raw); }catch(e){}
        const text=(card.innerText||'').toLowerCase();
        if(!c.status && !c.commission_status) c.status=text.includes('delivered')?'delivered':text.includes('completed')?'completed':text.includes('revision')?'revisions':text.includes('unpaid')?'unpaid':'in_progress';
        const [label,tone]=actionFor(c);
        const bar=document.createElement('div');
        bar.className='lunarist-next-action';
        bar.innerHTML='<span class="lunarist-next-label">Next action</span><button type="button" class="btn '+(tone==='primary'?'primary':tone==='pink'?'pink':'')+'">'+label+'</button>';
        const btn=bar.querySelector('button');
        btn.addEventListener('click',()=>{
          const id=c.id||c.commission_id||card.dataset.commissionId;
          if(label==='Leave Review' && typeof window.openClientReview==='function') return window.openClientReview(id);
          if(label==='Approve Delivery' && typeof window.approveCommissionDelivery==='function') return window.approveCommissionDelivery(id);
          if(label==='Pay Now' && typeof window.payCommission==='function') return window.payCommission(id);
          card.scrollIntoView({behavior:'smooth',block:'center'});
          card.dispatchEvent(new CustomEvent('lunarist:commission-action',{detail:{id,label},bubbles:true}));
        });
        card.appendChild(bar);
      });
    };
    const style=document.createElement('style');
    style.textContent='.lunarist-next-action{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0 0;padding-top:12px;border-top:1px solid var(--line,rgba(255,255,255,.1))}.lunarist-next-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted,#9c96ad);font-weight:700}.lunarist-next-action .btn{padding:8px 11px;font-size:12px}.lunarist-next-action button{white-space:nowrap}@media(max-width:520px){.lunarist-next-action{align-items:stretch;flex-direction:column}.lunarist-next-action button{width:100%}}';
    document.head.appendChild(style);
    const obs=new MutationObserver(render); obs.observe(document.body,{childList:true,subtree:true});
    render();
    window.__lunaristClientNextAction=true;
    return true;
  };
  if(!boot()){ let n=0; const t=setInterval(()=>{if(boot()||++n>80)clearInterval(t)},250); }
})();
