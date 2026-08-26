(function(){
 const labels={x:'X',instagram:'Instagram',youtube:'YouTube',website:'Website'};
 const normalize=(v,k)=>{v=(v||'').trim();if(!v)return '';if(!/^https?:\/\//i.test(v)){if(k==='x')v='https://x.com/'+v.replace(/^@/,'');else if(k==='instagram')v='https://instagram.com/'+v.replace(/^@/,'');else if(k==='youtube')v='https://youtube.com/@'+v.replace(/^@/,'');else v='https://'+v}try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}};
 async function run(){
  const sb=window.supabaseClient;if(!sb||!window.state?.currentUser)return false;
  const modals=[...document.querySelectorAll('.modal,.drawer,[role=dialog]')].filter(x=>x.offsetParent!==null);
  const modal=modals.reverse().find(x=>/profile/i.test(x.innerText||''));if(!modal||modal.querySelector('#memberSocialEditor'))return false;
  const {data:p}=await sb.from('profiles').select('social_links,socials').eq('id',state.currentUser.id).maybeSingle();const l=p?.social_links||p?.socials||{};
  const box=document.createElement('div');box.id='memberSocialEditor';box.style.cssText='margin-top:18px;padding:18px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025)';
  box.innerHTML='<h3 style="margin:0 0 4px">Social & Website</h3><p style="margin:0 0 14px;color:var(--muted);font-size:12px">Add clickable links to your public artist profile.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+Object.keys(labels).map(k=>`<label style="font-size:10px;color:var(--muted);text-transform:uppercase">${labels[k]}<input data-ms="${k}" style="display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#0a0910;color:var(--text)" value="${String(l[k]||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></label>`).join('')+'</div><button type="button" class="btn" id="memberSocialSave" style="margin-top:12px">Save social links</button>';
  const anchor=[...modal.querySelectorAll('button,.btn')].reverse().find(b=>/save|update/i.test(b.textContent||''));(anchor?.parentElement||modal).before(box);
  box.querySelector('#memberSocialSave').onclick=async()=>{const out={};box.querySelectorAll('[data-ms]').forEach(i=>out[i.dataset.ms]=normalize(i.value,i.dataset.ms));const r=await sb.from('profiles').update({social_links:out,updated_at:new Date().toISOString()}).eq('id',state.currentUser.id);if(r.error){window.toast?.('Could not save social links: '+r.error.message);return}window.state.currentMember&&(state.currentMember.social_links=out);window.toast?.('Social links saved.');};
  return true;
 }
 let n=0;const t=setInterval(()=>run().then(ok=>{if(ok||++n>120)clearInterval(t)}),250);
})();
