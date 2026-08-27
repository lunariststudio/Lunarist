// Lunarist Profile Role dropdown
(function(){
  'use strict';
  const ROLES = [
    'Astral Weavers',
    'Blizzcasters',
    'Minstrels',
    'Echobinders',
    'Astral Weavers Director',
    'Blizzcasters Director',
    'Minstrels Director',
    'Echobinders Director',
    'Leader',
    'Administrator'
  ];

  function isProfileContext(el){
    let n=el;
    for(let i=0;i<8 && n;i++,n=n.parentElement){
      const text=(n.textContent||'').toLowerCase();
      if(text.includes('profile settings') || text.includes('edit profile') || n.id==='profileModal' || n.id==='profileSettings') return true;
    }
    return false;
  }

  function upgrade(root){
    const nodes=(root||document).querySelectorAll('input,textarea');
    nodes.forEach(input=>{
      if(input.dataset.roleDropdownApplied==='1') return;
      const id=(input.id||'').toLowerCase();
      const name=(input.name||'').toLowerCase();
      let label='';
      if(input.id){
        const l=document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if(l) label=l.textContent||'';
      }
      const parent=input.closest('.field, .formfield, .form-group, .fieldgroup, div');
      if(parent && !label) label=parent.querySelector('label')?.textContent||'';
      const looksRole=/^role$|(^|[_-])role($|[_-])/.test(id)||/^role$|(^|[_-])role($|[_-])/.test(name)||/^\s*role\s*$/i.test(label);
      if(!looksRole || !isProfileContext(input)) return;

      const select=document.createElement('select');
      [...input.attributes].forEach(a=>{
        if(!['type','value'].includes(a.name)) select.setAttribute(a.name,a.value);
      });
      select.dataset.roleDropdownApplied='1';
      select.className=input.className;
      select.style.cssText=input.style.cssText;
      ROLES.forEach(role=>{
        const option=document.createElement('option');
        option.value=role;
        option.textContent=role;
        select.appendChild(option);
      });
      const current=input.value||'';
      if(current && !ROLES.includes(current)){
        const option=document.createElement('option');
        option.value=current;
        option.textContent=current;
        select.appendChild(option);
      }
      select.value=current;
      input.replaceWith(select);
      select.dispatchEvent(new Event('change',{bubbles:true}));
      select.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }

  function start(){
    upgrade(document);
    const observer=new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{
      if(n.nodeType===1) upgrade(n);
    })));
    observer.observe(document.body||document.documentElement,{childList:true,subtree:true});
    window.__lunaristRoleDropdown=ROLES.slice();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
