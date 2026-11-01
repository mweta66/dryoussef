const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),core=require('../server/core.cjs');
const phone='01012345678';
for(const runtime of ['Node','Edge'])test(runtime+': incomplete legacy archives do not break listing/deletion and cannot restore malformed bookings',async()=>{
 const today=core.today();let state={roles:{admin:{r:'admin',u:'admin'}},settings:{branches:{alex:{name:'الإسكندرية'},dmn:{name:'دمنهور'}}},patients:{[phone]:{n:'مريضة الاختبار',d:today}},deletedBookings:{empty:null,missing:{deletedAt:today},broken:{booking:{id:'broken',phone}},valid:{booking:{id:'valid',name:'حجز محفوظ',phone,date:today,b:'alex',v:'exam',s:'done',no:1,rev:1}}},recycleBin:{empty:null,incomplete:{at:today},old:{id:'old',items:[{path:['patients','01012345679'],before:{n:'مريضة مؤرشفة',d:today}}]}}};
 const {createService}=runtime==='Node'?require('../server/service.cjs'):await import('../supabase/functions/clinic-api/service.js');const handle=createService({read:async()=>structuredClone(state),mutate:async fn=>{state=fn(structuredClone(state))}});
 assert.deepEqual(Object.keys(await handle({action:'get',path:'deletedBookings'},'admin')),['valid']);
 assert.deepEqual(Object.keys((await handle({action:'workspace',tab:'deleted'},'admin')).deletedBookings),['valid']);
 const before=structuredClone(state);await assert.rejects(handle({action:'bookingRestore',id:'broken'},'admin'),{status:409});assert.deepEqual(state,before);
 await handle({action:'patientDelete',phone},'admin');assert.equal(state.patients[phone],undefined);
 const trash=await handle({action:'trashList'},'admin');assert.ok(trash.rows.some(x=>x.id==='old'));const entry=trash.rows.find(x=>x.action==='patientDelete');assert.ok(entry);
 await handle({action:'trashRestore',id:entry.id},'admin');assert.ok(state.patients[phone]);await handle({action:'branchDelete',branch:'dmn'},'admin');assert.equal(state.settings.branches.dmn,undefined);
});
test('legacy incomplete deleted-booking rows cannot crash the browser or expose undefined rows',()=>{
 const source=fs.readFileSync('public/clinic-workspace.js','utf8').split('\n').find(x=>x.startsWith('function deletedPage()'));
 const context=vm.createContext({DELETED:{empty:null,broken:{},valid:{booking:{id:'ok',date:'2026-11-01',phone,name:'حجز محفوظ',b:'alex'}}},BR:{alex:{name:'الإسكندرية'}},esc:x=>String(x??'')});vm.runInContext(source,context);
 const html=context.deletedPage();assert.match(html,/حجز محفوظ/);assert.match(html,/ناقصة البيانات/);assert.doesNotMatch(html,/undefined/);
});
