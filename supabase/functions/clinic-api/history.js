import * as entryProvenance from './entry-provenance.js';
import * as core from './core.js';
import * as perms from './permissions.js';
const ROOTS=['patients','files','complaints','attachments','bookings','inbox','followups','deletedBookings','sessions','complaintSequences','settings','roles','tasks','checkins','appointmentRequests','waitingList','slotOpenings','dayClosures','patientMerges','userPreferences','followupPlans','bookingContacts','urgentReviews','patientIdentities','patientPhoneIndex','clinicalVisits'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function diff(before,after,path=[],out=[]){
 if(same(before,after))return out;
 if(object(before)&&object(after)){for(const key of new Set([...Object.keys(before),...Object.keys(after)]))diff(before[key],after[key],path.concat(key),out);}
 else out.push({path,before:before===undefined?null:before,after:after===undefined?null:after,removed:after===undefined,added:before===undefined});
 return out;
}
function safe(value){if(Array.isArray(value))return value.filter(x=>!Array.isArray(x?.path)||x.path[0]!=='drafts').map(safe);if(object(value))return Object.fromEntries(Object.entries(value).filter(([k])=>!/(password|token|secret|hash|salt)/i.test(k)).map(([k,v])=>[k,safe(v)]));return typeof value==='string'&&value.startsWith('data:image/')?'[صورة مضمّنة]':value;}
function context(before,next,changes,input={}){
 const out={patients:{},bookings:{},branches:{},users:{}};
 for(const state of [before,next]){
  for(const [p,x]of Object.entries(state.patients||{}))if(x.n)out.patients[p]=x.n;
  for(const [d,rows]of Object.entries(state.bookings||{}))for(const x of Object.values(rows)){out.patients[x.phone]||=x.name;out.bookings[d+'/'+x.id]={name:x.name,phone:x.phone,no:x.no,b:x.b,date:d};}
  for(const [b,x]of Object.entries(state.settings?.branches||state.settings?.site?.branches||{}))out.branches[b]=x.name;
  for(const [id,x]of Object.entries(state.roles||{})){out.users[id]=x.displayName||x.u;out.users[x.u]=x.displayName||x.u;}
 }
 const phones=new Set(),tickets=new Set(),users=new Set([input.uid,input.actor].filter(Boolean));
 for(const c of changes){const [root,a,b]=c.path;if(['patients','files','complaints','attachments','inbox','followups'].includes(root))phones.add(a);if(root==='patients'){for(const v of [c.before,c.after])if(v&&typeof v==='object'&&v.n)out.patients[a]=v.n;if(b==='n'&&typeof(c.after||c.before)==='string')out.patients[a]=c.after||c.before;}if(root==='roles')users.add(a);
  if(root==='bookings'){if(b)tickets.add(a+'/'+b);for(const v of [c.before,c.after])if(v&&typeof v==='object'){const rows=b?[v]:Object.values(v);for(const x of rows)if(x?.id){out.bookings[a+'/'+x.id]={name:x.name,phone:x.phone,no:x.no,b:x.b,date:a};out.patients[x.phone]||=x.name;phones.add(x.phone);tickets.add(a+'/'+x.id);}}}
 }
 for(const k of tickets)if(out.bookings[k]?.phone)phones.add(out.bookings[k].phone);
 out.patients=Object.fromEntries(Object.entries(out.patients).filter(([p])=>phones.has(p)));out.bookings=Object.fromEntries(Object.entries(out.bookings).filter(([k])=>tickets.has(k)));out.users=Object.fromEntries(Object.entries(out.users).filter(([id])=>users.has(id)||changes.some(c=>['by','editedBy','archivedBy'].includes(c.path.at(-1))&&[c.before,c.after].includes(id))));return out;
}
function record(before,next,input,uid){
 const changes=[];const tracked=ROOTS.concat(['patientDelete','dataClear','purgeDemo','trainingYearPurge'].includes(input.action)?['drafts']:[]);for(const root of tracked)diff(before[root]||{},next[root]||{},[root],changes);
 const id=crypto.randomUUID(),at=new Date().toISOString(),branches=[...new Set((input.puts||[]).map(x=>x.n?.b).concat((input.dels||[]).map(x=>x.b)).filter(Boolean))];
 entryProvenance.stamp(before,next,input,uid,at);
 const phones=new Set();for(const change of changes){const [root,a,b]=change.path;if(['patients','files','complaints','attachments'].includes(root))phones.add(a);if(root==='bookings'&&b){for(const state of [before,next]){const booking=state.bookings?.[a]?.[b];if(booking?.b)branches.push(booking.b);if(booking?.phone)phones.add(booking.phone);}}if(root==='settings'&&['sched','branches'].includes(a)&&b)branches.push(b);}
 for(const state of [before,next])for(const rows of Object.values(state.bookings||{}))for(const booking of Object.values(rows))if(phones.has(booking.phone))branches.push(booking.b);
 branches.splice(0,branches.length,...new Set(branches.filter(Boolean)));
 if(changes.some(x=>x.path[0]==='settings'&&x.path[1]==='sched')){next.settings||={};next.settings.scheduleUpdatedAt=at;}
 if(input.action!=='siteContentSave'&&changes.some(x=>x.path[0]==='settings'&&x.path[1]==='site'&&['sections','layout'].includes(x.path[2]))){next.settings.contentRev=(before.settings?.contentRev||0)+1;}
 const watermarkState=x=>Object.fromEntries(Object.entries(x.settings?.site?.design||{}).filter(([key])=>key.startsWith('watermark')));if(input.action!=='watermarkSave'&&JSON.stringify(watermarkState(before))!==JSON.stringify(watermarkState(next)))next.settings.watermarkRev=(before.settings?.watermarkRev||0)+1;
 const aboutState=x=>[x.settings?.site?.about,Object.fromEntries(Object.entries(x.settings?.site?.design||{}).filter(([key])=>key.startsWith('about')))];if(input.action!=='aboutSave'&&JSON.stringify(aboutState(before))!==JSON.stringify(aboutState(next)))next.settings.aboutRev=(before.settings?.aboutRev||0)+1;
 if(input.action!=='headerSave'&&changes.some(x=>x.path[0]==='settings'&&x.path[1]==='site'&&(!x.path[2]||['design','headerTitle','headerSubtitle','headerText','doctorName','specialty'].includes(x.path[2])))){next.settings.headerRev=(before.settings?.headerRev||0)+1;}
 const entry={id,at,actor:uid,actorName:before.roles?.[uid]?.displayName||before.roles?.[uid]?.u,action:input.action,target:input.uid,branch:input.branch||(branches.length===1?branches[0]:undefined),branches,changeCount:changes.length};
 next.audit=[...(before.audit||[]),entry];next.activityDetails={...(next.activityDetails||{}),[id]:safe(changes)};next.activityContext={...(next.activityContext||{}),[id]:context(before,next,changes,{...input,actor:uid})};
 // Archive the exact missing subtrees, including original image references. No automatic expiry.
 if(input.action==='bookingRestore')for(const group of Object.values(next.recycleBin||{})){if(!group||!Array.isArray(group.items))continue;group.items=group.items.filter(x=>!(x?.path?.[0]==='bookings'&&x.path[2]===input.id));if(!group.items.length)group.restoredAt=at;}
 const removed=changes.filter(x=>x.removed&&!['roles','sessions','complaintSequences'].includes(x.path[0]));
 if(removed.length&& !['trashRestore','bookingRestore','patientSave','userCredentials','patientMergeApply','patientMergeUndo'].includes(input.action)){
  next.recycleBin={...(next.recycleBin||{}),[id]:{...entry,items:structuredClone(removed)}};
 }
 // A clinical deletion is reversible: do not let the physical cleanup outbox erase its reports.
 for(const group of Object.values(next.recycleBin||{}))if(group&&!group.restoredAt&&Array.isArray(group.items))for(const item of group.items)if(item?.path?.[0]==='attachments'){
  const collect=x=>{if(!object(x))return;if(x.key&&next.attachmentGarbage)delete next.attachmentGarbage[x.key];for(const v of Object.values(x))if(object(v))collect(v)};collect(item.before);
 }
 return next;
}
function admin(state,uid,key='data.restore'){perms.requirePermission(core.role(state,uid),key);}
function get(state,path){let x=state;for(const k of path)x=x?.[k];return x;}
function referencesRetiredMerge(state,items){
 const retired=Object.values(state.patientIdentities||{}).filter(row=>row?.deletedAt&&row.mergedInto);if(!retired.length)return false;
 const phones=new Set(),ids=new Set(),bound=new Map(),validPhone=value=>/^01[0125]\d{8}$/.test(value||'');
 const bind=(phone,id)=>{if(validPhone(phone))phones.add(phone);if(typeof id==='string'&&/^pat_[a-f0-9]{32}$/.test(id)){ids.add(id);if(validPhone(phone)){if(!bound.has(phone))bound.set(phone,new Set());bound.get(phone).add(id);}}};
 const visit=(value,hint)=>{
  if(!value||typeof value!=='object')return;
  const phone=core.phone(value.phone||value.p||hint),id=value.patientId||(/^pat_[a-f0-9]{32}$/.test(value.id||'')?value.id:null);bind(phone,id);
  if(validPhone(value.entity))bind(value.entity,null);
  for(const [key,child]of Object.entries(value))visit(child,validPhone(key)?key:hint);
 };
 for(const item of items){const [root,key]=item.path;const hint=['patients','files','complaints','attachments','followups','patientPhoneIndex'].includes(root)&&validPhone(key)?key:null;if(hint)bind(hint,root==='patientPhoneIndex'?item.before:null);visit(item.before,hint);}
 return retired.some(row=>ids.has(row.id)||phones.has(row.phone)&&!bound.get(row.phone)?.size);
}
function restore(original,uid,id){
 admin(original,uid);const s=structuredClone(original),group=s.recycleBin?.[id];if(!group||group.restoredAt||!Array.isArray(group.items))core.fail('المحذوفات غير موجودة أو سبق استعادتها',404);
 if(group.items.some(x=>!x||!Array.isArray(x.path)||!x.path.length||x.path.some(k=>typeof k!=='string'||['__proto__','constructor','prototype'].includes(k))))core.fail('بيانات الأرشيف غير مكتملة؛ لم تتم الاستعادة',409);
 if(['patientMergeApply','patientMergeUndo'].includes(group.action)||referencesRetiredMerge(s,group.items))core.fail('الأرشيف مرتبط بملف تم دمجه؛ استخدم التراجع من سجل دمج الملفات للحفاظ على السجل كاملًا',409);
 for(const item of group.items){if(get(s,item.path)!==undefined)core.fail('تعارض مع بيانات حالية في '+item.path.join('/')+'؛ لم يتم تغيير أي بيانات',409);}
 for(const item of group.items){let parent=s;for(const key of item.path.slice(0,-1)){if(parent[key]!==undefined&&!object(parent[key]))core.fail('تعارض مع بيانات أحدث',409);parent=parent[key]||={};}parent[item.path.at(-1)]=structuredClone(item.before);}
 // Restore the same internal identity; a tombstone is for a NEW registration, not undo.
 const restoredPhones=new Set(group.items.filter(x=>x.path[0]==='patients').flatMap(x=>x.path.length===1?Object.keys(x.before||{}):[x.path[1]]));
 for(const phone of restoredPhones){
  const id=s.patientPhoneIndex?.[phone]||s.patients?.[phone]?.patientId,record=id&&s.patientIdentities?.[id];
  if(!record)continue;
  if(record.phone!==phone)core.fail('هوية الحالة مرتبطة الآن برقم آخر؛ لم تتم الاستعادة',409);
  delete record.deletedAt;
 }
 // Restored bookings are waiting, never resume a past examination or reuse a ticket.
 for(const item of group.items.filter(x=>x.path[0]==='bookings')){
  const rows=s.bookings[item.path[1]]||{};const restored=item.path.length===2?Object.values(rows):[rows[item.path[2]]];
  for(const n of restored){if(!n?.id)continue;if(Object.values(rows).some(x=>x.id!==n.id&&x.phone===n.phone))core.fail('يوجد حجز آخر لنفس المريض في اليوم نفسه',409);if(!core.branchIds(s).includes(n.b))core.fail('استعد الفرع أولًا قبل الحجوزات',409);s.sequences||={};const key=n.date+'_'+n.b;n.no=Math.max(s.sequences[key]||0,...Object.values(rows).map(x=>x.b===n.b?x.no||0:0))+1;s.sequences[key]=n.no;n.s='wait';n.rev=(n.rev||0)+1;delete n.startedAt;delete s.deletedBookings?.[n.id];}
 }
 // Complaint numbers are high-water marks, even across deletion and recovery.
 for(const [phone,rows]of Object.entries(s.complaints||{})){s.complaintSequences||={};s.complaintSequences[phone]=Math.max(original.complaintSequences?.[phone]||0,s.complaintSequences[phone]||0,...Object.values(rows).map(x=>x.no||0));}
 group.restoredAt=new Date().toISOString();group.restoredBy=uid;core.rebuild(s);return s;
}
function list(state,uid,input){admin(state,uid);const page=Math.max(0,Math.floor(Number(input.page)||0)),size=30;let rows=Object.values(state.recycleBin||{}).filter(x=>x&&!x.restoredAt&&Array.isArray(x.items)&&!['patientMergeApply','patientMergeUndo'].includes(x.action)).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));return {total:rows.length,page,rows:rows.slice(page*size,(page+1)*size).map(({items,...entry})=>({...entry,count:items.length,paths:items.filter(x=>Array.isArray(x?.path)).map(x=>x.path.join('/'))}))};}
export {context,record,restore,list,admin,diff};
