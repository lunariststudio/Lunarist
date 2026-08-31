// Lunarist ↔ Eugene Card integration.
(function(){
  if(typeof window==='undefined'||window.__lunaristEugeneIntegration)return;
  const EUGENE='https://eugene-card-1.vercel.app';
  const LUNARIST='https://lunaristudio.vercel.app';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toastMsg=m=>{if(typeof toast==='function')toast(m);};
  let cardUrl='';

  function lunaristUrl(){
    const username=window.state?.currentMember?.username||window.state?.currentUser?.user_metadata?.username||'';
    return username ? `${LUNARIST}/${encodeURIComponent(username)}` : LUNARIST;
  }

  async function loadCardUrl(){
    if(!window.supabaseClient||!window.state?.currentUser)return '';
    try{
      const r=await supabaseClient.from('profiles').select('eugene_card_url').eq('id',state.currentUser.id).maybeSingle();
      cardUrl=r.data?.eugene_card_url||'';
    }catch(e){}
    return cardUrl;
  }

  function openModal(){
    if(document.getElementById('eugeneLinkModal'))return;
    const modal=document.createElement('div');modal.id='eugeneLinkModal';
    modal.innerHTML=`<div class="panel" style="width:min(620px,94vw);position:relative;padding:24px"><button id="eugeneLinkClose" class="btn" style="position:absolute;right:14px;top:14px">×</button><div class="eyebrow">LUNARIST × EUGENE CARD</div><h2 style="margin:5px 0 8px">Connect your Eugene Card</h2><p class="meta">Link your public Eugene Card to your Lunarist profile. The connection stays in Lunarist's Supabase profile record; no credentials are shared between the two apps.</p><div class="field" style="margin-top:16px"><label>Eugene Card URL</label><input id="eugeneCardUrlInput" type="url" placeholder="https://eugene-card-1.vercel.app/..." value="${esc(cardUrl)}"></div><div class="heroactions"><button class="btn primary" id="eugeneLinkSave">Save connection</button>${cardUrl?'<button class="btn" id="eugeneLinkOpen">Open Eugene Card</button>':''}<button class="btn" id="eugeneLunaristOpen">Open Lunarist Profile</button></div><div class="meta" id="eugeneLinkStatus" style="margin-top:10px"></div></div>`;
    Object.assign(modal.style,{position:'fixed',inset:'0',zIndex:'10050',display:'flex',alignItems:'center',justifyContent:'center',padding:'18px',background:'rgba(2,1,6,.82)',backdropFilter:'blur(16px)'});
    document.body.appendChild(modal);
    const close=()=>modal.remove();document.getElementById('eugeneLinkClose').onclick=close;modal.addEventListener('click',e=>{if(e.target===modal)close()});
    document.getElementById('eugeneLinkSave').onclick=async()=>{
      const input=document.getElementById('eugeneCardUrlInput'),status=document.getElementById('eugeneLinkStatus');
      const value=input.value.trim();
      if(value&&!/^https:\/\/eugene-card-1\.vercel\.app(?:\/|$)/i.test(value)){status.textContent='Please use your public Eugene Card URL.';return;}
      if(!window.supabaseClient||!window.state?.currentUser){status.textContent='Please sign in first.';return;}
      const b=document.getElementById('eugeneLinkSave');b.disabled=true;status.textContent='Saving…';
      const r=await supabaseClient.from('profiles').update({eugene_card_url:value||null,updated_at:new Date().toISOString()}).eq('id',state.currentUser.id);
      b.disabled=false;
      if(r.error){status.textContent=r.error.message;return;}
      cardUrl=value;state.currentMember&&(state.currentMember.eugene_card_url=value);status.textContent='Connected.';toastMsg('Eugene Card connected.');setTimeout(close,450);
    };
    document.getElementById('eugeneLinkOpen')?.addEventListener('click',()=>{if(cardUrl)window.open(cardUrl,'_blank','noopener,noreferrer')});
    document.getElementById('eugeneLunaristOpen')?.addEventListener('click',()=>window.open(lunaristUrl(),'_blank','noopener,noreferrer'));
  }

  function addNavButton(){
    const nav=document.getElementById('navlinks');if(!nav||document.getElementById('navEugeneCardBtn'))return;
    const b=document.createElement('button');b.className='navbtn';b.id='navEugeneCardBtn';b.textContent='Eugene Card';b.title='Connect Eugene Card';b.onclick=async()=>{await loadCardUrl();openModal()};
    const client=document.getElementById('navClientSpaceBtn');nav.insertBefore(b,client||nav.firstChild);
  }

  function enhancePublicProfile(){
    const path=location.pathname.replace(/^\/+|\/+$/g,'');
    if(!path||path.includes('/')||/^(login|signup|discover|projects|profile|admin|settings|member-space|my-commission|clients)$/i.test(path))return;
    if(document.getElementById('lunaristEugenePublicBtn'))return;
    const sb=window.supabaseClient||window.supabase||window._supabase;if(!sb)return;
    sb.from('profiles').select('eugene_card_url').eq('username',path).maybeSingle().then(r=>{
      const url=r.data?.eugene_card_url;if(!url)return;
      const host=document.querySelector('.lpm-copy')||document.querySelector('.lunarist-public-member-profile');if(!host)return;
      const a=document.createElement('a');a.id='lunaristEugenePublicBtn';a.className='btn';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Eugene Card ↗';a.style.cssText='display:inline-flex;margin:12px 8px 0 0;text-decoration:none';host.appendChild(a);
    }).catch(()=>{});
  }

  function handleEugeneReturn(){
    const p=new URLSearchParams(location.search);const from=p.get('eugene');
    if(from){sessionStorage.setItem('lunaristEugeneReturn',from);}
  }

  const style=document.createElement('style');style.textContent='#navEugeneCardBtn{color:var(--gold)}#navEugeneCardBtn:hover{color:var(--text)}';document.head.appendChild(style);
  handleEugeneReturn();
  const timer=setInterval(()=>{addNavButton();enhancePublicProfile();if(window.state?.currentUser)loadCardUrl();},1200);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
  window.__lunaristEugeneIntegration=true;
})();
