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
  let busy=false;
  async function scan(){
    if(busy)return;busy=true;
    try{
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
