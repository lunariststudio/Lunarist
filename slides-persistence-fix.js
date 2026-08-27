// Lunarist: REAL Project Slides persistence.
// Saves the actual slide editor state to the authenticated owner's project row,
// verifies the database write, and never reports success unless Supabase confirms it.
(function(){
  if(typeof window==='undefined'||window.__LUNARIST_SLIDES_REAL_SAVE__)return;
  window.__LUNARIST_SLIDES_REAL_SAVE__=true;
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const uid=()=>window.state?.currentUser?.id||null;
  const notify=m=>{try{if(typeof window.toast==='function')window.toast(m);else console.log('[Lunarist Slides]',m)}catch{}};

  function readSlides(){
    const root=q('#lsSlidesGrid')||q('#lsSlidesGridV2')||q('.ls-slides-grid');
    if(!root)return [];
    return [...root.children].filter(x=>x.matches('.ls-slide,.lsv2item,.project-slide')).map((card,i)=>{
      const img=card.querySelector('img'), video=card.querySelector('video');
      const linkText=card.querySelector('.ls-slide-link')?.textContent?.trim();
      const link=card.querySelector('.ls-slide-link a')?.href;
      let url=linkText||link||img?.currentSrc||img?.src||video?.currentSrc||video?.src||'';
      let type=video?'video':(img?'image':'link');
      let platform=null;
      const badge=card.querySelector('.ls-num')?.textContent||'';
      const pm=badge.match(/·\s*([A-Za-z]+)/); if(pm)platform=pm[1].toLowerCase();
      const frame=card.querySelector('iframe');
      if(frame && !linkText){
        const src=frame.src||''; url=src;
        type='link';
        if(src.includes('youtube'))platform='youtube';
        else if(src.includes('twitch'))platform='twitch';
        else if(src.includes('twitter')||src.includes('x.com'))platform='x';
        else if(src.includes('instagram'))platform='instagram';
      }
      const titleEl=card.querySelector('[data-slide-title],[data-lsv2title],.project-slide-title');
      const descEl=card.querySelector('[data-slide-desc],[data-lsv2desc],.project-slide-desc');
      const id=card.querySelector('[data-slide-del]')?.dataset.slideDel||crypto.randomUUID?.()||String(Date.now()+i);
      return {id,type,platform,url,title:titleEl?.value||titleEl?.textContent?.trim()||`Slide ${i+1}`,description:descEl?.value||descEl?.textContent?.trim()||'',position:i+1};
    }).filter(x=>x.url);
  }

  async function resolveId(form,title){
    const user=uid(); if(!user||!window.supabaseClient)throw new Error('Supabase authentication is not ready.');
    if(form?.dataset?.lsProjectId)return form.dataset.lsProjectId;
    if(Array.isArray(window.data?.projects)){
      const p=window.data.projects.find(x=>String(x.title||'').trim()===title && String(x.owner_id||x.member||'')===String(user));
      if(p?.id)return p.id;
    }
    const r=await window.supabaseClient.from('projects').select('id').eq('owner_id',user).eq('title',title).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(r.error)throw r.error;
    return r.data?.id||null;
  }

  async function persist(form,title,slides){
    if(!title)throw new Error('Project title is missing.');
    const user=uid(); if(!user)throw new Error('You are not signed in.');
    let id=await resolveId(form,title);
    if(!id)throw new Error('Project row is not created yet.');
    const payload={slides,updated_at:new Date().toISOString()};
    const r=await window.supabaseClient.from('projects').update(payload).eq('id',id).eq('owner_id',user).select('id,slides').single();
    if(r.error)throw r.error;
    if(String(r.data?.id)!==String(id))throw new Error('Supabase did not confirm the project update.');
    const stored=Array.isArray(r.data?.slides)?r.data.slides:[];
    if(JSON.stringify(stored)!==JSON.stringify(slides))throw new Error('Supabase returned different slide data.');
    const check=await window.supabaseClient.from('projects').select('id,slides').eq('id',id).eq('owner_id',user).single();
    if(check.error)throw check.error;
    if(JSON.stringify(check.data?.slides||[])!==JSON.stringify(slides))throw new Error('Database verification failed. Slides were not persisted.');
    return {id,count:stored.length};
  }

  function bind(){
    const form=q('#projectForm'), button=q('#saveProject');
    if(!form||!button||button.dataset.realSlidesPersistBound)return;
    button.dataset.realSlidesPersistBound='1';
    button.addEventListener('click',async()=>{
      const title=q('#pjTitle')?.value?.trim()||'';
      const slides=readSlides();
      let success=false,lastError=null;
      // Existing projects can be persisted immediately before the original save handler closes the modal.
      try{
        const result=await persist(form,title,slides);
        success=true;
        notify(`Slides saved to database (${result.count}).`);
      }catch(e){lastError=e}
      // New projects receive their UUID only after the normal Create/Save handler runs.
      if(!success){
        for(const delay of [900,1600,2800,4500,7000]){
          await sleep(delay);
          try{
            const result=await persist(form,title,readSlides());
            success=true;
            notify(`Slides saved to database (${result.count}).`);
            break;
          }catch(e){lastError=e}
        }
      }
      if(!success)notify(`Slides NOT saved: ${lastError?.message||'database write was not confirmed'}`);
    },true);
  }
  const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(bind,20)});
  obs.observe(document.body,{childList:true,subtree:true});
  bind();
})();
