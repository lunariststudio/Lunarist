/* Lunarist Client Space messaging. Uses existing conversations/messages schema. */
(function(){
  function installClientMessageStyles(){
    if(document.getElementById('lunarist-client-message-contrast')) return;
    const style=document.createElement('style');
    style.id='lunarist-client-message-contrast';
    style.textContent=`
      #clientMessagesPanel{color:#12233f!important;}
      #clientMessagesPanel .client-section-title h2,
      #clientMessagesPanel .client-section-title p,
      #clientMessagesPanel .client-chat-header,
      #clientMessagesPanel .client-chat-header strong{color:#12233f!important;}
      #clientMessagesPanel .client-conversation{
        display:flex!important;align-items:center!important;justify-content:space-between!important;
        gap:12px!important;width:100%!important;text-align:left!important;
        color:#12233f!important;background:rgba(255,255,255,.78)!important;
        border:1px solid rgba(7,58,134,.16)!important;border-radius:14px!important;
      }
      #clientMessagesPanel .client-conversation span{color:#54709a!important;}
      #clientMessagesPanel .client-message-list{
        background:rgba(255,255,255,.72)!important;border:1px solid rgba(7,58,134,.14)!important;
        border-radius:16px!important;padding:14px!important;
      }
      #clientMessagesPanel .client-message{
        color:#12233f!important;background:rgba(255,255,255,.94)!important;
        border:1px solid rgba(7,58,134,.12)!important;border-radius:14px!important;
        padding:10px 13px!important;margin:8px 0!important;
      }
      #clientMessagesPanel .client-message.mine{
        color:#fff!important;background:#146ee8!important;border-color:#146ee8!important;
      }
      #clientMessagesPanel .client-message small{display:block!important;color:#6680a5!important;margin-top:5px!important;}
      #clientMessagesPanel .client-message.mine small{color:rgba(255,255,255,.78)!important;}
      #clientMessagesPanel .client-message-form{
        display:flex!important;align-items:center!important;gap:10px!important;
        margin-top:12px!important;padding:10px!important;border-radius:16px!important;
        background:rgba(255,255,255,.9)!important;border:1px solid rgba(7,58,134,.18)!important;
      }
      #clientMessagesPanel #clientMessageInput{
        flex:1!important;min-width:0!important;height:44px!important;
        color:#12233f!important;-webkit-text-fill-color:#12233f!important;
        background:#fff!important;border:1px solid rgba(7,58,134,.2)!important;
        border-radius:12px!important;padding:10px 13px!important;outline:none!important;
        opacity:1!important;
      }
      #clientMessagesPanel #clientMessageInput::placeholder{
        color:#54709a!important;-webkit-text-fill-color:#54709a!important;opacity:1!important;
      }
      #clientMessagesPanel #clientMessageInput:focus{
        border-color:#146ee8!important;box-shadow:0 0 0 3px rgba(20,110,232,.12)!important;
      }
      #clientMessagesPanel .client-message-form button{
        flex:0 0 auto!important;color:#fff!important;background:#146ee8!important;
        border:0!important;border-radius:12px!important;padding:11px 18px!important;
      }
      #clientMessagesPanel .client-empty{color:#54709a!important;}
      @media(max-width:640px){
        #clientMessagesPanel .client-message-form{align-items:stretch!important;}
        #clientMessagesPanel .client-message-form button{padding:10px 14px!important;}
      }
    `;
    document.head.appendChild(style);
  }
  installClientMessageStyles();
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
