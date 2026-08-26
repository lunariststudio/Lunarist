(()=>{
  const cacheKey='lunarist_addon_ja_v1';
  const fallback={
    'Commercial Use':'商用利用',
    'Rush-fee':'特急料金',
    'Rush Fee':'特急料金',
    'Extra Revision':'追加修正',
    'Video over 3 minutes will be charged +$10/30 sec':'3分を超える動画は30秒ごとに+$10',
    'Add-ons & Custom Options':'追加オプション・カスタム項目',
    'Video Duration (mm:ss) *':'動画の長さ（mm:ss） *',
    'Automatic price calculation':'自動価格計算'
  };
  let rate=0, lastTitle='', service=null;
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const lang=()=>$('.lang-switch [data-lang="ja"]')?.classList.contains('active')?'ja':'en';
  const toast=(m)=>{try{window.toast?.(m)}catch{}};
  async function getRate(){
    if(rate)return rate;
    const r=await fetch('/api/exchange?from=USD&to=JPY',{cache:'no-store'});const d=await r.json();
    if(!r.ok||!Number(d?.rate))throw Error(d?.error||'Exchange rate unavailable'); rate=Number(d.rate);return rate;
  }
  async function loadService(){
    const h=$('h2'); if(!h)return null;
    const text=(h.textContent||'').trim(); const m=text.match(/^Inquire\s*[—-]\s*(.+)$/); if(!m)return null;
    if(m[1]===lastTitle&&service)return service; lastTitle=m[1];
    const r=await fetch('/api/lunarist?resource=services',{cache:'no-store'});const list=await r.json();
    const rows=Array.isArray(list)?list:(Array.isArray(list?.services)?list.services:[]);
    service=rows.find(x=>String(x.title||'').trim()===m[1])||null; return service;
  }
  function durationBox(){return $('#inqVideoDuration')?.closest('.field')||null}
  function durationSelected(){
    const s=service?.add_ons||[];
    return $$('.modalAddonCheck').some(cb=>{const ao=s[Number(cb.dataset.idx)];return ao?.type==='duration'&&cb.checked});
  }
  function syncDuration(){
    const box=durationBox(); if(!box)return;
    const on=durationSelected(); box.style.display=on?'flex':'none';
    const input=$('#inqVideoDuration'); if(input){input.required=on;if(!on)input.value='';}
  }
  function seconds(v){const m=String(v||'').trim().match(/^(\d+):(\d{1,2})$/);if(m)return Number(m[1])*60+Number(m[2]);if(/^\d+$/.test(v))return Number(v)*60;return 0}
  function validDuration(){const cb=$$('.modalAddonCheck').find(x=>service?.add_ons?.[Number(x.dataset.idx)]?.type==='duration'&&x.checked);if(!cb)return true;const input=$('#inqVideoDuration');return !!input&&seconds(input.value)>0&&seconds(input.value)<=86400&&/^\d{1,3}:\d{2}$/.test(input.value.trim())}
  function installValidation(){
    ['payPaypalBtn','payCardBtn','sendInquiryBtn'].forEach(id=>{const b=$('#'+id);if(!b||b.dataset.durationGuard)return;b.dataset.durationGuard='1';b.addEventListener('click',e=>{if(durationSelected()&&!validDuration()){e.preventDefault();e.stopImmediatePropagation();const input=$('#inqVideoDuration');syncDuration();input?.focus();toast(lang()==='ja'?'動画の長さを入力してください（例：04:30）。':'Please enter the video duration (e.g. 04:30).');}},true)});
  }
  async function translateAddons(){
    const ja=lang()==='ja'; const boxes=$$('.modalAddonCheck'); if(!boxes.length)return;
    const s=service?.add_ons||[];
    for(const cb of boxes){
      const ao=s[Number(cb.dataset.idx)]; if(!ao)continue;
      const span=cb.closest('label')?.querySelector('span:not([style])'); if(!span)continue;
      const original=span.dataset.originalText||span.textContent.trim(); span.dataset.originalText=original;
      if(!ja){span.textContent=original;continue}
      if(fallback[original]){span.textContent=fallback[original];continue}
      try{
        const key=cacheKey+'_'+original;const cached=localStorage.getItem(key);if(cached){span.textContent=cached;continue}
        const r=await fetch('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'translate_addon',text:original})});
        const d=await r.json();if(r.ok&&d.translation){span.textContent=d.translation;localStorage.setItem(key,d.translation)}
      }catch{}
    }
  }
  async function convertCurrency(){
    const area=$('#view'); if(!area)return;
    const els=[...area.querySelectorAll('#svcPriceBreakdown,#depositAmountLabel,#fullAmountLabel,#inquirySubtext')];
    const all=[];els.forEach(el=>{if(el)all.push(el,...el.querySelectorAll('*'))});
    if(lang()==='en'){
      all.forEach(el=>{if(el.dataset?.usdText!=null)el.textContent=el.dataset.usdText});return;
    }
    let r;try{r=await getRate()}catch{return}
    all.forEach(el=>{
      if(el.children.length) return;
      const text=el.textContent||''; if(!/\$\s*\d+(?:\.\d+)?/.test(text))return;
      if(el.dataset.usdText==null)el.dataset.usdText=text;
      el.textContent=el.dataset.usdText.replace(/\$\s*(\d+(?:\.\d+)?)/g,(_,n)=>`¥${Math.round(Number(n)*r).toLocaleString('ja-JP')}`).replace(/\bUSD\b/g,'JPY');
    });
  }

  /* Member editor popup patch.
     The main index still owns the real Supabase save/update logic. We only move
     those existing forms into a proper modal, so no database behavior is duplicated.
  */
  let editorModal=null;
  let editorBody=null;
  let editorStage=null;
  let originalOpenDashboard=null;
  let originalShowProjectForm=null;
  let originalShowServiceForm=null;

  function installEditorStyles(){
    if(document.getElementById('lunarist-editor-popup-style'))return;
    const style=document.createElement('style');
    style.id='lunarist-editor-popup-style';
    style.textContent=`
      #lunaristEditorModal{z-index:500;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,1,6,.82);backdrop-filter:blur(16px)}
      #lunaristEditorModal.open{display:flex}
      #lunaristEditorModal .editor-popup-box{width:min(980px,100%);max-height:92vh;overflow:auto;background:#100e18;border:1px solid var(--line);border-radius:24px;box-shadow:var(--shadow);padding:0;transform:translateY(14px) scale(.985);opacity:0;transition:transform .3s var(--ease),opacity .25s var(--ease)}
      #lunaristEditorModal.open .editor-popup-box{transform:none;opacity:1}
      #lunaristEditorModal .editor-popup-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--line);background:rgba(16,14,24,.94);backdrop-filter:blur(14px)}
      #lunaristEditorModal .editor-popup-head h2{margin:0;font-size:20px}
      #lunaristEditorModal .editor-popup-body{padding:20px}
      #lunaristEditorModal .editor-popup-body>.panel{margin:0!important;border:0!important;background:transparent!important;padding:0!important;box-shadow:none!important}
      #lunaristEditorModal .editor-popup-body .heroactions{position:sticky;bottom:-20px;z-index:3;margin:20px -20px -20px;padding:14px 20px;background:rgba(16,14,24,.96);border-top:1px solid var(--line);backdrop-filter:blur(14px)}
      @media(max-width:720px){#lunaristEditorModal{padding:8px}#lunaristEditorModal .editor-popup-box{max-height:96vh;border-radius:18px}#lunaristEditorModal .editor-popup-head{padding:14px 16px}#lunaristEditorModal .editor-popup-body{padding:16px}#lunaristEditorModal .editor-popup-body .heroactions{margin:16px -16px -16px;padding:12px 16px;flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }

  function ensureEditorModal(){
    if(editorModal)return;
    installEditorStyles();
    editorStage=document.createElement('div');
    editorStage.id='lunaristEditorStage';
    editorStage.style.display='none';
    document.body.appendChild(editorStage);

    editorModal=document.createElement('div');
    editorModal.id='lunaristEditorModal';
    editorModal.className='modal';
    editorModal.innerHTML=`<div class="editor-popup-box" role="dialog" aria-modal="true" aria-labelledby="lunaristEditorTitle"><div class="editor-popup-head"><h2 id="lunaristEditorTitle">Edit</h2><button type="button" class="iconbtn" id="lunaristEditorClose" aria-label="Close">×</button></div><div class="editor-popup-body" id="lunaristEditorBody"></div></div>`;
    document.body.appendChild(editorModal);
    editorBody=document.getElementById('lunaristEditorBody');
    document.getElementById('lunaristEditorClose').onclick=closeEditor;
    editorModal.addEventListener('click',e=>{if(e.target===editorModal)closeEditor()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&editorModal?.classList.contains('open'))closeEditor()});
  }

  function closeEditor(){
    if(!editorModal)return;
    editorModal.classList.remove('open');
    document.body.style.overflow='';
    if(editorBody&&editorBody.firstChild){
      const form=document.getElementById('projectForm')||document.getElementById('serviceForm');
      if(form){
        while(editorBody.firstChild)form.appendChild(editorBody.firstChild);
        form.innerHTML='';
      }
    }
  }

  function moveCurrentFormToPopup(kind,existing){
    ensureEditorModal();
    const id=kind==='project'?'projectForm':'serviceForm';
    const form=document.getElementById(id);
    if(!form)return;
    while(editorBody.firstChild)editorBody.removeChild(editorBody.firstChild);
    while(form.firstChild)editorBody.appendChild(form.firstChild);
    const title=kind==='project'?(existing?'Edit project':'New project'):(existing?'Edit service':'New service');
    document.getElementById('lunaristEditorTitle').textContent=title;
    editorModal.classList.add('open');
    document.body.style.overflow='hidden';

    const cancelId=kind==='project'?'cancelProject':'cancelService';
    document.getElementById(cancelId)?.addEventListener('click',()=>closeEditor(),{once:true});

    const saveId=kind==='project'?'saveProject':'saveService';
    const save=document.getElementById(saveId);
    if(save){
      save.addEventListener('click',()=>{
        // The original handler performs validation and the Supabase write.
        // Keep the popup open on validation/database errors; successful writes
        // call openDashboard(), which is wrapped below to close this popup.
        setTimeout(()=>{
          const msg=document.getElementById(kind==='project'?'projectMsg':'serviceMsg');
          if(msg&&msg.textContent.trim())return;
        },100);
      },{once:true});
    }
  }

  function installEditorPopups(){
    if(!window.showProjectForm||!window.showServiceForm||window.__lunaristEditorPopupInstalled)return;
    window.__lunaristEditorPopupInstalled=true;
    originalShowProjectForm=window.showProjectForm;
    originalShowServiceForm=window.showServiceForm;
    originalOpenDashboard=window.openDashboard;

    window.openDashboard=function(){
      const result=originalOpenDashboard.apply(this,arguments);
      if(editorModal?.classList.contains('open'))closeEditor();
      return result;
    };

    window.showProjectForm=function(existing=null){
      ensureEditorModal();
      editorStage.appendChild(document.getElementById('projectForm')||document.createElement('div'));
      const form=editorStage.querySelector('#projectForm');
      if(form)document.body.appendChild(form);
      originalShowProjectForm.call(this,existing);
      moveCurrentFormToPopup('project',existing);
    };

    window.showServiceForm=function(existing=null){
      ensureEditorModal();
      const current=document.getElementById('serviceForm');
      if(current)editorStage.appendChild(current);
      const form=editorStage.querySelector('#serviceForm');
      if(form)document.body.appendChild(form);
      originalShowServiceForm.call(this,existing);
      moveCurrentFormToPopup('service',existing);
    };
  }

  let busy=false;
  async function scan(){
    if(busy)return;busy=true;
    try{
      installEditorPopups();
      const s=await loadService();if(!s){lastTitle='';service=null;return}
      syncDuration();installValidation();await translateAddons();await convertCurrency();
    }finally{busy=false}
  }
  const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(scan,30)});obs.t=null;
  obs.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.addEventListener('change',e=>{if(e.target.matches('.modalAddonCheck')){scan()}},{capture:true});
  document.addEventListener('click',e=>{if(e.target.closest('.lang-switch'))setTimeout(scan,80)},{capture:true});
  const nativeFetch=window.fetch;
  window.fetch=async function(input,init){
    try{
      const url=typeof input==='string'?input:(input?.url||'');
      if(/\/api\/paypal(?:\?|$)/.test(url)&&init?.body&&lang()==='ja'&&typeof init.body==='string'){
        const body=JSON.parse(init.body);body.currency='JPY';init={...init,body:JSON.stringify(body)};
      }
    }catch{}
    return nativeFetch.apply(this,arguments);
  };
  scan();
})();
