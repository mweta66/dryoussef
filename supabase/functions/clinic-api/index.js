import {supabaseAdapter} from './adapter.js';
import {createService} from './service.js';
const adapter=supabaseAdapter(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
const handle=createService(adapter);
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers,status:204});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{headers,status:405});
 try{
  if(!String(req.headers.get('content-type')).startsWith('application/json'))return new Response(JSON.stringify({error:'JSON required'}),{headers,status:415});
  if(Number(req.headers.get('content-length')||0)>900000)return new Response(JSON.stringify({error:'Payload too large'}),{headers,status:413});
  const text=await req.text();if(new TextEncoder().encode(text).length>900000)return new Response(JSON.stringify({error:'Payload too large'}),{headers,status:413});
  const input=JSON.parse(text),isPublic=input.action==='lookup'||input.action==='get'&&input.path==='settings';
  let uid=null;if(!isPublic){const token=(req.headers.get('Authorization')||'').match(/^Bearer (.+)$/)?.[1];if(!token)return new Response(JSON.stringify({error:'NOAUTH'}),{headers,status:401});uid=await adapter.verify(token)}
  const client=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
  const data=await handle(input,uid,client);return new Response(JSON.stringify({data}),{headers});
 }catch(e){return new Response(JSON.stringify({error:e.status?e.message:'تعذر تنفيذ العملية'}),{headers,status:e.status||500})}
});
