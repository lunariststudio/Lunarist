import {handleOAuth} from '../lib/oauth-provider.js';

export default async function handler(req,res){
  if(req.method==='POST'){
    const query=req.query&&typeof req.query==='object'?req.query:{};
    const body=req.body&&typeof req.body==='object'?req.body:{};
    req.body={...query,...body};
  }
  return handleOAuth(req,res);
}
