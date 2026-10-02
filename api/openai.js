import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}


const recommendationBuckets=new Map();
function recommendationRateLimit(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  const key=forwarded||String(req.headers['x-real-ip']||'unknown');
  const now=Date.now(),last=recommendationBuckets.get(key)||0;
  if(now-last<30000)return false;
  recommendationBuckets.set(key,now);
  if(recommendationBuckets.size>2000){for(const [k,t] of recommendationBuckets)if(now-t>120000)recommendationBuckets.delete(k);}
  return true;
}
function cleanRecommendationItems(items,max=48){
  return (Array.isArray(items)?items:[]).slice(0,max).map(x=>({
    id:String(x?.id||''),title:String(x?.title||'').slice(0,160),category:String(x?.category||'').slice(0,80),
    tags:Array.isArray(x?.tags)?x.tags.slice(0,8).map(v=>String(v).slice(0,50)):[],description:String(x?.description||'').slice(0,500),
    creator:String(x?.creator||'').slice(0,100),role:String(x?.role||'').slice(0,80),price:String(x?.price||'').slice(0,40),delivery:String(x?.delivery||'').slice(0,80),
    popularity:Number(x?.popularity||0)||0,freshness:Number(x?.freshness||0)||0
  })).filter(x=>x.id);
}
async function recommendationResponse(req,body){
  if(!recommendationRateLimit(req))return {status:429,body:{error:'Recommendation refresh is temporarily limited.'}};
  const projects=cleanRecommendationItems(body.projects),services=cleanRecommendationItems(body.services);
  if(!projects.length&&!services.length)return {status:200,body:{homeProjectIds:[],discoverProjectIds:[],serviceIds:[]}};
  const interests=body.interests&&typeof body.interests==='object'?body.interests:{};
  const viewed=Array.isArray(body.viewed)?body.viewed.slice(0,30).map(String):[];
  const query=String(body.query||'').slice(0,180);
  const input=[
    'You are Lunarist Studio’s recommendation reranker.',
    'Rank only the supplied catalog IDs. Never invent IDs.',
    'Optimize for genuine relevance and discovery, not generic popularity.',
    'Use visitor interests and viewed history as signals, but avoid repeating recently viewed items when good alternatives exist.',
    'Balance relevance with diversity: avoid returning many near-duplicates from the same category or creator.',
    'For services, consider usefulness of the offer, category/tags, creator, price/delivery when present, and query relevance.',
    'For projects, consider semantic fit, category/tags, creator/role, freshness/popularity, and query relevance.',
    'Return only IDs from the supplied catalog.',JSON.stringify({interests,viewed,query,projects,services})
  ].join('\\n');
  const response=await openai.responses.create({model:'gpt-6-luna',reasoning:{effort:'low'},input,store:false,text:{format:{type:'json_schema',name:'lunarist_recommendations',strict:true,schema:{type:'object',additionalProperties:false,properties:{homeProjectIds:{type:'array',items:{type:'string'}},discoverProjectIds:{type:'array',items:{type:'string'}},serviceIds:{type:'array',items:{type:'string'}}},required:['homeProjectIds','discoverProjectIds','serviceIds']}}}});
  const parsed=JSON.parse(response.output_text||'{}');
  const projectSet=new Set(projects.map(x=>x.id)),serviceSet=new Set(services.map(x=>x.id));
  const valid=(arr,set)=>Array.isArray(arr)?arr.map(String).filter((id,i,a)=>set.has(id)&&a.indexOf(id)===i).slice(0,12):[];
  return {status:200,body:{homeProjectIds:valid(parsed.homeProjectIds,projectSet),discoverProjectIds:valid(parsed.discoverProjectIds,projectSet),serviceIds:valid(parsed.serviceIds,serviceSet)}};
}

async function requireUser(req) {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!url || !key || !token) return null;

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(res, 500, { error: 'OpenAI is not configured on the server.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.action === 'recommendations') {
      try {
        const result = await recommendationResponse(req, body);
        return json(res, result.status, result.body);
      } catch (error) {
        console.error('AI recommendation request failed:', error);
        return json(res, 500, { error: error?.message || 'AI recommendation request failed.' });
      }
    }

    const user = await requireUser(req);
    if (!user?.id) {
      return json(res, 401, { error: 'Sign in to Lunarist to use AI.' });
    }
    const input = typeof body.input === 'string' ? body.input.trim() : '';

    if (!input) {
      return json(res, 400, { error: 'input is required.' });
    }

    if (input.length > 12000) {
      return json(res, 400, { error: 'input is too long.' });
    }

    const response = await openai.responses.create({
      model: 'gpt-6-luna',
      input,
      store: true,
    });

    return json(res, 200, {
      id: response.id,
      output_text: response.output_text,
    });
  } catch (error) {
    console.error('OpenAI request failed:', error);
    return json(res, 500, {
      error: error?.message || 'OpenAI request failed.',
    });
  }
}
