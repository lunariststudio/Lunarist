// Lunarist — payment/work-state separation UI.
(function(){
  if(typeof window==='undefined') return;
  const pretty=s=>String(s||'Pending').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const paymentLabel=s=>({pending:'Payment Pending',paid:'Paid',partially_paid:'Partially Paid',failed:'Payment Failed',refunded:'Refunded',cancelled:'Payment Cancelled'}[String(s||'pending').toLowerCase()]||pretty(s));
  const inject=()=>document.querySelectorAll('[data-commission-id],[data-commission]').forEach(card=>{
    if(card.querySelector('.lunarist-state-pair'))return;
    let c={};try{const raw=card.getAttribute('data-commission');if(raw?.trim().startsWith('{'))c=JSON.parse(raw)}catch(e){}
    const text=(card.innerText||'').toLowerCase();
    const work=c.status||((text.match(/completed|delivered|revisions|wip[123]|in progress|paid|unpaid|pending/i)||['pending'])[0]);
    const pay=c.payment_status||((c.paypal_capture_id||text.includes('paid'))?'paid':'pending');
    const el=document.createElement('div');el.className='lunarist-state-pair';
    el.innerHTML='<span><small>Commission</small><b>'+pretty(work)+'</b></span><span><small>Payment</small><b>'+paymentLabel(pay)+'</b></span>';
    card.appendChild(el);
  });
  const css=document.createElement('style');css.textContent='.lunarist-state-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.lunarist-state-pair span{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border:1px solid var(--line,rgba(255,255,255,.1));border-radius:10px;background:rgba(255,255,255,.025)}.lunarist-state-pair small{font-size:9px;color:var(--muted,#999);text-transform:uppercase;letter-spacing:.08em}.lunarist-state-pair b{font-size:11px}@media(max-width:520px){.lunarist-state-pair{grid-template-columns:1fr}}';document.head.appendChild(css);
  new MutationObserver(inject).observe(document.body,{childList:true,subtree:true});inject();
})();
