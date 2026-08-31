// Lunarist Client Space — Commission timeline enhancement.
(function(){
  if(typeof window==='undefined') return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pretty=s=>String(s||'Update').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const getClient=()=>window.supabase||window._supabase||window.supabaseClient;
  const ensure=()=>{document.querySelectorAll('[data-commission-id],[data-commission]').forEach(card=>{
    if(card.querySelector('.lunarist-commission-timeline')) return;
    const id=card.dataset.commissionId; if(!id) return;
    const wrap=document.createElement('section'); wrap.className='lunarist-commission-timeline';
    wrap.innerHTML='<div class="lct-head"><h4>Timeline</h4><span class="lct-loading">Loading…</span></div><div class="lct-events"></div>';
    card.appendChild(wrap);
    const load=async()=>{
      const sb=getClient(); if(!sb) return;
      try{
        const {data,error}=await sb.from('commission_status_history').select('*').eq('commission_id',id).order('created_at',{ascending:true});
        if(error) throw error;
        const events=(data||[]).map(x=>`<div class="lct-event"><span class="lct-dot"></span><div><strong>${esc(pretty(x.status||x.event||'Update'))}</strong><small>${x.created_at?new Date(x.created_at).toLocaleString():''}</small>${x.note||x.message?`<p>${esc(x.note||x.message)}</p>`:''}</div></div>`).join('');
        wrap.querySelector('.lct-loading').textContent=data?.length?'':'No history yet';
        wrap.querySelector('.lct-events').innerHTML=events;
      }catch(e){wrap.querySelector('.lct-loading').textContent='Timeline unavailable';}
    }; load();
  })};
  const css=document.createElement('style');css.textContent='.lunarist-commission-timeline{margin-top:12px;padding:14px 0 0;border-top:1px solid var(--line,rgba(255,255,255,.08))}.lct-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.lct-head h4{margin:0;font-size:12px}.lct-loading{font-size:10px;color:var(--muted,#999)}.lct-event{display:flex;gap:10px;position:relative;padding:0 0 11px}.lct-event:last-child{padding-bottom:0}.lct-event:not(:last-child):before{content:"";position:absolute;left:3px;top:9px;bottom:0;border-left:1px solid var(--line,rgba(255,255,255,.1))}.lct-dot{width:7px;height:7px;border-radius:50%;background:currentColor;margin-top:4px;flex:none}.lct-event div{display:flex;flex-direction:column;gap:2px}.lct-event strong{font-size:11px}.lct-event small,.lct-event p{font-size:10px;color:var(--muted,#999);margin:0}.lct-event p{margin-top:2px;line-height:1.4}';document.head.appendChild(css);
  new MutationObserver(ensure).observe(document.body,{childList:true,subtree:true}); ensure();
})();
