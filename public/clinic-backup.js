/* A portable backup contains clinical JSON and the actual private report files. */
function backupArchiveTools(){return typeof ClinicBackupArchive!=='undefined'?ClinicBackupArchive:require('./clinic-backup-archive.js');}
function downloadBackupFile(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function showSplitBackupDownloads(archive,encrypted,password){
 const files=[{name:'clinic-'+archive.manifest.archiveId+'-manifest.json',value:archive.manifest},...archive.parts.map((value,i)=>({name:archive.manifest.parts[i].fileName,value}))];
 if(encrypted)for(const file of files)file.value=await ClinicBackupCrypto.encrypt(file.value,password);
 openForm('حفظ أجزاء النسخة الاحتياطية',[],()=>{});const box=document.querySelector('.mod');box.replaceChildren();
 const title=document.createElement('h3');title.id='modal-title';title.textContent='نسخة مقسمة إلى '+files.length+' ملفات';box.append(title);
 const hint=document.createElement('p');hint.textContent='احفظ ملف التعريف وكل الأجزاء في مجلد آمن. للاستعادة اختر ملف التعريف مع الأجزاء. يمكنك استعادة أجزاء محددة ثم استكمال الباقي لاحقًا دون تكرار المرفقات.';box.append(hint);
 if(encrypted){const warning=document.createElement('p');warning.className='hint';warning.textContent='كل الملفات مشفرة بنفس كلمة التشفير؛ احتفظ بها خارج ملفات النسخة.';box.append(warning);}
 files.forEach((file,index)=>{const b=document.createElement('button');b.type='button';b.className='btn x';b.textContent=index?'تنزيل الجزء '+index:'تنزيل ملف التعريف الأساسي';b.onclick=()=>{downloadBackupFile(file.value,file.name);b.textContent=(index?'الجزء '+index:'ملف التعريف')+' — طُلب تنزيله';};box.append(b);});
 const close=document.createElement('button');close.className='btn';close.textContent='إغلاق';close.onclick=closeM;box.append(close);
}
async function downloadCompleteBackup(encrypted=false,forceSplit=false){
 const error=await guard(async()=>{
  let password;if(encrypted){password=prompt('كلمة تشفير لا تقل عن 12 حرفًا. احتفظ بها؛ لا يمكن استعادة النسخة بدونها.');if(password===null)return;if(password!==prompt('أعد كتابة كلمة التشفير'))throw Error('كلمتا التشفير غير متطابقتين');if(password.length<12)throw Error('كلمة التشفير لا تقل عن 12 حرفًا');}
  const tools=backupArchiveTools(),snapshot=await gateway('exportData',{},true),images=[];let bytes=tools.bytes(snapshot);
  for(const [phone,items]of Object.entries(snapshot.attachments||{}))for(const item of Object.values(items)){
   notify('تجهيز مرفقات النسخة: '+(images.length+1));const image=await gateway('attachmentExport',{phone,id:item.id},true);bytes+=tools.bytes(image);
   if(bytes>tools.MAX_ARCHIVE_BYTES)throw Error('النسخة أكبر من 256 ميجابايت؛ لم تُنزّل نسخة ناقصة.');images.push(image);
  }
  const latest=await gateway('exportData',{},true);if(JSON.stringify(latest.attachments)!==JSON.stringify(snapshot.attachments))throw Error('تغيرت التقارير أثناء التنزيل. أعد تجهيز النسخة لضمان اكتمالها.');
  if(forceSplit||bytes>tools.MAX_PART_BYTES){await showSplitBackupDownloads(await tools.buildArchive(snapshot,images),encrypted,password);return;}
  let output={format:'clinic-complete-backup',schemaVersion:1,exportedAt:snapshot.exportedAt,clinic:snapshot,images};tools.validateCompleteBackup(output);if(encrypted)output=await ClinicBackupCrypto.encrypt(output,password);downloadBackupFile(output,(encrypted?'clinic-encrypted-backup-':'clinic-complete-backup-')+today()+'.json');
 },'تم تجهيز النسخة الاحتياطية');if(error)notify(error);
}
function validateCompleteBackup(bundle){return backupArchiveTools().validateCompleteBackup(bundle);}
if(typeof module==='object'&&module.exports)module.exports={validateCompleteBackup};
