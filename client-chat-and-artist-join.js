// Lunarist client messaging + artist join-date enhancement.
(function(){
  if(typeof window==='undefined') return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fallbackArtists=()=>Array.isArray(window.data?.members)?window.data.members.filter(m=>!m.is_admin&&(m.account_type==='member'||m.role==='artist'||m.role==='member')):[];
  let artistCache=null;
  async function loadArtists(){
    if(Array.isArray(artistCache)) return artistCache;
    const sb=window.supabaseClient||window.supabase||window.sb;
    if(sb?.from){
      try{
        const r=await sb.from('profiles').select('id,username,display_name,role,avatar_url,available,is_admin,account_type,created_at').eq('account_type','member').eq('is_admin',false).order('created_at',{ascending:true});
        if(!r.error&&Array.isArray(r.data)){artistCache=r.data;window.__lunaristArtists=artistCache;return artistCache;}
      }catch{}
    }
    artistCache=fallbackArtists();window.__lunaristArtists=artistCache;return artistCache;
  }
  const artists=()=>Array.isArray(artistCache)?artistCache:(Array.isArray(window.__lunaristArtists)?window.__lunaristArtists:fallbackArtists());
  const joined=m=>m?.joined_at||m?.created_at||m?.profile_created_at||m?.createdAt||null;
  const fmt=d=>{if(!d)return '';const x=new Date(d);return Number.isNaN(x.getTime())?'':x.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});};
  function installStyle(){if(document.getElementById('lunarist-client-chat-style'))return;const s=document.createElement('style');s.id='lunarist-client-chat-style';s.textContent=`
    .lcc-wrap{display:grid;grid-template-columns:270px 1fr;gap:12px;min-height:520px}.lcc-list,.lcc-main{border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025);overflow:hidden}.lcc-list{padding:10px}.lcc-user{width:100%;display:flex;gap:10px;align-items:center;text-align:left;padding:10px;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--text);cursor:pointer}.lcc-user:hover,.lcc-user.active{background:rgba(255,255,255,.06);border-color:var(--line)}.lcc-user img{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#111}.lcc-main{display:flex;flex-direction:column}.lcc-head{padding:14px 16px;border-bottom:1px solid var(--line)}.lcc-body{flex:1;padding:16px;overflow:auto;min-height:340px}.lcc-msg{max-width:76%;padding:9px 12px;border-radius:14px;margin:7px 0;line-height:1.45;font-size:13px}.lcc-msg.mine{margin-left:auto;background:rgba(201,182,255,.15);border:1px solid rgba(201,182,255,.25)}.lcc-msg.theirs{background:rgba(255,255,255,.045);border:1px solid var(--line)}.lcc-time{display:block;margin-top:4px;color:var(--muted);font-size:9px}.lcc-compose{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)}.lcc-compose textarea{flex:1;resize:none;min-height:44px;max-height:120px;border:1px solid var(--line);border-radius:12px;background:#0a0910;color:var(--text);padding:10px}.lcc-empty{height:100%;display:grid;place-items:center;text-align:center;color:var(--muted);padding:40px}.lunarist-joined-date{margin-top:6px;color:var(--muted);font-size:11px}.lunarist-joined-date b{color:var(--text);font-weight:600}@media(max-width:760px){.lcc-wrap{grid-template-columns:1fr}.lcc-list{max-height:190px;overflow:auto}.lcc-user{display:inline-flex;width:auto;margin-right:5px}.lcc-list{white-space:nowrap}}
  `;document.head.appendChild(s)}
  async function getConversation(otherId){
    const sb=window.supabaseClient||window.supabase||window.sb;
    if(!sb||!state.currentUser)return {data:null,error:new Error('Not signed in')};
    const existing=await sb.from('conversations').select('id,client_id,artist_id,status').eq('client_id',state.currentUser.id).eq('artist_id',otherId).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(existing.error)return existing;
    if(existing.data)return existing;
    return await sb.from('conversations').insert({client_id:state.currentUser.id,artist_id:otherId,status:'active'}).select('id,client_id,artist_id,status').single();
  }
  async function loadMessages(otherId){
    const sb=window.supabaseClient||window.supabase||window.sb;
    if(!sb||!state.currentUser)return {data:[],error:null};
    const conv=await getConversation(otherId);
    if(conv.error)return conv;
    return await sb.from('messages').select('id,sender_id,body,content,created_at,read_at,is_read').eq('conversation_id',conv.data.id).order('created_at',{ascending:true});
  }
  async function renderChat(){
    const root=document.getElementById('client-chat-root');if(!root||!state.currentUser)return;
    const list=await loadArtists();const selected=window.__lunaristChatArtistId;
    root.innerHTML=`<div class="lcc-wrap"><aside class="lcc-list"><div class="eyebrow" style="padding:8px">Artists</div>${list.length?list.map(a=>`<button class="lcc-user ${String(selected)===String(a.id)?'active':''}" data-chat-artist="${esc(a.id)}"><img src="${esc(a.avatar_url||a.avatar||'')}" onerror="this.style.visibility='hidden'"><span><b>${esc(a.display_name||a.name||a.username||'Artist')}</b><small class="meta">@${esc(a.username||'artist')}</small></span></button>`).join(''):`<div class="lcc-empty">No artists available.</div>`}</aside><main class="lcc-main" id="lcc-main">${selected?'<div class="lcc-empty">Loading conversation…</div>':'<div class="lcc-empty"><div><b>Message an artist</b><br><span>Select an artist to start a conversation.</span></div></div>'}</main></div>`;
    root.querySelectorAll('[data-chat-artist]').forEach(b=>b.onclick=async()=>{window.__lunaristChatArtistId=b.dataset.chatArtist;await renderChat();await renderConversation()});
    if(selected)await renderConversation();
  }
  async function renderConversation(){
    const root=document.getElementById('lcc-main');const id=window.__lunaristChatArtistId;if(!root||!id)return;
    const a=artists().find(x=>String(x.id)===String(id));if(!a)return;
    const r=await loadMessages(id);if(r.error){root.innerHTML=`<div class="lcc-empty"><div><b>Messages unavailable</b><br><span>${esc(r.error.message)}</span></div></div>`;return}
    const msgs=r.data||[];
    root.innerHTML=`<div class="lcc-head"><b>${esc(a.display_name||a.name||a.username||'Artist')}</b><div class="meta">@${esc(a.username||'artist')}</div></div><div class="lcc-body" id="lcc-body">${msgs.length?msgs.map(m=>{const mine=String(m.sender_id)===String(state.currentUser.id);return `<div class="lcc-msg ${mine?'mine':'theirs'}">${esc(m.body||m.content||'')}<span class="lcc-time">${new Date(m.created_at).toLocaleString()}</span></div>`}).join(''):`<div class="lcc-empty">Start the conversation with this artist.</div>`}</div><form class="lcc-compose" id="lcc-compose"><textarea id="lcc-input" maxlength="5000" placeholder="Write a message…"></textarea><button class="btn primary" type="submit">Send</button></form>`;
    const body=root.querySelector('#lcc-body');if(body)body.scrollTop=body.scrollHeight;
    root.querySelector('#lcc-compose').onsubmit=async e=>{e.preventDefault();const input=root.querySelector('#lcc-input'),text=input.value.trim();if(!text)return;const sb=window.supabaseClient||window.supabase||window.sb;if(!sb){toast('Messaging is unavailable right now.');return}const conv=await getConversation(id);if(conv.error){toast('Conversation could not be opened: '+conv.error.message);return}const ins=await sb.from('messages').insert({conversation_id:conv.data.id,sender_id:state.currentUser.id,body:text,content:text});if(ins.error){toast('Message could not be sent: '+ins.error.message);return}await sb.from('conversations').update({last_message_at:new Date().toISOString()}).eq('id',conv.data.id);input.value='';await renderConversation()};
  }
  function addTab(){
    const tabs=document.getElementById('clientSpaceTabs');if(!tabs||tabs.querySelector('[data-client-tab="messages"]'))return;
    const b=document.createElement('button');b.className='filter';b.dataset.clientTab='messages';b.textContent='Messages';
    b.onclick=async()=>{await loadArtists();window.__lunaristChatArtistId=window.__lunaristChatArtistId||artists()[0]?.id;tabs.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.client-space-section').forEach(x=>x.classList.remove('active'));let s=document.getElementById('client-space-messages');if(!s){s=document.createElement('section');s.className='client-space-section';s.id='client-space-messages';tabs.parentElement.appendChild(s)}s.classList.add('active');s.innerHTML='<div class="panel"><div class="eyebrow">Messages</div><h2 style="margin:4px 0 14px">Chat with an artist</h2><div id="client-chat-root"></div></div>';await renderChat()};
    tabs.appendChild(b)
  }
  async function artistJoinDates(){
    const ms=await loadArtists();if(!ms.length)return;
    const map=new Map(ms.map(m=>[String(m.id),m]));
    document.querySelectorAll('[data-member],[data-artist],[data-artist-id]').forEach(card=>{if(card.querySelector('.lunarist-joined-date'))return;const id=card.dataset.member||card.dataset.artist||card.dataset.artistId;const m=map.get(String(id));if(!m||!joined(m))return;const el=document.createElement('div');el.className='lunarist-joined-date';el.innerHTML=`Joined Lunarist <b>${esc(fmt(joined(m)))}</b>`;card.appendChild(el)});
    document.querySelectorAll('.artistcard,.artist-card,.artistCard,.member-card').forEach(card=>{if(card.querySelector('.lunarist-joined-date'))return;const text=(card.innerText||'').trim();const m=ms.find(x=>text.includes(x.display_name||'§§§')||text.includes(x.name||'§§§')||text.includes('@'+(x.username||'§§§')));if(!m||!joined(m))return;const el=document.createElement('div');el.className='lunarist-joined-date';el.innerHTML=`Joined Lunarist <b>${esc(fmt(joined(m)))}</b>`;card.appendChild(el)})
  }
  async function boot(){
    installStyle();
    if(state.currentMember&&!state.currentMember.is_admin){
      await loadArtists();
      addTab();
      await artistJoinDates();
    }
  }
  let obs;function start(){boot();if(obs)return;obs=new MutationObserver(()=>{boot()});obs.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{obs.disconnect();obs=null},30000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
