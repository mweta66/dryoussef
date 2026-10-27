const perms=require('./permissions.cjs');
const fail=(m,s=400)=>{const e=new Error(m);e.status=s;throw e};
const validPhone=p=>/^01[0125]\d{8}$/.test(p);
const validId=p=>/^[A-Za-z0-9_-]{1,128}$/.test(p);
function indexPatients(state){
 state.patients||={};
 for(const rows of Object.values(state.bookings||{}))for(const x of Object.values(rows||{})){
  if(validPhone(x.phone)&&(!state.patients[x.phone]||state.patients[x.phone].d<=x.date))state.patients[x.phone]={...state.patients[x.phone],n:x.name,d:x.date};
 }
 return state;
}
function allPatients(r){return perms.allBranches(r)||(r.r==='nurse'&&!r.scope&&!r.br);}
function canAccess(state,r,phone){return allPatients(r)||state.patients?.[phone]?.br===r.br&&!!r.br||Object.values(state.bookings||{}).some(rows=>Object.values(rows).some(x=>x.phone===phone&&x.b===r.br));}
function assertAccess(state,r,phone){if(!canAccess(state,r,phone))fail('غير مصرح ببيانات هذا الفرع',403);}
function filterPatients(state,r,records){return Object.fromEntries(Object.entries(records||{}).filter(([phone])=>canAccess(state,r,phone)));}
function numberComplaints(state){state.complaintSequences||={};for(const [phone,rows]of Object.entries(state.complaints||{})){const ordered=Object.entries(rows).sort(([a,x],[b,y])=>String(x.at||x.date).localeCompare(String(y.at||y.date))||a.localeCompare(b)),used=new Set();let next=Number(state.complaintSequences[phone])||0;for(const [,row]of ordered)if(Number.isSafeInteger(row.no)&&row.no>0&&!used.has(row.no)){used.add(row.no);next=Math.max(next,row.no);}else delete row.no;for(const [,row]of ordered)if(!row.no)row.no=++next;state.complaintSequences[phone]=next;}return state;}
function read(state,r,path){
 if(path==='files'||path==='complaints'){perms.requirePermission(r,'data.export');return filterPatients(state,r,path==='complaints'?numberComplaints(structuredClone(state)).complaints:state[path]);}
 if(path==='patients'){perms.requirePermission(r,'patients.read');const indexed=indexPatients(structuredClone(state));return filterPatients(indexed,r,indexed.patients);}
 if(/^complaints\/01[0125]\d{8}$/.test(path)){perms.requirePermission(r,'complaints.read');assertAccess(state,r,path.split('/')[1]);return numberComplaints(structuredClone(state)).complaints?.[path.split('/')[1]]||{};}
 if(/^files\/01[0125]\d{8}$/.test(path)){perms.requirePermission(r,'notes.read');assertAccess(state,r,path.split('/')[1]);return state.files?.[path.split('/')[1]]||null;}
 if(path==='inbox'){perms.requirePermission(r,'notifications.read');return Object.fromEntries(Object.entries(state.inbox||{}).filter(([,x])=>canAccess(state,r,x.p)));}
 fail('مسار غير مسموح',403);
}
function patch(state,r,updates,core){

 indexPatients(state);state.complaints||={};state.files||={};state.inbox||={};
 numberComplaints(state);
 const entries=Object.entries(updates);
 if(!entries.length||entries.length>200)fail('تحديث غير صحيح');
 for(const [path,value] of entries){
  const [kind,ph,key,extra]=path.split('/');
  if(kind==='inbox'){
   if(!validId(ph)||key)fail('مسار غير صحيح');
   if(value!==null){if(!entries.some(([p,v])=>p.startsWith('complaints/')&&p.endsWith('/'+ph)&&v))fail('إشعار غير صحيح');continue;}
   perms.requirePermission(r,'notifications.read');if(state.inbox[ph])assertAccess(state,r,state.inbox[ph].p);delete state.inbox[ph];continue;
  }
  if(!validPhone(ph)||extra)fail('مسار غير صحيح');
  if(state.patients[ph])assertAccess(state,r,ph);
  if(kind==='patients'){
   perms.requirePermission(r,kind==='patients'?'patients.edit':'notes.edit');if(key)fail('غير مصرح',403);
   if(value===null)fail('استخدم إجراء حذف الحالة الكامل؛ مسار التعديل لا يقبل الحذف',403);
   if(typeof value?.n!=='string'||!value.n.trim()||value.n.length>120)fail('اسم غير صحيح');core.date(value.d);state.patients[ph]={...state.patients[ph],n:value.n,d:value.d,...(!allPatients(r)?{br:r.br}:{})};continue;
  }
  if(!state.patients[ph])fail('الحالة غير موجودة',404);assertAccess(state,r,ph);
  if(kind==='files'){
   perms.requirePermission(r,'notes.edit');if(key)fail('غير مصرح',403);
   const currentVersion=state.files[ph]?.rev||0;if((value?.rev??0)!==currentVersion)fail('تم تعديل الملف الطبي من مستخدم آخر. أعد فتح الملف لمراجعة التغييرات قبل الحفظ.',409);
   if(value===null){if(currentVersion)fail('استخدم حذف الحالة لإزالة ملف محفوظ',409);delete state.files[ph];continue;}
   if(typeof value?.n!=='string'||value.n.length>5000)fail('الملاحظات طويلة');const next={...state.files[ph],n:value.n,rev:currentVersion+1,by:r.u,t:new Date().toISOString()};for(const k of ['allergies','chronic','diagnosis','treatment'])if(value[k]!==undefined){if(typeof value[k]!=='string'||value[k].length>2000)fail('بيانات طبية غير صحيحة');next[k]=value[k];}state.files[ph]=next;continue;
  }
  if(kind==='complaints'){
   if(!validId(key))fail('معرّف غير صحيح');const rows=state.complaints[ph]||={},old=rows[key];
   perms.requirePermission(r,value===null?'complaints.delete':old?'complaints.edit':'complaints.create');
   if(value===null){delete rows[key];delete state.inbox[key];continue;}
   core.date(value?.date);if(value.date>core.today()||typeof value.text!=='string'||!value.text.trim()||value.text.length>2000||typeof value.tx!=='string'||value.tx.length>1000)fail('راجع الشكوى والتاريخ والعلاج');
   if(value.reason!==undefined&&(typeof value.reason!=='string'||value.reason.length>2000))fail('سبب الشكوى حتى 2000 حرف');
   const no=old?.no||((state.complaintSequences[ph]||0)+1);state.complaintSequences[ph]=Math.max(state.complaintSequences[ph]||0,no);
   rows[key]={id:key,no,date:value.date,reason:typeof value.reason==='string'?value.reason.trim():old?.reason||'',text:value.text.trim(),tx:value.tx,by:old?.by||r.u,at:old?.at||new Date().toISOString(),...(old?{editedAt:new Date().toISOString(),editedBy:r.u}:{}),...(old?.trainingBatch?{trainingBatch:old.trainingBatch}:{})};
   if(!old){const note=rows[key];state.inbox[key]={p:ph,n:state.patients[ph].n,by:note.by,at:note.at,d:note.date};}continue;
  }
  fail('مسار كتابة غير مسموح',403);
 }
 return state;
}
module.exports={read,patch,indexPatients,canAccess,assertAccess,allPatients,numberComplaints};
