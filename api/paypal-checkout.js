function cfg(){return{url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),key:process.env.SUPABASE_SERVICE_ROLE_KEY||'',client:process.env.PAYPAL_CLIENT_ID||'',secret:process.env.PAYPAL_CLIENT_SECRET||''}}
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function money(v){const n=Number(String(v??'').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>0?n:0}
function str(v,max){return typeof v==='string'?v.slice(0,max):''}
async function token(c){const r=await fetch('https://api-m.paypal.com/v1/oauth2/token',{method:'POST',body:'grant_type=client_credentials',headers:{Authorization:`Basic ${Buffer.from(`${c.client}:${c.secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'}});const d=await r.json();if(!r.ok||!d.access_token)throw Error('PayPal authentication failed');return d.access_token}
async function db(c,path,opts={}){return fetch(`${c.url}/rest/v1/${path}`,{...opts,headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',...(opts.headers||{})}})}

// Add-ons can be a flat dollar amount ({type:'fixed'}) or a percentage of the
// base price ({type:'percent'}). Percentage is resolved server-side against
// the service's own price_from so a tampered client total can't be trusted.
function addonIsDuration(ao){return ao?.type==='duration'||ao?.duration===true||Number(ao?.included_seconds||ao?.includedSeconds||0)>0||Number(ao?.unit_seconds||ao?.unitSeconds||0)>0}
function addonDurationAmount(ao,durationSeconds){const included=Number(ao?.included_seconds??ao?.includedSeconds??0)||0;const unit=Number(ao?.unit_seconds??ao?.unitSeconds??30)||30;const price=money(ao?.price);const d=Math.max(0,Number(durationSeconds)||0);if(!d||d<=included)return 0;return Math.ceil((d-included)/unit)*price}
function addonAmount(base,ao,options={}){
  if(addonIsDuration(ao)) return addonDurationAmount(ao,options.duration_seconds);
  const n=money(ao?.price);
  return ao?.type==='percent' ? (base*n/100) : n;
}
async function usdJpyRate(){
  const r=await fetch('https://api.frankfurter.app/latest?from=USD&to=JPY');
  const d=await r.json();
  const rate=Number(d?.rates?.JPY);
  if(!r.ok||!rate)throw Object.assign(new Error('Unable to obtain the USD/JPY exchange rate.'),{status:502});
  return rate;
}

async function loadService(c,service_id){
  if(!UUID_RE.test(service_id||''))throw Object.assign(Error('Invalid service.'),{status:400});
  const sr=await db(c,`services?select=id,title,price_from,add_ons&id=eq.${service_id}`);
  const services=await sr.json(), service=services?.[0];
  if(!service)throw Object.assign(Error('Service not found.'),{status:404});
  return service;
}

function resolveAddons(service,addon_titles,addon_options=[]){
  const chosen=Array.isArray(addon_titles)?addon_titles.slice(0,10):[];
  const options=Array.isArray(addon_options)?addon_options.slice(0,10):[];
  const addons=Array.isArray(service.add_ons)?service.add_ons:[];
  const base=money(service.price_from);
  const selected=[];
  let addonTotal=0;
  for(const title of chosen){
    const ao=addons.find(x=>String(x?.title||'')===String(title));
    if(ao){
      const opt=options.find(x=>String(x?.title||'')===String(title))||{};
      const durationSeconds=addonIsDuration(ao)?Number(opt.duration_seconds):null;
      if(addonIsDuration(ao)&&(!Number.isFinite(durationSeconds)||durationSeconds<0))throw Object.assign(new Error(`Duration is required for add-on: ${String(ao.title).slice(0,120)}`),{status:400});
      const amount=addonAmount(base,ao,{duration_seconds:durationSeconds});
      addonTotal+=amount;
      selected.push({title:String(ao.title).slice(0,120),amount,duration_seconds:durationSeconds});
    }
  }
  return {base,addonTotal,total:base+addonTotal,selected};
}

function buildInquiryRow({service_id,customer,selected,status,paypal_order_id,payment_type,charge_amount,total_amount,currency='USD'}){
  return {
    service_id,
    name:str(customer.name,100),
    email:str(customer.email,160),
    company:str(customer.company,120),
    social:str(customer.social,120),
    target_deadline:customer.target_deadline||null,
    message:str(customer.message,4000)||(paypal_order_id?'PayPal service purchase':'Service inquiry'),
    attachment_url:str(customer.attachment_url,500),
    budget:`${currency} ${Number(total_amount||0).toFixed(2)}`,
    currency,
    payment_type:payment_type==='deposit'?'deposit':'full',
    deposit_amount:payment_type==='deposit'?Number(charge_amount||0):null,
    total_amount:Number(total_amount||0),
    addon_titles:selected.map(a=>a.title),
    status,
    paypal_order_id:paypal_order_id||null
  };
}

async function createOrder(c,body){
  const {service_id,addon_titles=[],addon_options=[],customer={},payment_type,currency='USD'}=body||{};
  const service=await loadService(c,service_id);
  const {base,total,selected}=resolveAddons(service,addon_titles,addon_options);
  if(!base)throw Object.assign(Error('This service has no configured PayPal price.'),{status:400});
  const isDeposit=payment_type==='deposit';
  const requestedCurrency=String(currency).toUpperCase()==='JPY'?'JPY':'USD';
  const rate=requestedCurrency==='JPY'?await usdJpyRate():1;
  const convertedTotal=requestedCurrency==='JPY'?Math.round(total*rate):total;
  const chargeAmountBase=isDeposit?(total/2):total;
  const chargeAmount=requestedCurrency==='JPY'?Math.round(chargeAmountBase*rate):chargeAmountBase;

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
        amount:{currency_code:requestedCurrency,value:chargeAmount.toFixed(2)}
      }],
      application_context:{return_url:returnUrl,cancel_url:cancelUrl,user_action:'PAY_NOW'},
      payer:{email_address:typeof customer.email==='string'?customer.email.slice(0,160):undefined}
    })
  });
  const od=await order.json();
  if(!order.ok)throw Object.assign(Error(od?.message||'PayPal order creation failed'),{status:502});

  const inquiry=buildInquiryRow({service_id,customer,selected,status:'new',paypal_order_id:od.id,payment_type:isDeposit?'deposit':'full',charge_amount:chargeAmount,total_amount:convertedTotal,currency:requestedCurrency});
  const cr=await db(c,'commissions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(inquiry)});
  if(!cr.ok){console.error('commission insert failed',await cr.text())}
  return od;
}

async function createInquiryOnly(c,body){
  const {service_id,addon_titles=[],addon_options=[],customer={},currency='USD'}=body||{};
  const service=await loadService(c,service_id);
  const {total,selected}=resolveAddons(service,addon_titles,addon_options);
  if(!customer?.name||!customer?.email)throw Object.assign(Error('Name and email are required.'),{status:400});
  const requestedCurrency=String(currency).toUpperCase()==='JPY'?'JPY':'USD';
  const rate=requestedCurrency==='JPY'?await usdJpyRate():1;
  const convertedTotal=requestedCurrency==='JPY'?Math.round(total*rate):total;
  const inquiry=buildInquiryRow({service_id,customer,selected,status:'new',paypal_order_id:null,payment_type:'full',charge_amount:0,total_amount:convertedTotal,currency:requestedCurrency});
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

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const c=cfg();if(!c.url||!c.key)return res.status(503).json({error:'Payment environment is not configured.'});
  try{
    const b=req.body||{};
    if(b.action==='capture'){
      if(!c.client||!c.secret)return res.status(503).json({error:'Payment environment is not configured.'});
      return res.status(200).json(await capture(c,b.order_id));
    }
    if(b.action==='inquiry_only')return res.status(200).json(await createInquiryOnly(c,b));
    if(!c.client||!c.secret)return res.status(503).json({error:'Payment environment is not configured.'});
    return res.status(200).json(await createOrder(c,b));
  }catch(e){
    console.error(e);
    return res.status(e.status||500).json({error:e.message||'PayPal request failed',...(e.data?{details:e.data}:{})})
  }
}
