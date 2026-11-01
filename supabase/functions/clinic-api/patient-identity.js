import {createHash,randomUUID} from 'node:crypto';
const VALID_ID=/^pat_[a-f0-9]{32}$/;
const normalizePhone=value=>String(value||'').replace(/[٠-٩۰-۹]/g,d=>{const n=d.charCodeAt(0);return n>=1776?n-1776:n-1632}).replace(/[\s()+-]/g,'').replace(/^(?:0020|20)(?=1)/,'0');
const legacyId=phone=>'pat_'+createHash('md5').update('clinic-patient/v1|'+phone).digest('hex');
const freshId=()=>'pat_'+randomUUID().replaceAll('-','');
const fail=(m,status=409)=>{const e=Error(m);e.status=status;throw e;};
function ensure(state){
 state.patients||={};state.patientIdentities||={};state.patientPhoneIndex||={};const used=new Map();
 for(const [phone,p]of Object.entries(state.patients)){
  if(!/^01[0125]\d{8}$/.test(phone)||!p||typeof p!=='object')continue;
  const explicit=VALID_ID.test(p.patientId||'')?p.patientId:p.id,indexed=state.patientPhoneIndex[phone];let id=VALID_ID.test(explicit||'')?explicit:VALID_ID.test(indexed||'')&&!state.patientIdentities[indexed]?.deletedAt?indexed:legacyId(phone);
  if(!explicit&&state.patientIdentities[id]?.deletedAt)id=freshId();
  if(used.has(id)&&used.get(id)!==phone)fail('هوية داخلية مرتبطة بأكثر من حالة؛ راجع الملفات المتشابهة قبل الحفظ');used.set(id,phone);
  const conflicts=Object.values(state.patientIdentities).filter(x=>x.phone===phone&&!x.deletedAt&&x.id!==id&&state.patients[phone]&&(p.patientId||p.id));
  if(conflicts.length)fail('رقم الموبايل مرتبط بهويات مختلفة؛ لا يمكن دمج الملفات تلقائيًا');
  state.patientPhoneIndex[phone]=id;state.patientIdentities[id]={...state.patientIdentities[id],id,phone,createdAt:state.patientIdentities[id]?.createdAt||null};delete state.patientIdentities[id].deletedAt;
 }
 for(const [phone,id]of Object.entries(state.patientPhoneIndex))if(!state.patients[phone]){delete state.patientPhoneIndex[phone];if(state.patientIdentities[id]&&!state.patientIdentities[id].deletedAt)state.patientIdentities[id].deletedAt=new Date().toISOString();}
 return state;
}
function idForPhone(state,phone){const p=normalizePhone(phone),row=state.patients?.[p],explicit=VALID_ID.test(row?.patientId||'')?row.patientId:row?.id,indexed=state.patientPhoneIndex?.[p];if(!row)return null;if(VALID_ID.test(explicit||''))return explicit;if(VALID_ID.test(indexed||'')&&!state.patientIdentities?.[indexed]?.deletedAt)return indexed;return legacyId(p);}
function resolve(state,input={}){
 const phone=input.phone?normalizePhone(input.phone):'',id=input.patientId||'';
 if(phone&&!/^01[0125]\d{8}$/.test(phone))fail('رقم الموبايل غير صحيح',400);if(id&&!VALID_ID.test(id))fail('هوية الحالة غير صحيحة',400);
 if(!phone&&!id)fail('حدد الحالة برقم الموبايل أو الهوية الداخلية',400);
 let matches=Object.entries(state.patients||{}).filter(([p,x])=>phone?p===phone:idForPhone(state,p)===id);
 if(phone){const bindings=Object.values(state.patientIdentities||{}).filter(x=>x.phone===phone&&!x.deletedAt);if(new Set(bindings.map(x=>x.id)).size>1)fail('رقم الموبايل مرتبط بأكثر من ملف؛ يراجع الطاقم الهوية قبل المتابعة');}
 if(matches.length>1)fail('تعذر تحديد ملف واحد للحالة');if(!matches.length)fail('الحالة غير موجودة',404);
 const [p,patient]=matches[0],patientId=idForPhone(state,p);if(id&&patientId!==id)fail('الهوية الداخلية لا تطابق رقم الموبايل؛ أعد اختيار الحالة',409);return {phone:p,patientId,patient};
}
function rename(state,from,to){const old=normalizePhone(from),next=normalizePhone(to);ensure(state);const id=idForPhone(state,old);if(!id)return null;if(old!==next&&state.patients[next]&&idForPhone(state,next)!==id)fail('رقم الموبايل الجديد مستخدم لحالة أخرى');if(old!==next)delete state.patientPhoneIndex[old];state.patientPhoneIndex[next]=id;state.patientIdentities[id]={...state.patientIdentities[id],phone:next};
 for(const x of Object.values(state.followupPlans||{}))if(x.patientId===id||x.phone===old){x.patientId=id;x.phone=next;}
 for(const root of ['tasks','appointmentRequests','waitingList','clinicalVisits','urgentReviews'])for(const x of Object.values(state[root]||{}))if(x.patientId===id||x.phone===old){x.patientId=id;x.phone=next;}
 return id;
}
function isTrainingPatient(state,phone){const p=state.patients?.[phone];if(p?.trainingBatch||p?.training===true||['training','demo','seed'].includes(p?.dataSource))return true;if(state.recordProvenance?.['patients/'+phone]?.origin==='training')return true;return Object.values(state.bookings||{}).some(rows=>Object.values(rows).some(x=>x.phone===phone&&(x.trainingBatch||/^demo[-_]/.test(x.id||''))));}
function isTrainingBooking(state,booking){const origin=state.recordProvenance?.['bookings/'+booking?.id]?.origin;if(booking?.trainingBatch||booking?.training===true||['training','demo','seed'].includes(booking?.dataSource)||/^demo[-_]/.test(booking?.id||'')||origin==='training')return true;if(origin==='manual')return false;return isTrainingPatient(state,booking?.phone);}
function filterOperationalBookings(state,rows,options={}){if(options.includeTraining&&options.role?.r!=='admin')fail('عرض بيانات التدريب في المؤشرات متاح للأدمن فقط',403);const training=rows.filter(x=>isTrainingBooking(state,x));return {bookings:options.includeTraining?rows:rows.filter(x=>!isTrainingBooking(state,x)),excludedTraining:options.includeTraining?0:training.length,includesTraining:options.includeTraining===true};}
export {ensure,resolve,idForPhone,legacyId,normalizePhone,rename,isTrainingPatient,isTrainingBooking,filterOperationalBookings};
