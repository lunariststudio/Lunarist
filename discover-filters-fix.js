// Discover filters + search focus stability.
(function(){
  if(typeof window==='undefined'||window.__lunaristDiscoverFiltersFixInstalled)return;
  window.__lunaristDiscoverFiltersFixInstalled=true;

  const GROUPS=['Astral Weavers','Blizzcasters','Minstrels','Echobinders'];
  let selected='';
  let searchValue='';
  let searchWasFocused=false;
  let searchSelection=0;

  const norm=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
  const groupForRole=role=>{
    const r=norm(role);
    return GROUPS.find(g=>r===norm(g)||r.startsWith(norm(g)+' director'))||'';
  };
  const val=(o,keys)=>{for(const k of keys)if(o&&o[k]!=null&&String(o[k]).trim()!=='')return o[k];return ''};
  const memberId=m=>val(m,['id','member_id','memberId','user_id','userId','auth_user_id','authUserId','profile_id','profileId']);
  const projectId=p=>val(p,['artist_id','artistId','member_id','memberId','user_id','userId','owner_id','ownerId','profile_id','profileId']);
  const role=m=>val(m,['role','member_role','memberRole','artist_role','artistRole','type']);
  function discoverRoot(){
    const el=document.querySelector('#discover');
    if(el)return el;
    const h=[...document.querySelectorAll('h1,h2,h3,h4')].find(x=>norm(x.textContent)==='discover');
    return h?.closest('.section')||null;
  }
  function groupForProject(p,members){
    const direct=val(p,['role','artist_role','artistRole','member_role','memberRole','guild','group']);
    const g=groupForRole(direct); if(g)return g;
    const id=String(projectId(p)||'');
    const m=id?members.find(x=>String(memberId(x)||'')===id):null;
    return m?groupForRole(role(m)):'';
  }
  function findSearch(root){
    if(!root)return null;
    return root.querySelector('input.search, input[placeholder*="Search" i], input[aria-label*="Search" i]')||document.querySelector('input.search, input[placeholder*="Search" i], input[aria-label*="Search" i]');
  }
  function ensureUI(){
    const root=discoverRoot(); if(!root)return;
    let controls=root.querySelector('[data-lunarist-discover-filters]');
    if(!controls){
      controls=document.createElement('div');
      controls.setAttribute('data-lunarist-discover-filters','1');
      controls.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 18px;';
      const search=findSearch(root);
      if(search&&search.parentElement) search.parentElement.insertBefore(controls,search);
      else root.querySelector('.sectionhead')?.after(controls);
      if(!controls.isConnected)return;
    }
    if(!controls.querySelector('[data-lunarist-guild-filter]')){
      const label=document.createElement('label');
      label.setAttribute('data-lunarist-guild-filter','1');
      label.style.cssText='display:flex;align-items:center;gap:7px;white-space:nowrap;';
      label.innerHTML='<span style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Guild</span>';
      const select=document.createElement('select');
      select.setAttribute('aria-label','Filter Discover by guild');
      select.style.cssText='border:1px solid var(--line);background:var(--panel2);color:var(--text);padding:9px 32px 9px 12px;border-radius:999px;outline:none;cursor:pointer;';
      select.innerHTML='<option value="">All guilds</option>'+GROUPS.map(g=>`<option value="${g}">${g}</option>`).join('');
      select.value=selected;
      select.addEventListener('change',()=>{selected=select.value;apply();});
      label.appendChild(select); controls.appendChild(label);
    }
  }
  function apply(){
    const root=discoverRoot(); if(!root)return;
    const projects=Array.isArray(window.data?.projects)?window.data.projects:[];
    const members=Array.isArray(window.data?.members)?window.data.members:[];
    root.querySelectorAll('[data-project]').forEach(card=>{
      const p=projects.find(x=>String(x.id)===String(card.getAttribute('data-project')));
      if(!p){card.hidden=false;return;}
      card.hidden=!!selected&&groupForProject(p,members)!==selected;
    });
  }
  function captureSearch(){
    const s=findSearch(discoverRoot());
    if(!s)return;
    searchValue=s.value||'';
    searchWasFocused=document.activeElement===s;
    if(searchWasFocused)searchSelection=s.selectionStart??searchValue.length;
  }
  function restoreSearch(){
    const root=discoverRoot(); const s=findSearch(root); if(!s)return;
    if(searchValue!=='' && s.value!==searchValue)s.value=searchValue;
    if(searchWasFocused){try{s.focus({preventScroll:true});s.setSelectionRange(searchSelection,searchSelection)}catch{try{s.focus()}catch{}}}
  }
  function bindSearch(){
    const root=discoverRoot(); if(!root)return;
    const s=findSearch(root); if(!s||s.dataset.lunaristSearchFix==='1')return;
    s.dataset.lunaristSearchFix='1';
    s.addEventListener('input',captureSearch,true);
    s.addEventListener('keydown',()=>setTimeout(captureSearch,0),true);
    s.addEventListener('focus',()=>{searchWasFocused=true},true);
  }
  function start(){
    ensureUI(); bindSearch(); apply();
    const obs=new MutationObserver(()=>{
      clearTimeout(obs.t);obs.t=setTimeout(()=>{ensureUI();bindSearch();restoreSearch();apply()},30);
    });
    if(document.body)obs.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{ensureUI();bindSearch();restoreSearch();apply()},250);
    setTimeout(()=>{ensureUI();bindSearch();restoreSearch();apply()},1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
