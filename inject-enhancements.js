const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'index.html');
if(!fs.existsSync(file))throw new Error('index.html not found');
let html=fs.readFileSync(file,'utf8');
const requiredScripts=['lunarist-enhancements.js','client-messaging.js','client-chat-and-artist-join.js','x-project-player.js','social-project-fix.js','services-drag-drop.js','x-discovery-likes.js','discover-role-filter.js','discover-filters-fix.js','project-media-manager.js','slides-addon-logic.js','slides-addon-logic-fix.js','profile-role-dropdown.js','eugene-lunarist-integration.js','eugene-connection-status-fix.js','eugene-status-render-fix.js','eugene-card-oauth-ui.js','eugene-oauth-nav-fix.js','oauth-admin-ui.js','oauth-admin-route-fix.js','oauth-browser-bridge.js'];
if(!html.includes('</body>'))throw new Error('index.html has no closing body tag');
const removedScripts=['slides-pricing.js','slides-live-ui.js','slides-persistence-fix.js','project-slides-view.js','project-media-carousel-fix.js','social-links.js','member-social-fix.js','profile-social-settings.js','public-profile-socials.js'];
for(const name of removedScripts){const re=new RegExp(`\\s*<script[^>]*src=["']/${name.replace(/\\./g,'\\\\.')}(\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'g');html=html.replace(re,'\n');}
for(const name of requiredScripts){const alreadyPresent=new RegExp(`<script[^>]*src=["']/${name.replace(/\\./g,'\\\\.')}(\\?[^"']*)?["'][^>]*>`).test(html);if(!alreadyPresent)html=html.replace('</body>',`<script src="/${name}"></script>\n</body>`);}
html=html.replace(/\s*<script src="\/client-route-safety\.js\?v=1"><\/script>\s*/g,'\n');
if(!html.includes('window.state=state'))html=html.replace(/const data=\{members:\[\],projects:\[\],services:\[\],recommendations:\[\]\};/,'const data={members:[],projects:[],services:[],recommendations:[]};window.state=state;window.data=data;');
if(!html.includes('window.supabaseClient=window.supabase.createClient'))html=html.replace('supabaseClient=window.supabase.createClient','supabaseClient=window.supabaseClient=window.supabase.createClient');
fs.writeFileSync(file,html);

// OAuth consent forms submit as POST requests, so the authorization parameters
// from the initial GET must travel with the approval action. Without these hidden
// fields the POST arrives with no client_id and is reported as an unknown client.
const oauthFile=path.join(process.cwd(),'lib','oauth-provider.js');
if(fs.existsSync(oauthFile)){
  let oauth=fs.readFileSync(oauthFile,'utf8');
  const old='<form method="POST"><input type="hidden" name="action" value="approve"><button type="submit">Approve and continue</button></form>';
  const next='<form method="POST"><input type="hidden" name="action" value="approve"><input type="hidden" name="client_id" value="${escapeHtml(params.client_id)}"><input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri)}"><input type="hidden" name="response_type" value="${escapeHtml(params.response_type)}"><input type="hidden" name="scope" value="${escapeHtml(params.scope)}"><input type="hidden" name="code_challenge" value="${escapeHtml(params.code_challenge)}"><input type="hidden" name="code_challenge_method" value="${escapeHtml(params.code_challenge_method)}"><input type="hidden" name="state" value="${escapeHtml(params.state)}"><button type="submit">Approve and continue</button></form>';
  if(oauth.includes(old)){
    oauth=oauth.replace(old,next);
    fs.writeFileSync(oauthFile,oauth);
    console.log('OAuth consent form state preservation injected.');
  }else if(!oauth.includes('name="code_challenge" value="${escapeHtml(params.code_challenge)}"')){
    throw new Error('OAuth consent form target was not found; refusing to build an unpatched OAuth provider.');
  }
}
console.log('Lunarist enhancements injected; Eugene Card registered OAuth client integration enabled.');
