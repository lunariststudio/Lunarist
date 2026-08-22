function config(){return{url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),key:process.env.SUPABASE_SERVICE_ROLE_KEY||''}}
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function money(v){const n=Number(String(v??'').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>0?n:0}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).end();
  const {url,key}=config(); if(!url||!key)return res.status(503).json({error:'Supabase server credentials are not configured.'});
  const {service_id,addon_titles=[],customer={}}=req.body||{};
  if(!UUID_RE.test(service_id||''))return res.status(400).json({error:'Invalid service.'});
  try{
    const sr=await fetch(`${url}/rest/v1/services?select=id,title,description,price_from,add_ons& id=eq.${service_id}`.replace('?select=id,title,description,price_from,add_ons& id','?select=id,title,description,price_from,add_ons&id'),{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    const services=await sr.json(); const service=services?.[0];
    if(!service||!service.id)return res.status(404).json({error:'Service not found.'});
    const base=money(service.price_from); if(!base)return res.status(400).json({error:'This service has no configured PayPal price.'});
    const addons=Array.isArray(service.add_ons)?service.add_ons:[];
    const chosen=Array.isArray(addon_titles)?addon_titles.slice(0,10):[];
    let total=base; const selected=[];
    for(const title of chosen){
      const ao=addons.find(x=>String(x?.title||'')===String(title));
      if(ao){const amount=money(ao.price);total+=amount;selected.push({title:String(ao.title).slice(0,120),amount:amount.toFixed(2)})}
    }
    const clientId=process.env.PAYPAL_CLIENT_ID,secretKey=process.env.PAYPAL_CLIENT_SECRET;
    if(!clientId||!secretKey)return res.status(500).json({error:'PayPal credentials not configured in environment variables.'});
    const auth=Buffer.from(`${clientId}:${secretKey}`).toString('base64');
    const tokenResponse=await fetch('https://api-m.paypal.com/v1/oauth2/token',{method:'POST',body:'grant_type=client_credentials',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'}});
    const tokenData=await tokenResponse.json(); if(!tokenResponse.ok||!tokenData.access_token)return res.status(502).json({error:'Unable to authenticate with PayPal'});
    const orderResponse=await fetch('https://api-m.paypal.com/v2/checkout/orders',{method:'POST',headers:{Authorization:`Bearer ${tokenData.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({
      intent:'CAPTURE',
      purchase_units:[{description:String(service.title).slice(0,127),custom_id:service.id,amount:{currency_code:'USD',value:total.toFixed(2)},items:[{name:String(service.title).slice(0,127),unit_amount:{currency_code:'USD',value:base.toFixed(2)},quantity:'1'},...selected.map(a=>({name:a.title,unit_amount:{currency_code:'USD',value:a.amount},quantity:'1'}))]}],
      payer:{email_address:typeof customer.email==='string'?customer.email.slice(0,160):undefined}
    })});
    const orderData=await orderResponse.json(); return res.status(orderResponse.status).json(orderData);
  }catch(e){console.error(e);return res.status(500).json({error:'PayPal request failed'});}
}
