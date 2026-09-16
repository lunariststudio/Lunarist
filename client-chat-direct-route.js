// Route client Chat with Artist actions into Client Space -> Messages -> selected artist.
(function(){
  if(typeof window==='undefined') return;
  function artistIdFromButton(button){
    if(!button) return null;
    const direct=button.dataset?.artistId||button.dataset?.artist||button.dataset?.member||button.getAttribute('data-modal-member');
    if(direct) return String(direct);
    const modal=button.closest('#projectModal,.modal');
    const member=modal?.querySelector('[data-modal-member],[data-artist-id],[data-artist],[data-member]');
    return member?.dataset?.modalMember||member?.dataset?.artistId||member?.dataset?.artist||member?.dataset?.member||null;
  }
  async function openSelectedArtistChat(artistId){
    if(!artistId) return;
    window.__lunaristChatArtistId=String(artistId);
    try{if(typeof window.closeModal==='function')window.closeModal()}catch(e){}
    for(let i=0;i<40;i++){
      try{
        if(!window.state?.currentUser){if(typeof window.openAuth==='function')window.openAuth('signin');return;}
        if(typeof window.openClientSpace==='function'){
          await window.openClientSpace('overview');
          const tab=document.querySelector('#clientSpaceTabs [data-client-tab="messages"]');
          if(tab){tab.click();return;}
        }
      }catch(e){console.warn('[Lunarist] direct artist chat route retry:',e?.message||e)}
      await new Promise(r=>setTimeout(r,100));
    }
    console.warn('[Lunarist] Could not open Client Space Messages for artist',artistId);
  }
  document.addEventListener('click',function(event){
    const target=event.target?.closest?.('#modalDirectChatBtn,[data-direct-chat-artist],[data-chat-artist-direct],button');
    if(!target)return;
    const text=(target.textContent||'').trim().toLowerCase();
    const isChatButton=target.matches('#modalDirectChatBtn,[data-direct-chat-artist],[data-chat-artist-direct]')||text.includes('chat with artist')||text.includes('チャット');
    if(!isChatButton)return;
    const artistId=artistIdFromButton(target);if(!artistId)return;
    event.preventDefault();event.stopImmediatePropagation();openSelectedArtistChat(artistId);
  },true);
  window.openArtistChatInClientSpace=openSelectedArtistChat;
})();
