function cfg(){return{url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),key:process.env.SUPABASE_SERVICE_ROLE_KEY||'',client:process.env.PAYPAL_CLIENT_ID||'',secret:process.env.PAYPAL_CLIENT_SECRET||''}}
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function money(v){const n=Number(String(v??'').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>0?n:0}
function str(v,max){return typeof v==='string'?v.slice(0,max):''}
async function token(c){const r=await fetch('https://api-m.paypal.com/v1/oauth2/token',{method:'POST',body:'grant_type=client_credentials',headers:{Authorization:`Basic ${Buffer.from(`${c.client}:${c.secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'}});const d=await r.json();if(!r.ok||!d.access_token)throw Error('PayPal authentication failed');return d.access_token}
async function db(c,path,opts={}){return fetch(`${c.url}/rest/v1/${path}`,{...opts,headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',...(opts.headers||{})}})}

// Add-ons can be fixed, percentage, or duration-based. Duration add-ons charge
// once per unit after the included threshold, and are recalculated server-side.
function addonAmount(base,ao,durationSeconds=0){
  const n=money(ao?.price);
  if(ao?.type==='percent') return base*n/100;
  if(ao?.type==='duration'){
    const threshold=Math.max(0,Number(ao.threshold_seconds??ao.thresholdSeconds??180));
    const unit=Math.max(1,Number(ao.unit_seconds??ao.unitSeconds??30));
    const extra=Math.max(0,Number(durationSeconds||0)-threshold);
    return extra>0 ? Math.ceil(extra/unit)*n : 0;
  }
  return n;
}

async function loadService(c,service_id){
  if(!UUID_RE.test(service_id||''))throw Object.assign(Error('Invalid service.'),{status:400});
  const sr=await db(c,`services?select=id,title,price_from,add_ons,artist_id,owner_id&id=eq.${service_id}`);
  const services=await sr.json(), service=services?.[0];
  if(!service)throw Object.assign(Error('Service not found.'),{status:404});
  return service;
}

function resolveAddons(service,addon_titles,durationSeconds=0){
  const chosen=Array.isArray(addon_titles)?addon_titles.slice(0,10):[];
  const addons=Array.isArray(service.add_ons)?service.add_ons:[];
  const base=money(service.price_from);
  const selected=[];
  let addonTotal=0;
  for(const title of chosen){
    const ao=addons.find(x=>String(x?.title||'')===String(title));
    if(ao){
      const amount=addonAmount(base,ao,durationSeconds);
      addonTotal+=amount;
      selected.push({title:String(ao.title).slice(0,120),amount});
    }
  }
  return {base,addonTotal,total:base+addonTotal,selected};
}

function buildInquiryRow({service,service_id,customer,selected,status,paypal_order_id,payment_type,charge_amount,total_amount,client_id}){
  const artist_id=service?.artist_id||service?.owner_id||null;
  return {
    client_id:client_id||null,
    artist_id,
    client_name:str(customer.name,100),
    project_title:str(service?.title,160),
    service_id,
    name:str(customer.name,100),
    email:str(customer.email,160),
    company:str(customer.company,120),
    social:str(customer.social,120),
    target_deadline:customer.target_deadline||null,
    message:str(customer.message,4000)||(paypal_order_id?'PayPal service purchase':'Service inquiry'),
    attachment_url:str(customer.attachment_url,500),
    budget:`USD ${Number(total_amount||0).toFixed(2)}`,
    payment_type:payment_type==='deposit'?'deposit':'full',
    deposit_amount:payment_type==='deposit'?Number(charge_amount||0):null,
    total_amount:Number(total_amount||0),
    addon_titles:selected.map(a=>a.title),
    status,
    paypal_order_id:paypal_order_id||null
  };
}

async function createOrder(c,body,client_id=null){
  const {service_id,addon_titles=[],customer={},payment_type,video_duration_seconds=0}=body||{};
  const service=await loadService(c,service_id);
  const durationSeconds=Math.max(0,Number(video_duration_seconds)||0);
  const {base,total,selected}=resolveAddons(service,addon_titles,durationSeconds);
  if(!base)throw Object.assign(Error('This service has no configured PayPal price.'),{status:400});
  const isDeposit=payment_type==='deposit';
  const chargeAmount=isDeposit?(total/2):total;

  const t=await token(c);
  const site=process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:(process.env.NEXT_PUBLIC_SITE_URL||'https://lunaristudio.vercel.app');
  const returnUrl=`${site}/?paypal=success`;
  const cancelUrl=`${site}/?paypal=cancel`;
  const description=`${String(service.title).slice(0,100)} — ${isDeposit?'50% Deposit':'Full Amount'}`;

  const order=await fetch('https://api-m.paypal.com/v2/checkout/orders',{
    method:'POST',
    headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      intent:'CAPTURE',
      purchase_units:[{
        description:description.slice(0,127),
        custom_id:service.id,
        amount:{currency_code:'USD',value:chargeAmount.toFixed(2)}
      }],
      application_context:{return_url:returnUrl,cancel_url:cancelUrl,user_action:'PAY_NOW'},
      payer:{email_address:typeof customer.email==='string'?customer.email.slice(0,160):undefined}
    })
  });
  const od=await order.json();
  if(!order.ok)throw Object.assign(Error(od?.message||'PayPal order creation failed'),{status:502});

  const inquiry=buildInquiryRow({service,service_id,customer,selected,status:'new',paypal_order_id:od.id,payment_type:isDeposit?'deposit':'full',charge_amount:chargeAmount,total_amount:total,client_id});
  const cr=await db(c,'commissions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(inquiry)});
  if(!cr.ok){console.error('commission insert failed',await cr.text())}
  return od;
}

async function createInquiryOnly(c,body,client_id=null){
  const {service_id,addon_titles=[],customer={},video_duration_seconds=0}=body||{};
  const service=await loadService(c,service_id);
  const durationSeconds=Math.max(0,Number(video_duration_seconds)||0);
  const {total,selected}=resolveAddons(service,addon_titles,durationSeconds);
  if(!customer?.name||!customer?.email)throw Object.assign(Error('Name and email are required.'),{status:400});
  const inquiry=buildInquiryRow({service,service_id,customer,selected,status:'new',paypal_order_id:null,payment_type:'full',charge_amount:0,total_amount:total,client_id});
  const cr=await db(c,'commissions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(inquiry)});
  if(!cr.ok)throw Object.assign(Error('Unable to save your inquiry.'),{status:502});
  return {ok:true};
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

async function authUserId(c,req){
  const auth=String(req.headers.authorization||'');
  if(!auth.startsWith('Bearer '))return null;
  const r=await fetch(`${c.url}/auth/v1/user`,{headers:{apikey:c.key,Authorization:auth}});
  if(!r.ok)return null;
  const u=await r.json();
  return UUID_RE.test(u?.id||'')?u.id:null;
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const c=cfg();if(!c.url||!c.key)return res.status(503).json({error:'Payment environment is not configured.'});
  try{
    const b=req.body||{};
    if(b.action==='capture'){
      if(!c.client||!c.secret)return res.status(503).json({error:'Payment environment is not configured.'});
      return res.status(200).json(await capture(c,b.order_id));
    }
    const client_id=await authUserId(c,req);
    if(b.action==='inquiry_only')return res.status(200).json(await createInquiryOnly(c,b,client_id));
    if(!c.client||!c.secret)return res.status(503).json({error:'Payment environment is not configured.'});
    return res.status(200).json(await createOrder(c,b,client_id));
  }catch(e){
    console.error(e);
    return res.status(e.status||500).json({error:e.message||'PayPal request failed',...(e.data?{details:e.data}:{})})
  }
}
