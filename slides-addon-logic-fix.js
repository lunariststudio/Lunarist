// Lunarist: final Slides-as-Add-on compatibility layer.
(function(){
  if(typeof window==='undefined'||window.__lunaristSlidesAddonFix)return;
  window.__lunaristSlidesAddonFix=true;
  const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
  const isSlidesRow=row=>{const t=row?.querySelector('.aoTitle')?.value?.trim()||'';const type=row?.querySelector('.aoType')?.value||'';return /^slides?$/i.test(t)||type==='slides'||(type==='duration'&&/\bslides?\b/i.test(t));};
  function setupRows(){
    qsa('.addonRow').forEach(row=>{
      const type=row.querySelector('.aoType');if(!type)return;
      if(![...type.options].some(o=>o.value==='slides')){const o=document.createElement('option');o.value='slides';o.textContent='Slides';type.appendChild(o);}
      if(isSlidesRow(row)){
        row.dataset.lsSlides='1';
        if(type.value==='duration')type.value='slides';
        const p=row.querySelector('.aoPrice');if(p)p.placeholder='Price / slide';
        const th=row.querySelector('.aoThreshold');if(th){th.value='0';th.style.display='none';}
        const unit=row.querySelector('.aoUnit');if(unit){unit.value='1';unit.style.display='none';}
      }
    });
  }
  function prepareSave(){
    qsa('.addonRow').forEach(row=>{
      if(!isSlidesRow(row))return;
      const type=row.querySelector('.aoType');if(type)type.value='duration';
      row.dataset.lsSlides='1';
      const th=row.querySelector('.aoThreshold');if(th)th.value='0';
      const unit=row.querySelector('.aoUnit');if(unit)unit.value='1';
    });
  }
  function inquiry(){
    const input=qs('#inqVideoDuration');if(!input)return;
    const selected=qsa('.modalAddonCheck:checked').some(cb=>/\bslides?\b/i.test(cb.closest('.addon-box')?.textContent||''));
    if(!selected)return;
    const f=input.closest('.field'),label=f?.querySelector('label'),meta=f?.querySelector('.meta');
    if(label)label.textContent='Number of Slides *';
    if(meta)meta.textContent='Enter the number of slides. This add-on is charged per slide.';
    input.placeholder='e.g. 5';
    if(!input.dataset.lsBound){
      input.dataset.lsBound='1';
      input.addEventListener('input',()=>{
        const n=Math.max(0,Math.floor(Number(String(input.value).replace(/\D/g,''))||0));
        input.value=n?`00:${String(Math.min(59,n)).padStart(2,'0')}`:'00:00';
      });
    }
  }
  function removeStandalone(){
    qsa('#lsPriceSlidesPanel').forEach(e=>e.remove());
    qsa('.ls-price-panel').forEach(e=>e.closest('.field')?.remove());
    qsa('.slide-pricing-box').forEach(e=>e.remove());
  }
  function boot(){removeStandalone();setupRows();inquiry();}
  const mo=new MutationObserver(boot);
  function start(){boot();mo.observe(document.body,{subtree:true,childList:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const text=(b.textContent||'').trim().toLowerCase();
    if(text.includes('save')&&qs('#serviceForm')){prepareSave();setTimeout(boot,150);}
  },true);
})();
