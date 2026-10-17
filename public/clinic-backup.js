/* A complete portable backup contains clinical JSON plus the actual private images. */
async function downloadCompleteBackup(){
 const error=await guard(async()=>{
  const snapshot=await gateway('exportData',{},true),images=[];let bytes=new TextEncoder().encode(JSON.stringify(snapshot)).length;
  for(const [phone,items]of Object.entries(snapshot.attachments||{}))for(const item of Object.values(items)){
   notify('تنزيل صور النسخة الاحتياطية: '+(images.length+1));const image=await gateway('attachmentExport',{phone,id:item.id},true);bytes+=image.data.length;
   if(bytes>64000000)throw Error('النسخة أكبر من 64 ميجابايت. لم يتم تنزيل نسخة ناقصة؛ تواصل مع الإدارة لتصدير أرشيف التخزين.');images.push(image);
  }
  const latest=await gateway('exportData',{},true);if(JSON.stringify(latest.attachments)!==JSON.stringify(snapshot.attachments))throw Error('تغيرت صور التقارير أثناء التنزيل. أعد إنشاء النسخة للاحتفاظ بنسخة متسقة.');
  const bundle={format:'clinic-complete-backup',schemaVersion:1,exportedAt:snapshot.exportedAt,clinic:snapshot,images};const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='clinic-complete-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 },'تم تنزيل نسخة كاملة بالصور');if(error)notify(error);
}
function validateCompleteBackup(bundle){
 if(bundle?.format!=='clinic-complete-backup'||bundle.schemaVersion!==1||!bundle.clinic||!Array.isArray(bundle.images)||bundle.images.length>1000)throw Error('نسخة كاملة غير صحيحة');
 const expected=new Map();for(const [phone,items]of Object.entries(bundle.clinic.attachments||{}))for(const item of Object.values(items))expected.set(phone+'|'+item.id,item);
 if(expected.size!==bundle.images.length)throw Error('النسخة غير مكتملة: عدد الصور لا يطابق سجلات المرفقات');
 const seen=new Set();for(const image of bundle.images){const id=image.phone+'|'+image.sourceId,item=expected.get(id);if(!item||seen.has(id)||!bundle.clinic.patients?.[image.phone]||image.name!==item.name||image.mime!==item.mime||typeof image.data!=='string'||!image.data.length||image.data.length>800000)throw Error('صورة في النسخة غير مطابقة لبيانات الحالة');seen.add(id);}
 const clinic={...bundle.clinic};delete clinic.attachments;return {clinic,images:bundle.images};
}
if(typeof module==='object'&&module.exports)module.exports={validateCompleteBackup};
