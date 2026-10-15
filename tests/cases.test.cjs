const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../server/core.cjs'),{makeDemo}=require('../scripts/demo-data.cjs'),{createService}=require('../server/service.cjs');
function fixture(){const state=makeDemo().state;state.roles.demo_nurse={r:'nurse',u:'nurse'};return state;}
test('nurse can search patients and read complaints but cannot read bookings, notes or inbox',()=>{
 const s=fixture(),p=Object.values(s.bookings[core.today()])[0].phone;
 assert.ok(core.read(s,'demo_nurse','patients')[p]);assert.deepEqual(core.read(s,'demo_nurse','complaints/'+p),{});
 for(const path of ['bookings','bookings/'+core.today(),'files/'+p,'files','complaints','inbox','roles'])assert.throws(()=>core.read(s,'demo_nurse',path),{status:403});
 assert.throws(()=>core.read(s,'demo_dmn','patients'),{status:403});
});
test('nurse complaints generate a trusted notification and cannot be overwritten or deleted by a nurse',()=>{
 let s=fixture(),p=Object.values(s.bookings[core.today()])[0].phone,path='complaints/'+p+'/new_note';
 s=core.patch(s,'demo_nurse',{[path]:{id:'fake',date:core.today(),text:'Test complaint',tx:'Test treatment',by:'doctor',at:'fake'},'inbox/new_note':{p:'fake'}});
 assert.equal(s.complaints[p].new_note.by,'nurse');assert.equal(s.inbox.new_note.p,p);assert.notEqual(s.complaints[p].new_note.at,'fake');
 assert.throws(()=>core.patch(s,'demo_nurse',{[path]:null}),{status:403});
 assert.throws(()=>core.patch(s,'demo_nurse',{[path]:{date:core.today(),text:'Overwrite',tx:''}}),{status:403});
 assert.throws(()=>core.patch(s,'demo_nurse',{'inbox/new_note':null}),{status:403});
 const doc=core.patch(s,'demo_doctor',{[path]:{date:core.today(),text:'Reviewed',tx:'Reviewed treatment'}});
 assert.equal(doc.complaints[p].new_note.text,'Reviewed');assert.equal(doc.complaints[p].new_note.by,'nurse');
 const removed=core.patch(doc,'demo_doctor',{[path]:null});assert.equal(removed.inbox.new_note,undefined);
});
test('medical writes validate real dates, patient membership and text limits; doctors own private notes',()=>{
 const s=fixture(),p=Object.values(s.bookings[core.today()])[0].phone;
 assert.throws(()=>core.patch(s,'demo_nurse',{['complaints/'+p+'/bad']:{date:'2026-02-31',text:'test',tx:''}}));
 assert.throws(()=>core.patch(s,'demo_nurse',{'complaints/01234567890/bad':{date:core.today(),text:'test',tx:''}}),{status:404});
 assert.throws(()=>core.patch(s,'demo_nurse',{['files/'+p]:{n:'secret'}}),{status:403});
 assert.throws(()=>core.patch(s,'demo_doctor',{['files/'+p]:{n:'x'.repeat(5001)}}));
 const next=core.patch(s,'demo_doctor',{['files/'+p]:{n:'Private note'}});assert.equal(core.read(next,'demo_doctor','files/'+p).n,'Private note');
});
test('new bookings index patients and admin can create a nurse account',async()=>{
 let s=fixture();const n={id:'fresh_patient',name:'New patient',phone:'01275884716',date:core.today(),b:'dmn',s:'wait',v:'exam',nt:''};
 s=core.commit(s,'demo_doctor',[{n}],[]).state;assert.equal(s.patients[n.phone].n,n.name);
 const handler=createService({read:async()=>s,mutate:async fn=>{s=fn(s)},createUser:async()=> 'new_nurse',deleteUser:async()=>{},limit:async()=>{}});
 await handler({action:'userCreate',u:'nurse-two',p:'password123',br:'nurse'},'demo_admin');assert.equal(s.roles.new_nurse.r,'nurse');
 await assert.rejects(handler({action:'userCreate',u:'nurse-three',p:'password123',br:'nurse'},'demo_nurse'),{status:403});
 await handler({action:'purgeDemo'},'demo_admin');assert.ok(s.bookings[n.date][n.id]);assert.ok(s.patients[n.phone]);
});
