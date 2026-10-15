import * as perms from './permissions.js';
const fail=(m,s=400)=>{const e=new Error(m);e.status=s;throw e};
const validPhone=p=>/^01[0125]\d{8}$/.test(p);
const validId=p=>/^[A-Za-z0-9_-]{1,128}$/.test(p);
function indexPatients(state){
 state.patients||={};
 for(const rows of Object.values(state.bookings||{}))for(const x of Object.values(rows||{})){
  if(validPhone(x.phone)&&(!state.patients[x.phone]||state.patients[x.phone].d<=x.date))state.patients[x.phone]={n:x.name,d:x.date};
 }
 return state;
}
function read(state,r,path){
 if(path==='files'||path==='complaints'){perms.requirePermission(r,'data.export');return state[path]||{};}
 if(path==='patients'){perms.requirePermission(r,'patients.read');return indexPatients(structuredClone(state)).patients;}
 if(/^complaints\/01[0125]\d{8}$/.test(path)){perms.requirePermission(r,'complaints.read');return state.complaints?.[path.split('/')[1]]||{};}
 if(/^files\/01[0125]\d{8}$/.test(path)){perms.requirePermission(r,'notes.read');return state.files?.[path.split('/')[1]]||null;}
 if(path==='inbox'){perms.requirePermission(r,'notifications.read');return state.inbox||{};}
 fail('مسار غير مسموح',403);
}
function patch(state,r,updates,core){

 indexPatients(state);state.complaints||={};state.files||={};state.inbox||={};
 const entries=Object.entries(updates);
 if(!entries.length||entries.length>200)fail('تحديث غير صحيح');
 for(const [path,value] of entries){
  const [kind,ph,key,extra]=path.split('/');
  if(kind==='inbox'){
   if(!validId(ph)||key)fail('مسار غير صحيح');
   if(value!==null){if(!entries.some(([p,v])=>p.startsWith('complaints/')&&p.endsWith('/'+ph)&&v))fail('إشعار غير صحيح');continue;}
   perms.requirePermission(r,'notifications.read');delete state.inbox[ph];continue;
  }
  if(!validPhone(ph)||extra)fail('مسار غير صحيح');
  if(kind==='patients'){
   perms.requirePermission(r,kind==='patients'?'patients.edit':'notes.edit');if(key)fail('غير مصرح',403);
   if(value===null){delete state.patients[ph];continue;}
   if(typeof value?.n!=='string'||!value.n.trim()||value.n.length>120)fail('اسم غير صحيح');core.date(value.d);state.patients[ph]={n:value.n,d:value.d};continue;
  }
  if(!state.patients[ph])fail('الحالة غير موجودة',404);
  if(kind==='files'){
   perms.requirePermission(r,'notes.edit');if(key)fail('غير مصرح',403);
   if(value===null){delete state.files[ph];continue;}
   if(typeof value?.n!=='string'||value.n.length>5000)fail('الملاحظات طويلة');const next={...state.files[ph],n:value.n,t:new Date().toISOString()};for(const k of ['allergies','chronic','diagnosis','treatment'])if(value[k]!==undefined){if(typeof value[k]!=='string'||value[k].length>2000)fail('بيانات طبية غير صحيحة');next[k]=value[k];}state.files[ph]=next;continue;
  }
  if(kind==='complaints'){
   if(!validId(key))fail('معرّف غير صحيح');const rows=state.complaints[ph]||={},old=rows[key];
   perms.requirePermission(r,value===null?'complaints.delete':old?'complaints.edit':'complaints.create');
   if(value===null){delete rows[key];delete state.inbox[key];continue;}
   core.date(value?.date);if(value.date>core.today()||typeof value.text!=='string'||!value.text.trim()||value.text.length>2000||typeof value.tx!=='string'||value.tx.length>1000)fail('راجع الشكوى والتاريخ والعلاج');
   rows[key]={id:key,date:value.date,text:value.text.trim(),tx:value.tx,by:old?.by||r.u,at:old?.at||new Date().toISOString()};
   if(!old){const note=rows[key];state.inbox[key]={p:ph,n:state.patients[ph].n,by:note.by,at:note.at,d:note.date};}continue;
  }
  fail('مسار كتابة غير مسموح',403);
 }
 return state;
}
export {read,patch,indexPatients};
