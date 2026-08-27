// Lunarist: real Project Slides persistence fix.
// The previous UI could show a successful Save while the project row was never updated.
(function(){
  if(typeof window==='undefined'||window.__lunaristSlidesPersistFix)return;
  window.__lunaristSlidesPersistFix=true;

  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toastMsg(message){
    try{ if(typeof window.toast==='function') window.toast(message); else console.log('[Lunarist Slides]',message); }catch{}
  }

  function currentUserId(){
    return window.state?.currentUser?.id || window.supabaseClient?.auth?.getUser?.()?.data?.user?.id || null;
  }

  function readSlidesFromUI(){
    const cards=qa('#lsSlidesGrid .ls-slide');
    return cards.map((card,index)=>{
      const badge=card.querySelector('.ls-num')?.textContent||'';
      const platformMatch=badge.match(/·\s*([A-Za-z]+)/);
      const platform=platformMatch?platformMatch[1].toLowerCase():null;
      const linkEl=card.querySelector('.ls-slide-link');
      const url=linkEl?.textContent?.trim() || card.querySelector('img')?.getAttribute('src') || card.querySelector('video')?.getAttribute('src') || '';
      const type=linkEl?'link':(card.querySelector('video')?'video':'image');
      const title=card.querySelector('[data-slide-title]')?.value || '';
      const description=card.querySelector('[data-slide-desc]')?.value || '';
      const id=card.querySelector('[data-slide-del]')?.dataset.slideDel || crypto.randomUUID?.() || String(Date.now()+index);
      return {id,type,platform,url,title,description,position:index+1};
    }).filter(x=>x.url);
  }

  async function resolveProjectId(title){
    const uid=currentUserId();
    if(!uid||!window.supabaseClient||!title)return null;
    const form=q('#projectForm');
    if(form?.dataset?.lsProjectId)return form.dataset.lsProjectId;
    // First use the loaded project object when available.
    if(Array.isArray(window.data?.projects)){
      const p=window.data.projects.find(x=>String(x.title||'').trim()===title && String(x.owner_id||x.member||'')===String(uid));
      if(p?.id)return p.id;
    }
    // Then query Supabase. This intentionally uses owner_id (not the old `member` field).
    const r=await window.supabaseClient.from('projects').select('id,created_at').eq('owner_id',uid).eq('title',title).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(r.error)throw r.error;
    return r.data?.id||null;
  }

  async function saveSlides(title){
    if(!window.supabaseClient)throw new Error('Supabase client is not available.');
    if(!currentUserId())throw new Error('You are not signed in.');
    const slides=readSlidesFromUI();
    let id=await resolveProjectId(title);
    if(!id)throw new Error('Project record has not been created yet.');
    const r=await window.supabaseClient.from('projects')
      .update({slides,updated_at:new Date().toISOString()})
      .eq('id',id)
      .eq('owner_id',currentUserId())
      .select('id,slides')
      .single();
    if(r.error)throw r.error;
    if(!r.data?.id)throw new Error('Supabase did not confirm the project update.');
    // Verify the value that was actually stored, not just the update response.
    const check=await window.supabaseClient.from('projects').select('id,slides').eq('id',id).single();
    if(check.error)throw check.error;
    const stored=Array.isArray(check.data?.slides)?check.data.slides:[];
    if(JSON.stringify(stored)!==JSON.stringify(slides))throw new Error('Supabase verification failed: stored Slides do not match.');
    return {id,count:stored.length};
  }

  function bind(button){
    if(!button||button.dataset.realSlidesSaveBound)return;
    button.dataset.realSlidesSaveBound='1';
    // Capture phase runs before the existing save handler. For an existing project
    // this writes the slide JSON before the modal is torn down.
    button.addEventListener('click',async function(){
      const title=q('#pjTitle')?.value?.trim();
      if(!title)return;
      let done=false;
      try{
        const result=await saveSlides(title);
        done=true;
        toastMsg(`Slides actually saved to Supabase (${result.count}).`);
      }catch(firstError){
        // New projects do not have an id until the normal Create/Save handler runs.
        // Retry after it has created the row, then verify the database value.
        const delays=[1200,2200,4000,6500];
        for(const delay of delays){
          await new Promise(r=>setTimeout(r,delay));
          try{
            const result=await saveSlides(title);
            done=true;
            toastMsg(`Slides actually saved to Supabase (${result.count}).`);
            break;
          }catch{}
        }
        if(!done)toastMsg(`Slides were NOT confirmed saved: ${firstError?.message||'unknown error'}`);
      }
    },true);
  }

  const obs=new MutationObserver(()=>{const b=q('#saveProject');if(b)bind(b)});
  obs.observe(document.body,{childList:true,subtree:true});
  bind(q('#saveProject'));
})();
