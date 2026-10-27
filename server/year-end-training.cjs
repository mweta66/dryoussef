const core=require('./core.cjs');
const perms=require('./permissions.cjs');
const schedule=require('./schedule.cjs');
const branches=require('./branches.cjs');
const names=require('./demo-names.cjs');
const profiles=require('./demo-profiles.cjs');
function authorize(s,uid,key){if(core.role(s,uid).r!=='admin')core.fail('هذه العملية للأدمن فقط',403);perms.requirePermission(core.role(s,uid),key);}
function plan(s,uid){
 authorize(s,uid,'data.import');const from=core.today(),to=from.slice(0,4)+'-12-31',days=[],taggedBatches=new Set(Object.values(s.bookings||{}).flatMap(rows=>Object.values(rows).map(x=>x.trainingBatch)).filter(Boolean)),batches=Object.values(s.settings?.trainingYearBatches||{}).filter(x=>x.status==='active'||taggedBatches.has(x.id)).map(x=>({...x,status:'active'})),active=batches.find(x=>x.year===from.slice(0,4));
 if(active)return {from,to,days,bookings:active.bookings,patients:active.patients,existingBatch:active,batches};
 for(let d=from;d<=to;){const available=schedule.availability(branches.branches(s),s.settings?.sched||{},d);
  // Unscheduled/flexible branches are intentionally left empty. Never invent doctor attendance.
  if(available.scheduled.length>1)core.fail('تعارض في جدول الطبيب يوم '+d+'؛ حدد فرعًا واحدًا قبل إضافة البيانات',409);
  for(const item of available.scheduled){const limit=branches.branches(s)[item.id].maxBookings||0,existing=Object.values(s.bookings?.[d]||{}).filter(x=>x.b===item.id&&x.s!=='cx').length,count=Math.max(0,Math.min(10,limit?limit-existing:10));if(count)days.push({date:d,branch:item.id,count});}
  const next=new Date(d+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);d=next.toISOString().slice(0,10);
 }
 return {from,to,days,bookings:days.reduce((n,d)=>n+d.count,0),patients:days.reduce((n,d)=>n+d.count,0),existingBatch:null,batches};
}
function seed(original,uid){
 const p=plan(original,uid);if(p.existingBatch)return {state:original,summary:{...p.existingBatch,alreadyExists:true}};
 if(!p.bookings)core.fail('لا توجد أيام عمل معلنة متاحة حتى نهاية العام؛ راجع مواعيد الفروع',409);
 const s=structuredClone(original),at=new Date().toISOString(),batch='year-end-'+p.from.slice(0,4)+'-'+Date.now()+'-'+Object.keys(original.settings?.trainingYearBatches||{}).length,by=core.role(s,uid).u;
 for(const key of ['patients','files','complaints','complaintSequences','bookings','sequences'])s[key]||={};
 const used=new Set([...Object.keys(s.patients),...Object.keys(s.files),...Object.keys(s.complaints),...Object.keys(s.attachments||{}),...Object.values(s.bookings).flatMap(rows=>Object.values(rows).map(x=>x.phone)),...Object.values(s.deletedBookings||{}).map(x=>x.booking?.phone)]);
 // Include archived clinical phones so a restored file cannot collide with newly generated cases.
 for(const group of Object.values(s.recycleBin||{}))for(const item of group.items||[]){if(['patients','files','complaints','attachments'].includes(item.path?.[0]))used.add(item.path[1]);if(item.path?.[0]==='bookings'){if(item.before?.phone)used.add(item.before.phone);else for(const x of Object.values(item.before||{}))if(x?.phone)used.add(x.phone);}}
 let serial=60000,index=0;
 for(const day of p.days)for(let i=0;i<day.count;i++){
  let phone;do{phone='010000'+String(++serial).padStart(5,'0');if(serial>99999)core.fail('نفدت أرقام التدريب المتاحة',409);}while(used.has(phone));used.add(phone);
  const name=names.egyptianName(index),spouse=names.spouse(phone),{file}=profiles.clinicalProfile(index),id='demo-year-'+batch+'-'+index,key=day.date+'_'+day.branch,rows=s.bookings[day.date]||={},no=Math.max(s.sequences[key]||0,0,...Object.values(rows).filter(x=>x.b===day.branch).map(x=>x.no||0))+1;
  rows[id]={id,date:day.date,b:day.branch,no,name,phone,v:['exam','cons','follow'][index%3],s:'wait',nt:'',rev:1,trainingBatch:batch,...spouse};s.sequences[key]=no;
  s.patients[phone]={n:name,d:p.from,...spouse,trainingBatch:batch,rev:1};s.files[phone]={...file,t:at,rev:1,trainingBatch:batch};s.complaints[phone]={};
  for(let visit=0;visit<3;visit++){
   const dt=new Date(p.from+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()-42+visit*14);const date=dt.toISOString().slice(0,10),cid=id+'-visit-'+(visit+1),profile=profiles.clinicalProfile(index+visit).profile;
   s.complaints[phone][cid]={id:cid,no:visit+1,date,reason:profile.reason,text:profile.text,tx:profile.treatment,at:date+'T12:00:00.000Z',by,byUid:uid,trainingBatch:batch};
  }
  s.complaintSequences[phone]=3;index++;
 }
 const summary={id:batch,year:p.from.slice(0,4),from:p.from,to:p.to,patients:index,bookings:index,complaints:index*3,workingDays:p.days.length,status:'active',createdAt:at,createdBy:uid};
 s.settings||={};s.settings.trainingYearBatches||={};s.settings.trainingYearBatches[batch]=summary;core.rebuild(s);return {state:s,summary};
}
function purge(original,uid,batch){
 authorize(original,uid,'data.delete');const meta=original.settings?.trainingYearBatches?.[batch];if(!meta)core.fail('دفعة التدريب غير موجودة',404);
 const s=structuredClone(original),summary={patients:0,bookings:0,complaints:0,preservedSharedPatients:0};
 for(const rows of Object.values(s.bookings||{}))for(const [id,x]of Object.entries(rows))if(x.trainingBatch===batch){delete rows[id];summary.bookings++;}
 for(const [id,x]of Object.entries(s.deletedBookings||{}))if(x.booking?.trainingBatch===batch)delete s.deletedBookings[id];
 for(const [phone,patient]of Object.entries(s.patients||{})){
  const shared=Object.values(s.bookings||{}).some(rows=>Object.values(rows).some(x=>x.phone===phone))||Object.values(s.deletedBookings||{}).some(x=>x.booking?.phone===phone);
  for(const [id,x]of Object.entries(s.complaints?.[phone]||{}))if(x.trainingBatch===batch){delete s.complaints[phone][id];summary.complaints++;}
  if(patient.trainingBatch!==batch)continue;
  if(shared){summary.preservedSharedPatients++;continue;}
  // All records on a dedicated training patient's file belong to that case. History retains removals.
  delete s.patients[phone];delete s.files?.[phone];delete s.complaints?.[phone];delete s.attachments?.[phone];
  for(const [id,x]of Object.entries(s.inbox||{}))if(x.p===phone)delete s.inbox[id];summary.patients++;
 }
 // Keep issued ticket/complaint high-water marks: real records must never be renumbered.
 s.settings.trainingYearBatches[batch]={...meta,status:'purged',purgedAt:new Date().toISOString(),purgedBy:uid};core.rebuild(s);return {state:s,summary};
}
async function handle(adapter,input,uid){
 if(input.action==='trainingYearPreview')return plan(await adapter.read(),uid);
 const key=input.action==='trainingYearSeed'?'SEED_YEAR_END_TRAINING':'DELETE_YEAR_END_TRAINING';if(input.confirmation!==key)core.fail('راجع تأكيد العملية أولًا');
 let summary;await adapter.mutate(s=>{const result=input.action==='trainingYearSeed'?seed(s,uid):purge(s,uid,input.batch);summary=result.summary;return result.state;});return {ok:true,...summary};
}
module.exports={plan,seed,purge,handle};
