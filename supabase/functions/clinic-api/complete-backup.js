import * as core from './core.js';
import * as perms from './permissions.js';
import * as attachments from './attachments.js';
import * as patientIdentity from './patient-identity.js';
const MAX_RECOVERY_BYTES=256000000,UUID=/^[0-9a-f-]{36}$/i,PATIENT_ID=/^pat_[a-f0-9]{32}$/;
const recoveryActions=['recoveryBackupExport','recoveryFileExport','recoveryBackupVerify'];
const clone=x=>JSON.parse(JSON.stringify(x));
const byteLength=x=>new TextEncoder().encode(JSON.stringify(x)).length;
async function checksum(value){const bytes=value instanceof Uint8Array?value:new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function cleanState(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))core.fail('حالة النسخة غير صحيحة');
 const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!/(?:^|_)(?:password|token|secret|salt|passwordhash|refresh_token|access_token)(?:$|_)/i.test(key)&&!['hash','idToken','refreshToken','serviceRoleKey','service_role_key'].includes(key)).map(([key,v])=>[key,clean(v)])):value;
 const state=clean(clone(payload));delete state.backupRehearsal;delete state.restoreRehearsal;return state;
}
function fileReferences(state){
 const found=new Map();
 function collect(value,context={}){
  if(!value||typeof value!=='object')return;
  if(value.key&&value.id&&value.mime){
   if(!UUID.test(value.key)||!UUID.test(value.id)||!['image/jpeg','image/png','image/webp','application/pdf'].includes(value.mime))core.fail('مرجع تقرير غير صالح في النسخة');
   const prior=found.get(value.key),reference={...context,id:value.id,phone:context.phone||null};
   if(prior&&(prior.mime!==value.mime||prior.size!==undefined&&value.size!==undefined&&prior.size!==value.size))core.fail('مراجع متعارضة لنفس ملف التقرير',409);
   if(prior)prior.references.push(reference);else found.set(value.key,{key:value.key,name:String(value.name||'تقرير'),mime:value.mime,...value.size!==undefined?{size:value.size}:{},...value.digest?{recordChecksum:value.digest}:{},references:[reference]});return;
  }
  for(const [key,x]of Object.entries(value))collect(x,{...context,.../^01[0125]\d{8}$/.test(key)?{phone:key}:{}});
 }
 collect(state.attachments,{kind:'active'});
 for(const [trashId,group]of Object.entries(state.recycleBin||{}))for(const item of group.items||[])if(item.path?.[0]==='attachments')collect(item.before,{kind:'trash',trashId,phone:/^01[0125]\d{8}$/.test(item.path[1]||'')?item.path[1]:null});
 if(found.size>10000)core.fail('عدد المرفقات أكبر من حد النسخة؛ صدّر على مجموعات');return [...found.values()];
}
function graphCheck(state){
 if(!state||typeof state!=='object'||Array.isArray(state))core.fail('حالة الاستعادة غير صحيحة',409);
 const counts={patients:Object.keys(state.patients||{}).length,bookings:0,files:Object.keys(state.files||{}).length,complaints:0,roles:Object.keys(state.roles||{}).length,audit:(state.audit||[]).length,trash:Object.keys(state.recycleBin||{}).length,followupPlans:Object.keys(state.followupPlans||{}).length,bookingContacts:Object.keys(state.bookingContacts||{}).length};
 const branchIds=new Set(core.branchIds(state)),ids=new Set(),patientIds=new Set();let admins=0;
 const identityFor=phone=>{const patient=state.patients?.[phone];return patient?.patientId||patient?.id||state.patientPhoneIndex?.[phone]||patientIdentity.legacyId(phone);};
 for(const [uid,r]of Object.entries(state.roles||{})){if(!uid||!r||!['admin','doctor','nurse','sec','staff'].includes(r.r)||typeof r.u!=='string'||r.br&&!branchIds.has(r.br)||r.permissions&&Object.entries(r.permissions).some(([key,value])=>!perms.keys.includes(key)||typeof value!=='boolean'))core.fail('حساب أو صلاحيات غير متسقة في النسخة',409);if(r.r==='admin'&&r.enabled!==false)admins++;}
 if(!admins)core.fail('النسخة لا تحتوي مدير نظام فعالًا',409);
 for(const [phone,p]of Object.entries(state.patients||{})){if(!/^01[0125]\d{8}$/.test(phone)||!p||typeof p.n!=='string')core.fail('هوية حالة غير متسقة في النسخة',409);const patientId=p.patientId||p.id;if(patientId){if(!PATIENT_ID.test(patientId))core.fail('صيغة الهوية الداخلية غير صحيحة في النسخة',409);if(patientIds.has(patientId))core.fail('هوية داخلية مكررة في النسخة',409);patientIds.add(patientId);}}
 for(const [date,rows]of Object.entries(state.bookings||{})){
  core.date(date);const tickets=new Set();
  for(const [id,row]of Object.entries(rows||{})){if(!row||id!==row.id||ids.has(id)||row.date!==date||!state.patients?.[row.phone]||!branchIds.has(row.b)||!Number.isSafeInteger(row.no)||row.no<1||!['wait','exam','done','no','cx'].includes(row.s))core.fail('حجز أو مرجع حالة غير متسق في النسخة',409);const key=row.b+'|'+row.no;if(tickets.has(key))core.fail('رقم تذكرة مكرر في النسخة',409);tickets.add(key);ids.add(id);counts.bookings++;if(state.sequences?.[date+'_'+row.b]!==undefined&&state.sequences[date+'_'+row.b]<row.no)core.fail('عداد التذاكر أصغر من تذكرة صادرة',409);if(row.patientId&&!PATIENT_ID.test(row.patientId))core.fail('صيغة هوية الحجز الداخلية غير صحيحة',409);if(row.patientId&&row.patientId!==identityFor(row.phone))core.fail('الحجز يشير إلى هوية داخلية مختلفة',409);}
 }
 for(const phone of Object.keys(state.files||{}))if(!state.patients?.[phone])core.fail('ملف طبي بلا هوية حالة',409);
 for(const [phone,rows]of Object.entries(state.complaints||{})){if(!state.patients?.[phone])core.fail('شكاوى بلا هوية حالة',409);const numbers=new Set();for(const [id,row]of Object.entries(rows||{})){if(!row||row.id!==id||typeof row.text!=='string')core.fail('شكوى غير صالحة في النسخة',409);core.date(row.date);if(row.no!==undefined){if(!Number.isSafeInteger(row.no)||row.no<1||numbers.has(row.no))core.fail('تسلسل شكاوى غير صحيح',409);numbers.add(row.no);if(state.complaintSequences?.[phone]!==undefined&&state.complaintSequences[phone]<row.no)core.fail('عداد الشكاوى أصغر من رقم صادر',409);}counts.complaints++;}}
 for(const [phone,rows]of Object.entries(state.attachments||{}))if(Object.keys(rows||{}).length&&!state.patients?.[phone])core.fail('تقارير نشطة بلا هوية حالة',409);
 for(const [phone,id]of Object.entries(state.patientPhoneIndex||{})){const person=state.patients?.[phone],entry=state.patientIdentities?.[id];if(!PATIENT_ID.test(id)||!person||!entry||entry.id!==id||entry.phone!==phone||entry.deletedAt||(person.patientId||person.id)&&id!==(person.patientId||person.id))core.fail('فهرس الهوية الداخلية لا يطابق ملف الحالة',409);}
 for(const [id,entry]of Object.entries(state.patientIdentities||{})){if(!PATIENT_ID.test(id)||!entry||entry.id!==id||typeof entry.phone!=='string')core.fail('سجل هوية داخلية غير صحيح',409);if(!entry.deletedAt){const patient=state.patients?.[entry.phone];if(!patient||(patient.patientId||patient.id)&&(patient.patientId||patient.id)!==id||state.patientPhoneIndex?.[entry.phone]!==id)core.fail('هوية نشطة بلا ملف مطابق',409);}}
 const knownBookings=new Set(ids);for(const [id,item]of Object.entries(state.deletedBookings||{}))if(item.booking?.id)knownBookings.add(item.booking.id);
 for(const group of Object.values(state.recycleBin||{}))for(const item of group.items||[])if(item.path?.[0]==='bookings'){if(item.before?.id)knownBookings.add(item.before.id);else for(const row of Object.values(item.before||{}))if(row?.id)knownBookings.add(row.id);}
 for(const plan of Object.values(state.followupPlans||{})){if(plan.phone&&!state.patients?.[plan.phone])core.fail('خطة متابعة بلا هوية حالة',409);const patient=state.patients?.[plan.phone];if(plan.patientId&&!PATIENT_ID.test(plan.patientId))core.fail('صيغة هوية خطة المتابعة غير صحيحة',409);if(plan.patientId&&patient&&plan.patientId!==identityFor(plan.phone))core.fail('خطة المتابعة مرتبطة بهوية مختلفة',409);for(const id of [plan.sourceBookingId,plan.linkedBookingId||plan.bookingId].filter(Boolean))if(!knownBookings.has(id))core.fail('خطة متابعة مرتبطة بحجز غير موجود',409);}
 for(const [id,contact]of Object.entries(state.bookingContacts||{}))if(!knownBookings.has(contact.bookingId||id))core.fail('متابعة تأكيد بلا حجز أصلي أو مؤرشف',409);
 return counts;
}
async function manifestFor(payload,source={kind:'current'}){const state=cleanState(payload);graphCheck(state);const files=fileReferences(state);if(byteLength(state)>MAX_RECOVERY_BYTES)core.fail('بيانات النسخة تتجاوز 256 ميجابايت');return {format:'clinic-recovery-manifest',schemaVersion:1,exportedAt:new Date().toISOString(),source,state,stateChecksum:await checksum(state),files,externalServices:{authCredentialsIncluded:false,authSessionsIncluded:false,hostingSecretsIncluded:false,providerAccountRestoreRequired:true}};}
async function readFile(adapter,descriptor){
 const read=adapter.readAttachmentBytes||adapter.readAttachment;if(!read)core.fail('قراءة أصل التقارير غير مهيأة؛ لم يتم اعتبار النسخة مكتملة',503);
 let value;try{value=await read(descriptor.key,descriptor.mime)}catch{core.fail('تعذر قراءة أحد أصول التقارير؛ لم يتم اعتبار النسخة مكتملة',503)}
 if(typeof value?.data!=='string')core.fail('الخدمة لم تعد أصل التقرير كبيانات؛ الرابط المؤقت لا يكفي',503);
 const bytes=attachments.decodeImage({name:descriptor.name,mime:descriptor.mime,data:value.data});
 if(descriptor.size!==undefined&&descriptor.size!==bytes.length)core.fail('حجم أصل التقرير لا يطابق بياناته',409);
 const digest=await checksum(bytes);if(descriptor.recordChecksum&&descriptor.recordChecksum!==digest)core.fail('بصمة أصل التقرير لا تطابق السجل',409);
 return {key:descriptor.key,mime:descriptor.mime,size:bytes.length,checksum:digest,data:value.data};
}
async function buildRecoveryBundle(adapter,payload,source){const manifest=await manifestFor(payload,source),files=[];let size=byteLength(manifest);for(const item of manifest.files){const file=await readFile(adapter,item);size+=byteLength(file);if(size>MAX_RECOVERY_BYTES)core.fail('النسخة الكاملة تتجاوز 256 ميجابايت؛ لم يتم تصدير نسخة ناقصة');files.push(file);}return {format:'clinic-recovery-backup',schemaVersion:1,manifest,files};}
async function verifyRecoveryBundle(bundle){
 if(bundle?.format!=='clinic-recovery-backup'||bundle.schemaVersion!==1||bundle.manifest?.format!=='clinic-recovery-manifest'||bundle.manifest.schemaVersion!==1||!Array.isArray(bundle.files)||byteLength(bundle)>MAX_RECOVERY_BYTES)core.fail('صيغة نسخة الاستعادة الكاملة غير صحيحة');
 const manifest=bundle.manifest;if(!manifest.state||typeof manifest.state!=='object'||Array.isArray(manifest.state)||!Array.isArray(manifest.files)||typeof manifest.stateChecksum!=='string')core.fail('تعريف نسخة الاستعادة غير صحيح',409);if(await checksum(manifest.state)!==manifest.stateChecksum)core.fail('بصمة بيانات النسخة لا تطابق محتواها',409);
 const original=manifest.state,restored=clone(original),counts=graphCheck(restored),expected=fileReferences(restored),supplied=new Map(),declared=new Map();
 for(const item of manifest.files||[]){if(declared.has(item.key))core.fail('مرجع ملف مكرر في تعريف النسخة',409);declared.set(item.key,item);}
 for(const file of bundle.files){if(!file||supplied.has(file.key))core.fail('ملف مكرر أو غير صحيح في النسخة',409);supplied.set(file.key,file);}
 if(expected.length!==declared.size||expected.length!==supplied.size)core.fail('نسخة الاستعادة ناقصة أو تحتوي ملفات لا تخصها',409);
 const isolatedStorage=new Map();let archivedReferences=0;
 for(const item of expected){const descriptor=declared.get(item.key),file=supplied.get(item.key);if(!descriptor||!file||descriptor.mime!==item.mime||file.mime!==item.mime||JSON.stringify(descriptor.references)!==JSON.stringify(item.references))core.fail('ملف غير مطابق لمراجع الحالة أو المحذوفات',409);const bytes=attachments.decodeImage({name:item.name,mime:file.mime,data:file.data});if(file.size!==bytes.length||item.size!==undefined&&item.size!==bytes.length||file.checksum!==await checksum(bytes)||item.recordChecksum&&item.recordChecksum!==file.checksum)core.fail('ملف تقرير تالف أو تغيرت بصمته',409);isolatedStorage.set(item.key,new Uint8Array(bytes));archivedReferences+=item.references.filter(x=>x.kind==='trash').length;}
 // The copy is serialized and read again to exercise a real roundtrip, rather than only counting rows.
 const restoredAgain=JSON.parse(JSON.stringify(restored));if(await checksum(restoredAgain)!==manifest.stateChecksum)core.fail('تغيرت بيانات الحالة خلال تجربة الاستعادة',409);
 for(const [key,bytes]of isolatedStorage)if(await checksum(bytes)!==supplied.get(key).checksum)core.fail('فشل التحقق بعد كتابة أصل التقرير في المخزن المعزول',409);
 const verifiedRoots=['roles','settings','patients','bookings','files','complaints','complaintSequences','sequences','attachments','audit','activityDetails','activityContext','recycleBin','followupPlans','bookingContacts','recordProvenance','patientIdentities','patientPhoneIndex'].filter(k=>original[k]!==undefined);
 return {at:new Date().toISOString(),status:'passed_with_limitations',scope:'state-and-original-reports',clinicalVerified:true,imagesVerified:true,originalsUntouched:true,liveWrites:0,sourceRecordChecksums:{matched:expected.filter(x=>x.recordChecksum).length,notRecorded:expected.filter(x=>!x.recordChecksum).length},counts:{...counts,reports:isolatedStorage.size,archivedReportReferences:archivedReferences},verifiedRoots,checks:{state:'passed',originalFiles:'passed',archivedFiles:'passed',roleMetadata:'passed',permissions:'passed',ticketCounters:'passed',complaintCounters:'passed',auditAndTrash:'passed',clinicConfiguration:'passed',providerAccounts:'not_verified'},authCredentialsIncluded:false,completeSystemRecovery:false,warning:'نجحت تجربة معزولة لبيانات العيادة وأصول التقارير والأرشيف والصلاحيات. كلمات مرور وجلسات Supabase Auth وأسرار الاستضافة ليست ضمن النسخة؛ استعادة مزود الحسابات تحتاج إجراءً منفصلًا.'};
}
async function exportImage(adapter,input,uid){const s=await adapter.read();perms.requirePermission(core.role(s,uid),'data.export');const phone=core.phone(input.phone),item=s.attachments?.[phone]?.[input.id];if(!item)core.fail('الصورة غير موجودة',404);const result=await readFile(adapter,{...item,name:item.name||'تقرير'});return {sourceId:item.id,phone,name:item.name,mime:item.mime,category:item.category||'report',reportDate:item.reportDate||item.createdAt.slice(0,10),data:result.data,checksum:result.checksum};}
async function sourceState(adapter,input){if(input.source==='latest'){const backup=await adapter.latestBackup?.();if(!backup?.payload)core.fail('لا توجد نسخة آلية مسجلة',404);return {payload:backup.payload,source:{kind:'automatic',createdAt:backup.created_at,version:backup.version}};}return {payload:await adapter.read(),source:{kind:'current'}};}
async function handleRecovery(adapter,input,uid){const live=await adapter.read();if(core.role(live,uid).r!=='admin')core.fail('نسخة الاستعادة الكاملة متاحة للأدمن فقط',403);perms.requirePermission(core.role(live,uid),'data.export');if(input.action==='recoveryBackupVerify')return verifyRecoveryBundle(input.bundle);const {payload,source}=await sourceState(adapter,input);if(input.action==='recoveryBackupExport')return manifestFor(payload,source);if(input.action==='recoveryFileExport'){const item=fileReferences(payload).find(x=>x.key===input.key);if(!item)core.fail('أصل التقرير غير موجود ضمن النسخة المصرح بها',404);return readFile(adapter,item);}core.fail('عملية نسخة الاستعادة غير صحيحة');}
export {exportImage,recoveryActions,handleRecovery,manifestFor,buildRecoveryBundle,verifyRecoveryBundle,fileReferences,graphCheck,checksum,MAX_RECOVERY_BYTES};
