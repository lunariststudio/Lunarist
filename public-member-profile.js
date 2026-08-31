// Lunarist — public member profile polish for /:username routes.
(function(){
  if(typeof window==='undefined') return;
  const path=location.pathname.replace(/^\/+|\/+$/g,'');
  if(!path || path.includes('/') || /^(login|signup|discover|projects|profile|admin|settings|member-space|my-commission)$/i.test(path)) return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pick=(o,keys)=>keys.map(k=>o?.[k]).find(v=>v!=null&&String(v).trim()!=='');
  const init=async()=>{
    if(document.documentElement.dataset.memberProfilePolished) return;
    document.documentElement.dataset.memberProfilePolished='1';
    const root=document.querySelector('main')||document.body;
    const candidates=[...root.querySelectorAll('section,article,div')].filter(x=>/(profile|about|projects|reviews|social)/i.test(x.className+' '+x.id));
    const sb=window.supabase||window._supabase||window.supabaseClient;
    let user=null;
    try{
      if(sb){
        const {data}=await sb.from('profiles').select('username,display_name,full_name,avatar_url,bio,website,role,created_at').eq('username',path).maybeSingle();
        user=data||null;
      }
    }catch(e){}
    const name=pick(user,['display_name','full_name'])||path;
    const role=pick(user,['role'])||'Lunarist Member';
    const bio=pick(user,['bio']);
    const website=pick(user,['website']);
    const avatar=pick(user,['avatar_url']);
    const panel=document.createElement('section'); panel.className='lunarist-public-member-profile';
    panel.innerHTML=`<div class="lpm-avatar">${avatar?`<img src="${esc(avatar)}" alt="${esc(name)}" loading="eager">`:`<span>${esc(name.slice(0,1).toUpperCase())}</span>`}</div><div class="lpm-copy"><div class="lpm-kicker">PUBLIC MEMBER PROFILE</div><h1>${esc(name)}</h1><div class="lpm-handle">@${esc(path)}</div><div class="lpm-role">${esc(role)}</div>${bio?`<p>${esc(bio)}</p>`:''}${website?`<a class="lpm-site" href="${esc(/^https?:\/\//i.test(website)?website:'https://'+website)}" target="_blank" rel="noopener noreferrer">Website ↗</a>`:''}</div>`;
    const first=candidates[0];
    if(first && first.parentNode) first.parentNode.insertBefore(panel,first); else root.prepend(panel);
    const empty=[...root.querySelectorAll('*')].filter(x=>x.children.length===0 && /^(no projects|no reviews|nothing here|no portfolio)$/i.test(x.textContent.trim()));
    empty.forEach(x=>{x.classList.add('lpm-empty');x.textContent=x.textContent.trim().replace(/^No /i,'No public ')});
    const style=document.createElement('style'); style.textContent='.lunarist-public-member-profile{display:flex;align-items:center;gap:22px;max-width:980px;margin:24px auto;padding:24px;border:1px solid var(--line,rgba(255,255,255,.1));border-radius:20px;background:linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.015));box-sizing:border-box}.lpm-avatar{width:88px;height:88px;border-radius:50%;overflow:hidden;flex:none;display:grid;place-items:center;background:rgba(255,255,255,.08);font-size:30px;font-weight:700}.lpm-avatar img{width:100%;height:100%;object-fit:cover}.lpm-copy{min-width:0}.lpm-kicker{font-size:10px;letter-spacing:.12em;color:var(--muted,#999);font-weight:700}.lpm-copy h1{margin:3px 0 0;font-size:28px}.lpm-handle{color:var(--muted,#999);font-size:13px}.lpm-role{display:inline-block;margin-top:8px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.07);font-size:11px}.lpm-copy p{margin:12px 0 0;max-width:680px;line-height:1.55;color:var(--muted,#aaa)}.lpm-site{display:inline-block;margin-top:12px;color:inherit;text-decoration:none;font-size:12px;font-weight:700}.lpm-empty{opacity:.8}@media(max-width:640px){.lunarist-public-member-profile{margin:14px 12px;padding:18px;gap:14px;align-items:flex-start}.lpm-avatar{width:64px;height:64px;font-size:22px}.lpm-copy h1{font-size:22px}.lpm-copy p{font-size:13px}.lpm-kicker{font-size:9px}}'; document.head.appendChild(style);
  };
  const wait=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else setTimeout(init,120)}; wait();
})();
