const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const core=require('../server/core.cjs'),identity=require('../server/patient-identity.cjs');
const source='01012345678',target='01112345678',other='01212345678',day=core.today(),next=(()=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)})(),reportId='11111111-1111-4111-8111-111111111111';
const draftId=(kind,entity)=>createHash('sha256').update(JSON.stringify({kind,entity})).digest('hex').slice(0,32);
function stateForMerge(){
 const s={roles:{admin:{r:'admin',u:'admin'},sec:{r:'sec',u:'alex-sec',br:'alex'}},settings:{branches:{alex:{name:'Alex',enabled:true}},sched:{alex:{mode:'flexible'}},bookingRequests:{changeCutoffHours:0}},patients:{[source]:{n:'Source patient',d:day},[target]:{n:'Target patient',d:day},[other]:{n:'Unrelated patient',d:day}},files:{[source]:{n:'Original clinical note',diagnosis:'Original diagnosis',rev:2},[target]:{n:'Target clinical note',rev:3}},complaints:{[source]:{complaint:{id:'complaint',date:day,text:'Original complaint',no:1}}},complaintSequences:{[source]:1},bookings:{[day]:{visit:{id:'visit',phone:source,name:'Source patient',date:day,b:'alex',no:1,v:'exam',s:'done',rev:2}}},attachments:{[source]:{[reportId]:{id:reportId,key:reportId,name:'Original report',mime:'image/png',size:7,createdAt:new Date().toISOString(),reportDate:day}}}};
 identity.ensure(s);const patientId=identity.idForPhone(s,source);s.bookings[day].visit.patientId=patientId;
 s.followupPlans={plan:{id:'plan',phone:source,patientId,sourceBookingId:'visit',branch:'alex',type:'follow',targetDate:next,status:'pending',rev:2}};
 s.clinicalVisits={clinical:{id:'clinical',phone:source,patientId,bookingId:'visit',branch:'alex',date:day,file:structuredClone(s.files[source]),at:new Date().toISOString()}};
 s.urgentReviews={urgent:{id:'urgent',phone:source,patientId,bookingId:'visit',branch:'alex',status:'open',rev:1}};
 s.appointmentRequests={request:{id:'request',kind:'new',phone:source,patientId,name:'Source patient',branch:'alex',date:next,status:'pending',rev:1,createdAt:new Date().toISOString()}};
 s.waitingList={waiting:{id:'waiting',phone:source,patientId,name:'Source patient',branch:'alex',from:next,to:next,status:'waiting',rev:1}};
 s.tasks={task:{id:'task',phone:source,patientId,branch:'alex',title:'Review report',status:'open',rev:1}};
 s.inbox={note:{p:source,n:'Source patient'}};s.followups={[source]:{old:{text:'Legacy follow-up'}}};
 s.checkins={visit:{bookingId:'visit',phone:source,patientId,status:'arrived',branch:'alex'}};s.bookingContacts={visit:{bookingId:'visit',phone:source,patientId,status:'confirmed',branch:'alex',rev:1}};
 s.deletedBookings={archived:{booking:{id:'archived',phone:source,patientId,name:'Source patient',date:day,b:'alex',no:2,v:'follow',s:'cx',rev:1}}};
 const id=draftId('medical',source);s.drafts={admin:{[id]:{id,kind:'medical',entity:source,branch:'alex',data:{n:'Private original note',rev:2},updatedAt:new Date().toISOString()}}};s.editingPresence={[source]:{admin:{name:'admin',at:Date.now()}}};
 return s;
}
async function fixture(runtime){let state=stateForMerge();const {createService}=runtime==='Node'?require('../server/service.cjs'):await import('../supabase/functions/clinic-api/service.js');const handle=createService({read:async()=>structuredClone(state),mutate:async fn=>{state=fn(structuredClone(state))},limit:async()=>{}});return {handle,state:()=>state,set:s=>{state=s},merge:async()=>{const preview=await handle({action:'patientMergePreview',source,target},'admin');return handle({action:'patientMergeApply',source,target,previewToken:preview.token,confirmation:'MERGE_PATIENTS'},'admin')}};}
function legacyMergeState(){
 // The .3 merge contract stored only these original roots and no post-merge graph fingerprint.
 const before={roles:{admin:{r:'admin',u:'admin'}},settings:{branches:{alex:{name:'Alex',enabled:true}}},patients:{[source]:{n:'Source legacy patient',d:day},[target]:{n:'Target legacy patient',d:day}},bookings:{[day]:{visit:{id:'visit',phone:source,name:'Source legacy patient',date:day,b:'alex',no:1,v:'exam',s:'done',rev:1}}}};
 identity.ensure(before);const after=structuredClone(before);after.bookings[day].visit.phone=target;after.bookings[day].visit.name=after.patients[target].n;after.bookings[day].visit.rev++;delete after.patients[source];identity.ensure(after);
 const changes=[],history=require('../server/history.cjs');for(const root of ['patients','bookings','files','complaints','complaintSequences','attachments','inbox','tasks'])history.diff(before[root]||{},after[root]||{},[root],changes);
 after.patientMerges={legacy:{id:'legacy',source,target,at:new Date().toISOString(),by:'admin',changes}};return {before,after};
}
for(const runtime of ['Node','Edge']){
 test(runtime+': merge rebinds the full clinical graph to one stable target identity and undo restores exact source records',async()=>{
  const f=await fixture(runtime),before=structuredClone(f.state()),sourceId=identity.idForPhone(before,source),targetId=identity.idForPhone(before,target),merged=await f.merge(),s=f.state();
  assert.equal(s.patients[source],undefined);assert.equal(identity.idForPhone(s,target),targetId);assert.equal(s.patients[target].patientId,targetId);
  for(const row of [s.bookings[day].visit,s.deletedBookings.archived.booking,...['followupPlans','clinicalVisits','urgentReviews','appointmentRequests','waitingList','tasks','checkins','bookingContacts'].flatMap(root=>Object.values(s[root]))]){assert.equal(row.phone,target);assert.equal(row.patientId,targetId);}
  assert.deepEqual(s.clinicalVisits.clinical.file,before.clinicalVisits.clinical.file);assert.deepEqual(s.attachments[target][reportId],before.attachments[source][reportId]);assert.equal(s.followupPlans.plan.rev,3);assert.equal(s.appointmentRequests.request.rev,2);assert.equal(s.inbox.note.p,target);assert.deepEqual(s.followups[target],before.followups[source]);
  assert.equal(s.drafts.admin[draftId('medical',target)].entity,target);assert.equal(s.drafts.admin[draftId('medical',source)],undefined);assert.equal(s.patientIdentities[sourceId].mergedInto,targetId);assert.ok(s.patientIdentities[sourceId].deletedAt);
  const plans=await f.handle({action:'followupPlanList',phone:target},'admin');assert.equal(plans.plans.length,1);assert.equal(plans.plans[0].phone,target);
  assert.ok(!Object.values(s.recycleBin||{}).some(group=>group.action==='patientMergeApply'));
  await f.handle({action:'patientMergeUndo',id:merged.id},'admin');const restored=f.state();
  for(const root of ['patients','bookings','files','complaints','complaintSequences','attachments','inbox','tasks','followups','deletedBookings','followupPlans','clinicalVisits','urgentReviews','appointmentRequests','waitingList','checkins','bookingContacts','drafts','editingPresence','patientIdentities','patientPhoneIndex'])assert.deepEqual(restored[root],before[root],root+' was not restored exactly');
  assert.ok(!Object.values(restored.recycleBin||{}).some(group=>group.action==='patientMergeUndo'));
 });
 test(runtime+': modern clinical records and private drafts invalidate stale merge previews',async()=>{
  for(const root of ['followupPlans','clinicalVisits','appointmentRequests','waitingList','drafts','editingPresence']){const f=await fixture(runtime),preview=await f.handle({action:'patientMergePreview',source,target},'admin');if(root==='drafts')f.state().drafts.admin[draftId('medical',source)].data.n+=' changed';else if(root==='editingPresence')f.state().editingPresence[source].admin.at++;else Object.values(f.state()[root])[0].rev=100;const before=structuredClone(f.state());await assert.rejects(f.handle({action:'patientMergeApply',source,target,previewToken:preview.token,confirmation:'MERGE_PATIENTS'},'admin'),{status:409});assert.deepEqual(f.state(),before);}
 });
 test(runtime+': merge rejects competing private drafts without overwriting either account draft',async()=>{
  const f=await fixture(runtime),id=draftId('medical',target);f.state().drafts.admin[id]={id,kind:'medical',entity:target,branch:'alex',data:{n:'Competing target notes'},updatedAt:new Date().toISOString()};const before=structuredClone(f.state());await assert.rejects(f.merge(),{status:409});assert.deepEqual(f.state(),before);
 });
 test(runtime+': newly added clinical data blocks undo atomically but unrelated-patient activity does not',async()=>{
  const f=await fixture(runtime),merged=await f.merge();f.state().clinicalVisits.newVisit={id:'newVisit',phone:target,patientId:identity.idForPhone(f.state(),target),date:day,file:{n:'New visit after merge'}};const before=structuredClone(f.state());await assert.rejects(f.handle({action:'patientMergeUndo',id:merged.id},'admin'),{status:409});assert.deepEqual(f.state(),before);
  const g=await fixture(runtime),m=await g.merge();g.state().clinicalVisits.unrelated={id:'unrelated',phone:other,patientId:identity.idForPhone(g.state(),other),date:day,file:{n:'Unrelated visit'}};await g.handle({action:'patientMergeUndo',id:m.id},'admin');assert.equal(g.state().clinicalVisits.unrelated.file.n,'Unrelated visit');
 });
 test(runtime+': pre-existing requests after merge book only the target and never recreate the source patient',async()=>{
  const f=await fixture(runtime);await f.merge();const request=f.state().appointmentRequests.request;await f.handle({action:'requestDecide',id:request.id,revision:request.rev,decision:'approve',confirmContact:true},'admin');assert.equal(f.state().patients[source],undefined);const booking=Object.values(f.state().bookings[next])[0];assert.equal(booking.phone,target);assert.equal(booking.patientId,identity.idForPhone(f.state(),target));
 });
 test(runtime+': generic archives cannot undo a merge or resurrect a retired source, and target deletion still restores safely',async()=>{
  const f=await fixture(runtime),before=structuredClone(f.state());await f.merge();const s=f.state(),sourceId=identity.idForPhone(before,source);s.recycleBin||={};s.recycleBin.legacyMerge={id:'legacyMerge',action:'patientMergeApply',items:[{path:['patients',source],before:before.patients[source]}]};s.recycleBin.olderSource={id:'olderSource',action:'patientDelete',items:[{path:['patients',source],before:before.patients[source]},{path:['patientPhoneIndex',source],before:sourceId}]};
  for(const id of ['legacyMerge','olderSource']){const untouched=structuredClone(f.state());await assert.rejects(f.handle({action:'trashRestore',id},'admin'),{status:409});assert.deepEqual(f.state(),untouched);}
  const trash=await f.handle({action:'trashList'},'admin');assert.ok(!trash.rows.some(row=>row.id==='legacyMerge'));
  await f.handle({action:'patientDelete',phone:target},'admin');const group=Object.values(f.state().recycleBin).find(row=>row.action==='patientDelete'&&row.items.some(item=>item.path[0]==='patients'&&item.path[1]===target));await f.handle({action:'trashRestore',id:group.id},'admin');assert.equal(f.state().patients[source],undefined);assert.equal(f.state().followupPlans.plan.phone,target);assert.equal(f.state().clinicalVisits.clinical.patientId,identity.idForPhone(f.state(),target));assert.deepEqual(f.state().attachments[target][reportId],before.attachments[source][reportId]);
 });
 test(runtime+': delegated branch merge permission cannot move foreign records or expose foreign merge history',async()=>{
  const f=await fixture(runtime),s=f.state();s.roles.sec.permissions={'patients.merge':true,'patients.read':true};s.patients[source].br='alex';s.patients[target].br='alex';s.settings.branches.matrouh={name:'Matrouh',enabled:true};s.bookings[next]={foreign:{id:'foreign',phone:source,name:'Source patient',date:next,b:'matrouh',no:1,v:'follow',s:'wait',rev:1}};
  const before=structuredClone(s);await assert.rejects(f.handle({action:'patientMergePreview',source,target},'sec'),{status:403});assert.deepEqual(f.state(),before);
  const merge=await f.merge(),merged=structuredClone(f.state());await assert.rejects(f.handle({action:'patientMergeUndo',id:merge.id},'sec'),{status:403});assert.deepEqual(f.state(),merged);
  s.patientMerges={foreignMerge:{id:'foreignMerge',source:'01512345678',target:other,at:new Date().toISOString()}};s.patients[other].br='matrouh';f.set(s);const list=await f.handle({action:'patientMergeList'},'sec');assert.deepEqual(list,[]);
 });
 test(runtime+': merge and deletion audit details do not reveal private drafts but undo snapshots preserve them',async()=>{
  for(const action of ['patientMergeApply','patientDelete']){const f=await fixture(runtime),text='DO_NOT_DISCLOSE_PRIVATE_DRAFT';f.state().drafts.admin[draftId('medical',source)].data.n=text;let merge;if(action==='patientMergeApply')merge=await f.merge();else await f.handle({action,phone:source},'admin');const entry=f.state().audit.find(row=>row.action===action),detail=await f.handle({action:'auditDetail',id:entry.id},'admin');assert.ok(!JSON.stringify(detail).includes(text));if(merge){assert.ok(JSON.stringify(f.state().patientMerges[merge.id].changes).includes(text));await f.handle({action:'patientMergeUndo',id:merge.id},'admin');assert.equal(f.state().drafts.admin[draftId('medical',source)].data.n,text);}else{const group=Object.values(f.state().recycleBin).find(row=>row.action===action);assert.ok(JSON.stringify(group.items).includes(text));}}
 });
 test(runtime+': legacy merge undo rejects untracked target follow-up, but safe old merges retain their original identity',async()=>{
  const f=await fixture(runtime),legacy=legacyMergeState();f.set(legacy.after);f.state().followupPlans={newPlan:{id:'newPlan',phone:target,patientId:identity.idForPhone(f.state(),target),sourceBookingId:'visit',branch:'alex',type:'follow',rev:1}};const before=structuredClone(f.state());await assert.rejects(f.handle({action:'patientMergeUndo',id:'legacy'},'admin'),{status:409});assert.deepEqual(f.state(),before);
  const safe=legacyMergeState();f.set(safe.after);f.state().followupPlans={original:{id:'original',phone:source,patientId:identity.idForPhone(safe.before,source),sourceBookingId:'visit',branch:'alex',type:'follow',rev:1}};await f.handle({action:'patientMergeUndo',id:'legacy'},'admin');assert.equal(f.state().bookings[day].visit.phone,source);assert.equal(identity.idForPhone(f.state(),source),identity.idForPhone(safe.before,source));assert.equal(f.state().followupPlans.original.patientId,identity.idForPhone(f.state(),source));
 });
}
