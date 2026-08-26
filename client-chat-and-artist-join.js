// Lunarist client messaging + artist join-date enhancement.
(function(){
  if(typeof window==='undefined') return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // NOTE: index.html declares `supabaseClient` and `state` with `let`/`const` at the top level of
  // an inline <script>, so they are NOT properties of `window` (only `var`/function declarations are).
  // They ARE reachable as bare identifiers from other classic scripts on the same page though, since
  // all classic <script> tags share one global lexical scope. `window.supabase` is a different thing
  // entirely — it's the @supabase/supabase-js library namespace (just `{createClient, ...}`), not the
  // initialized client, so it must never be used as a fallback here or every call below silently breaks.
  const sb=()=>{try{if(typeof supabaseClient!=='undefined'&&supabaseClient)return supabaseClient}catch(e){}return window.supabaseClient||null};
  const curUser=()=>{try{return (typeof state!=='undefined'&&state&&state.currentUser)||null}catch(e){return null}};
  const authUser=async()=>{
    const s=sb();
    if(!s?.auth?.getUser)return curUser();
    try{return (await s.auth.getUser()).data?.user||curUser()}catch{return curUser()}
  };

  let artistCache=[];
  let artistCacheAt=0;
  async function loadArtists(force=false){
    const s=sb();
    if(!s)return [];
    if(!force&&artistCache.length&&Date.now()-artistCacheAt<30000)return artistCache;
    const r=await s.from('profiles')
      .select('id,username,display_name,role,avatar_url,is_admin,account_type,created_at,available')
      .eq('account_type','member')
      .order('created_at',{ascending:true});
    if(r.error){console.warn('[Lunarist] artist sync failed:',r.error.message);return artistCache}
    artistCache=(r.data||[]).filter(Boolean);
    artistCacheAt=Date.now();
    return artistCache;
  }

  const joined=m=>m?.created_at||m?.joined_at||m?.profile_created_at||m?.createdAt||null;
  const fmt=d=>{if(!d)return '';const x=new Date(d);return Number.isNaN(x.getTime())?'':x.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});};
  const displayName=m=>m?.display_name||m?.name||m?.username||'Artist';
  const avatar=m=>m?.avatar_url||m?.avatar||'';

  function installStyle(){
    if(document.getElementById('lunarist-client-chat-style'))return;
    const s=document.createElement('style');s.id='lunarist-client-chat-style';
    s.textContent=`
      .lcc-wrap{display:grid;grid-template-columns:270px 1fr;gap:12px;min-height:520px}
      .lcc-list,.lcc-main{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025);overflow:hidden}
      .lcc-list{padding:10px}.lcc-user{width:100%;display:flex;gap:10px;align-items:center;text-align:left;padding:10px;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--text);cursor:pointer}
      .lcc-user:hover,.lcc-user.active{background:rgba(255,255,255,.06);border-color:var(--line)}.lcc-user img{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#111}.lcc-user .lcc-role{display:block;color:var(--muted);font-size:10px;margin-top:2px}
      .lcc-main{display:flex;flex-direction:column}.lcc-head{padding:14px 16px;border-bottom:1px solid var(--line)}.lcc-body{flex:1;padding:16px;overflow:auto;min-height:340px}
      .lcc-msg{max-width:76%;padding:9px 12px;border-radius:14px;margin:7px 0;line-height:1.45;font-size:13px}.lcc-msg.mine{margin-left:auto;background:rgba(201,182,255,.15);border:1px solid rgba(201,182,255,.25)}.lcc-msg.theirs{background:rgba(255,255,255,.045);border:1px solid var(--line)}.lcc-time{display:block;margin-top:4px;color:var(--muted);font-size:9px}
      .lcc-compose{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)}.lcc-compose textarea{flex:1;resize:none;min-height:44px;max-height:120px;border:1px solid var(--line);border-radius:12px;background:#0a0910;color:var(--text);padding:10px}.lcc-empty{height:100%;display:grid;place-items:center;text-align:center;color:var(--muted);padding:40px}
      .lunarist-joined-date{margin-top:7px;color:var(--muted);font-size:11px}.lunarist-joined-date b{color:var(--text);font-weight:600}
      @media(max-width:760px){.lcc-wrap{grid-template-columns:1fr}.lcc-list{max-height:210px;overflow:auto}.lcc-user{display:inline-flex;width:auto;margin-right:5px}.lcc-list{white-space:nowrap}.lcc-user .lcc-copy{white-space:normal}}
    `;
    document.head.appendChild(s);
  }

  function findArtistFromCard(card,list){
    const id=card?.dataset?.member||card?.dataset?.artist||card?.dataset?.artistId;
    if(id){const byId=list.find(m=>String(m.id)===String(id));if(byId)return byId}
    const text=(card?.innerText||'').trim().toLowerCase();
    if(!text)return null;
    return list.find(m=>{
      const n=displayName(m).toLowerCase(),u=String(m.username||'').toLowerCase();
      return (n&&text.includes(n))||(u&&text.includes('@'+u))||(u&&text.includes(u));
    })||null;
  }

  async function artistJoinDates(){
    const list=await loadArtists();
    if(!list.length)return;
    const cards=document.querySelectorAll('.artistcard,.artist-card,.artistCard,.member-card,[data-member],[data-artist],[data-artist-id]');
    cards.forEach(card=>{
      if(card.querySelector('.lunarist-joined-date'))return;
      const m=findArtistFromCard(card,list);if(!m||!joined(m))return;
      const el=document.createElement('div');el.className='lunarist-joined-date';el.innerHTML=`Joined Lunarist <b>${esc(fmt(joined(m)))}</b>`;card.appendChild(el);
    });
  }

  async function loadMessages(conversationId){
    const s=sb();if(!s||!conversationId)return {data:[],error:null};
    return await s.from('messages').select('id,sender_id,content,body,created_at,is_read,read_at').eq('conversation_id',conversationId).order('created_at',{ascending:true});
  }

  async function findConversation(userId,artistId){
    const s=sb();if(!s||!userId||!artistId)return {data:null,error:null};
    return await s.from('conversations').select('id,client_id,artist_id,status,last_message_at,created_at').eq('client_id',userId).eq('artist_id',artistId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  }

  async function createConversation(userId,artistId){
    const s=sb();
    const existing=await findConversation(userId,artistId);
    if(existing.data)return {data:existing.data,error:null};
    if(existing.error&&existing.error.code!=='PGRST116')return existing;
    return await s.from('conversations').insert({client_id:userId,artist_id:artistId,status:'active'}).select('id,client_id,artist_id,status,last_message_at,created_at').single();
  }

  async function renderConversation(){
    const root=document.getElementById('lcc-main'),id=window.__lunaristChatArtistId,user=await authUser(),list=await loadArtists();
    if(!root||!id||!user)return;
    const a=list.find(x=>String(x.id)===String(id));if(!a)return;
    const conv=await findConversation(user.id,a.id);
    if(conv.error&&conv.error.code!=='PGRST116'){
      root.innerHTML=`<div class="lcc-empty"><div><b>Messages unavailable</b><br><span>${esc(conv.error.message)}</span></div></div>`;return;
    }
    const conversation=conv.data;
    let msgs=[];
    if(conversation){const r=await loadMessages(conversation.id);if(r.error){root.innerHTML=`<div class="lcc-empty"><div><b>Messages unavailable</b><br><span>${esc(r.error.message)}</span></div></div>`;return}msgs=r.data||[];}
    root.innerHTML=`<div class="lcc-head"><div class="row"><img class="avatar" style="width:40px;height:40px" src="${esc(avatar(a))}" onerror="this.style.visibility='hidden'"><div><b>${esc(displayName(a))}</b><div class="meta">@${esc(a.username||'artist')} · ${esc(a.role||'Artist')}</div></div></div></div><div class="lcc-body" id="lcc-body">${msgs.length?msgs.map(m=>{const mine=String(m.sender_id)===String(user.id);return `<div class="lcc-msg ${mine?'mine':'theirs'}">${esc(m.body||m.content||'')}<span class="lcc-time">${new Date(m.created_at).toLocaleString()}</span></div>`}).join(''):`<div class="lcc-empty">Start the conversation with ${esc(displayName(a))}.</div>`}</div><form class="lcc-compose" id="lcc-compose"><textarea id="lcc-input" maxlength="5000" placeholder="Write a message…"></textarea><button class="btn primary" type="submit">Send</button></form>`;
    const body=root.querySelector('#lcc-body');if(body)body.scrollTop=body.scrollHeight;
    root.querySelector('#lcc-compose').onsubmit=async e=>{
      e.preventDefault();const input=root.querySelector('#lcc-input'),text=input.value.trim();if(!text)return;
      const s=sb();if(!s){toast('Messaging is unavailable right now.');return}
      input.disabled=true;
      let c=conversation;
      if(!c){const cr=await createConversation(user.id,a.id);if(cr.error){toast('Could not start conversation: '+cr.error.message);input.disabled=false;return}c=cr.data}
      const ins=await s.from('messages').insert({conversation_id:c.id,sender_id:user.id,content:text,body:text});
      if(ins.error){toast('Message could not be sent: '+ins.error.message);input.disabled=false;return}
      await s.from('conversations').update({last_message_at:new Date().toISOString()}).eq('id',c.id);
      // Best-effort only — mirrors index.html's sendNotification(). Never let a failure here
      // (e.g. RLS on `notifications`) block the message, which has already been sent successfully.
      try{await s.from('notifications').insert({user_id:a.id,title:'New Message',message:'A client sent you a message',type:'message'})}catch(e){console.warn('[Lunarist] notification insert failed (non-fatal):',e?.message||e)}
      input.value='';input.disabled=false;renderConversation();
    };
  }

  async function renderChat(){
    const root=document.getElementById('client-chat-root');if(!root)return;
    const user=await authUser();if(!user){root.innerHTML='<div class="lcc-empty">Please sign in to message an artist.</div>';return}
    const list=await loadArtists(true),selected=window.__lunaristChatArtistId;
    root.innerHTML=`<div class="lcc-wrap"><aside class="lcc-list"><div class="eyebrow" style="padding:8px">Artists</div>${list.length?list.map(a=>`<button class="lcc-user ${String(selected)===String(a.id)?'active':''}" data-chat-artist="${esc(a.id)}"><img src="${esc(avatar(a))}" onerror="this.style.visibility='hidden'"><span class="lcc-copy"><b>${esc(displayName(a))}</b><small class="lcc-role">${esc(a.role||'Artist')} · @${esc(a.username||'artist')}</small></span></button>`).join(''):`<div class="lcc-empty">No artists available.</div>`}</aside><main class="lcc-main" id="lcc-main">${selected?'<div class="lcc-empty">Loading conversation…</div>':'<div class="lcc-empty"><div><b>Message an artist</b><br><span>Select an artist to start a conversation.</span></div></div>'}</main></div>`;
    root.querySelectorAll('[data-chat-artist]').forEach(b=>b.onclick=async()=>{window.__lunaristChatArtistId=b.dataset.chatArtist;await renderChat()});
    if(selected)await renderConversation();
  }

  function addTab(){
    const tabs=document.getElementById('clientSpaceTabs');if(!tabs||tabs.querySelector('[data-client-tab="messages"]'))return;
    const b=document.createElement('button');b.className='filter';b.dataset.clientTab='messages';b.textContent='Messages';
    b.onclick=async()=>{
      tabs.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');
      document.querySelectorAll('.client-space-section').forEach(x=>x.classList.remove('active'));
      let s=document.getElementById('client-space-messages');
      if(!s){s=document.createElement('section');s.className='client-space-section';s.id='client-space-messages';tabs.parentElement.appendChild(s)}
      s.classList.add('active');s.innerHTML='<div class="panel"><div class="eyebrow">Messages</div><h2 style="margin:4px 0 14px">Chat with an artist</h2><div id="client-chat-root"></div></div>';
      await renderChat();
    };
    tabs.appendChild(b);
  }

  async function boot(){
    installStyle();
    const user=await authUser();
    if(user){
      if(document.getElementById('clientSpaceTabs'))addTab();
    }
    if(location.pathname==='/artists'||location.pathname.startsWith('/artists/'))await artistJoinDates();
  }

  let running=false;
  async function start(){
    if(running)return;running=true;
    await boot();
    // Client Space's own script (client-space.js) fully rebuilds #clientSpaceTabs's innerHTML
    // (wiping out the Messages tab we inject) every time the client portal is opened or refreshed —
    // e.g. approving a delivery, saving the profile, or clicking the nav button again — which can
    // happen minutes into a session, not just on initial page load. A short-lived polling window
    // (as this used to be) means the tab reliably vanishes forever the first time that happens after
    // it expires. Keep checking indefinitely; boot()/addTab() are cheap and already idempotent.
    setInterval(boot,750);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
