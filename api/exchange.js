const ALLOWED=new Set(['USD','JPY']);
let cached={rate:null,at:0};
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const from=String(req.query?.from||'USD').toUpperCase();
  const to=String(req.query?.to||'JPY').toUpperCase();
  if(!ALLOWED.has(from)||!ALLOWED.has(to))return res.status(400).json({error:'Only USD and JPY are supported.'});
  if(from===to)return res.status(200).json({from,to,rate:1,source:'same-currency'});
  const now=Date.now();
  if(cached.rate&&now-cached.at<15*60*1000)return res.status(200).json({from,to,rate:cached.rate,source:'cached'});
  try{
    const r=await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const d=await r.json();
    const rate=Number(d?.rates?.[to]);
    if(!r.ok||!Number.isFinite(rate)||rate<=0)throw Error('Exchange-rate provider failed.');
    cached={rate,at:now};
    return res.status(200).json({from,to,rate,source:'frankfurter'});
  }catch(e){
    return res.status(502).json({error:e.message||'Unable to load exchange rate.'});
  }
}
