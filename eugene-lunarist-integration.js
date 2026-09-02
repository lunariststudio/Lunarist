// Lunarist ↔ Eugene Card integration.
// Lunarist-side, user-controlled account/profile linking.
// Lunarist stores the public Eugene Card profile URL only; no passwords, tokens, or service-role secrets.
(function(){
  if(typeof window==='undefined'||window.__lunaristEugeneIntegration)return;
  const EUGENE='https://eugene-card-1.vercel.app';
  const LUNARIST='https://lunaristudio.vercel.app';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toastMsg=m=>{try{window.toast?.(m)}catch{}};
  let cardUrl='';

  function currentUsername(){return String(window.state?.currentMember?.username||window.state?.currentUser?.user_metadata?.username||'').trim().replace(/^@/,'')}
  function lunaristUrl(username=currentUsername()){return username?`${LUNARIST}/${encodeURIComponent(username)}`:LUNARIST}
  function cardProfileUrl(username){const u=String(username||'').trim().replace(/^@/,'');return u?`${EUGENE}/${encodeURIComponent(u)}`:''}
  function validCardUrl(value){try{const u=new URL(String(value||''));return u.protocol==='https:'&&u.origin===EUGENE}catch{return false}}
  function normalizeCardUrl(value){const v=String(value||'').trim();if(!v)return '';return validCardUrl(v)?v:''}
  function usernameFromCardUrl(value){try{const u=new URL(value);return decodeURIComponent(u.pathname.replace(/^\/+|\/+$/g,'').split('/')[0]||'')}catch{return ''}}

  async function loadCardUrl(){
    if(!window.supabaseClient||!window.state?.currentUser)return '';
    try{const r=await supabaseClient.from('profiles').select('eugene_card_url').eq('id',state.currentUser.id).maybeSingle();cardUrl=normalizeCardUrl(r.data?.eugene_card_url||'')}catch{}
    return cardUrl;
  }
  async function saveCardUrl(value){
    if(!window.supabaseClient||!window.state?.currentUser)throw Error('Please sign in first.');
    const r=await supabaseClient.from('profiles').update({eugene_card_url:value||null,updated_at:new Date().toISOString()}).eq('id',state.currentUser.id);
    if(r.error)throw r.error;
    cardUrl=value||'';
    if(state.currentMember)state.currentMember.eugene_card_url=cardUrl;
  }

  async function consumeEugeneLink(){
    const p=new URLSearchParams(location.search);
    const incomingUsername=String(p.get('eugene_username')||p.get('eugeneUsername')||'').trim().replace(/^@/,'');
    const incoming=normalizeCardUrl(p.get('eugene_card_url')||p.get('eugeneCardUrl')||'')||cardProfileUrl(incomingUsername);
    if(!incoming||!window.state?.currentUser||!window.supabaseClient)return false;
    try{
      await saveCardUrl(incoming);
      const clean=new URL(location.href);
      ['eugene_card_url','eugeneCardUrl','eugene_username','eugeneUsername','eugene_user_id','eugeneUserId'].forEach(k=>clean.searchParams.delete(k));
      history.replaceState({},'',clean.pathname+clean.search+clean.hash);
      toastMsg('Eugene Card connected.');
      return true;
    }catch{return false}
  }

  function openModal(){
    if(document.getElementById('eugeneLinkModal'))return;
    const modal=document.createElement('div');modal.id='eugeneLinkModal';
    const connected=!!cardUrl;const existingUsername=usernameFromCardUrl(cardUrl);
    modal.innerHTML=`<div class="panel" style="width:min(680px,94vw);position:relative;padding:24px"><button id="eugeneLinkClose" class="btn" style="position:absolute;right:14px;top:14px">×</button><div class="eyebrow">LUNARIST × EUGENE CARD</div><h2 style="margin:5px 0 8px">${connected?'Eugene Card connected':'Connect your Eugene Card'}</h2><p class="meta">Link your Eugene Card identity to this Lunarist account. You can enter your Eugene Card username or public profile URL. Lunarist stores only the public profile URL; Eugene Card authentication remains separate.</p><div class="field" style="margin-top:16px"><label>Eugene Card username</label><input id="eugeneCardUsernameInput" type="text" autocomplete="off" placeholder="your-eugene-username" value="${esc(existingUsername)}"><div class="meta" style="margin-top:6px">Enter the same username you use on Eugene Card.</div></div><div class="field" style="margin-top:12px"><label>Eugene Card public profile URL</label><input id="eugeneCardUrlInput" type="url" autocomplete="url" placeholder="https://eugene-card-1.vercel.app/username" value="${esc(cardUrl)}"></div><div class="field" style="margin-top:12px"><label>Lunarist profile</label><input type="text" readonly value="${esc(lunaristUrl())}"></div><div class="heroactions"><button class="btn primary" id="eugeneLinkSave">${connected?'Update connection':'Connect account'}</button>${connected?'<button class="btn" id="eugeneLinkOpen">Open Eugene Card</button><button class="btn" id="eugeneLinkCopy">Copy Eugene Card link</button><button class="btn" id="eugeneLinkRemove">Disconnect</button>':''}<button class="btn" id="eugeneLunaristOpen">Open my Lunarist profile</button></div><div class="meta" id="eugeneLinkStatus" style="margin-top:10px"></div></div>`;
    Object.assign(modal.style,{position:'fixed',inset:'0',zIndex:'10050',display:'flex',alignItems:'center',justifyContent:'center',padding:'18px',background:'rgba(2,1,6,.82)',backdropFilter:'blur(16px)'});
    document.body.appendChild(modal);
    const close=()=>modal.remove();document.getElementById('eugeneLinkClose').onclick=close;modal.addEventListener('click',e=>{if(e.target===modal)close()});
    const usernameInput=document.getElementById('eugeneCardUsernameInput');const urlInput=document.getElementById('eugeneCardUrlInput');
    usernameInput.addEventListener('input',()=>{const u=usernameInput.value.trim().replace(/^@/,'');if(u)urlInput.value=cardProfileUrl(u)});
    document.getElementById('eugeneLinkSave').onclick=async()=>{
      const status=document.getElementById('eugeneLinkStatus');let value=normalizeCardUrl(urlInput.value);const u=usernameInput.value.trim().replace(/^@/,'');
      if(!value&&u)value=cardProfileUrl(u);
      if(urlInput.value.trim()&&!value){status.textContent='Use a public Eugene Card URL from eugene-card-1.vercel.app.';return}
      if(!value){status.textContent='Enter your Eugene Card username or public profile URL.';return}
      const b=document.getElementById('eugeneLinkSave');b.disabled=true;status.textContent='Saving connection…';
      try{await saveCardUrl(value);status.textContent='Connected.';toastMsg('Eugene Card connected.');setTimeout(close,450)}catch(e){status.textContent=e.message||'Could not save the connection.';b.disabled=false}
    };
    document.getElementById('eugeneLinkOpen')?.addEventListener('click',()=>{if(cardUrl)window.open(cardUrl,'_blank','noopener,noreferrer')});
    document.getElementById('eugeneLinkCopy')?.addEventListener('click',async()=>{if(!cardUrl)return;try{await navigator.clipboard.writeText(cardUrl);toastMsg('Eugene Card link copied.')}catch{document.getElementById('eugeneLinkStatus').textContent='Copy failed. Please copy the URL manually.'}});
    document.getElementById('eugeneLinkRemove')?.addEventListener('click',async()=>{const status=document.getElementById('eugeneLinkStatus'),b=document.getElementById('eugeneLinkRemove');b.disabled=true;status.textContent='Disconnecting…';try{await saveCardUrl('');toastMsg('Eugene Card disconnected.');close()}catch(e){status.textContent=e.message||'Could not disconnect.';b.disabled=false}});
    document.getElementById('eugeneLunaristOpen')?.addEventListener('click',()=>window.open(lunaristUrl(),'_blank','noopener,noreferrer'));
  }

  function enhancePublicProfile(){
    const path=location.pathname.replace(/^\/+|\/+$/g,'');
    if(!path||path.includes('/')||/^(login|signup|discover|projects|profile|admin|settings|member-space|my-commission|clients)$/i.test(path))return;
    if(document.getElementById('lunaristEugenePublicBtn'))return;
    const sb=window.supabaseClient||window.supabase||window._supabase;if(!sb)return;
    sb.from('profiles').select('eugene_card_url').eq('username',path).maybeSingle().then(r=>{const url=normalizeCardUrl(r.data?.eugene_card_url||'');if(!url)return;const host=document.querySelector('.lpm-copy')||document.querySelector('.lunarist-public-member-profile');if(!host)return;const a=document.createElement('a');a.id='lunaristEugenePublicBtn';a.className='btn';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Eugene Card ↗';a.style.cssText='display:inline-flex;margin:12px 8px 0 0;text-decoration:none';host.appendChild(a)}).catch(()=>{});
  }

  function offerEugeneLinkFromReturn(){
    const p=new URLSearchParams(location.search);const from=p.get('eugene');if(from)sessionStorage.setItem('lunaristEugeneReturn',from)
  }

  const style=document.createElement('style');style.textContent='#eugeneLinkModal .field label{display:block;margin-bottom:6px}';document.head.appendChild(style);
  offerEugeneLinkFromReturn();
  let bootstrapped=false;
  const timer=setInterval(async()=>{
    enhancePublicProfile();
    if(window.state?.currentUser&&!bootstrapped){bootstrapped=true;await loadCardUrl();await consumeEugeneLink()}
  },800);
  window.addEventListener('beforeunload',()=>clearInterval(timer));
  window.__lunaristEugeneIntegration=true;
})();
