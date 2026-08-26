export default async function handler(req, res) {
  const input=String(req.query?.url||req.body?.url||'').trim();
  const clientId=String(process.env.TWITCH_CLIENT_ID||'').trim();
  const clientSecret=String(process.env.TWITCH_CLIENT_SECRET||'').trim();
  if(!clientId||!clientSecret)return res.status(503).json({error:'TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are not configured in Vercel.'});
  let u; try{u=new URL(/^https?:\/\//i.test(input)?input:'https://'+input)}catch{return res.status(400).json({error:'Invalid Twitch URL.'})}
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(host!=='twitch.tv'&&host!=='m.twitch.tv')return res.status(400).json({error:'That does not look like a Twitch URL.'});
  const parts=u.pathname.split('/').filter(Boolean);
  if(!parts.length)return res.status(400).json({error:'Invalid Twitch URL.'});
  try{
    const tr=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'client_credentials'})});
    const td=await tr.json().catch(()=>({}));
    if(!tr.ok||!td.access_token)return res.status(tr.status||502).json({error:td.message||'Twitch authentication failed.'});
    const token=td.access_token;
    async function helix(path){const r=await fetch('https://api.twitch.tv/helix'+path,{headers:{'Client-ID':clientId,'Authorization':'Bearer '+token}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Twitch API request failed.');return d}
    if(parts[0].toLowerCase()==='videos'&&parts[1]){
      const d=await helix('/videos?id='+encodeURIComponent(parts[1])),v=d.data?.[0];
      if(!v)return res.status(404).json({error:'Twitch VOD not found.'});
      return res.status(200).json({platform:'twitch',type:'video',mediaType:'video',id:v.id,url:input,title:v.title||'',description:v.description||'',author:v.user_name||'',username:v.user_login||'',thumbnail:v.thumbnail_url||'',game:v.game_name||'',viewCount:Number(v.view_count||0),publishedAt:v.published_at||null,duration:v.duration||'',isLive:false});
    }
    if(parts[0].toLowerCase()==='clip')return res.status(400).json({error:'Twitch Clips are not supported yet. Use a channel or VOD URL.'});
    const login=parts[0],users=await helix('/users?login='+encodeURIComponent(login)),user=users.data?.[0];
    if(!user)return res.status(404).json({error:'Twitch channel not found.'});
    const streams=await helix('/streams?user_id='+encodeURIComponent(user.id)),s=streams.data?.[0];
    return res.status(200).json({platform:'twitch',type:s?'live':'channel',mediaType:'video',url:input,title:s?.title||user.display_name||'',description:user.description||'',author:user.display_name||'',username:user.login||'',thumbnail:s?.thumbnail_url?s.thumbnail_url.replace('{width}','1280').replace('{height}','720'):(user.profile_image_url||''),game:s?.game_name||'',isLive:!!s,viewers:Number(s?.viewer_count||0),viewCount:0,startedAt:s?.started_at||null});
  }catch(e){return res.status(500).json({error:e.message||'Unable to fetch Twitch data.'})}
}
