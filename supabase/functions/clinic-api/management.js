import {Buffer} from 'node:buffer';
import * as perms from './permissions.js';
import * as cases from './cases.js';
import * as branchConfig from './branches.js';
import * as designOptions from './design-options.js';
function site(value,fail){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('بيانات الموقع غير صحيحة');
 const result={};for(const k of ['doctorName','specialty','clinicName','bookingPhone','emergencyPhone','about','footer','headerTitle','headerSubtitle','headerText']){
  if(value[k]!==undefined){if(typeof value[k]!=='string'||value[k].length>(['about','footer','headerTitle','headerSubtitle','headerText'].includes(k)?2000:160))fail('النص طويل أو غير صحيح');result[k]=value[k];}
 }
 for(const k of ['bookingPhone','emergencyPhone'])if(result[k]&&!/^\+?[0-9]{7,15}$/.test(result[k]))fail('رقم الهاتف غير صحيح');
 result.branches={};for(const b of Object.keys(value.branches||{})){if(!branchConfig.validId(b))fail('رمز فرع غير صحيح');const x=value.branches?.[b];if(!x)continue;result.branches[b]={};for(const k of ['name','address','phone']){if(typeof x[k]!=='string'||x[k].length>300)fail('بيانات الفرع غير صحيحة');result.branches[b][k]=x[k];}if(x.phone&&!/^\+?[0-9]{7,15}$/.test(x.phone))fail('هاتف الفرع غير صحيح');}
 const d=value.design||{};result.design=designOptions.validate(d);for(const k of ['primary','background','text','accent','card']){if(d[k]!==undefined){if(!/^#[0-9a-f]{6}$/i.test(d[k]))fail('لون غير صحيح');result.design[k]=d[k];}}
 for(const [k,min,max] of [['radius',0,40],['width',600,1200],['fontSize',14,22]])if(d[k]!==undefined){if(!Number.isInteger(d[k])||d[k]<min||d[k]>max)fail('قيمة تصميم غير صحيحة');result.design[k]=d[k];}
 if(d.showBackground!==undefined){if(typeof d.showBackground!=='boolean')fail('خيار الخلفية غير صحيح');result.design.showBackground=d.showBackground;}
 for(const k of ['logo','doctorPhoto'])if(d[k]!==undefined){
  if(d[k]===''){result.design[k]='';continue;}
  const match=String(d[k]).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);if(!match)fail('الصورة يجب أن تكون PNG أو JPEG أو WebP');
  const bytes=Buffer.from(match[2],'base64');if(bytes.length>200000||bytes.length<12)fail('حجم الصورة غير مناسب');
  const good=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!good)fail('محتوى الصورة غير صحيح');result.design[k]=d[k];
 }
 return result;
}
function mutate(original,uid,input,core){
 const s=structuredClone(original),r=core.role(s,uid);
 if(input.action==='siteSave'){perms.requirePermission(r,'site.manage');s.settings||={};const nextSite=site(input.site,core.fail);if(JSON.stringify(s.settings.site?.design)!==JSON.stringify(nextSite.design))s.settings.previousDesign=structuredClone(s.settings.site?.design||{});s.settings.site=nextSite;if(s.settings.branches)for(const [b,x]of Object.entries(s.settings.site.branches)){if(s.settings.branches[b])s.settings.branches[b]={...s.settings.branches[b],...x};}return s;}
 if(input.action==='userSave'){
  perms.requirePermission(r,'users.manage');if(!s.roles[input.uid])core.fail('المستخدم غير موجود',404);
  const next=perms.validateRole(input.role,core.fail,core.branchIds(s));if(next.u!==s.roles[input.uid].u)core.fail('اسم الدخول ثابت؛ يمكنك تعديل الاسم الظاهر');
  if(s.roles[input.uid].r==='admin'&&(next.r!=='admin'||next.enabled===false)&&!Object.entries(s.roles).some(([id,x])=>id!==input.uid&&x.r==='admin'&&x.enabled!==false))core.fail('يجب إبقاء حساب مدير فعال واحد على الأقل');
  if(s.roles[input.uid].r==='doctor'&&(next.r!=='doctor'||next.enabled===false)&&!Object.entries(s.roles).some(([id,x])=>id!==input.uid&&x.r==='doctor'&&x.enabled!==false))core.fail('يجب إبقاء حساب طبيب فعال واحد على الأقل');
  s.roles[input.uid]=next;return s;
 }
 if(input.action==='patientSave'){
  perms.requirePermission(r,'patients.edit');cases.indexPatients(s);const p=core.phone(input.phone),to=core.phone(input.newPhone||p),name=String(input.name||'').trim();
  if(!/^01[0125]\d{8}$/.test(p)||!/^01[0125]\d{8}$/.test(to)||!name||name.length>120)core.fail('راجع اسم الحالة والهاتف');
  if(p!==to&&s.patients[to])core.fail('رقم الهاتف الجديد مستخدم لحالة أخرى',409);
  s.patients[to]={n:name,d:s.patients[p]?.d||core.today()};if(p!==to)delete s.patients[p];
  for(const rows of Object.values(s.bookings||{}))for(const x of Object.values(rows))if(x.phone===p){x.phone=to;x.name=name;x.rev=(x.rev||0)+1;}
  if(p!==to)for(const kind of ['files','complaints','followups'])if(s[kind]?.[p]){s[kind][to]=s[kind][p];delete s[kind][p];}
  for(const n of Object.values(s.inbox||{}))if(n.p===p){n.p=to;n.n=name;}core.rebuild(s);return s;
 }
 if(input.action==='patientDelete'){
  perms.requirePermission(r,'patients.delete');const p=core.phone(input.phone);if(!/^01[0125]\d{8}$/.test(p))core.fail('هاتف غير صحيح');
  for(const rows of Object.values(s.bookings||{}))for(const [id,x] of Object.entries(rows))if(x.phone===p)delete rows[id];
  for(const [id,x] of Object.entries(s.deletedBookings||{}))if(x.booking.phone===p)delete s.deletedBookings[id];
  for(const kind of ['patients','files','complaints','followups'])delete s[kind]?.[p];for(const [id,x] of Object.entries(s.inbox||{}))if(x.p===p)delete s.inbox[id];core.rebuild(s);return s;
 }
 if(input.action==='dataClear'){
  perms.requirePermission(r,'data.delete');if(input.confirmation!=='DELETE_CLINIC_DATA')core.fail('تأكيد الحذف مطلوب');
  for(const kind of ['bookings','patients','files','complaints','inbox','track','deletedBookings','sessions','followups'])s[kind]={};return s;
 }
 core.fail('عملية غير مسموحة',403);
}
export {mutate,site};
