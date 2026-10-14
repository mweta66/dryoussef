const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../server/core.cjs'),management=require('../server/management.cjs'),perms=require('../server/permissions.cjs'),{makeDemo}=require('../scripts/demo-data.cjs');
function fixture(){return makeDemo().state}
test('granular permissions grant and revoke booking actions immediately while preserving branch boundaries',()=>{
 let s=fixture(),r={...s.roles.demo_dmn,scope:'branch',permissions:{'bookings.edit':true,'bookings.delete':true}};
 s=management.mutate(s,'demo_doctor',{action:'userSave',uid:'demo_dmn',role:r},core);
 let x=Object.values(s.bookings[core.today()]).find(x=>x.b==='dmn');
 s=core.commit(s,'demo_dmn',[{n:{...x,name:'Edited'},o:x}],[]).state;x=s.bookings[x.date][x.id];assert.equal(x.name,'Edited');
 const other=Object.values(s.bookings[x.date]).find(x=>x.b==='alex');assert.throws(()=>core.commit(s,'demo_dmn',[],[other]),{status:403});
 s=management.mutate(s,'demo_doctor',{action:'userSave',uid:'demo_dmn',role:{...r,permissions:{'bookings.edit':false,'bookings.delete':false}}},core);
 assert.throws(()=>core.commit(s,'demo_dmn',[],[x]),{status:403});assert.throws(()=>core.commit(s,'demo_dmn',[{n:{...x,name:'Denied'},o:x}],[]),{status:403});
});
test('custom accounts start with no permissions; disabled accounts are rejected; unknown permission keys are invalid',()=>{
 let s=fixture();s.roles.staff={r:'staff',u:'staff',br:'dmn'};assert.throws(()=>core.read(s,'staff','bookings/'+core.today()),{status:403});
 s=management.mutate(s,'demo_doctor',{action:'userSave',uid:'staff',role:{...s.roles.staff,enabled:false}},core);assert.throws(()=>core.role(s,'staff'),{status:403});
 assert.throws(()=>management.mutate(fixture(),'demo_doctor',{action:'userSave',uid:'demo_dmn',role:{r:'sec',u:'sec-dmn',br:'dmn',permissions:{root:true}}},core));
 assert.throws(()=>management.mutate(fixture(),'demo_doctor',{action:'userSave',uid:'demo_doctor',role:{r:'staff',u:'doctor'}},core));
});
test('doctor can promote another doctor and all doctor permissions remain enabled',()=>{
 let s=management.mutate(fixture(),'demo_doctor',{action:'userSave',uid:'demo_dmn',role:{r:'doctor',u:'sec-dmn',permissions:{'site.manage':false}}},core);
 assert.ok(perms.can(s.roles.demo_dmn,'site.manage'));
 s=management.mutate(s,'demo_doctor',{action:'userSave',uid:'demo_doctor',role:{r:'staff',u:'doctor'}},core);assert.equal(s.roles.demo_doctor.r,'staff');
});
test('site writes validate colors and images and require an explicit permission',()=>{
 const s=fixture();assert.throws(()=>management.mutate(s,'demo_dmn',{action:'siteSave',site:{}},core),{status:403});
 const next=management.mutate(s,'demo_doctor',{action:'siteSave',site:{doctorName:'Changed',bookingPhone:'01234567890',design:{primary:'#123456',showBackground:false}}},core);assert.equal(next.settings.site.doctorName,'Changed');
 for(const design of [{primary:'url(javascript:evil)'},{logo:'data:image/svg+xml;base64,PHN2Zz4='},{logo:'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAA=='},{width:5000}])assert.throws(()=>management.mutate(s,'demo_doctor',{action:'siteSave',site:{design}},core));
});
test('patient edits move all related records and deletion removes history without recreating the patient index',()=>{
 let s=fixture(),x=Object.values(s.bookings[core.today()])[0],p=x.phone,to='01512345678';s.files={[p]:{n:'Private'}};s.complaints={[p]:{note:{text:'History'}}};s.inbox={note:{p,n:x.name}};
 s=management.mutate(s,'demo_doctor',{action:'patientSave',phone:p,newPhone:to,name:'Renamed'},core);
 assert.equal(s.bookings[x.date][x.id].phone,to);assert.equal(s.files[p],undefined);assert.equal(s.files[to].n,'Private');assert.equal(s.inbox.note.p,to);assert.equal(s.track[x.date][p],undefined);
 s=management.mutate(s,'demo_doctor',{action:'patientDelete',phone:to},core);assert.equal(s.bookings[x.date][x.id],undefined);assert.equal(s.files[to],undefined);assert.equal(core.read(s,'demo_doctor','patients')[to],undefined);
});
test('private booking notes are hidden from staff and preserved during allowed status updates',()=>{
 let s=fixture(),original=Object.values(s.bookings[core.today()]).find(x=>x.b==='dmn');original.nt='private medical note';const x=core.read(s,'demo_dmn','bookings/'+core.today())[original.id];assert.equal(x.nt,'');
 s=core.commit(s,'demo_dmn',[{n:{...x,s:x.s==='done'?'wait':'done'},o:x}],[]).state;assert.equal(s.bookings[x.date][x.id].nt,'private medical note');
});
test('bulk data deletion keeps accounts, website settings and monotonic ticket counters',()=>{
 const s=fixture(),next=management.mutate(s,'demo_doctor',{action:'dataClear',confirmation:'DELETE_CLINIC_DATA'},core);assert.deepEqual(next.bookings,{});assert.deepEqual(next.roles,s.roles);assert.deepEqual(next.settings,s.settings);assert.deepEqual(next.sequences,s.sequences);
 assert.throws(()=>management.mutate(s,'demo_dmn',{action:'dataClear',confirmation:'DELETE_CLINIC_DATA'},core),{status:403});
});
