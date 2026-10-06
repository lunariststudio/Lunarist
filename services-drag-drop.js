// Lunarist Services drag & drop ordering.
// Uses the existing public.services.sort_order column and the current user's services only.
(function(){
  if(typeof window==='undefined' || window.__lunaristServicesDnD)return;
  window.__lunaristServicesDnD=true;
  let timer=null, boundList=null, saving=false;

  function injectStyle(){
    if(document.getElementById('lunarist-services-dnd-style'))return;
    const s=document.createElement('style');
    s.id='lunarist-services-dnd-style';
    s.textContent=`
      #serviceList.service-reorder-list{display:flex;flex-direction:column;gap:8px}
      #serviceList .service-reorder-item{position:relative;transition:transform .16s ease,opacity .16s ease,box-shadow .16s ease;border:1px solid transparent}
      #serviceList .service-reorder-item.ls-dragging{opacity:.45;transform:scale(.99)}
      #serviceList .service-reorder-item.ls-drag-over{border-color:var(--gold);box-shadow:0 0 0 2px rgba(232,207,145,.12)}
      #serviceList .service-drag-handle{width:34px;height:34px;min-width:34px;padding:0;border:1px solid var(--line);border-radius:9px;background:rgba(255,255,255,.035);color:var(--muted);cursor:grab;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;touch-action:none;user-select:none}
      #serviceList .service-drag-handle:hover{color:var(--text);border-color:var(--gold)}
      #serviceList .service-drag-handle:active{cursor:grabbing}
      #serviceList .service-reorder-item[draggable=true]{cursor:default}
      #serviceList .service-reorder-item.ls-drop-placeholder{height:64px;border:1px dashed var(--gold);border-radius:12px;background:rgba(232,207,145,.04)}
      @media(max-width:700px){#serviceList .service-drag-handle{width:38px;height:38px;min-width:38px}}
    `;
    document.head.appendChild(s);
  }

  function currentUserId(){return window.state?.currentUser?.id||''}
  function list(){return document.getElementById('serviceList')}
  function items(){const l=list();return l?[...l.querySelectorAll(':scope > .service-reorder-item[data-service-reorder-id]')]:[]}
  function idOf(el){return el?.dataset?.serviceReorderId||''}

  async function saveOrder(){
    const l=list(); const uid=currentUserId(); if(!l||!uid||!window.supabaseClient||saving)return;
    const ids=items().map(idOf).filter(Boolean); if(!ids.length)return;
    saving=true;
    try{
      const results=await Promise.all(ids.map((id,index)=>supabaseClient.from('services').update({sort_order:index}).eq('id',id).eq('owner_id',uid)));
      const failed=results.find(r=>r?.error); if(failed)throw failed.error;
      if(Array.isArray(window.data?.services)){
        ids.forEach((id,index)=>{const s=window.data.services.find(x=>x.id===id);if(s)s.sort_order=index;});
      }
      if(Array.isArray(window.state?.myServices)) window.state.myServices.forEach(s=>{const i=ids.indexOf(s.id);if(i>=0)s.sort_order=i});
      window.toast?.('Service order saved.');
    }catch(e){
      window.toast?.('Could not save service order: '+(e?.message||'Unknown error'));
    }finally{saving=false}
  }

  function bind(){
    injectStyle();
    const l=list(); if(!l || !currentUserId())return;
    if(boundList===l && l.dataset.serviceDndBound==='1')return;
    boundList=l; l.dataset.serviceDndBound='1';
    let dragging=null, pointerDrag=null;

    l.addEventListener('dragstart',e=>{
      const item=e.target.closest('.service-reorder-item');
      if(!item || !e.target.closest('.service-drag-handle')){e.preventDefault();return}
      dragging=item; item.classList.add('ls-dragging');
      e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',idOf(item));
    });
    l.addEventListener('dragover',e=>{
      if(!dragging)return; e.preventDefault();
      const target=e.target.closest('.service-reorder-item');
      if(!target || target===dragging)return;
      const r=target.getBoundingClientRect();
      target.classList.add('ls-drag-over');
      if(e.clientY < r.top+r.height/2) l.insertBefore(dragging,target); else l.insertBefore(dragging,target.nextSibling);
    });
    l.addEventListener('dragleave',e=>{const target=e.target.closest('.service-reorder-item');target?.classList.remove('ls-drag-over')});
    l.addEventListener('dragend',async()=>{
      if(!dragging)return; dragging.classList.remove('ls-dragging'); items().forEach(x=>x.classList.remove('ls-drag-over')); dragging=null; await saveOrder();
    });

    // Pointer fallback for touch devices.
    l.addEventListener('pointerdown',e=>{
      const handle=e.target.closest('.service-drag-handle'); const item=e.target.closest('.service-reorder-item');
      if(!handle||!item||e.pointerType==='mouse')return;
      pointerDrag={item,id:idOf(item),x:e.clientX,y:e.clientY,active:false,pointerId:e.pointerId};
      handle.setPointerCapture?.(e.pointerId);
    });
    l.addEventListener('pointermove',e=>{
      if(!pointerDrag || e.pointerId!==pointerDrag.pointerId)return;
      if(!pointerDrag.active && Math.hypot(e.clientX-pointerDrag.x,e.clientY-pointerDrag.y)<8)return;
      pointerDrag.active=true; const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.service-reorder-item');
      if(!target||target===pointerDrag.item||target.parentElement!==l)return;
      const r=target.getBoundingClientRect(); target.classList.add('ls-drag-over');
      if(e.clientY<r.top+r.height/2)l.insertBefore(pointerDrag.item,target);else l.insertBefore(pointerDrag.item,target.nextSibling);
    });
    l.addEventListener('pointerup',async e=>{
      if(!pointerDrag||e.pointerId!==pointerDrag.pointerId)return;
      const didMove=pointerDrag.active; pointerDrag=null; items().forEach(x=>x.classList.remove('ls-drag-over'));
      if(didMove)await saveOrder();
    });
    l.addEventListener('pointercancel',()=>{pointerDrag=null;items().forEach(x=>x.classList.remove('ls-drag-over'))});
  }

  const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(bind,100)});
  obs.observe(document.body,{childList:true,subtree:true});
  bind();
})();
