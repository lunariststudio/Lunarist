// Lunarist deployed Project Slides persistence fix.
(function(){
  if(window.__LUNARIST_SLIDES_PERSIST_FIX__)return;window.__LUNARIST_SLIDES_PERSIST_FIX__=true;
  const q=s=>document.querySelector(s), sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function readSlides(){
    const root=q('#lsSlidesGrid')||q('#lsSlidesGridV2')||q('.ls-slides-grid'); if(!root)return [];
    return [...root.children].filter(x=>x.matches('.ls-slide,.lsv2item,.project-slide')).map((card,i)=>{
      const img=card.querySelector('img'),video=card.querySelector('video'),iframe=card.querySelector('iframe'),link=card.querySelector('blockquote a[href],a[href]');
      let url=img?.currentSrc||img?.src||video?.currentSrc||video?.src||link?.href||iframe?.src||'';
      let type=img?'image':video?'video':'link',platform='link';
      const iframeSrc=iframe?.src||''; const all=(url+' '+iframeSrc).toLowerCase();
      if(all.includes('youtube'))platform='youtube';else if(all.includes('twitch'))platform='twitch';else if(all.includes('x.com')||all.includes('twitter.com'))platform='x';else if(all.includes('instagram'))platform='instagram';
      if(platform==='youtube'&&iframeSrc){const m=iframeSrc.match(/\/embed\/([^?/#]+)/);if(m)url='https://youtu.be/'+m[1]}
      if(platform==='twitch'&&iframeSrc){const m=iframeSrc.match(/[?&](?:video|channel)=([^&]+)/);if(m)url='https://twitch.tv/'+decodeURIComponent(m[1])}
      const titleEl=card.querySelector('[data-slide-title],[data-lsv2title],.project-slide-title');
      const descEl=card.querySelector('[data-slide-desc],[data-lsv2desc],.project-slide-desc');
      return {id:crypto.randomUUID(),type,platform,url,title:titleEl?.value||titleEl?.textContent?.trim()||`Slide ${i+1}`,description:descEl?.value||descEl?.textContent?.trim()||'',position:i+1};
    }).filter(x=>x.url);
  }
  async function save(title,id,slides){
    if(typeof supabaseClient==='undefined'||typeof state==='undefined'||!state.currentUser)return;
    let pid=id||'';
    for(let i=0;i<12&&!pid;i++){try{const r=await supabaseClient.from('projects').select('id').eq('owner_id',state.currentUser.id).eq('title',title).order('created_at',{ascending:false}).limit(1).maybeSingle();pid=r.data?.id||''}catch{}if(!pid)await sleep(350)}
    if(!pid){console.warn('[Lunarist Slides] project not found after save');return}
    const r=await supabaseClient.from('projects').update({slides,updated_at:new Date().toISOString()}).eq('id',pid).eq('owner_id',state.currentUser.id);
    if(r.error)console.error('[Lunarist Slides] persistence failed:',r.error.message);else if(typeof toast==='function')toast(`Project Slides saved (${slides.length})`);
  }
  function bind(){const form=q('#projectForm'),button=q('#saveProject');if(!form||!button||button.dataset.slidePersistBound)return;button.dataset.slidePersistBound='1';button.addEventListener('click',()=>{const snapshot=readSlides(),title=q('#pjTitle')?.value.trim()||'',id=form.dataset.lsProjectId||'';save(title,id,snapshot)},true)}
  const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(bind,20)});obs.observe(document.body,{childList:true,subtree:true});bind();
})();
