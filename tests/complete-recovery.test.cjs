const {test}=require('node:test'),assert=require('node:assert/strict');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC',reportBytes=Buffer.from(png,'base64').length;
const id='11111111-1111-4111-8111-111111111111',archivedId='22222222-2222-4222-8222-222222222222',phone='01011111111',patientId=require('../server/patient-identity.cjs').legacyId(phone);
function fixture(){return {roles:{admin:{u:'admin',r:'admin'},nurse:{u:'nurse',r:'nurse',scope:'all'}},settings:{branches:{alex:{name:'الإسكندرية',enabled:true}},avg:15},patients:{[phone]:{n:'مريم أحمد',patientId}},bookings:{'2026-10-01':{visit:{id:'visit',phone,name:'مريم أحمد',patientId,date:'2026-10-01',b:'alex',no:1,v:'exam',s:'done'}}},sequences:{'2026-10-01_alex':1},files:{[phone]:{n:'ملاحظات'}},complaints:{[phone]:{c:{id:'c',date:'2026-10-01',text:'مراجعة',no:1}}},complaintSequences:{[phone]:1},attachments:{[phone]:{[id]:{id,key:id,name:'تقرير',mime:'image/png',size:reportBytes,createdAt:'2026-10-01T12:00:00Z'}}},audit:[{id:'a',action:'patientSave',actor:'admin'}],activityDetails:{a:[{path:['patients',phone],after:{n:'مريم'}}]},recycleBin:{trash:{items:[{path:['attachments',phone,archivedId],before:{id:archivedId,key:archivedId,name:'تقرير مؤرشف',mime:'image/png',size:reportBytes}}]}},followupPlans:{plan:{id:'plan',phone,targetDate:'2026-11-01'}},bookingContacts:{visit:{status:'confirmed'}},recordProvenance:{['bookings/visit']:{origin:'manual',createdAt:'2026-11-01T00:00:00Z'}}};}
for(const runtime of ['Node','Edge'])test(runtime+': recovery roundtrip verifies current and archived files, patient identity, roles and complete history without changing the source',async()=>{
 const recovery=runtime==='Node'?require('../server/complete-backup.cjs'):await import('../supabase/functions/clinic-api/complete-backup.js'),state=fixture(),original=structuredClone(state),reads=[];
 const bundle=await recovery.buildRecoveryBundle({readAttachmentBytes:async key=>{reads.push(key);return {data:png}}},state);
 const result=await recovery.verifyRecoveryBundle(JSON.parse(JSON.stringify(bundle)));assert.deepEqual(state,original);assert.equal(result.imagesVerified,true);assert.equal(result.originalsUntouched,true);assert.equal(result.liveWrites,0);assert.equal(result.counts.reports,2);assert.equal(result.counts.archivedReportReferences,1);assert.equal(result.checks.roleMetadata,'passed');assert.equal(result.checks.providerAccounts,'not_verified');assert.equal(result.authCredentialsIncluded,false);assert.equal(result.completeSystemRecovery,false);assert.ok(result.verifiedRoots.includes('recordProvenance'));assert.ok(result.verifiedRoots.includes('followupPlans'));assert.ok(result.verifiedRoots.includes('activityDetails'));assert.deepEqual(reads.sort(),[id,archivedId].sort());
});
test('tampered state, tampered report bytes, a wrong checksum and missing originals fail verification',async()=>{
 const recovery=require('../server/complete-backup.cjs'),bundle=await recovery.buildRecoveryBundle({readAttachmentBytes:async()=>({data:png})},fixture());
 for(const alter of [b=>{b.manifest.state.patients[phone].n='تغيير'},b=>{b.files[0].data=Buffer.from([137,80,78,71,13,10,26,10,1,1,1,1,1,1,1,1]).toString('base64')},b=>{b.files[0].checksum='0'.repeat(64)},b=>{b.files.pop()}]){const copy=structuredClone(bundle);alter(copy);await assert.rejects(recovery.verifyRecoveryBundle(copy));}
 await assert.rejects(recovery.buildRecoveryBundle({readAttachmentBytes:async()=>{throw Error('missing storage object')}},fixture()),{status:503});
});
test('invalid role branches, orphaned clinical references and invalid issued counters block a false restoration success',async()=>{
 const recovery=require('../server/complete-backup.cjs');for(const alter of [s=>{s.roles.nurse.br='missing'},s=>{delete s.patients[phone]},s=>{s.sequences['2026-10-01_alex']=0},s=>{s.complaintSequences[phone]=0},s=>{s.bookings['2026-10-01'].visit.patientId='another-patient'}]){const s=fixture();alter(s);await assert.rejects(recovery.buildRecoveryBundle({readAttachmentBytes:async()=>({data:png})},s),{status:409});}
});
test('rehearsal never writes state or storage and does not inject a live administrator into historical role metadata',async()=>{
 const rehearsal=require('../server/backup-rehearsal.cjs'),payload=fixture(),live=fixture(),before=structuredClone(payload);let writes=0;
 const adapter={read:async()=>structuredClone(live),latestBackup:async()=>({payload,created_at:'2026-10-01T12:00:00Z',version:7}),readAttachmentBytes:async()=>({data:png}),mutate:async()=>{writes++;throw Error('must not mutate')},uploadAttachment:async()=>{writes++;throw Error('must not upload')},deleteAttachment:async()=>{writes++;throw Error('must not delete')}};
 const result=await rehearsal.handle(adapter,{action:'backupRehearsal'},'admin');assert.equal(result.version,7);assert.equal(result.imagesVerified,true);assert.deepEqual(payload,before);assert.equal(writes,0);await assert.rejects(rehearsal.handle(adapter,{action:'backupRehearsal'},'nurse'),{status:403});
 delete payload.roles.admin;await assert.rejects(rehearsal.handle(adapter,{action:'backupRehearsal'},'admin'),{status:409});
});
test('manifest and per-file export require the administrator and cannot fetch arbitrary storage keys',async()=>{
 const recovery=require('../server/complete-backup.cjs'),state=fixture(),adapter={read:async()=>structuredClone(state),readAttachmentBytes:async()=>({data:png})};
 const manifest=await recovery.handleRecovery(adapter,{action:'recoveryBackupExport'},'admin');assert.equal(manifest.format,'clinic-recovery-manifest');assert.equal(manifest.files.length,2);assert.ok(!manifest.files[0].data);const exported=await recovery.handleRecovery(adapter,{action:'recoveryFileExport',key:archivedId},'admin');assert.equal(exported.data,png);assert.equal(exported.checksum.length,64);await assert.rejects(recovery.handleRecovery(adapter,{action:'recoveryFileExport',key:'33333333-3333-4333-8333-333333333333'},'admin'),{status:404});await assert.rejects(recovery.handleRecovery(adapter,{action:'recoveryBackupExport'},'nurse'),{status:403});
});
test('account passwords and hosting secrets are never part of an exported recovery manifest',async()=>{
 const recovery=require('../server/complete-backup.cjs'),state=fixture();state.roles.admin.password='private';state.roles.admin.hash='private-hash';state.roles.admin.refreshToken='private-token';state.settings.serviceRoleKey='private-server-key';const manifest=await recovery.manifestFor(state);assert.ok(!JSON.stringify(manifest).includes('private'));assert.equal(manifest.externalServices.providerAccountRestoreRequired,true);
});

test('identity indexes and follow-up/contact graph survive roundtrip, while mismatched references are rejected',async()=>{const recovery=require('../server/complete-backup.cjs'),state=fixture(),pid=state.patients[phone].patientId;state.patientIdentities={[pid]:{id:pid,phone,createdAt:null}};state.patientPhoneIndex={[phone]:pid};state.followupPlans.plan.patientId=pid;state.followupPlans.plan.sourceBookingId='visit';state.followupPlans.plan.linkedBookingId='visit';const bundle=await recovery.buildRecoveryBundle({readAttachmentBytes:async()=>({data:png})},state),result=await recovery.verifyRecoveryBundle(bundle);assert.ok(result.verifiedRoots.includes('patientPhoneIndex'));assert.ok(result.verifiedRoots.includes('patientIdentities'));for(const alter of [s=>{s.patientPhoneIndex[phone]='wrong'},s=>{s.patientIdentities[pid].phone='01022222222'},s=>{s.followupPlans.plan.linkedBookingId='missing'},s=>{s.bookingContacts.missing={status:'confirmed'}}]){const copy=structuredClone(state);alter(copy);await assert.rejects(recovery.manifestFor(copy),{status:409})}});
test('current rehearsal works without an automatic backup and clearly retains provider-account limitations',async()=>{const rehearsal=require('../server/backup-rehearsal.cjs');let reads=0,writes=0;const state=fixture(),result=await rehearsal.handle({read:async()=>state,readAttachmentBytes:async()=>{reads++;return {data:png}},mutate:async()=>{writes++}}, {action:'backupRehearsal',source:'current'},'admin');assert.equal(result.source,'current');assert.equal(reads,2);assert.equal(writes,0);assert.equal(result.checks.providerAccounts,'not_verified');assert.equal(result.sourceRecordChecksums.notRecorded,2)});
test('file manifest corruption fails with a validation error rather than a missing-property exception',async()=>{const recovery=require('../server/complete-backup.cjs'),bundle=await recovery.buildRecoveryBundle({readAttachmentBytes:async()=>({data:png})},fixture());const wrong=structuredClone(bundle);wrong.files[0].key='33333333-3333-4333-8333-333333333333';await assert.rejects(recovery.verifyRecoveryBundle(wrong),e=>e.status===409);const missing=structuredClone(bundle);delete missing.manifest.files;await assert.rejects(recovery.verifyRecoveryBundle(missing),e=>e.status===409)});
test('browser recovery downloads roundtrip both a single file and split parts, including archived reports',async()=>{const recovery=require('../server/complete-backup.cjs'),browser=require('../public/clinic-backup.js'),bundle=await recovery.buildRecoveryBundle({readAttachmentBytes:async()=>({data:png})},fixture());const full=await browser.recoveryDownloadFiles(bundle);assert.equal(full.length,1);assert.equal((await browser.joinRecoveryDownloadFiles(full)).files.length,2);const split=await browser.recoveryDownloadFiles(bundle,250);assert.equal(split[0].value.format,'clinic-recovery-index');assert.ok(split.length>=4);const joined=await browser.joinRecoveryDownloadFiles(JSON.parse(JSON.stringify(split)));assert.equal(joined.manifest.stateChecksum,bundle.manifest.stateChecksum);assert.equal(joined.files.length,2);assert.equal((await browser.verifyRecoveryTransport(joined)).status,'passed');await assert.rejects(browser.joinRecoveryDownloadFiles(split.slice(0,-1)));const wrong=structuredClone(split);wrong.at(-1).value.files[0].data=Buffer.from('not a report').toString('base64');await assert.rejects(browser.joinRecoveryDownloadFiles(wrong));});

for(const runtime of ['Node','Edge'])test(runtime+': malformed defined internal identities fail recovery before it can report an operational success',async()=>{
 const recovery=runtime==='Node'?require('../server/complete-backup.cjs'):await import('../supabase/functions/clinic-api/complete-backup.js');
 for(const corrupt of [
  s=>{s.patients[phone].patientId='invalid-id'},
  s=>{s.bookings['2026-10-01'].visit.patientId='invalid-id'},
  s=>{s.followupPlans.plan.patientId='invalid-id'},
  s=>{s.patientPhoneIndex={[phone]:'invalid-id'};s.patientIdentities={'invalid-id':{id:'invalid-id',phone}}},
  s=>{s.patientIdentities={[patientId]:null}},
  s=>{s.bookings['2026-10-01'].visit.patientId='pat_'+'f'.repeat(32)},
 ]){const state=fixture();corrupt(state);await assert.rejects(recovery.manifestFor(state),{status:409});}
});

for(const runtime of ['Node','Edge'])test(runtime+': legacy ID-less patients remain recoverable with or without generated identity indexes',async()=>{
 const recovery=runtime==='Node'?require('../server/complete-backup.cjs'):await import('../supabase/functions/clinic-api/complete-backup.js');
 const serviceModule=runtime==='Node'?require('../server/service.cjs'):await import('../supabase/functions/clinic-api/service.js');
 for(const indexed of [false,true]){
  let state=fixture();delete state.patients[phone].patientId;delete state.bookings['2026-10-01'].visit.patientId;
  if(indexed)require('../server/patient-identity.cjs').ensure(state);
  const original=structuredClone(state),bundle=await recovery.buildRecoveryBundle({readAttachmentBytes:async()=>({data:png})},state);
  assert.equal((await recovery.verifyRecoveryBundle(bundle)).imagesVerified,true);assert.deepEqual(state,original);
  state=structuredClone(bundle.manifest.state);
  const service=serviceModule.createService({read:async()=>structuredClone(state),mutate:async fn=>{state=fn(structuredClone(state))}});
  await service({action:'trashRestore',id:'trash'},'admin');
  assert.equal(state.attachments[phone][archivedId].key,archivedId);
  assert.equal(state.patientPhoneIndex[phone],patientId);
  assert.equal(state.patientIdentities[patientId].phone,phone);
 }
});

for(const runtime of ['Node','Edge'])test(runtime+': a malformed identity graph that blocks a restored service operation is rejected by the recovery verifier',async()=>{
 const recovery=runtime==='Node'?require('../server/complete-backup.cjs'):await import('../supabase/functions/clinic-api/complete-backup.js');
 const serviceModule=runtime==='Node'?require('../server/service.cjs'):await import('../supabase/functions/clinic-api/service.js');
 let state=fixture();const invalid='patient-fixed-1';state.patients[phone].patientId=invalid;state.bookings['2026-10-01'].visit.patientId=invalid;
 state.patientPhoneIndex={[phone]:invalid};state.patientIdentities={[invalid]:{id:invalid,phone}};
 const service=serviceModule.createService({read:async()=>structuredClone(state),mutate:async fn=>{state=fn(structuredClone(state))}});
 const before=structuredClone(state);await assert.rejects(service({action:'trashRestore',id:'trash'},'admin'),{status:409});assert.deepEqual(state,before);
 await assert.rejects(recovery.manifestFor(state),{status:409});
});
