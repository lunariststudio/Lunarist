export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const from=String(req.query?.from||'USD').toUpperCase();
  const to=String(req.query?.to||'JPY').toUpperCase();
  if(from!=='USD'||to!=='JPY')return res.status(400).json({error:'Only USD to JPY is supported.'});
  try{
    const r=await fetch('https://api.frankfurter.app/latest?from=USD&to=JPY');
    const d=await r.json();
    const rate=Number(d?.rates?.JPY);
    if(!r.ok||!rate)throw new Error('Exchange rate unavailable.');
    return res.status(200).json({from,to,rate,source:'Frankfurter'});
  }catch(e){return res.status(502).json({error:e.message||'Exchange rate unavailable.'})}
}
