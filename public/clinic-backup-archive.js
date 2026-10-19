/* Portable archive validation; shared by the browser and local regression tests. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ClinicBackupArchive=factory();})(globalThis,function(){
 const MAX_PART_BYTES=8000000,MAX_ARCHIVE_BYTES=256000000;
 const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
 async function checksum(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
 function expectedImages(clinic){
  if(!clinic||!clinic.patients||typeof clinic.patients!=='object')throw Error('بيانات العيادة غير صحيحة');
  const expected=new Map();for(const [phone,items]of Object.entries(clinic.attachments||{}))for(const item of Object.values(items)){if(!item||typeof item.id!=='string'||expected.has(phone+'|'+item.id))throw Error('معرف مرفق غير صحيح أو مكرر');expected.set(phone+'|'+item.id,item);}return expected;
 }
 function checkImages(clinic,images,expected,seen){
  if(!Array.isArray(images))throw Error('قائمة المرفقات غير صحيحة');
  for(const image of images){
   const key=image?.phone+'|'+image?.sourceId,item=expected.get(key),maximum=image?.mime==='application/pdf'?6666668:800000;
   if(!item||seen.has(key)||!clinic.patients[image.phone]||image.name!==item.name||image.mime!==item.mime||!['image/jpeg','image/png','image/webp','application/pdf'].includes(image.mime)||typeof image.data!=='string'||!image.data.length||image.data.length>maximum||image.data.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data))throw Error('مرفق في النسخة غير مطابق أو مكرر أو أكبر من الحد المسموح');
   seen.add(key);
  }
 }
 function clinicalData(clinic){const out={...clinic};delete out.attachments;return out;}
 function validateCompleteBackup(bundle){
  if(bundle?.format!=='clinic-complete-backup'||bundle.schemaVersion!==1||!Array.isArray(bundle.images))throw Error('نسخة كاملة غير صحيحة');
  const expected=expectedImages(bundle.clinic),seen=new Set();checkImages(bundle.clinic,bundle.images,expected,seen);
  if(expected.size!==seen.size)throw Error('النسخة غير مكتملة: عدد المرفقات لا يطابق سجلاتها');
  return {clinic:clinicalData(bundle.clinic),images:bundle.images};
 }
 async function buildArchive(clinic,images,{partBytes=MAX_PART_BYTES,archiveId=crypto.randomUUID()}={}){
  if(!Number.isInteger(partBytes)||partBytes<1000||partBytes>MAX_PART_BYTES)throw Error('حجم جزء النسخة غير صحيح');
  validateCompleteBackup({format:'clinic-complete-backup',schemaVersion:1,clinic,images});if(bytes(clinicalData(clinic))>8000000)throw Error('البيانات الطبية وحدها تتجاوز 8 ميجابايت؛ صدّر الحالات على مجموعات أصغر قبل تجهيز المرفقات');
  const parts=[];let part={format:'clinic-backup-part',schemaVersion:2,archiveId,index:1,images:[]},size=bytes(part);
  for(const image of images){const imageBytes=bytes(image)+1;if(imageBytes+200>partBytes)throw Error('أحد المرفقات أكبر من حجم الجزء المسموح');if(part.images.length&&size+imageBytes>partBytes){parts.push(part);part={format:'clinic-backup-part',schemaVersion:2,archiveId,index:parts.length+1,images:[]};size=bytes(part);}part.images.push(image);size+=imageBytes;}
  if(part.images.length)parts.push(part);
  const descriptors=[];for(const p of parts)descriptors.push({index:p.index,fileName:'clinic-'+archiveId+'-part-'+String(p.index).padStart(3,'0')+'.json',count:p.images.length,checksum:await checksum(p)});
  const manifest={format:'clinic-backup-manifest',schemaVersion:2,archiveId,exportedAt:clinic.exportedAt,clinic,parts:descriptors};
  if(bytes(manifest)+parts.reduce((sum,x)=>sum+bytes(x),0)>MAX_ARCHIVE_BYTES)throw Error('النسخة تتجاوز 256 ميجابايت؛ قسّم التصدير إلى أرشيفات أصغر');
  return {manifest,parts};
 }
 async function validateArchive(manifest,parts){
  if(manifest?.format!=='clinic-backup-manifest'||manifest.schemaVersion!==2||!/^[0-9a-f-]{36}$/.test(manifest.archiveId||'')||!Array.isArray(manifest.parts)||manifest.parts.length>1000||!Array.isArray(parts))throw Error('ملف تعريف النسخة المقسمة غير صحيح');
  const expected=expectedImages(manifest.clinic),seen=new Set(),indexes=new Set(),descriptors=new Map();let count=0,totalBytes=bytes(manifest);
  for(const descriptor of manifest.parts){if(!Number.isInteger(descriptor.index)||descriptor.index<1||descriptor.index>manifest.parts.length||descriptors.has(descriptor.index)||!Number.isInteger(descriptor.count)||descriptor.count<1||!/^[a-f0-9]{64}$/.test(descriptor.checksum||''))throw Error('قائمة أجزاء النسخة غير صحيحة');descriptors.set(descriptor.index,descriptor);count+=descriptor.count;}
  if(count!==expected.size)throw Error('أعداد المرفقات في تعريف النسخة غير متطابقة');
  const images=[];for(const part of parts){
   if(part?.format!=='clinic-backup-part'||part.schemaVersion!==2||part.archiveId!==manifest.archiveId||indexes.has(part.index)||!descriptors.has(part.index)||!Array.isArray(part.images))throw Error('جزء مكرر أو تابع لنسخة أخرى');
   const descriptor=descriptors.get(part.index);if(part.images.length!==descriptor.count||await checksum(part)!==descriptor.checksum)throw Error('جزء تالف أو تغير محتواه: '+part.index);
   if(bytes(part)>MAX_PART_BYTES)throw Error('أحد أجزاء النسخة أكبر من 8 ميجابايت');totalBytes+=bytes(part);if(totalBytes>MAX_ARCHIVE_BYTES)throw Error('الأجزاء أكبر من 256 ميجابايت');
   checkImages(manifest.clinic,part.images,expected,seen);indexes.add(part.index);images.push(...part.images);
  }
  if(!parts.length&&manifest.parts.length)throw Error('اختر ملف تعريف النسخة ومعه جزء واحد على الأقل');
  if(parts.length===manifest.parts.length&&seen.size!==expected.size)throw Error('النسخة غير مكتملة');
  return {clinic:clinicalData(manifest.clinic),images,partial:indexes.size<manifest.parts.length,selectedParts:indexes.size,totalParts:manifest.parts.length,archiveId:manifest.archiveId,manifest};
 }
 function restoreProgress(manifest,attachments){const expected=expectedImages(manifest.clinic),present=new Set();for(const [phone,items]of Object.entries(attachments||{}))for(const item of Object.values(items)){const key=phone+'|'+(item.restoreSourceId||item.id),original=expected.get(key);if(original&&original.name===item.name&&original.mime===item.mime)present.add(key);}return {present:present.size,total:expected.size,complete:present.size===expected.size};}
 return {MAX_PART_BYTES,MAX_ARCHIVE_BYTES,bytes,checksum,validateCompleteBackup,buildArchive,validateArchive,restoreProgress};
});
