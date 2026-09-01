// Admin Studio — API Connectors
// Secure control-plane UI for registered OAuth/API integrations.
(function(){
  'use strict';
  if(typeof window==='undefined'||window.__lunaristApiConnectors)return;
  window.__lunaristApiConnectors=true;

  const esc=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const API='/api/lunarist?resource=oauth-admin';
  const LUNARIST=location.origin;
  const EUGENE_ORIGIN='https://eugene-card-1.vercel.app';
  const CLIENT_ID='lunarist-studio';
  const CALLBACK=`${LUNARIST}/api/eugene-card/callback`;
  const SCOPES=['openid','profile','email','offline_access'];

  const css=`
  .api-connector-wrap{margin-top:18px}
  .api-connector-card{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));border-radius:20px;padding:20px;box-shadow:0 18px 55px rgba(0,0,0,.16)}
  .api-connector-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
  .api-connector-brand{display:flex;align-items:center;gap:12px}.api-connector-icon{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;border:1px solid rgba(201,182,255,.3);background:rgba(201,182,255,.08);color:var(--moon);font-weight:900;font-size:19px}
  .api-status{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:800}.api-status-dot{width:7px;height:7px;border-radius:50%;background:var(--muted)}.api-status.ok{color:var(--green);border-color:rgba(142,224,186,.3)}.api-status.ok .api-status-dot{background:var(--green)}.api-status.warn{color:var(--gold);border-color:rgba(232,207,145,.3)}.api-status.warn .api-status-dot{background:var(--gold)}.api-status.error{color:var(--danger);border-color:rgba(255,125,142,.3)}.api-status.error .api-status-dot{background:var(--danger)}
  .api-connector-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}.api-connector-field{padding:12px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.025);min-width:0}.api-connector-field label{display:block;color:var(--muted);font:700 9px/1 IBM Plex Mono,monospace;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}.api-connector-field code{display:block;overflow:auto;white-space:nowrap;color:var(--text);font:12px/1.4 IBM Plex Mono,monospace}.api-scope-list{display:flex;gap:6px;flex-wrap:wrap}.api-scope{font:10px IBM Plex Mono,monospace;color:var(--moon);border:1px solid rgba(201,182,255,.22);background:rgba(201,182,255,.06);border-radius:999px;padding:5px 8px}.api-connector-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.api-connector-log{margin-top:12px;padding:11px 12px;border-radius:12px;background:#08070d;border:1px solid var(--line);font-size:11px;color:var(--muted);white-space:pre-wrap;min-height:18px}.api-connector-help{margin-top:12px;color:var(--muted);font-size:12px;line-height:1.6}
  @media(max-width:720px){.api-connector-grid{grid-template-columns:1fr}}
  `;
  const style=document.createElement('style');style.id='admin-api-connectors-style';style.textContent=css;document.head.appendChild(style);

  function authHeaders(){return typeof apiAuthHeaders==='function'?apiAuthHeaders():Promise.resolve({'Content-Type':'application/json'});}
  async function adminRequest(action,options={}){const headers=await authHeaders();const r=await fetch(`${API}&action=${encodeURIComponent(action)}`,{...options,headers:{...headers,...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`API request failed (${r.status})`);return d;}

  function panelHtml(){return `<div class="api-connector-wrap"><div class="api-connector-card">
    <div class="api-connector-head"><div class="api-connector-brand"><div class="api-connector-icon">L✦</div><div><div class="eyebrow">API Connector</div><h3 style="margin:4px 0">Eugene Card</h3><div class="meta">Registered OAuth 2.0 application · server-to-server token exchange</div></div></div><div id="apiConnectorStatus" class="api-status"><span class="api-status-dot"></span><span>Checking…</span></div></div>
    <div class="api-connector-grid">
      <div class="api-connector-field"><label>Client ID</label><code>${esc(CLIENT_ID)}</code></div>
      <div class="api-connector-field"><label>OAuth mode</label><code>Authorization Code + PKCE S256</code></div>
      <div class="api-connector-field"><label>Authorization endpoint</label><code>${esc(LUNARIST+'/oauth/authorize')}</code></div>
      <div class="api-connector-field"><label>Token endpoint</label><code>${esc(LUNARIST+'/oauth/token')}</code></div>
      <div class="api-connector-field"><label>Callback</label><code>${esc(CALLBACK)}</code></div>
      <div class="api-connector-field"><label>Eugene Card origin</label><code>${esc(EUGENE_ORIGIN)}</code></div>
      <div class="api-connector-field" style="grid-column:1/-1"><label>Scopes</label><div class="api-scope-list">${SCOPES.map(s=>`<span class="api-scope">${esc(s)}</span>`).join('')}</div></div>
    </div>
    <div class="api-connector-actions"><button class="btn primary" id="apiConnectorTest">Test API</button><button class="btn" id="apiConnectorGrants">View active grants</button><button class="btn" id="apiConnectorCopy">Copy OAuth configuration</button></div>
    <div class="api-connector-log" id="apiConnectorLog">Ready.</div>
    <div id="apiConnectorGrantsBox" style="display:none;margin-top:14px"></div>
    <div class="api-connector-help"><b style="color:var(--text)">Security:</b> no client secret is displayed or stored in this browser UI. OAuth authorization codes and tokens remain server-side; this panel only manages and verifies the registered integration.</div>
  </div></div>`}

  async function test(){
    const status=document.getElementById('apiConnectorStatus'),log=document.getElementById('apiConnectorLog'),btn=document.getElementById('apiConnectorTest');if(!status||!log)return;btn.disabled=true;status.className='api-status warn';status.innerHTML='<span class="api-status-dot"></span><span>Testing…</span>';log.textContent='Checking OAuth discovery and registered grants…';
    try{
      const discovery=await fetch(`${LUNARIST}/.well-known/oauth-authorization-server`,{cache:'no-store'});const meta=await discovery.json().catch(()=>({}));if(!discovery.ok)throw new Error(`Discovery endpoint returned ${discovery.status}.`);
      const grants=await adminRequest('grants');const active=Array.isArray(grants)?grants.filter(g=>g.client_id===CLIENT_ID&&g.active):[];
      status.className='api-status ok';status.innerHTML='<span class="api-status-dot"></span><span>Ready</span>';
      log.textContent=`OAuth API is reachable.\nAuthorization: ${meta.authorization_endpoint||LUNARIST+'/oauth/authorize'}\nToken: ${meta.token_endpoint||LUNARIST+'/oauth/token'}\nPKCE: ${Array.isArray(meta.code_challenge_methods_supported)?meta.code_challenge_methods_supported.join(', '):'S256'}\nActive ${CLIENT_ID} grants: ${active.length}`;
    }catch(e){status.className='api-status error';status.innerHTML='<span class="api-status-dot"></span><span>Check failed</span>';log.textContent=e.message||'Unable to test API connector.'}finally{btn.disabled=false}
  }

  async function grants(){
    const box=document.getElementById('apiConnectorGrantsBox');if(!box)return;box.style.display='block';box.innerHTML='<div class="panel"><div class="meta">Loading grants…</div></div>';
    try{const rows=(await adminRequest('grants')).filter(x=>x.client_id===CLIENT_ID);if(!rows.length){box.innerHTML='<div class="panel"><div class="meta">No Eugene Card OAuth grants have been issued yet.</div></div>';return}box.innerHTML=`<div class="panel"><div class="eyebrow">OAuth Grants</div><div style="margin-top:8px">${rows.map(g=>{const p=g.profile||{};return `<div class="listitem" style="align-items:center"><div class="grow"><b>${esc(p.display_name||p.username||g.lunarist_user_id)}</b><div class="meta">${esc(g.scope||'')} · created ${new Date(g.created_at).toLocaleString()} · ${g.revoked_at?'Revoked':g.active?'Active':'Expired'}</div></div>${g.active?`<button class="btn" data-revoke-grant="${esc(g.id)}">Revoke</button>`:''}</div>`}).join('')}</div></div>`;box.querySelectorAll('[data-revoke-grant]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await adminRequest('revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.revokeGrant})});toast('OAuth grant revoked');await grants();}catch(e){toast(e.message);b.disabled=false}})}catch(e){box.innerHTML=`<div class="panel"><div class="meta">${esc(e.message||'Unable to load grants.')}</div></div>`}
  }

  async function copyConfig(){const cfg={client_id:CLIENT_ID,authorization_endpoint:`${LUNARIST}/oauth/authorize`,token_endpoint:`${LUNARIST}/oauth/token`,userinfo_endpoint:`${LUNARIST}/oauth/userinfo`,revoke_endpoint:`${LUNARIST}/oauth/revoke`,redirect_uri:CALLBACK,grant_type:'authorization_code',code_challenge_method:'S256',scopes:SCOPES};try{await navigator.clipboard.writeText(JSON.stringify(cfg,null,2));toast('OAuth configuration copied')}catch{document.getElementById('apiConnectorLog').textContent=JSON.stringify(cfg,null,2)}}

  window.renderAdminApiConnectors=function(){const sec=document.getElementById('adminPageView');if(!sec)return;const existing=sec.querySelector('[data-studio-panel="api-connectors"]');if(existing)return;const panel=document.createElement('div');panel.dataset.studioPanel='api-connectors';panel.innerHTML=panelHtml();sec.appendChild(panel);document.getElementById('apiConnectorTest').onclick=test;document.getElementById('apiConnectorGrants').onclick=grants;document.getElementById('apiConnectorCopy').onclick=copyConfig;test()};
})();
