const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../server/core.cjs'),perms=require('../server/permissions.cjs');
const phone='01012345678',foreignPhone='01012345679';
test('secretary defaults grant medical reading only, with explicit revocation and unchanged nurse/data-entry access',()=>{
 for(const key of perms.secretaryReadGrants)assert.equal(perms.can({r:'sec'},key),true,key);
 for(const key of ['notes.edit','complaints.create','complaints.edit','complaints.delete','attachments.create','attachments.delete','patients.delete','users.manage','data.export'])assert.equal(perms.can({r:'sec'},key),false,key);
 assert.equal(perms.can({r:'sec',permissions:{'notes.read':false}},'notes.read'),false);
 assert.equal(perms.can({r:'nurse'},'notes.read'),false);assert.equal(perms.can({r:'staff'},'notes.read'),false);
 const role=perms.validateRole({r:'sec',u:'new-sec',br:'alex'},core.fail,['alex']);for(const key of perms.secretaryReadGrants)assert.equal(role.permissions[key],true);
 const restricted=perms.validateRole({...role,permissions:{'notes.read':false}},core.fail,['alex']);assert.equal(restricted.permissions['notes.read'],false);
});
for(const runtime of ['Node','Edge']){
 async function fixture(){
  let s={roles:{admin:{r:'admin',u:'admin'},nurse:{r:'nurse',u:'nurse'},entry:{r:'staff',u:'entry'},disabled:{r:'sec',u:'disabled',br:'alex',enabled:false,permissions:{'notes.read':false}},archived:{r:'sec',u:'archived',br:'alex',archivedAt:'old',permissions:{'notes.read':false}}},settings:{branches:Object.fromEntries(['alex','matrouh','dmn','libya'].map(br=>[br,{name:br}]))},patients:{[phone]:{n:'مريضة الفرع',br:'alex',d:core.today()},[foreignPhone]:{n:'مريضة أخرى',br:'matrouh',d:core.today()}},files:{[phone]:{n:'ملاحظة الطبيب المحفوظة',diagnosis:'تشخيص مسجل',treatment:'خطة المتابعة',rev:1}},complaints:{[phone]:{one:{id:'one',no:1,date:core.today(),text:'شكوى مسجلة',tx:'خطة مسجلة'}}},bookings:{}};
  for(const br of ['alex','matrouh','dmn','libya'])s.roles[br]={r:'sec',u:br+'-sec',br,scope:'branch',permissions:{'notes.edit':false,...Object.fromEntries(perms.secretaryReadGrants.map(k=>[k,false]))}};
  const {createService}=runtime==='Node'?require('../server/service.cjs'):await import('../supabase/functions/clinic-api/service.js');return {state:()=>s,handle:createService({read:async()=>structuredClone(s),mutate:async fn=>{s=fn(structuredClone(s))}})};
 }
 test(runtime+': existing secretary roles receive the requested read grants exactly once without changing clinical records or other staff',async()=>{
  const f=await fixture(),before=structuredClone(f.state());await assert.rejects(f.handle({action:'secretaryClinicalAccessUpgrade'},'alex'),{status:403});assert.deepEqual(f.state(),before);
  const answer=await f.handle({action:'secretaryClinicalAccessUpgrade'},'admin');assert.equal(answer.updated,4);assert.equal(f.state().settings.secretaryClinicalAccessVersion,1);
  for(const br of ['alex','matrouh','dmn','libya']){const r=f.state().roles[br];assert.equal(r.br,br);assert.equal(r.scope,'branch');for(const key of perms.secretaryReadGrants)assert.equal(r.permissions[key],true);assert.equal(r.permissions['notes.edit'],false);}
  for(const uid of ['nurse','entry','disabled','archived'])assert.deepEqual(f.state().roles[uid],before.roles[uid]);
  for(const root of ['patients','files','complaints','bookings'])assert.deepEqual(f.state()[root],before[root]);
  assert.equal(f.state().audit.at(-1).action,'secretaryClinicalAccessUpgrade');assert.equal(f.state().audit.at(-1).actor,'admin');
  f.state().roles.alex.permissions['notes.read']=false;assert.equal((await f.handle({action:'secretaryClinicalAccessUpgrade'},'admin')).changed,false);assert.equal(f.state().roles.alex.permissions['notes.read'],false);
 });
 test(runtime+': secretary reads doctor notes and history in her branch but cannot edit, author a plan, or view a foreign patient',async()=>{
  const f=await fixture();await f.handle({action:'secretaryClinicalAccessUpgrade'},'admin');
  assert.equal((await f.handle({action:'get',path:'files/'+phone},'alex')).diagnosis,'تشخيص مسجل');
  assert.equal((await f.handle({action:'patientHistoryPage',phone,kind:'medical'},'alex')).rows[0].text,'ملاحظة الطبيب المحفوظة');
  const before=structuredClone(f.state().files);await assert.rejects(f.handle({action:'patch',updates:{['files/'+phone]:{n:'تعديل غير مصرح',rev:1}}},'alex'),{status:403});assert.deepEqual(f.state().files,before);
  await assert.rejects(f.handle({action:'followupPlanSave',phone,targetDate:core.today()},'alex'),{status:403});
  await assert.rejects(f.handle({action:'get',path:'files/'+foreignPhone},'alex'),{status:403});
  f.state().roles.alex.permissions['notes.read']=false;await assert.rejects(f.handle({action:'get',path:'files/'+phone},'alex'),{status:403});
 });
}
