const {test}=require('node:test'),assert=require('node:assert/strict');
const config={enabled:true,walletEnabled:true,walletNumber:'٠١٠١٢٣٤٥٦٧٨',instapayEnabled:true,instapayUrl:'https://ipn.eg/S/local-test',message:'QA price instructions'};
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'Content-Type':'application/json'}});
for(const runtime of ['Node','Edge'])for(const actor of ['admin','doctor']){
 test(runtime+' '+actor+': payment save uses bounded delta and an idempotent receipt, returning acknowledged settings even after a lost upstream reply',async()=>{
  const {supabaseAdapter}=await import('../supabase/functions/clinic-api/adapter.js');
  const {createService}=runtime==='Node'?require('../server/service.cjs'):await import('../supabase/functions/clinic-api/service.js');
  const state={roles:{[actor]:{r:actor,u:actor}},settings:{avg:15,paymentsRev:0},patients:{}},calls=[];let saved,write;
  const adapter=supabaseAdapter('https://isolated.invalid','local-only',async(url,options)=>{
   const name=new URL(url).pathname.split('/').at(-1),body=JSON.parse(options.body||'{}');calls.push(name);
   if(name==='clinic_read_slice')return json({roles:state.roles});
   if(name==='clinic_mutation_receipt')return json(saved||null);
   if(name==='clinic_operational_snapshot')return json({version:10,payload:state});
   if(name==='clinic_compare_and_swap_delta'){write=body;saved={...body.receipt,status:'saved',version:11,committedAt:'2026-11-04T00:00:00Z'};throw new TypeError('isolated lost response');}
   throw Error('Unexpected full snapshot/archive transport: '+name);
  });
  const handle=createService(adapter),input={action:'paymentSettingsSave',revision:0,config,operationId:'payment_operation_12345678'};
  const result=await handle(input,actor);assert.equal(result.ok,true);assert.equal(result.revision,1);assert.equal(result.payments.walletNumber,'01012345678');assert.equal(result.payments.message,config.message);
  assert.equal(write.receipt.action,'paymentSettingsSave');assert.equal(write.receipt.uid,actor);assert.ok(write.changes.some(x=>x.path[0]==='settings'&&x.path[1]==='payments'));assert.ok(JSON.stringify(write).length<10000);assert.equal(calls.filter(x=>x==='clinic_compare_and_swap_delta').length,1);
  assert.equal((await handle(input,actor)).reconciled,true);assert.equal(calls.filter(x=>x==='clinic_compare_and_swap_delta').length,1);
 });
}
