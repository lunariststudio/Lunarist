// Discover guild filter: filters project cards by the artist/member role group.
(function(){
  if(typeof window==='undefined'||window.__lunaristDiscoverRoleFilterInstalled)return;
  window.__lunaristDiscoverRoleFilterInstalled=true;

  const GROUPS=['Astral Weavers','Blizzcasters','Minstrels','Echobinders'];
  const norm=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
  const groupForRole=role=>{
    const r=norm(role);
    return GROUPS.find(g=>r===norm(g)||r.startsWith(norm(g)+' director'))||'';
  };
  const valueOf=(obj,keys)=>{
    for(const k of keys){if(obj&&obj[k]!=null&&String(obj[k]).trim()!=='')return obj[k];}
    return '';
  };
  const projectMemberId=p=>valueOf(p,['artist_id','artistId','member_id','memberId','user_id','userId','owner_id','ownerId','profile_id','profileId']);
  const memberId=m=>valueOf(m,['id','member_id','memberId','user_id','userId','auth_user_id','authUserId','profile_id','profileId','artist_id','artistId']);
  const memberRole=m=>valueOf(m,['role','member_role','memberRole','artist_role','artistRole','type']);

  let selected='';
  let filterEl=null;

  function findMember(project,members){
    const pid=String(projectMemberId(project)||'');
    if(pid){
      const exact=members.find(m=>String(memberId(m)||'')===pid);
      if(exact)return exact;
    }
    const names=['artist_name','artistName','member_name','memberName','owner_name','ownerName','username','user_name'];
    const pn=norm(valueOf(project,names));
    if(pn)return members.find(m=>norm(valueOf(m,names))===pn)||null;
    return null;
  }

  function projectGroup(project,members){
    const direct=valueOf(project,['role','artist_role','artistRole','member_role','memberRole','guild','group']);
    const directGroup=groupForRole(direct);
    if(directGroup)return directGroup;
    const member=findMember(project,members);
    return member?groupForRole(memberRole(member)):'';
  }

  function getDiscoverRoot(){
    const headings=[...document.querySelectorAll('h1,h2,h3,h4')];
    const heading=headings.find(h=>norm(h.textContent)==='discover');
    return heading?.closest('.section')||document.querySelector('#discover,.discover')||null;
  }

  function ensureFilter(){
    const root=getDiscoverRoot();
    if(!root)return null;
    let bar=root.querySelector('.discoverbar');
    if(!bar)return null;
    if(bar.querySelector('[data-discover-role-filter]'))return bar.querySelector('[data-discover-role-filter]');

    const wrap=document.createElement('label');
    wrap.setAttribute('data-discover-role-filter','1');
    wrap.style.cssText='display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;white-space:nowrap;';
    wrap.innerHTML='<span style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Guild</span>'+
      '<select aria-label="Filter Discover by guild" style="border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--text);padding:8px 12px;border-radius:999px;outline:none;cursor:pointer;">'+
      '<option value="">All guilds</option>'+GROUPS.map(g=>`<option value="${g}">${g}</option>`).join('')+'</select>';
    const select=wrap.querySelector('select');
    select.value=selected;
    select.addEventListener('change',()=>{selected=select.value;apply();});
    bar.appendChild(wrap);
    filterEl=select;
    return select;
  }

  function apply(){
    const root=getDiscoverRoot();
    if(!root)return;
    ensureFilter();
    const projects=Array.isArray(window.data?.projects)?window.data.projects:[];
    const members=Array.isArray(window.data?.members)?window.data.members:[];
    const cards=[...root.querySelectorAll('[data-project]')];
    if(!cards.length)return;
    cards.forEach(card=>{
      const p=projects.find(x=>String(x.id)===String(card.getAttribute('data-project')));
      if(!p){card.hidden=false;return;}
      const group=projectGroup(p,members);
      card.hidden=!!selected&&group!==selected;
    });
  }

  function start(){
    ensureFilter();
    apply();
    setTimeout(()=>{ensureFilter();apply();},300);
    setTimeout(()=>{ensureFilter();apply();},1000);
    const obs=new MutationObserver(()=>{clearTimeout(obs.t);obs.t=setTimeout(()=>{ensureFilter();apply();},80);});
    if(document.body)obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
