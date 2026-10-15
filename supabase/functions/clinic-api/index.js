import {supabaseAdapter} from './adapter.js';
import {createService} from './service.js';
const adapter=supabaseAdapter(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
const handle=createService(adapter);
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-request-id','Access-Control-Expose-Headers':'x-request-id','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
Deno.serve(async req=>{
 const requestId=crypto.randomUUID(),started=Date.now(),responseHeaders={...headers,'x-request-id':requestId};let action='unknown';
 if(req.method==='OPTIONS')return new Response(null,{headers,status:204});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{headers,status:405});
 try{
  if(!String(req.headers.get('content-type')).startsWith('application/json'))return new Response(JSON.stringify({error:'JSON required'}),{headers,status:415});
  if(Number(req.headers.get('content-length')||0)>900000)return new Response(JSON.stringify({error:'Payload too large'}),{headers,status:413});
  const text=await req.text();if(new TextEncoder().encode(text).length>900000)return new Response(JSON.stringify({error:'Payload too large'}),{headers,status:413});
  const input=JSON.parse(text);action=/^[A-Za-z]{1,40}$/.test(input.action)?input.action:'unknown';const isPublic=input.action==='lookup'||input.action==='publicQueue'||input.action==='get'&&input.path==='settings';
  let uid=null;if(!isPublic){const token=(req.headers.get('Authorization')||'').match(/^Bearer (.+)$/)?.[1];if(!token)return new Response(JSON.stringify({error:'NOAUTH'}),{headers,status:401});uid=await adapter.verify(token)}
  const client=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
  const data=await handle(input,uid,client);console.info(JSON.stringify({event:'clinic_request',requestId,action,status:200,durationMs:Date.now()-started}));return new Response(JSON.stringify({data}),{headers:responseHeaders});
 }catch(e){const status=Number.isInteger(e.status)&&e.status>=400&&e.status<=599?e.status:500;console.error(JSON.stringify({event:'clinic_error',requestId,action,status,durationMs:Date.now()-started}));if(status>=500){const task=adapter.recordError({request_id:requestId,action,status,duration_ms:Date.now()-started}).catch(()=>{});if(typeof EdgeRuntime!=='undefined')EdgeRuntime.waitUntil(task);}return new Response(JSON.stringify({error:e.status?e.message:'تعذر تنفيذ العملية',requestId}),{headers:responseHeaders,status})}
});
