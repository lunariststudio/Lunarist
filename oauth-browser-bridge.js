(function(){'use strict';
if(window.__lunaristOAuthBrowserBridge)return;window.__lunaristOAuthBrowserBridge=true;
let running=false;
async function session(){const sb=window.supabaseClient||window.supabase;try{return(await sb?.auth?.getSession?.())?.data?.session||null}catch{return null}}
function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function params(){const p=new URLSearchParams(location.search);const out={};['client_id','redirect_uri','response_type','scope','code_challenge','code_challenge_method','state'].forEach(k=>{const v=p.get(k);if(v)out[k]=v});return out}
function closePopup(){document.getElementById('lunaristOAuthConsent')?.remove()}
function showPopup(p,onApprove){
  if(document.getElementById('lunaristOAuthConsent'))return;
  const scopes=(p.scope||'identity profile').split(/\s+/).filter(Boolean);
  const labels={identity:'Your Lunarist identity',profile:'Your public profile information',offline_access:'A refresh token for longer-lived access'};
  const list=scopes.map(s=>`<li><span class="oa-check">✓</span>${esc(labels[s]||s)}</li>`).join('');
  const app=p.client_id==='eugene-card'?'Eugene Card':(p.client_id||'External application');
  const el=document.createElement('div');el.id='lunaristOAuthConsent';el.innerHTML=`<div class="loac-backdrop"></div><section class="loac-modal" role="dialog" aria-modal="true" aria-labelledby="loac-title"><button class="loac-x" type="button" aria-label="Close">×</button><div class="loac-badge">L✦</div><div class="loac-kicker">LUNARIST CONNECTION</div><h2 id="loac-title">Connect ${esc(app)}?</h2><p class="loac-lead"><strong>${esc(app)}</strong> is requesting permission to connect to your Lunarist account.</p><div class="loac-user"><div class="loac-avatar">L</div><div><strong>Your Lunarist account</strong><span>Signed in and ready to connect</span></div></div><div class="loac-perms"><div class="loac-perms-title">This connection will allow access to:</div><ul>${list}</ul></div><p class="loac-note">You can revoke this connection later. Your password is never shared with ${esc(app)}.</p><div class="loac-actions"><button class="loac-cancel" type="button">Cancel</button><button class="loac-approve" type="button">Approve &amp; continue</button></div></section>`;
  const style=document.createElement('style');style.id='lunaristOAuthConsentStyle';style.textContent=`#lunaristOAuthConsent{position:fixed;inset:0;z-index:2147483647;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7f4ff}.loac-backdrop{position:absolute;inset:0;background:rgba(4,3,9,.78);backdrop-filter:blur(12px)}.loac-modal{position:relative;width:min(500px,calc(100vw - 32px));box-sizing:border-box;margin:8vh auto 0;background:#111019;border:1px solid rgba(255,255,255,.13);border-radius:24px;padding:28px;box-shadow:0 30px 100px rgba(0,0,0,.65);animation:loacIn .18s ease-out}.loac-x{position:absolute;right:15px;top:12px;border:0;background:transparent;color:#aaa3b5;font-size:28px;line-height:1;cursor:pointer}.loac-badge{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:rgba(201,182,255,.1);border:1px solid rgba(201,182,255,.25);color:#c9b6ff;font-weight:900;font-size:20px}.loac-kicker{margin-top:18px;font:700 10px/1 ui-monospace,SFMono-Regular,monospace;letter-spacing:.18em;color:#c9b6ff}.loac-modal h2{margin:9px 0 8px;font-size:27px;letter-spacing:-.03em}.loac-lead{margin:0 0 18px;color:#c4bdcf;line-height:1.55}.loac-user{display:flex;gap:12px;align-items:center;padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.035)}.loac-avatar{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:#ffffff0b;border:1px solid #ffffff18;color:#c9b6ff;font-weight:900}.loac-user strong,.loac-user span{display:block}.loac-user span{margin-top:3px;color:#9c96ad;font-size:13px}.loac-perms{margin-top:14px;padding:15px;border:1px solid rgba(255,255,255,.09);border-radius:14px}.loac-perms-title{font-weight:750;font-size:13px;margin-bottom:8px}.loac-perms ul{list-style:none;margin:0;padding:0}.loac-perms li{display:flex;gap:9px;align-items:flex-start;padding:6px 0;color:#c4bdcf;font-size:14px;line-height:1.4}.oa-check{color:#bfa6ff;font-weight:900}.loac-note{font-size:12px;line-height:1.5;color:#918a9c;margin:14px 0 18px}.loac-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:10px}.loac-actions button{border-radius:13px;padding:13px 16px;font-size:14px;font-weight:800;cursor:pointer}.loac-cancel{background:transparent;color:#c4bdcf;border:1px solid rgba(255,255,255,.12)}.loac-approve{border:0;background:#f7f4ff;color:#0b0910}.loac-actions button:disabled{opacity:.55;cursor:wait}@keyframes loacIn{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}@media(max-width:520px){.loac-modal{margin:4vh auto 0;padding:22px}.loac-actions{grid-template-columns:1fr}.loac-modal h2{font-size:23px}}`;
  document.head.appendChild(style);document.body.appendChild(el);
  const cancel=()=>{closePopup();history.replaceState({},'',location.pathname)};
  el.querySelector('.loac-x').onclick=cancel;el.querySelector('.loac-cancel').onclick=cancel;el.querySelector('.loac-backdrop').onclick=cancel;
  el.querySelector('.loac-approve').onclick=async()=>{const b=el.querySelector('.loac-approve');b.disabled=true;b.textContent='Connecting…';await onApprove();};
}
async function continueOAuth(){
  if(running)return;const p=new URLSearchParams(location.search);if(p.get('oauth_start')!=='1')return;
  const s=await session();if(!s?.access_token){try{window.toast?.('Please sign in to Lunarist to continue the connection.')}catch{}return}
  const q=params();showPopup(q,async()=>{
    running=true;
    try{
      const r=await fetch('/oauth/session',{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`},credentials:'include',cache:'no-store'});
      if(!r.ok)throw Error('Could not start OAuth session.');
      const form=document.createElement('form');form.method='POST';form.action='/oauth/authorize';form.style.display='none';
      Object.entries(q).forEach(([k,v])=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=v;form.appendChild(i)});
      const a=document.createElement('input');a.type='hidden';a.name='action';a.value='approve';form.appendChild(a);
      document.body.appendChild(form);form.submit();
    }catch(e){running=false;const b=document.querySelector('.loac-approve');if(b){b.disabled=false;b.textContent='Approve & continue'}try{window.toast?.(e.message||'Could not start OAuth session.')}catch{}}
  });
}
function boot(){continueOAuth();const sb=window.supabaseClient||window.supabase;try{sb?.auth?.onAuthStateChange?.((event)=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(continueOAuth,50)})}catch{}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
