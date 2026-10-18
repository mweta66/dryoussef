const calendar=require('./schedule.cjs'),branches=require('./branches.cjs'),core=require('./core.cjs');
function reconcile(before,next){
 if(JSON.stringify(before.settings?.sched)===JSON.stringify(next.settings?.sched)&&!Object.keys(next.scheduleTransferPending||{}).length)return next;
 const registry=branches.branches(next),oldRegistry=branches.branches(before),today=core.today();next.scheduleTransferPending||={};
 for(const [date,rows]of Object.entries(next.bookings||{}))for(const row of Object.values(rows)){
  const key=date+'/'+row.id,old=before.bookings?.[date]?.[row.id];
  if(date<today||row.s!=='wait'){delete next.scheduleTransferPending[key];continue;}
  const available=calendar.availability(registry,next.settings?.sched||{},date),stillAvailable=available.scheduled.some(x=>x.id===row.b)||available.flexible.includes(row.b);
  if(stillAvailable){delete next.scheduleTransferPending[key];continue;}
  const prior=calendar.availability(oldRegistry,before.settings?.sched||{},date),wasAvailable=prior.scheduled.some(x=>x.id===row.b)||prior.flexible.includes(row.b);
  if(!next.scheduleTransferPending[key]&&old?.b===row.b&&wasAvailable)next.scheduleTransferPending[key]={from:row.b,requestedAt:new Date().toISOString()};
  const pending=next.scheduleTransferPending[key];if(!pending)continue;
  if(available.scheduled.length!==1){pending.reason=available.scheduled.length?'multiple':'unassigned';continue;}
  const target=available.scheduled[0].id;
  if([row.b,target].some(b=>['running','paused'].includes(next.sessions?.[date+'_'+b]?.status)||Object.values(rows).some(x=>x.b===b&&x.s==='exam'))){pending.reason='session';continue;}
  const targetRows=Object.values(rows).filter(x=>x.b===target),limit=registry[target]?.maxBookings||0;
  if(limit&&row.v!=='emergency'&&targetRows.filter(x=>x.s!=='cx'&&x.v!=='emergency').length>=limit){pending.reason='capacity';continue;}
  if(Object.values(rows).some(x=>x.id!==row.id&&x.phone===row.phone)){pending.reason='duplicate';continue;}
  next.sequences||={};const counter=date+'_'+target,no=Math.max(next.sequences[counter]||0,0,...targetRows.map(x=>x.no||0))+1;
  row.scheduleMove={from:row.b,previousNo:row.no,at:new Date().toISOString()};row.b=target;row.no=no;row.rev=(row.rev||0)+1;next.sequences[counter]=no;delete next.scheduleTransferPending[key];
 }
 for(const key of Object.keys(next.scheduleTransferPending)){const [date,id]=key.split('/');if(!next.bookings?.[date]?.[id])delete next.scheduleTransferPending[key];}
 next.settings||={};next.settings.scheduleTransferPendingCount=Object.keys(next.scheduleTransferPending).length;
 return core.rebuild(next);
}
function preview(state,branch,schedule){const next=structuredClone(state);next.settings||={};next.settings.sched={...next.settings.sched,[branch]:core.schedule(schedule)};reconcile(state,next);const moved=[];for(const [date,rows]of Object.entries(next.bookings||{}))for(const row of Object.values(rows))if(state.bookings?.[date]?.[row.id]?.b!==row.b)moved.push({id:row.id,date,from:state.bookings[date][row.id].b,to:row.b,no:row.no});return {transferCount:moved.length,transfers:moved.slice(0,20),pendingCount:Object.keys(next.scheduleTransferPending||{}).length};}
function transferDay(state,from,to,day){
 state=structuredClone(state);
 if(from===to||!core.branchIds(state,true).includes(from)||!core.branchIds(state,true).includes(to)||!Number.isInteger(day)||day<0||day>6)core.fail('اختر فرعين مختلفين ويومًا صحيحًا');
 const source=state.settings?.sched?.[from],target=state.settings?.sched?.[to]||{mode:'days',d:[]},dayOnly=source?.mode==='days',slots=source?.mode==='weekly'?source.weekly?.[day]||[]:source?.d?.includes(day)&&!dayOnly?[{f:source.f,t:source.t}]:[];
 if(dayOnly?!source.d?.includes(day):!slots.length)core.fail('اليوم غير محدد في الفرع الأصلي');
 const targetDays=target.mode==='days',targetEmpty=target.mode==='flexible'||targetDays&&!target.d?.length||target.mode==='weekly'&&!Object.values(target.weekly||{}).some(x=>x.length);
 if(!targetEmpty&&dayOnly!==targetDays)core.fail('الفرعان يستخدمان أيامًا وساعات مختلفة؛ وحّد نوع المواعيد أو حدد ساعات اليوم من محرر المواعيد');
 const remove=dayOnly?{...source,d:source.d.filter(x=>x!==day)}:{mode:'weekly',weekly:{...(source.mode==='weekly'?source.weekly:Object.fromEntries((source.d||[]).map(x=>[x,[{f:source.f,t:source.t}]]))),[day]:[]},exceptions:source.exceptions||{}};
 const add=dayOnly?{mode:'days',d:[...new Set([...(target.d||[]),day])],exceptions:target.exceptions||{}}:{mode:'weekly',weekly:{...(target.mode==='weekly'?target.weekly:target.mode?{}:Object.fromEntries((target.d||[]).map(x=>[x,[{f:target.f,t:target.t}]]))),[day]:slots},exceptions:target.exceptions||{}};
 return {...state,settings:{...state.settings,sched:{...state.settings?.sched,[from]:core.schedule(remove),[to]:core.schedule(add)}}};
}
module.exports={reconcile,preview,transferDay};
