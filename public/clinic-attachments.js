/* Private patient reports. Never put image content in shared caches. */
function canUsePatientReports(){return !!me&&can('attachments.read');}
function canUploadPatientReports(){return canUsePatientReports()&&can('attachments.create');}
function reportPanel(phone){
 const panel=document.createElement('section');panel.className='patient-reports';panel.dataset.phone=phone;
 const title=document.createElement('h3');title.textContent='تقارير وصور الحالة';panel.append(title);
 if(canUploadPatientReports()){
  const label=document.createElement('label'),input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,application/pdf';input.id='patient-report-file';label.htmlFor=input.id;label.textContent='إضافة تقرير PDF أو صورة تحليل';panel.append(label,input);
  const caption=document.createElement('input');caption.type='text';caption.id='patient-report-name';caption.maxLength=120;caption.placeholder='اسم التقرير (اختياري)';caption.setAttribute('aria-label','اسم التقرير');panel.append(caption);
  const category=document.createElement('select');category.id='patient-report-category';category.setAttribute('aria-label','نوع التقرير');for(const [value,name]of [['report','تقرير'],['lab','تحليل'],['radiology','أشعة'],['other','أخرى']])category.add(new Option(name,value));panel.append(category);const date=document.createElement('input');date.id='patient-report-date';date.type='date';date.value=today();date.max=today();date.setAttribute('aria-label','تاريخ التقرير');panel.append(date);
  const hint=document.createElement('p');hint.className='hint';hint.textContent='PDF أصلي حتى 5 ميجابايت، أو صور JPG وPNG وWebP تُجهز حتى 600 كيلوبايت. حتى 20 مرفقًا لكل حالة. يتم تنزيل PDF دون تضمينه داخل الصفحة.';panel.append(hint);
  input.onchange=()=>uploadPatientReport(phone,input,caption,panel);
 }
 const status=document.createElement('p');status.className='hint';status.setAttribute('role','status');status.dataset.reportStatus='';panel.append(status);
 const list=document.createElement('div');list.className='patient-report-list';panel.append(list);
 loadPatientReports(phone,panel);return panel;
}
async function loadPatientReports(phone,panel){
 const status=panel.querySelector('[data-report-status]'),list=panel.querySelector('.patient-report-list');status.textContent='جارٍ تحميل التقارير…';
 try{const items=await gateway('attachmentList',{phone},true);if(!panel.isConnected)return;list.replaceChildren();status.textContent=items.length?'':'لا توجد مرفقات لهذه الحالة.';
  for(const item of items){const card=document.createElement('div');card.className='patient-report-item';const title=document.createElement('b');title.textContent=item.name;card.append(title);const meta=document.createElement('small');meta.textContent=({report:'تقرير',lab:'تحليل',radiology:'أشعة',other:'أخرى'}[item.category]||'تقرير')+' · '+(item.reportDate||'')+' · '+new Date(item.createdAt).toLocaleDateString('ar-EG')+' · '+item.by;card.append(meta);
   const show=document.createElement('button');show.type='button';show.className='btn sm';show.textContent=item.mime==='application/pdf'?'تنزيل PDF':'عرض الصورة';show.onclick=()=>viewPatientReport(phone,item,card,status);card.append(show);
   if(canUploadPatientReports()&&item.canDelete){const remove=document.createElement('button');remove.type='button';remove.className='btn sm r';remove.textContent='حذف';remove.onclick=async()=>{if(!confirm('نقل صورة التقرير إلى سلة المحذوفات؟ يستطيع الأدمن استعادتها.'))return;const error=await guard(async()=>{const result=await gateway('attachmentDelete',{phone,id:item.id},true);if(result.cleanupPending)notify('حذف الصورة مسجل ويحتاج استكمالًا من شاشة الاتصال والنسخ الاحتياطي');await loadPatientReports(phone,panel)},'تم حذف الصورة');if(error)status.textContent=error};card.append(remove)}list.append(card);
  }
 }catch(e){status.textContent=errMsg(e)}
}
async function preparePatientImage(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000)throw Error('اختر صورة JPG أو PNG أو WebP لا تزيد عن 10 ميجابايت');
 let bitmap;try{bitmap=await createImageBitmap(file)}catch{throw Error('تعذر قراءة الصورة؛ قد يكون الملف تالفًا. اختر الصورة الأصلية السليمة.')}try{
  if(bitmap.width*bitmap.height>40000000)throw Error('أبعاد الصورة كبيرة جدًا');
  const ratio=Math.min(1,2000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.9,.8,.7]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=600000)return {data:await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('تعذر قراءة الصورة'));reader.readAsDataURL(blob)}),mime:'image/jpeg'};}
  throw Error('الصورة أكبر من الحجم المسموح. ارفع صورة منفصلة أو قص المنطقة المطلوبة مع الحفاظ على وضوحها.');
 }finally{bitmap.close()}
}
async function preparePatientReport(file){
 if(file.type!=='application/pdf')return preparePatientImage(file);
 if(file.size>5000000)throw Error('ملف PDF أكبر من 5 ميجابايت');
 const bytes=new Uint8Array(await file.arrayBuffer()),header=new TextDecoder().decode(bytes.slice(0,12)),tail=new TextDecoder().decode(bytes.slice(-1024));
 if(!/^%PDF-(?:1\.[0-7]|2\.0)/.test(header)||!/%%EOF\s*$/.test(tail))throw Error('اختر ملف PDF أصليًا وسليمًا');
 return {mime:'application/pdf',data:await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('تعذر قراءة ملف PDF'));reader.readAsDataURL(file)})};
}
async function uploadPatientReport(phone,input,caption,panel){
 const file=input.files[0];if(!file)return;const status=panel.querySelector('[data-report-status]');input.disabled=true;
 const error=await guard(async()=>{status.textContent='جارٍ تجهيز ورفع التقرير…';const image=await preparePatientReport(file);await gateway('attachmentUpload',{phone,name:(caption.value.trim()||file.name).slice(0,120),category:panel.querySelector('#patient-report-category').value,reportDate:panel.querySelector('#patient-report-date').value,...image},true);caption.value='';await loadPatientReports(phone,panel)},'تم رفع التقرير');
 if(error)status.textContent=error;input.value='';input.disabled=false;
}
async function viewPatientReport(phone,item,card,status){
 try{status.textContent='جارٍ تحميل الصورة…';const result=await gateway('attachmentRead',{phone,id:item.id},true);if(!card.isConnected)return;if(item.mime==='application/pdf'){if(!result.data)throw Error('تعذر تنزيل PDF؛ تحقق من نشر خدمة العيادة الحديثة');const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=(item.name.replace(/[\\/:*?"<>|]/g,'-').replace(/\.pdf$/i,'')||'report')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent='تم تنزيل ملف PDF';return;}let image=card.querySelector('img');if(!image){image=document.createElement('img');image.alt=item.name;image.className='patient-report-image';const viewport=document.createElement('div');viewport.className='report-image-viewport';viewport.append(image);card.append(viewport);const tools=document.createElement('div');tools.className='acts';let zoom=100,rotation=0;for(const [name,action]of [['تكبير',()=>zoom=Math.min(300,zoom+25)],['تصغير',()=>zoom=Math.max(50,zoom-25)],['تدوير',()=>rotation=(rotation+90)%360]]){const button=document.createElement('button');button.type='button';button.className='btn sm x';button.textContent=name;button.onclick=()=>{action();image.style.width=zoom+'%';image.style.transform='rotate('+rotation+'deg)'};tools.append(button)}card.append(tools)}image.src=result.url||'data:'+result.mime+';base64,'+result.data;image.onload=()=>{status.textContent=''};image.onerror=()=>{status.textContent='تعذر عرض الصورة. أعد الضغط على عرض الصورة.'};}catch(e){status.textContent=errMsg(e)}
}
var reportBaseOpenCase=openCase;openCase=async function(phone){await reportBaseOpenCase(phone);const modal=document.querySelector('.mod');if(modal&&SEL===phone&&canUsePatientReports())modal.append(reportPanel(phone));};
var reportBaseNurse=nurse;nurse=function(){return reportBaseNurse()+(canUsePatientReports()&&PT?.[SEL]?'<div id="nurse-patient-reports"></div>':'')};
var reportBaseDraw=draw;draw=function(){reportBaseDraw();const host=document.getElementById('nurse-patient-reports');if(host&&canUsePatientReports())host.append(reportPanel(SEL));};
