const {test}=require('node:test'),assert=require('node:assert/strict'),identity=require('../server/patient-identity.cjs'),core=require('../server/core.cjs');
const phone='01012345678';
for(const runtime of ['Node','Edge'])test(runtime+': deleting and restoring a legacy patient preserves its stable identity and clinical references',async()=>{
 let state={roles:{admin:{r:'admin',u:'admin'}},settings:{branches:{alex:{name:'الإسكندرية',enabled:true}}},patients:{[phone]:{n:'مريضة الاستعادة',d:core.today()}},bookings:{[core.today()]:{booking:{id:'booking',phone,name:'مريضة الاستعادة',date:core.today(),b:'alex',no:1,v:'exam',s:'wait',rev:1}}}};
 identity.ensure(state);const originalId=identity.idForPhone(state,phone);state.bookings[core.today()].booking.patientId=originalId;
 state.clinicalVisits={visit:{id:'visit',phone,patientId:originalId,date:core.today(),medical:{n:'زيارة محفوظة'}}};state.followupPlans={plan:{id:'plan',phone,patientId:originalId,type:'follow',branch:'alex'}};
 const {createService}=runtime==='Node'?require('../server/service.cjs'):await import('../supabase/functions/clinic-api/service.js');const handle=createService({read:async()=>structuredClone(state),mutate:async fn=>{state=fn(structuredClone(state))}});
 await handle({action:'patientDelete',phone},'admin');assert.equal(state.patients[phone],undefined);assert.ok(state.patientIdentities[originalId].deletedAt);
 const trash=await handle({action:'trashList'},'admin');await handle({action:'trashRestore',id:trash.rows[0].id},'admin');
 assert.equal(identity.idForPhone(state,phone),originalId);assert.equal(state.patientIdentities[originalId].deletedAt,undefined);assert.equal(state.clinicalVisits.visit.patientId,originalId);assert.equal(state.followupPlans.plan.patientId,originalId);assert.equal(state.bookings[core.today()].booking.patientId,originalId);assert.equal(identity.resolve(state,{patientId:originalId}).phone,phone);
 const search=await handle({action:'patientSearch',query:phone},'admin');assert.equal(search.rows[0].patientId,originalId);
});
