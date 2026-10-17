const {test}=require('node:test'),assert=require('node:assert/strict');
const {createService}=require('../server/service.cjs'),{decodeImage}=require('../server/attachments.cjs');
const phone='01012345678',png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
function fixture(){let state={roles:{admin:{r:'admin',u:'admin'},doctor:{r:'doctor',u:'doctor'},nurse:{r:'nurse',u:'nurse'},otherNurse:{r:'nurse',u:'nurse-two'},sec:{r:'sec',u:'secretary',br:'dmn'},restricted:{r:'nurse',u:'restricted',scope:'branch',br:'dmn'}},patients:{[phone]:{n:'Synthetic'}},bookings:{'2026-10-17':{x:{phone,b:'alex'}}},settings:{},files:{[phone]:{n:'Private doctor note'}}},storage=new Map(),failSave=false;
 const handle=createService({read:async()=>structuredClone(state),mutate:async fn=>{if(failSave)throw Object.assign(Error('failed'),{status:503});state=fn(state)},uploadAttachment:async(id,bytes,mime)=>storage.set(id,{bytes,mime}),readAttachment:async id=>({data:Buffer.from(storage.get(id).bytes).toString('base64')}),deleteAttachment:async id=>storage.delete(id)});
 return {handle,storage,state:()=>state,fail:()=>{failSave=true}};}
const upload={action:'attachmentUpload',phone,name:'Synthetic report',mime:'image/png',data:png};
test('nurse uploads private report and doctor views it; lists expose no storage keys and notes remain private',async()=>{
 const f=fixture(),item=await f.handle(upload,'nurse');assert.equal(f.storage.size,1);assert.equal(item.name,'Synthetic report');assert.equal(item.key,undefined);
 const list=await f.handle({action:'attachmentList',phone},'doctor');assert.equal(list.length,1);assert.equal(list[0].by,'nurse');assert.equal(list[0].key,undefined);
 const image=await f.handle({action:'attachmentRead',phone,id:item.id},'doctor');assert.equal(image.data,png);
 await assert.rejects(f.handle({action:'get',path:'files/'+phone},'nurse'),{status:403});
 for(const uid of [null,'sec','restricted'])await assert.rejects(f.handle({action:'attachmentRead',phone,id:item.id},uid),e=>[401,403].includes(e.status));
 await assert.rejects(f.handle({action:'attachmentDelete',phone,id:item.id},'otherNurse'),{status:403});
 await f.handle({action:'attachmentDelete',phone,id:item.id},'nurse');assert.equal(f.storage.size,1);assert.equal((await f.handle({action:'attachmentList',phone},'doctor')).length,0);
});
test('attachments reject disguised HTML, oversized/invalid data, missing patients, traversal and excess count',async()=>{
 const f=fixture();for(const input of [{...upload,mime:'image/svg+xml'},{...upload,data:Buffer.from('<html>not an image</html>').toString('base64')},{...upload,data:'A'.repeat(800004)},{...upload,data:'not base64'},{...upload,name:''}])await assert.rejects(f.handle(input,'nurse'),{status:400});
 await assert.rejects(f.handle({...upload,phone:'01099999999'},'nurse'),{status:404});await assert.rejects(f.handle({action:'attachmentRead',phone,id:'../../state.json'},'doctor'),{status:404});
 assert.equal(f.storage.size,0);for(let i=0;i<20;i++)await f.handle(upload,'nurse');await assert.rejects(f.handle(upload,'doctor'),{status:400});assert.equal(f.storage.size,20);
});
test('an unsuccessful metadata commit removes the uploaded object',async()=>{const f=fixture();f.fail();await assert.rejects(f.handle(upload,'doctor'),{status:503});assert.equal(f.storage.size,0)});
test('changing patient phone retains report references; deletion removes access',()=>{
 const core=require('../server/core.cjs'),management=require('../server/management.cjs'),f=fixture(),s=f.state();s.attachments={[phone]:{image:{id:'image'}}};
 const next=management.mutate(s,'admin',{action:'patientSave',phone,newPhone:'01098765432',name:'Renamed'},core);
 assert.equal(next.attachments[phone],undefined);assert.ok(next.attachments['01098765432'].image);
 const removed=management.mutate(next,'admin',{action:'patientDelete',phone:'01098765432'},core);assert.equal(removed.attachments['01098765432'],undefined);
});
