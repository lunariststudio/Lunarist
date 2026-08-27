// Lunarist: REAL Project Slides persistence — wait for the app's Supabase client/auth to initialize.
(function(){
  if(typeof window==='undefined'||window.__LUNARIST_SLIDES_REAL_SAVE_V3__)return;
  window.__LUNARIST_SLIDES_REAL_SAVE_V3__=true;
  const q=s=>document.querySelector(s), sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const notify=m=>{try{window.toast?.(m)}catch{} console.log('[Lunarist Slides]',m)};
  async function ready(timeout=15000){
    const start=Date.now();
    while(Date.now()-start<timeout){
      const sb=window.supabaseClient;
      if(sb?.auth){
        try{const {data}=await sb.auth.getSession(); if(data?.session)return {sb,user:(await sb.auth.getUser()).data.user};}catch{}
      }
      await sleep(250);
    }
    throw new Error('Supabase client/auth did not initialize. Please refresh the page.');
  }
  function readSlides(){
    const root=q('#lsSlidesGrid')||q('#lsSlidesGridV2')||q('.ls-slides-grid');if(!root)return [];
    return [...root.children].filter(x=>x.matches('.ls-slide,.lsv2item,.project-slide')).map((card,i)=>{
      const img=card.querySelector('img'),video=card.querySelector('video'),frame=card.querySelector('iframe');
      const link=card.querySelector('.ls-slide-link a')?.href||card.querySelector('.ls-slide-link')?.textContent?.trim()||'';
      let url=link||img?.currentSrc||img?.src||video?.currentSrc||video?.src||'',type=video?'video':(img?'image':'link'),platform=null;
      if(frame){const src=frame.src||'';type='link';url=link||src;if(src.includes('youtube'))platform='youtube';else if(src.includes('twitch'))platform='twitch';else if(src.includes('twitter')||src.includes('x.com'))platform='x';else if(src.includes('instagram'))platform='instagram'}
      const badge=card.querySelector('.ls-num')?.textContent||'',pm=badge.match(/·\s*([A-Za-z]+)/);if(pm)platform=pm[1].toLowerCase();
      const title=card.querySelector('[data-slide-title],[data-lsv2title],.project-slide-title'),desc=card.querySelector('[data-slide-desc],[data-lsv2desc],.project-slide-desc');
      const id=card.querySelector('[data-slide-del]')?.dataset.slideDel||crypto.randomUUID?.()||String(Date.now()+i);
      return{id,type,platform,url,title:title?.value||title?.textContent?.trim()||`Slide ${i+1}`,description:desc?.value||desc?.textContent?.trim()||'',position:i+1};
    }).filter(x=>x.url);
  }
  async function resolveProject(form,title,user,sb){
    if(form?.dataset?.lsProjectId)return form.dataset.lsProjectId;
    const cached=window.data?.projects?.find(p=>String(p.title||'').trim()===title&&(String(p.owner_id||'')===String(user.id)||String(p.member||'')===String(user.id)));
    if(cached?.id)return cached.id;
    const r=await sb.from('projects').select('id').eq('owner_id',user.id).eq('title',title).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(r.error)throw r.error;return r.data?.id||null;
  }
  async function save(form,title,slides){
    const {sb,user}=await ready();if(!user)throw new Error('You are not signed in.');
    const id=await resolveProject(form,title,user,sb);if(!id)throw new Error('Project has not been created in the database yet.');
    const r=await sb.from('projects').update({slides,updated_at:new Date().toISOString()}).eq('id',id).eq('owner_id',user.id).select('id,slides').single();
    if(r.error)throw r.error;if(String(r.data?.id)!==String(id))throw new Error('Database did not confirm the project update.');
    const stored=Array.isArray(r.data?.slides)?r.data.slides:[];
    if(JSON.stringify(stored)!==JSON.stringify(slides))throw new Error('Database returned different slide data.');
    return{id,count:stored.length};
  }
  function bind(){
    const form=q('#projectForm'),button=q('#saveProject');if(!form||!button||button.dataset.slidesAuthFixV3)return;button.dataset.slidesAuthFixV3='1';
    button.addEventListener('click',async()=>{const title=q('#pjTitle')?.value?.trim()||'',initial=readSlides();let ok=false,last;try{const r=await save(form,title,initial);ok=true;notify(`Slides saved to database (${r.count}).`)}catch(e){last=e}if(!ok){for(const delay of [900,1800,3000,5000]){await sleep(delay);try{const r=await save(form,title,readSlides());ok=true;notify(`Slides saved to database (${r.count}).`);break}catch(e){last=e}}}if(!ok)notify(`Slides NOT saved: ${last?.message||'database write was not confirmed'}`)},true);
  }
  const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(bind,50)});obs.observe(document.body,{childList:true,subtree:true});bind();
})();
