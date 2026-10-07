/* Lunarist Client Space messaging. Uses existing conversations/messages schema. */
(function(){
  if(document.getElementById('lunarist-client-message-contrast')) return;
  const style=document.createElement('style');
  style.id='lunarist-client-message-contrast';
  style.textContent=`
    #clientMessagesPanel #clientMessageForm.client-message-form{
      display:flex!important;align-items:center!important;gap:10px!important;
      padding:12px!important;border:1px solid rgba(70,130,220,.28)!important;
      border-radius:18px!important;background:rgba(235,245,255,.92)!important;
      box-shadow:0 10px 28px rgba(20,70,150,.10)!important;
    }
    #clientMessagesPanel #clientMessageInput{
      appearance:none!important;-webkit-appearance:none!important;
      box-sizing:border-box!important;flex:1 1 auto!important;min-width:0!important;
      height:56px!important;padding:0 16px!important;border-radius:14px!important;
      border:1px solid rgba(55,105,190,.28)!important;
      background:#ffffff!important;background-image:none!important;
      color:#172554!important;-webkit-text-fill-color:#172554!important;
      caret-color:#1769e0!important;opacity:1!important;
      font:600 15px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;
      text-shadow:none!important;outline:none!important;
    }
    #clientMessagesPanel #clientMessageInput::placeholder{
      color:#64748b!important;-webkit-text-fill-color:#64748b!important;opacity:1!important;
    }
    #clientMessagesPanel #clientMessageInput:focus{
      background:#fff!important;color:#172554!important;-webkit-text-fill-color:#172554!important;
      border-color:#4b8df8!important;box-shadow:0 0 0 3px rgba(75,141,248,.16)!important;
    }
    #clientMessagesPanel #clientMessageForm.client-message-form > .btn{
      flex:0 0 auto!important;min-height:52px!important;padding:0 22px!important;
      color:#fff!important;-webkit-text-fill-color:#fff!important;
      background:#1877f2!important;border:1px solid #1877f2!important;
      border-radius:14px!important;font-weight:800!important;
    }
    #clientMessagesPanel .client-message{
      color:#172554!important;-webkit-text-fill-color:#172554!important;
      background:rgba(255,255,255,.88)!important;border:1px solid rgba(55,105,190,.16)!important;
    }
    #clientMessagesPanel .client-message.mine{
      color:#fff!important;-webkit-text-fill-color:#fff!important;
      background:#287df0!important;border-color:#287df0!important;
    }
    #clientMessagesPanel .client-message small{color:#64748b!important;-webkit-text-fill-color:#64748b!important;}
    #clientMessagesPanel .client-message.mine small{color:rgba(255,255,255,.82)!important;-webkit-text-fill-color:rgba(255,255,255,.82)!important;}
    @media(max-width:700px){
      #clientMessagesPanel #clientMessageForm.client-message-form{padding:8px!important;gap:7px!important;}
      #clientMessagesPanel #clientMessageInput{height:50px!important;font-size:14px!important;padding:0 13px!important;}
      #clientMessagesPanel #clientMessageForm.client-message-form > .btn{min-height:50px!important;padding:0 16px!important;}
    }
  `;
  document.head.appendChild(style);
})();

(function(){
  const wait=()=>window.supabaseClient||window.supabase||window.sb||null;
  function esc(s){return String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
  async function boot(){
    const sb=wait(); if(!sb) return false;
    const user=sb.auth?.getUser ? (await sb.auth.getUser()).data?.user : null;
    if(!user)return true;
    const root=document.querySelector('#client-space-root,#lunarist-client-space-root'); if(!root)return false;
    if(root.querySelector('#clientMessagesPanel'))return true;
    const nav=document.createElement('button'); nav.className='client-tab'; nav.id='clientMessagesTab'; nav.textContent='Messages';
    const tabs=root.querySelector('.client-tabs'); if(tabs)tabs.appendChild(nav); else return false;
    const panel=document.createElement('section'); panel.id='clientMessagesPanel'; panel.className='client-card'; panel.style.display='none';
    panel.innerHTML='<div class="client-section-title"><div><h2>Messages</h2><p>Talk directly with your Lunarist artist.</p></div></div><div id="clientConversationList" class="client-conversation-list"><div class="client-empty">Loading conversations…</div></div><div id="clientChat" style="display:none;margin-top:14px"><div id="clientChatHeader" class="client-chat-header"></div><div id="clientMessageList" class="client-message-list"></div><form id="clientMessageForm" class="client-message-form"><input id="clientMessageInput" maxlength="5000" autocomplete="off" placeholder="Write a message…"><button class="btn" type="submit">Send</button></form></div>';
    root.appendChild(panel);
    const list=panel.querySelector('#clientConversationList'), chat=panel.querySelector('#clientChat'), messages=panel.querySelector('#clientMessageList'), header=panel.querySelector('#clientChatHeader');
    let active=null;
    function show(){panel.style.display='block';document.querySelectorAll('#client-space-root > section,#lunarist-client-space-root > section').forEach(x=>{if(x!==panel)x.style.display='none'});nav.classList.add('active');loadConversations()}
    nav.onclick=show;
    async function loadConversations(){
      const {data,error}=await sb.from('conversations').select('id,client_id,artist_id,status,last_message_at,created_at,profiles_client:client_id(display_name,username,avatar_url),profiles_artist:artist_id(display_name,username,avatar_url)').or(`client_id.eq.${user.id},artist_id.eq.${user.id}`).order('last_message_at',{ascending:false,nullsFirst:false});
      if(error){list.innerHTML='<div class="client-empty">Messages are temporarily unavailable.</div>';return}
      if(!data?.length){list.innerHTML='<div class="client-empty">No conversations yet. Start a commission inquiry to message an artist.</div>';return}
      list.innerHTML=data.map(c=>{const other=c.client_id===user.id?c.profiles_artist:c.profiles_client;return `<button class="client-conversation" data-id="${c.id}"><strong>${esc(other?.display_name||other?.username||'Artist')}</strong><span>${esc(c.status||'Open')}</span></button>`}).join('');
      list.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openConversation(b.dataset.id,data.find(c=>c.id===b.dataset.id)));
    }
    async function openConversation(id,c){active=c;chat.style.display='block';const other=c.client_id===user.id?c.profiles_artist:c.profiles_client;header.innerHTML=`<strong>${esc(other?.display_name||other?.username||'Conversation')}</strong>`;await loadMessages();}
    async function loadMessages(){if(!active)return;const {data,error}=await sb.from('messages').select('id,sender_id,content,body,created_at,is_read').eq('conversation_id',active.id).order('created_at',{ascending:true});if(error){messages.innerHTML='<div class="client-empty">Unable to load messages.</div>';return}messages.innerHTML=(data||[]).map(m=>`<div class="client-message ${m.sender_id===user.id?'mine':''}">${esc(m.body||m.content)}<small>${new Date(m.created_at).toLocaleString()}</small></div>`).join('')||'<div class="client-empty">No messages yet.</div>';messages.scrollTop=messages.scrollHeight;}
    panel.querySelector('#clientMessageForm').onsubmit=async e=>{e.preventDefault();if(!active)return;const input=panel.querySelector('#clientMessageInput'),body=input.value.trim();if(!body)return;const {error}=await sb.from('messages').insert({conversation_id:active.id,sender_id:user.id,content:body,body});if(!error){input.value='';await sb.from('conversations').update({last_message_at:new Date().toISOString()}).eq('id',active.id);loadMessages();loadConversations();}};
    try{sb.channel('lunarist-client-messages').on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>{if(active&&p.new?.conversation_id===active.id)loadMessages();else loadConversations()}).subscribe()}catch{}
    return true;
  }
  let n=0;const t=setInterval(()=>{boot().then(ok=>{if(ok||++n>100)clearInterval(t)})},150);
})();
