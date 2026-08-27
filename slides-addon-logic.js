// Lunarist: Slides belong inside the existing Add-ons logic.
// Storage compatibility: Slides are represented by the existing duration add-on engine
// with threshold=0 and unit=1, while the UI presents them as slide count pricing.
(function(){
  if(typeof window==='undefined'||window.__lunaristSlidesAddonLogic)return;
  window.__lunaristSlidesAddonLogic=true;
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function cleanLegacy(){
    // Remove the old standalone Price / Slides panels and their containers.
    qa('#lsPriceSlidesPanel,#lsPriceRows,.slide-pricing-box').forEach(el=>{
      const panel=el.id==='lsPriceSlidesPanel'?el:el.closest('#lsPriceSlidesPanel')||el;
      if(panel&&panel.parentNode)panel.remove();
    });
    qa('[data-slide-price-rows]').forEach(el=>{const host=el.closest('.slide-pricing-box');if(host)host.remove();});
  }
  function addSlidesOption(select){
    if(!select||select.dataset.lsSlidesOption)return;
    select.dataset.lsSlidesOption='1';
    if(![...select.options].some(o=>o.value==='slides')){
      const opt=document.createElement('option');opt.value='slides';opt.textContent='Slides';select.appendChild(opt);
    }
    if(select.value==='slides')decorateRow(select.closest('.addonRow'));
  }
  function decorateRow(row){
    if(!row)return;
    const type=row.querySelector('.aoType');
    if(!type)return;
    if(type.value==='slides'){
      // Native duration calculation is used underneath: 0 included + $price per 1 slide.
      row.dataset.lsSlides='1';
      const price=row.querySelector('.aoPrice');
      if(price)price.placeholder='Price / slide';
      const threshold=row.querySelector('.aoThreshold');
      const unit=row.querySelector('.aoUnit');
      if(threshold){threshold.value='0';threshold.placeholder='Included slides';threshold.style.display='none';}
      if(unit){unit.value='1';unit.placeholder='Charge every slide';unit.style.display='none';}
    }else{
      delete row.dataset.lsSlides;
    }
  }
  function patchAddonRows(){
    qa('.aoType').forEach(select=>{
      addSlidesOption(select);
      if(!select.dataset.lsSlidesBound){
        select.dataset.lsSlidesBound='1';
        select.addEventListener('change',()=>{
          // The existing add-on save logic expects a known engine type.
          // Keep Slides as a UI-only type and normalize it immediately before save via hidden fields.
          decorateRow(select.closest('.addonRow'));
          if(select.value==='slides'){
            const row=select.closest('.addonRow');
            const threshold=row?.querySelector('.aoThreshold');
            const unit=row?.querySelector('.aoUnit');
            if(threshold)threshold.value='0';
            if(unit)unit.value='1';
          }
        });
      }
      decorateRow(select.closest('.addonRow'));
    });
  }
  function patchInquiry(){
    const modal=q('#inquiryModal')||q('#inquireModal');
    if(!modal)return;
    // Existing duration add-on UI creates this field. Slides uses the same calculation
    // engine but presents a clean integer slide count to the client.
    const duration=q('#inqVideoDuration');
    const selected=qa('.modalAddonCheck:checked').some(cb=>{
      const root=cb.closest('.addon-box');
      return /\bslides?\b/i.test(root?.textContent||'') && !/video duration/i.test(root?.textContent||'');
    });
    if(duration && selected){
      duration.dataset.lsSlidesInput='1';
      const field=duration.closest('.field');
      const label=field?.querySelector('label');
      const meta=field?.querySelector('.meta');
      if(label)label.textContent='Number of Slides *';
      if(meta)meta.textContent='Enter the number of slides. Slides are priced automatically using the Slides add-on rate.';
      duration.placeholder='e.g. 5';
      if(!duration.dataset.lsSlidesBound){
        duration.dataset.lsSlidesBound='1';
        duration.addEventListener('input',()=>{
          const n=Math.max(0,Math.floor(Number(String(duration.value).replace(/[^0-9]/g,''))||0));
          // Native duration parser interprets MM:SS. Encode slide count as seconds.
          duration.value=n?`00:${String(Math.min(59,n)).padStart(2,'0')}`:'00:00';
          if(n>59) duration.dataset.lsSlideCount=String(n);
          else delete duration.dataset.lsSlideCount;
          // Native refresh listener will run after this event.
        });
      }
    }
  }
  function normalizeForNative(){
    // Convert the Slides UI option to the native duration type immediately before
    // the application's existing service save serializes .aoType.
    qa('.addonRow').forEach(row=>{
      const type=row.querySelector('.aoType');
      if(type?.value==='slides'){
        type.value='duration';
        row.dataset.lsSlides='1';
        const threshold=row.querySelector('.aoThreshold'),unit=row.querySelector('.aoUnit');
        if(threshold)threshold.value='0';
        if(unit)unit.value='1';
      }
    });
  }
  function restoreSlidesLabels(){
    qa('.addonRow[data-ls-slides]').forEach(row=>{
      const type=row.querySelector('.aoType');
      if(type && type.value==='duration'){
        const option=[...type.options].find(o=>o.value==='duration');
        if(option)option.textContent='Slides';
        const price=row.querySelector('.aoPrice');if(price)price.placeholder='Price / slide';
      }
    });
  }
  function boot(){
    cleanLegacy();
    patchAddonRows();
    patchInquiry();
    restoreSlidesLabels();
  }
  const mo=new MutationObserver(()=>{cleanLegacy();patchAddonRows();patchInquiry();restoreSlidesLabels();});
  function start(){boot();mo.observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  // Capture the service-save action so Slides are stored with the native, already-supported
  // duration pricing fields and never as a standalone slide_pricing service feature.
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    const text=(b.textContent||'').trim().toLowerCase();
    if(text.includes('save')&&document.querySelector('#serviceForm'))setTimeout(()=>{patchAddonRows();restoreSlidesLabels();},0);
  },true);
})();
