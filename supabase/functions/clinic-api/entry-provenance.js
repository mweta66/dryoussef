import * as core from './core.js';
// Trusted, server-side provenance. Appointment/complaint dates never establish entry time.
const ROOTS=['patients','files','complaints','attachments','bookings','inbox','followups','deletedBookings','tasks','checkins','appointmentRequests','waitingList','slotOpenings','dayClosures','patientMerges'];
const NESTED=new Set(['complaints','attachments','bookings']);
const MANUAL=new Set(['commit','patch','patientSave','attachmentUpload','checkinSet','taskSave','appointmentRequest','appointmentChangeRequest','requestDecide','waitingListSave','dayClose']);
function entries(s){const out=[];for(const root of ROOTS)for(const [a,x]of Object.entries(s[root]||{})){
 if(NESTED.has(root)){for(const [b,row]of Object.entries(x||{}))if(row&&typeof row==='object')out.push({key:root+'/'+(root==='bookings'?b:a+'/'+b),path:[root,a,b],row,phone:root==='bookings'?row.phone:a});}
 else if(x&&typeof x==='object')out.push({key:root+'/'+a,path:[root,a],row:x,phone:['patients','files','followups'].includes(root)?a:x.phone||x.p||x.booking?.phone});
}return out;}
function directlyWritten(item,input,before){
 if(!MANUAL.has(input.action))return false;
 if(input.action==='patch')return Object.keys(input.updates||{}).some(path=>{const target=item.path.join('/');return path===target||path.startsWith(target+'/')});
 if(input.action==='commit')return item.path[0]==='bookings'&&(input.puts||[]).some(x=>x.n?.id===item.row.id)||item.path[0]==='patients'&&(input.puts||[]).some(x=>corePhone(x.n?.phone)===item.phone);
 if(input.action==='patientSave')return item.path[0]==='patients'&&[corePhone(input.phone),corePhone(input.newPhone)].includes(item.phone);
 if(input.action==='requestDecide')return item.phone===before.appointmentRequests?.[input.id]?.phone;
 const roots={attachmentUpload:'attachments',checkinSet:'checkins',taskSave:'tasks',appointmentRequest:'appointmentRequests',appointmentChangeRequest:'appointmentRequests',waitingListSave:'waitingList',dayClose:'dayClosures'};
 return item.path[0]===roots[input.action];
}
function corePhone(value){return core.phone(value);}
function stamp(before,next,input,uid,at){
 const prior=new Map(entries(before).map(x=>[x.key,x]));next.recordProvenance=structuredClone(before.recordProvenance||{});
 for(const item of entries(next)){
  let oldKey=item.key;
  if(input.action==='patientSave'&&corePhone(input.newPhone)&&item.phone===corePhone(input.newPhone)&&['patients','files','complaints','attachments'].includes(item.path[0]))oldKey=[item.path[0],corePhone(input.phone),...item.path.slice(2)].join('/');
  const old=prior.get(oldKey);if(oldKey===item.key&&old&&JSON.stringify(old.row)===JSON.stringify(item.row))continue;
  const saved=before.recordProvenance?.[oldKey]||(item.path[0]==='deletedBookings'?before.recordProvenance?.['bookings/'+item.row.booking?.id]:null);
  if(input.action==='trashRestore'){if(!saved)next.recordProvenance[item.key]={origin:'restored',createdAt:null};continue;}
  const training=item.row.trainingBatch||item.row.booking?.trainingBatch||old?.row.trainingBatch||old?.row.booking?.trainingBatch||saved?.origin==='training';
  const manual=directlyWritten(item,input,before)&&!training;
  let meta=saved?{...saved}:old?{origin:training?'training':'legacy',createdAt:null}:{origin:training?'training':manual?'manual':'import',createdAt:at,by:uid};
  // A manually written addition to an old clinical record is also protected from the cutoff onward.
  if(manual)meta.lastManualAt=at;
  if(training)meta.origin='training';next.recordProvenance[item.key]=meta;
 }
 return next;
}
export {ROOTS,entries,stamp};
