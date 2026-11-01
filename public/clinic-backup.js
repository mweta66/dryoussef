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

/* A recovery bundle also preserves audit/trash/identity and the original private reports. */
const RECOVERY_MAX_BYTES=256000000,RECOVERY_PART_BYTES=8000000;
function recoveryJsonBytes(value){return new TextEncoder().encode(JSON.stringify(value)).length;}
async function recoveryChecksum(value){const bytes=value instanceof Uint8Array?value:new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function recoveryBytes(file){if(!file||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mime)||typeof file.data!=='string'||file.data.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(file.data))throw Error('صيغة أصل التقرير غير صحيحة');const maximum=file.mime==='application/pdf'?5000000:600000;if(file.data.length>Math.ceil(maximum/3)*4)throw Error('أصل التقرير يتجاوز الحد المسموح');return Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));}
function recoveryReferencedKeys(state){const found=new Set();function visit(value){if(!value||typeof value!=='object')return;if(value.key&&value.id&&value.mime){found.add(value.key);return}for(const x of Object.values(value))visit(x)}visit(state?.attachments);for(const group of Object.values(state?.recycleBin||{}))for(const item of group.items||[])if(item.path?.[0]==='attachments')visit(item.before);return found;}
async function verifyRecoveryTransport(bundle){
 if(bundle?.format!=='clinic-recovery-backup'||bundle.schemaVersion!==1||bundle.manifest?.format!=='clinic-recovery-manifest'||bundle.manifest.schemaVersion!==1||!bundle.manifest.state||!Array.isArray(bundle.manifest.files)||!Array.isArray(bundle.files)||recoveryJsonBytes(bundle)>RECOVERY_MAX_BYTES)throw Error('نسخة الاستعادة الكاملة غير صحيحة أو أكبر من الحد المسموح');
 const manifest=bundle.manifest;if(await recoveryChecksum(manifest.state)!==manifest.stateChecksum)throw Error('بصمة بيانات النسخة لا تطابق محتواها');const expected=recoveryReferencedKeys(manifest.state),files=new Map(),declared=new Map();
 for(const item of manifest.files){if(!item?.key||declared.has(item.key))throw Error('تعريف تقرير مكرر أو غير صحيح');declared.set(item.key,item)}for(const file of bundle.files){if(!file?.key||files.has(file.key))throw Error('أصل تقرير مكرر أو غير صحيح');files.set(file.key,file)}if(expected.size!==files.size||expected.size!==declared.size)throw Error('النسخة لا تضم كل أصول التقارير النشطة والمؤرشفة');
 for(const key of expected){const file=files.get(key),descriptor=declared.get(key);if(!file||!descriptor||file.mime!==descriptor.mime)throw Error('أصل التقرير لا يطابق تعريفه');const bytes=recoveryBytes(file);if(bytes.length!==file.size||descriptor.size!==undefined&&descriptor.size!==bytes.length||await recoveryChecksum(bytes)!==file.checksum||descriptor.recordChecksum&&descriptor.recordChecksum!==file.checksum)throw Error('تغيرت بيانات تقرير أو بصمته أثناء التنزيل');}
 return {status:'passed',scope:'local-transport-checksums',reports:files.size,stateChecksum:manifest.stateChecksum,authCredentialsIncluded:false,completeSystemRecovery:false};
}
async function recoveryDownloadFiles(bundle,maxPartBytes=RECOVERY_PART_BYTES){
 await verifyRecoveryTransport(bundle);const archiveId=crypto.randomUUID();if(recoveryJsonBytes(bundle)<=maxPartBytes)return [{name:'clinic-recovery-'+archiveId+'.json',value:bundle}];
 const manifestName='clinic-recovery-'+archiveId+'-state.json',files=[{name:manifestName,value:bundle.manifest}],parts=[];let current=[];
 const flush=()=>{if(!current.length)return;const index=parts.length,part={format:'clinic-recovery-file-part',schemaVersion:1,archiveId,index,files:current};parts.push({name:'clinic-recovery-'+archiveId+'-files-'+(index+1)+'.json',value:part});current=[]};
 for(const file of bundle.files){if(current.length&&recoveryJsonBytes({files:[...current,file]})>maxPartBytes)flush();current.push(file);}flush();
 const index={format:'clinic-recovery-index',schemaVersion:1,archiveId,exportedAt:bundle.manifest.exportedAt,state:{fileName:manifestName,checksum:await recoveryChecksum(bundle.manifest)},parts:[]};for(const part of parts)index.parts.push({fileName:part.name,index:part.value.index,checksum:await recoveryChecksum(part.value),count:part.value.files.length});
 return [{name:'clinic-recovery-'+archiveId+'-index.json',value:index},...files,...parts];
}
async function joinRecoveryDownloadFiles(files){
 const standalone=files.find(x=>x.value?.format==='clinic-recovery-backup');if(standalone){if(files.length!==1)throw Error('اختر نسخة واحدة فقط أو مجموعة أجزاء واحدة');await verifyRecoveryTransport(standalone.value);return standalone.value;}
 const indexes=files.filter(x=>x.value?.format==='clinic-recovery-index');if(indexes.length!==1)throw Error('اختر ملف التعريف وكل أجزاء نسخة واحدة');const index=indexes[0].value;if(index.schemaVersion!==1||!index.state||!Array.isArray(index.parts))throw Error('تعريف أجزاء النسخة غير صحيح');const map=new Map(files.map(x=>[x.name,x.value]));if(map.size!==files.length||files.length!==index.parts.length+2)throw Error('ملفات مكررة أو أجزاء ناقصة/إضافية');const manifest=map.get(index.state.fileName);if(!manifest||await recoveryChecksum(manifest)!==index.state.checksum)throw Error('ملف حالة النسخة مفقود أو تغيرت بصمته');const parts=[];for(const descriptor of index.parts){const part=map.get(descriptor.fileName);if(!part||part.format!=='clinic-recovery-file-part'||part.schemaVersion!==1||part.archiveId!==index.archiveId||part.index!==descriptor.index||!Array.isArray(part.files)||part.files.length!==descriptor.count||await recoveryChecksum(part)!==descriptor.checksum)throw Error('جزء من أصول التقارير مفقود أو غير مطابق');parts.push(...part.files)}const bundle={format:'clinic-recovery-backup',schemaVersion:1,manifest,files:parts};await verifyRecoveryTransport(bundle);return bundle;
}
function showRecoveryDownloads(files){
 openForm('حفظ نسخة الاستعادة الكاملة',[],()=>{});const box=document.querySelector('.mod');box.replaceChildren();const title=document.createElement('h3');title.id='modal-title';title.textContent='نسخة الاستعادة الكاملة';box.append(title);const hint=document.createElement('p');hint.textContent='احفظ كل الملفات في مجلد خاص واحد. تم التحقق من بصمة بيانات العيادة والتقارير النشطة والمؤرشفة قبل تجهيزها. كلمات مرور وجلسات Supabase وأسرار الاستضافة غير مشمولة؛ استعادة مزود الحسابات تحتاج إجراءً منفصلًا.';box.append(hint);for(const file of files){const button=document.createElement('button');button.type='button';button.className='btn x';button.textContent='تنزيل '+file.name;button.onclick=()=>{downloadBackupFile(file.value,file.name);button.textContent='طُلب تنزيل '+file.name};box.append(button)}const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='إغلاق';close.onclick=closeM;box.append(close);
}
async function downloadRecoveryBackup(encrypted=false){
 if(me?.role!=='admin'){notify('نسخة الاستعادة الكاملة للأدمن فقط');return;}
 const error=await guard(async()=>{let password;if(encrypted){password=prompt('كلمة تشفير من 12 إلى 256 حرفًا. احتفظ بها خارج ملفات النسخة.');if(password===null)return;if(password!==prompt('أعد كتابة كلمة التشفير'))throw Error('كلمتا التشفير غير متطابقتين');if(password.length<12||password.length>256)throw Error('كلمة التشفير من 12 إلى 256 حرفًا');}
 const manifest=await gateway('recoveryBackupExport',{source:'current'},true),bundle={format:'clinic-recovery-backup',schemaVersion:1,manifest,files:[]};let size=recoveryJsonBytes(manifest);for(const descriptor of manifest.files){notify('تجهيز أصل التقرير '+(bundle.files.length+1)+' من '+manifest.files.length);const file=await gateway('recoveryFileExport',{key:descriptor.key,source:'current'},true);size+=recoveryJsonBytes(file);if(size>RECOVERY_MAX_BYTES)throw Error('النسخة أكبر من 256 ميجابايت؛ لم يتم تجهيز نسخة ناقصة');bundle.files.push(file)}
 const files=await recoveryDownloadFiles(bundle);if(encrypted){if(!window.ClinicBackupCrypto)throw Error('أداة التشفير لم تحمل؛ أعد فتح الصفحة');for(const file of files)file.value=await ClinicBackupCrypto.encrypt(file.value,password)}showRecoveryDownloads(files);
 },'تم تجهيز ملفات نسخة الاستعادة والتحقق من بصماتها');if(error)notify(error);
}
async function runCurrentRecoveryRehearsal(){
 if(me?.role!=='admin'){notify('تجربة الاستعادة الكاملة للأدمن فقط');return;}try{notify('جارٍ فحص استعادة الحالة وأصول التقارير في نسخة معزولة…');const result=await gateway('backupRehearsal',{source:'current'},true);window.ClinicLastRecoveryCheck=result;const target=document.getElementById('backup-rehearsal-status');if(target)target.textContent='آخر تجربة في هذه الجلسة: '+result.at+' · '+result.counts.reports+' أصل تقرير · '+result.warning;notify(result.imagesVerified?'نجحت تجربة بيانات العيادة وأصول التقارير. حسابات مزود الخدمة وأسراره تحتاج استعادة منفصلة.':'اكتمل فحص JSON؛ تحقق من نتيجة أصول التقارير.')}catch(e){notify(errMsg(e))}
}
function verifyDownloadedRecoveryBackup(){
 if(me?.role!=='admin'){notify('فحص نسخة الاستعادة للأدمن فقط');return;}const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.multiple=true;input.onchange=async()=>{try{const picked=[...input.files];if(!picked.length)return;if(picked.reduce((n,file)=>n+file.size,0)>RECOVERY_MAX_BYTES*1.5)throw Error('مجموعة الملفات أكبر من حد الفحص');const files=[];let password;for(const file of picked){let value;try{value=JSON.parse(await file.text())}catch{throw Error('ملف JSON غير صالح: '+file.name)}if(value.format==='clinic-encrypted-backup'){if(password===undefined)password=prompt('كلمة تشفير النسخة');if(password===null)return;if(!window.ClinicBackupCrypto)throw Error('أداة فك التشفير غير متاحة');value=await ClinicBackupCrypto.decrypt(value,password)}files.push({name:file.name,value})}const bundle=await joinRecoveryDownloadFiles(files);await verifyRecoveryTransport(bundle);notify('تطابقت بصمات بيانات النسخة وأصول التقارير. هذا فحص محلي للملفات فقط؛ لم تُستورد أو تُستبدل أي بيانات.')}catch(e){notify(errMsg(e))}};input.click();
}
if(typeof module==='object'&&module.exports)Object.assign(module.exports,{verifyRecoveryTransport,recoveryDownloadFiles,joinRecoveryDownloadFiles,recoveryChecksum,RECOVERY_MAX_BYTES});
