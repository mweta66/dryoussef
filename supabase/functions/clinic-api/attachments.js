import * as core from './core.js';
import * as perms from './permissions.js';
import * as cleanup from './storage-cleanup.js';
import * as cases from './cases.js';
const MAX_BYTES=600000,MAX_FILES=20,validId=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id);
function authorize(state,uid,phone,write=false){
 const role=core.role(state,uid);
 perms.requirePermission(role,write?'attachments.create':'attachments.read');
 if(!/^01[0125]\d{8}$/.test(phone)||!state.patients?.[phone])core.fail('الحالة غير موجودة',404);
 cases.assertAccess(state,role,phone);
 return role;
}
function decodeImage(input){
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120)core.fail('اسم التقرير مطلوب وحتى 120 حرفًا');
 if(!['image/jpeg','image/png','image/webp'].includes(input.mime)||typeof input.data!=='string'||!input.data.length||input.data.length>800000||input.data.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))core.fail('ارفع صورة JPG أو PNG أو WebP بالحجم المسموح');
 let bytes;try{bytes=Uint8Array.from(atob(input.data),c=>c.charCodeAt(0))}catch{core.fail('بيانات الصورة غير صحيحة')}
 if(bytes.length<12||bytes.length>MAX_BYTES)core.fail('الصورة يجب ألا تتجاوز 600 كيلوبايت بعد التجهيز');
 const match=input.mime==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):input.mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!match)core.fail('محتوى الصورة لا يطابق نوع الملف');return bytes;
}
async function handleAttachments(adapter,input,uid){
 const phone=core.phone(input.phone),write=input.action==='attachmentUpload';
 const state=await adapter.read(),role=authorize(state,uid,phone,write),records=state.attachments?.[phone]||{};
 if(input.action==='attachmentList')return Object.values(records).map(({key,byUid,...item})=>({...item,canDelete:perms.can(role,'attachments.delete')||byUid===uid&&perms.can(role,'attachments.own.delete')}));
 if(input.action==='attachmentUpload'){
  if(!adapter.uploadAttachment)core.fail('تخزين التقارير غير مهيأ',503);

  const bytes=decodeImage(input);if(input.category!==undefined&&!['report','lab','radiology','other'].includes(input.category))core.fail('تصنيف التقرير غير صحيح');const reportDate=core.date(input.reportDate||core.today());if(reportDate>core.today())core.fail('تاريخ التقرير لا يكون في المستقبل');let digest;
  if(input.restoreSourceId!==undefined){if(!perms.can(role,'data.restore')||!validId(input.restoreSourceId))core.fail('استعادة الصور لمدير النظام فقط',403);digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');const previous=Object.values(records).find(x=>(x.restoreSourceId||x.id)===input.restoreSourceId);if(previous){let same=previous.digest===digest;if(!same&&adapter.readAttachmentBytes){const original=await adapter.readAttachmentBytes(previous.key,previous.mime);same=original.data===input.data;}if(!same&&adapter.readAttachment){const original=await adapter.readAttachment(previous.key,previous.mime);same=original.data===input.data;}if(!same)core.fail('صورة الاستعادة تتعارض مع مرفق موجود',409);const {key,byUid,...item}=previous;return {...item,canDelete:true,restoredAlready:true};}}
  if(Object.keys(records).length>=MAX_FILES)core.fail('الحد الأقصى 20 صورة لكل حالة');
  const id=crypto.randomUUID(),record={id,key:id,name:input.name.trim(),mime:input.mime,size:bytes.length,createdAt:new Date().toISOString(),by:role.u,byUid:uid,category:input.category||'report',reportDate,...(input.restoreSourceId?{restoreSourceId:input.restoreSourceId,digest}:{})};
  await adapter.uploadAttachment(id,bytes,input.mime);
  try{await adapter.mutate(original=>{authorize(original,uid,phone,true);const s=structuredClone(original);s.attachments||={};const items=s.attachments[phone]||={};if(Object.keys(items).length>=MAX_FILES)core.fail('الحد الأقصى 20 صورة لكل حالة');items[id]=record;return s;});}
  catch(error){try{await adapter.deleteAttachment(id)}catch{}throw error;}
  const {key,byUid,...item}=record;return {...item,canDelete:perms.can(role,'attachments.delete')||perms.can(role,'attachments.own.delete')};
 }
 if(!validId(input.id)||!records[input.id])core.fail('الصورة غير موجودة',404);
 const item=records[input.id];if(!validId(item.key))core.fail('معرف المرفق غير صحيح',400);
 if(input.action==='attachmentRead'){
  if(!adapter.readAttachment)core.fail('تخزين التقارير غير مهيأ',503);
  return {...await adapter.readAttachment(item.key,item.mime),name:item.name,mime:item.mime};
 }
 if(input.action==='attachmentDelete'){
  if(!perms.can(role,'attachments.delete')&&!(item.byUid===uid&&perms.can(role,'attachments.own.delete')))core.fail('يمكن للممرضة حذف الصور التي رفعتها فقط',403);
  await adapter.mutate(original=>{const currentRole=authorize(original,uid,phone);const s=structuredClone(original);const current=s.attachments?.[phone]?.[input.id];if(current){if(!perms.can(currentRole,'attachments.delete')&&!(current.byUid===uid&&perms.can(currentRole,'attachments.own.delete')))core.fail('ليس لديك صلاحية حذف هذه الصورة',403);cleanup.enqueue(s,{[input.id]:current});delete s.attachments[phone][input.id];}return s;});
  return {ok:true,cleanupPending:await cleanup.drain(adapter)};
 }
 core.fail('عملية مرفقات غير مسموحة',403);
}
export {handleAttachments,decodeImage};
