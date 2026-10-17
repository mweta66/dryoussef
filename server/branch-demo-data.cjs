const core=require('./core.cjs');
function addBranchDemo(original,uid,count=100){
 if(core.role(original,uid).r!=='admin')core.fail('غير مصرح',403);
 if(count!==100)core.fail('عدد الحالات التجريبية لكل فرع يجب أن يكون 100');
 if(Object.values(original.bookings||{}).some(rows=>Object.keys(rows).length)||Object.keys(original.patients||{}).length)core.fail('يجب تفريغ البيانات المحلية قبل إضافة مجموعة التجربة',409);
 const s=structuredClone(original),ids=core.branchIds(s,true),baseline=core.today();
 if(ids.length!==4||!['alex','matrouh','dmn','libya'].every(b=>ids.includes(b)))core.fail('يجب تجهيز الفروع الأربعة أولًا');
 s.bookings||={};s.patients||={};s.files||={};s.complaints||={};s.inbox||={};s.sequences||={};
 for(const [branchIndex,b]of ids.entries())for(let i=0;i<count;i++){
  const dt=new Date(baseline+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+i%5-2);const date=dt.toISOString().slice(0,10),serial=40001+branchIndex*count+i;
  const phone='010000'+String(serial),id='demo-four-'+b+'-'+(i+1),name='حالة تجريبية '+s.settings.branches[b].name+' '+String(i+1).padStart(3,'0');
  const key=date+'_'+b,no=(s.sequences[key]||0)+1,status=date<baseline?['done','no','cx'][i%3]:'wait';
  const rows=s.bookings[date]||={};rows[id]={id,date,b,no,name,phone,v:['exam','cons','follow'][i%3],s:status,nt:'بيانات اصطناعية للاختبار فقط — لا تستخدم للتواصل أو العلاج',rev:1};s.sequences[key]=no;
  s.patients[phone]={n:name,d:date};s.files[phone]={n:'ملاحظات طبيب تجريبية: مراجعة التحاليل والسونار. ليست بيانات مريض حقيقي.',allergies:i%4===0?'حساسية تجريبية':'لا توجد بيانات مسجلة',chronic:'سجل تجريبي',diagnosis:'تشخيص تجريبي فقط',treatment:'خطة تجريبية غير مخصصة للاستخدام الطبي',t:new Date().toISOString()};
  const complaintDate=date>baseline?baseline:date,cid='demo-complaint-'+b+'-'+(i+1),at=complaintDate+'T10:00:00.000Z';
  s.complaints[phone]={[cid]:{id:cid,date:complaintDate,text:'شكوى تجريبية لمراجعة وظائف الملف الطبي',tx:'ملاحظة علاج تجريبية فقط',by:'بيانات تجريبية',at}};
  if(date===baseline&&i%2===0)s.inbox[cid]={p:phone,n:name,d:complaintDate,by:'بيانات تجريبية',at};
 }
 s.settings.demoPurged=false;s.settings.demoDatasetVersion=3;
 s.audit.push({action:'seedFourBranchDemo',actor:uid,at:new Date().toISOString(),casesPerBranch:count});
 return require('./realistic-demo.cjs').realisticDemo(core.rebuild(s));
}
module.exports={addBranchDemo};
