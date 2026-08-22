function cfg(){return{url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),key:process.env.SUPABASE_SERVICE_ROLE_KEY||'',client:process.env.PAYPAL_CLIENT_ID||'',secret:process.env.PAYPAL_CLIENT_SECRET||''}}
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function money(v){const n=Number(String(v??'').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>0?n:0}
async function token(c){const r=await fetch('https://api-m.paypal.com/v1/oauth2/token',{method:'POST',body:'grant_type=client_credentials',headers:{Authorization:`Basic ${Buffer.from(`${c.client}:${c.secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'}});const d=await r.json();if(!r.ok||!d.access_token)throw Error('PayPal authentication failed');return d.access_token}
async function db(c,path,opts={}){return fetch(`${c.url}/rest/v1/${path}`,{...opts,headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',...(opts.headers||{})}})}
async function createOrder(c,body){
 const {service_id,addon_titles=[],customer={}}=body||{};
 if(!UUID_RE.test(service_id||''))throw Object.assign(Error('Invalid service.'),{status:400});
 const sr=await db(c,`services?select=id,title,price_from,add_ons&id=eq.${service_id}`);
 const services=await sr.json(), service=services?.[0];
 if(!service)throw Object.assign(Error('Service not found.'),{status:404});
 const base=money(service.price_from);if(!base)throw Object.assign(Error('This service has no configured PayPal price.'),{status:400});
 const chosen=Array.isArray(addon_titles)?addon_titles.slice(0,10):[], addons=Array.isArray(service.add_ons)?service.add_ons:[];
 let total=base;const selected=[];
 for(const title of chosen){const ao=addons.find(x=>String(x?.title||'')===String(title));if(ao){const amount=money(ao.price);total+=amount;selected.push({title:String(ao.title).slice(0,120),amount:amount.toFixed(2)})}}
 const t=await token(c);
 const returnUrl=`${process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:process.env.NEXT_PUBLIC_SITE_URL||'https://lunaristudio.vercel.app'}/?paypal=success`;
 const cancelUrl=`${process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:process.env.NEXT_PUBLIC_SITE_URL||'https://lunaristudio.vercel.app'}/?paypal=cancel`;
 const order=await fetch('https://api-m.paypal.com/v2/checkout/orders',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{description:String(service.title).slice(0,127),custom_id:service.id,amount:{currency_code:'USD',value:total.toFixed(2)},items:[{name:String(service.title).slice(0,127),unit_amount:{currency_code:'USD',value:base.toFixed(2)},quantity:'1'},...selected.map(a=>({name:a.title,unit_amount:{currency_code:'USD',value:a.amount},quantity:'1'}))]}],application_context:{return_url:returnUrl,cancel_url:cancelUrl,user_action:'PAY_NOW'},payer:{email_address:typeof customer.email==='string'?customer.email.slice(0,160):undefined}})});
 const od=await order.json();if(!order.ok)throw Object.assign(Error(od?.message||'PayPal order creation failed'),{status:502});
 const inquiry={service_id,name:typeof customer.name==='string'?customer.name.slice(0,100):'',email:typeof customer.email==='string'?customer.email.slice(0,160):'',message:'PayPal service purchase',budget:`USD ${total.toFixed(2)}`,addon_titles:selected.map(a=>a.title),status:'new',paypal_order_id:od.id};
 const cr=await db(c,'commissions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(inquiry)});
 if(!cr.ok){console.error('commission insert failed',await cr.text())}
 return od;
}
async function capture(c,orderId){
 if(!/^[A-Z0-9-]{5,64}$/.test(orderId||''))throw Object.assign(Error('Invalid PayPal order.'),{status:400});
 const existing=await db(c,`commissions?select=id,status&paypal_order_id=eq.${encodeURIComponent(orderId)}&limit=1`);
 const rows=await existing.json();if(rows?.[0]?.status==='paid')return {alreadyCaptured:true,status:'paid'};
 const t=await token(c);
 const r=await fetch(`https://api-m.paypal.com/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'}});
 const d=await r.json();
 if(!r.ok)throw Object.assign(Error(d?.message||'PayPal capture failed'),{status:502,data:d});
 const paid=d.status==='COMPLETED';
 if(paid)await db(c,`commissions?paypal_order_id=eq.${encodeURIComponent(orderId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'paid',updated_at:new Date().toISOString()})});
 return {status:d.status,order:d};
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const c=cfg();if(!c.url||!c.key||!c.client||!c.secret)return res.status(503).json({error:'Payment environment is not configured.'});
 try{
  const b=req.body||{};
  if(b.action==='capture')return res.status(200).json(await capture(c,b.order_id));
  return res.status(200).json(await createOrder(c,b));
 }catch(e){console.error(e);return res.status(e.status||500).json({error:e.message||'PayPal request failed',...(e.data?{details:e.data}:{})})}
}
