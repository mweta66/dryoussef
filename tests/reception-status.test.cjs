const {test}=require('node:test'),assert=require('node:assert/strict');
for(const runtime of ['Node','Edge'])test(runtime+': secretary changes legacy booking status without demographic edit permission, hidden note loss or ticket renumbering',async()=>{
 const core=runtime==='Node'?require('../server/core.cjs'):await import('../supabase/functions/clinic-api/core.js');const date=core.today();
 const row={id:'legacy_a',date,b:'alex',no:17,name:'  مريضة قديمة  ',phone:'01011111111',v:'exam',s:'wait',nt:'ملاحظة خاصة بالطبيب',rev:1,sourceRecord:{original:'preserved'}};
 const state={roles:{sec:{r:'sec',u:'sec',br:'alex'},foreign:{r:'sec',u:'foreign',br:'matrouh'},limited:{r:'staff',u:'limited',br:'alex',permissions:{'bookings.read':true}}},settings:{},bookings:{[date]:{[row.id]:row}},patients:{[row.phone]:{n:row.name,d:date}}};
 let current=state;
 for(const status of ['done','wait','no','cx','wait']){
  const live=current.bookings[date][row.id],visible={...live,nt:''};current=core.commit(current,'sec',[{o:visible,n:{...visible,s:status}}],[]).state;
  const saved=current.bookings[date][row.id];assert.equal(saved.s,status);assert.equal(saved.no,17);assert.equal(saved.name,row.name);assert.equal(saved.nt,row.nt);assert.deepEqual(saved.sourceRecord,row.sourceRecord);assert.equal(saved.rev,live.rev+1);
 }
 const live=current.bookings[date][row.id],visible={...live,nt:''};
 for(const actor of ['foreign','limited'])assert.throws(()=>core.commit(current,actor,[{o:visible,n:{...visible,s:'done'}}],[]),e=>e.status===403);
 assert.throws(()=>core.commit(current,'sec',[{o:visible,n:{...visible,name:'اسم آخر',s:'done'}}],[]),e=>e.status===403);
 assert.throws(()=>core.commit(current,'sec',[{o:{...visible,rev:1},n:{...visible,s:'done'}}],[]),e=>e.status===409);
 assert.equal(state.bookings[date][row.id].s,'wait','input state is immutable');
});
