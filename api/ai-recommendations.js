import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function json(res,status,body){res.status(status).setHeader('Content-Type','application/json');return res.end(JSON.stringify(body));}

const buckets=new Map();
function rateLimit(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  const key=forwarded||String(req.headers['x-real-ip']||'unknown');
  const now=Date.now(), last=buckets.get(key)||0;
  if(now-last<30000)return false;
  buckets.set(key,now);
  if(buckets.size>2000){for(const [k,t] of buckets)if(now-t>120000)buckets.delete(k);}
  return true;
}

function cleanItems(items,max=48){
  return (Array.isArray(items)?items:[]).slice(0,max).map(x=>({
    id:String(x?.id||''),
    title:String(x?.title||'').slice(0,160),
    category:String(x?.category||'').slice(0,80),
    tags:Array.isArray(x?.tags)?x.tags.slice(0,8).map(v=>String(v).slice(0,50)):[],
    description:String(x?.description||'').slice(0,500),
    creator:String(x?.creator||'').slice(0,100),
    role:String(x?.role||'').slice(0,80),
    price:String(x?.price||'').slice(0,40),
    delivery:String(x?.delivery||'').slice(0,80),
    popularity:Number(x?.popularity||0)||0,
    freshness:Number(x?.freshness||0)||0
  })).filter(x=>x.id);
}

export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'Method not allowed.'});}
  if(!process.env.OPENAI_API_KEY)return json(res,500,{error:'OpenAI is not configured on the server.'});
  if(!rateLimit(req))return json(res,429,{error:'Recommendation refresh is temporarily limited.'});

  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const projects=cleanItems(body.projects);
    const services=cleanItems(body.services);
    if(!projects.length&&!services.length)return json(res,200,{homeProjectIds:[],discoverProjectIds:[],serviceIds:[]});

    const interests=body.interests&&typeof body.interests==='object'?body.interests:{};
    const viewed=Array.isArray(body.viewed)?body.viewed.slice(0,30).map(String):[];
    const query=String(body.query||'').slice(0,180);

    const input=[
      'You are Lunarist Studio’s recommendation reranker.',
      'Rank only the supplied catalog IDs. Never invent IDs.',
      'Optimize for genuine relevance and discovery, not generic popularity.',
      'Use the visitor’s interests and viewed history as signals, but avoid repeating recently viewed items when good alternatives exist.',
      'Balance relevance with diversity: avoid returning many near-duplicates from the same category or creator.',
      'For services, consider the usefulness of the offer, category/tags, creator, price/delivery when present, and query relevance.',
      'For projects, consider semantic fit, category/tags, creator/role, freshness/popularity, and query relevance.',
      'Return only IDs from the supplied catalog.',
      JSON.stringify({interests,viewed,query,projects,services})
    ].join('\n');

    const response=await openai.responses.create({
      model:'gpt-6-luna',
      reasoning:{effort:'low'},
      input,
      store:false,
      text:{
        format:{
          type:'json_schema',
          name:'lunarist_recommendations',
          strict:true,
          schema:{
            type:'object',
            additionalProperties:false,
            properties:{
              homeProjectIds:{type:'array',items:{type:'string'}},
              discoverProjectIds:{type:'array',items:{type:'string'}},
              serviceIds:{type:'array',items:{type:'string'}}
            },
            required:['homeProjectIds','discoverProjectIds','serviceIds']
          }
        }
      }
    });

    const parsed=JSON.parse(response.output_text||'{}');
    const projectSet=new Set(projects.map(x=>x.id)),serviceSet=new Set(services.map(x=>x.id));
    const valid=(arr,set)=>Array.isArray(arr)?arr.map(String).filter((id,i,a)=>set.has(id)&&a.indexOf(id)===i).slice(0,12):[];
    return json(res,200,{
      homeProjectIds:valid(parsed.homeProjectIds,projectSet),
      discoverProjectIds:valid(parsed.discoverProjectIds,projectSet),
      serviceIds:valid(parsed.serviceIds,serviceSet)
    });
  }catch(error){
    console.error('AI recommendation request failed:',error);
    return json(res,500,{error:error?.message||'AI recommendation request failed.'});
  }
}
