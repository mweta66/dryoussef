const core=require('./core.cjs'),perms=require('./permissions.cjs');
const ROOTS=['patients','files','complaints','attachments','bookings','inbox','followups','deletedBookings','sessions','complaintSequences','settings','roles'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function diff(before,after,path=[],out=[]){
 if(same(before,after))return out;
 if(object(before)&&object(after)){for(const key of new Set([...Object.keys(before),...Object.keys(after)]))diff(before[key],after[key],path.concat(key),out);}
 else out.push({path,before:before===undefined?null:before,after:after===undefined?null:after,removed:after===undefined,added:before===undefined});
 return out;
}
function safe(value){if(Array.isArray(value))return value.map(safe);if(object(value))return Object.fromEntries(Object.entries(value).filter(([k])=>!/(password|token|secret|hash|salt)/i.test(k)).map(([k,v])=>[k,safe(v)]));return typeof value==='string'&&value.startsWith('data:image/')?'[صورة مضمّنة]':value;}
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
 const changes=[];for(const root of ROOTS)diff(before[root]||{},next[root]||{},[root],changes);
 const id=crypto.randomUUID(),at=new Date().toISOString(),branches=[...new Set((input.puts||[]).map(x=>x.n?.b).concat((input.dels||[]).map(x=>x.b)).filter(Boolean))];
 const phones=new Set();for(const change of changes){const [root,a,b]=change.path;if(['patients','files','complaints','attachments'].includes(root))phones.add(a);if(root==='bookings'&&b){for(const state of [before,next]){const booking=state.bookings?.[a]?.[b];if(booking?.b)branches.push(booking.b);if(booking?.phone)phones.add(booking.phone);}}if(root==='settings'&&['sched','branches'].includes(a)&&b)branches.push(b);}
 for(const state of [before,next])for(const rows of Object.values(state.bookings||{}))for(const booking of Object.values(rows))if(phones.has(booking.phone))branches.push(booking.b);
 branches.splice(0,branches.length,...new Set(branches.filter(Boolean)));
 if(changes.some(x=>x.path[0]==='settings'&&x.path[1]==='sched')){next.settings||={};next.settings.scheduleUpdatedAt=at;}
 if(input.action!=='siteContentSave'&&changes.some(x=>x.path[0]==='settings'&&x.path[1]==='site'&&['sections','layout'].includes(x.path[2]))){next.settings.contentRev=(before.settings?.contentRev||0)+1;}
 const watermarkState=x=>Object.fromEntries(Object.entries(x.settings?.site?.design||{}).filter(([key])=>key.startsWith('watermark')));if(input.action!=='watermarkSave'&&JSON.stringify(watermarkState(before))!==JSON.stringify(watermarkState(next)))next.settings.watermarkRev=(before.settings?.watermarkRev||0)+1;
 const aboutState=x=>[x.settings?.site?.about,Object.fromEntries(Object.entries(x.settings?.site?.design||{}).filter(([key])=>key.startsWith('about')))];if(input.action!=='aboutSave'&&JSON.stringify(aboutState(before))!==JSON.stringify(aboutState(next)))next.settings.aboutRev=(before.settings?.aboutRev||0)+1;
 if(input.action!=='headerSave'&&changes.some(x=>x.path[0]==='settings'&&x.path[1]==='site'&&(!x.path[2]||['design','headerTitle','headerSubtitle','headerText','doctorName','specialty'].includes(x.path[2])))){next.settings.headerRev=(before.settings?.headerRev||0)+1;}
 const entry={id,at,actor:uid,actorName:before.roles?.[uid]?.displayName||before.roles?.[uid]?.u,action:input.action,target:input.uid,branch:input.branch||(branches.length===1?branches[0]:undefined),branches,changeCount:changes.length};
 next.audit=[...(before.audit||[]),entry];next.activityDetails={...(next.activityDetails||{}),[id]:changes.map(x=>safe(x))};next.activityContext={...(next.activityContext||{}),[id]:context(before,next,changes,{...input,actor:uid})};
 // Archive the exact missing subtrees, including original image references. No automatic expiry.
 if(input.action==='bookingRestore')for(const group of Object.values(next.recycleBin||{})){group.items=(group.items||[]).filter(x=>!(x.path[0]==='bookings'&&x.path[2]===input.id));if(!group.items.length)group.restoredAt=at;}
 const removed=changes.filter(x=>x.removed&&!['roles','sessions','complaintSequences'].includes(x.path[0]));
 if(removed.length&& !['trashRestore','bookingRestore','patientSave','userCredentials'].includes(input.action)){
  next.recycleBin={...(next.recycleBin||{}),[id]:{...entry,items:structuredClone(removed)}};
 }
 // A clinical deletion is reversible: do not let the physical cleanup outbox erase its reports.
 for(const group of Object.values(next.recycleBin||{}))if(!group.restoredAt)for(const item of group.items||[])if(item.path[0]==='attachments'){
  const collect=x=>{if(!object(x))return;if(x.key&&next.attachmentGarbage)delete next.attachmentGarbage[x.key];for(const v of Object.values(x))if(object(v))collect(v)};collect(item.before);
 }
 return next;
}
function admin(state,uid,key='data.restore'){perms.requirePermission(core.role(state,uid),key);}
function get(state,path){let x=state;for(const k of path)x=x?.[k];return x;}
function restore(original,uid,id){
 admin(original,uid);const s=structuredClone(original),group=s.recycleBin?.[id];if(!group||group.restoredAt)core.fail('المحذوفات غير موجودة أو سبق استعادتها',404);
 for(const item of group.items){if(get(s,item.path)!==undefined)core.fail('تعارض مع بيانات حالية في '+item.path.join('/')+'؛ لم يتم تغيير أي بيانات',409);}
 for(const item of group.items){let parent=s;for(const key of item.path.slice(0,-1)){if(parent[key]!==undefined&&!object(parent[key]))core.fail('تعارض مع بيانات أحدث',409);parent=parent[key]||={};}parent[item.path.at(-1)]=structuredClone(item.before);}
 // Restored bookings are waiting, never resume a past examination or reuse a ticket.
 for(const item of group.items.filter(x=>x.path[0]==='bookings')){
  const rows=s.bookings[item.path[1]]||{};const restored=item.path.length===2?Object.values(rows):[rows[item.path[2]]];
  for(const n of restored){if(!n?.id)continue;if(Object.values(rows).some(x=>x.id!==n.id&&x.phone===n.phone))core.fail('يوجد حجز آخر لنفس المريض في اليوم نفسه',409);if(!core.branchIds(s).includes(n.b))core.fail('استعد الفرع أولًا قبل الحجوزات',409);s.sequences||={};const key=n.date+'_'+n.b;n.no=Math.max(s.sequences[key]||0,...Object.values(rows).map(x=>x.b===n.b?x.no||0:0))+1;s.sequences[key]=n.no;n.s='wait';n.rev=(n.rev||0)+1;delete n.startedAt;delete s.deletedBookings?.[n.id];}
 }
 // Complaint numbers are high-water marks, even across deletion and recovery.
 for(const [phone,rows]of Object.entries(s.complaints||{})){s.complaintSequences||={};s.complaintSequences[phone]=Math.max(original.complaintSequences?.[phone]||0,s.complaintSequences[phone]||0,...Object.values(rows).map(x=>x.no||0));}
 group.restoredAt=new Date().toISOString();group.restoredBy=uid;core.rebuild(s);return s;
}
function list(state,uid,input){admin(state,uid);const page=Math.max(0,Math.floor(Number(input.page)||0)),size=30;let rows=Object.values(state.recycleBin||{}).filter(x=>!x.restoredAt).sort((a,b)=>b.at.localeCompare(a.at));return {total:rows.length,page,rows:rows.slice(page*size,(page+1)*size).map(({items,...entry})=>({...entry,count:items.length,paths:items.map(x=>x.path.join('/'))}))};}
module.exports={context,record,restore,list,admin,diff};
