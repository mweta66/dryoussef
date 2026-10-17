const core=require('./core.cjs'),perms=require('./permissions.cjs'),cases=require('./cases.cjs'),profiles=require('./demo-profiles.cjs');
const first=['مريم','سارة','آية','نور','هبة','إيمان','منى','دعاء','أسماء','فاطمة','ياسمين','رانيا','دينا','أمل','ندى','شيماء','رحاب','سلمى','بسمة','حنان'];
const middle=['أحمد','محمد','محمود','إبراهيم','مصطفى','حسن','حسين','خالد','عمرو','علي','طارق','سامح','عادل','كريم','ياسر','وليد','حسام','شريف','عصام','سعيد'];
const last=['عبد الله','السيد','حسن','منصور','عوض','النجار','سليمان','شاهين','مرسي','صالح','عباس','فؤاد','كمال','زكي','عمران','الشاذلي','عثمان','يوسف','حمدي','عبد الحميد'];
const placeholder=name=>/^(?:حالة|حاله|مريضة|مريضه)\s+(?:اصطناعي?(?:ة|ه)?(?:\s|$)|صناعي?(?:ة|ه)?(?:\s|$)|تجريبي?(?:ة|ه)?(?:\s|$)|افتراضي?(?:ة|ه)?(?:\s|$)|[0-9٠-٩])/.test(String(name||'').trim())||/^(?:demo|test|synthetic)\s+(?:patient|case)\b/i.test(String(name||''));
function egyptianName(index){let name=first[index%20]+' '+middle[Math.floor(index/20)%20]+' '+last[(index*7+Math.floor(index/20)+Math.floor(index/400))%20];for(let extra=Math.floor(index/8000);extra>0;extra=Math.floor((extra-1)/20))name+=' '+last[(extra-1)%20];return name;}
function spouse(phone){const i=Number(phone.slice(-5)),jobs=['مهندس','محاسب','مدرس','طبيب','صيدلي','موظف إداري','تاجر','محام','فني كهرباء','صاحب مشروع'];return {spouseName:middle[(i*3+2)%20]+' '+middle[(Math.floor(i/20)+5)%20]+' '+last[(i*7+3)%20],spouseJob:jobs[i%jobs.length],spousePhone:'010001'+phone.slice(-5)};}
// Exact historical seed values only: never rewrite free text entered by staff.
const legacyValues=new Set([
 'بيانات اصطناعية للاختبار فقط — لا تستخدم للتواصل أو العلاج','بيانات اصطناعية للاختبار فقط — لا تستخدم للتواصل','بيانات اصطناعية للاختبار فقط','بيانات تجريبية فقط',
 'ملاحظات طبيب تجريبية: مراجعة التحاليل والسونار. ليست بيانات مريض حقيقي.','ملاحظات دكتور تجريبية: متابعة التحاليل والسونار في الزيارة القادمة.','ملف تجريبي لا يُستخدم للتشخيص أو العلاج',
 'حساسية تجريبية','لا توجد بيانات تجريبية','بيانات اصطناعية','سجل تجريبي','تشخيص تجريبي فقط','تشخيص تجريبي','خطة تجريبية غير مخصصة للاستخدام الطبي','خطة تجريبية',
 'شكوى تجريبية لمراجعة وظائف الملف الطبي','ملاحظة علاج تجريبية فقط','شكوى اصطناعية للاختبار','متابعة تجريبية','شكوى تجريبية لمراجعة الطبيب','علاج تجريبي مسجل للاختبار فقط'
]);
const legacyText=value=>typeof value==='string'&&legacyValues.has(value.trim());
function normalize(original,uid){
 perms.requirePermission(core.role(original,uid),'data.import');const s=structuredClone(original);s.patients={...cases.indexPatients({...s,patients:{...s.patients}}).patients,...s.patients};const rows=Object.values(s.bookings||{}).flatMap(Object.values),phones=new Set(),used=new Set();for(const [p,x]of Object.entries(s.patients||{})){if(placeholder(x.n))phones.add(p);else if(x.n)used.add(x.n);}for(const x of rows){if(placeholder(x.name))phones.add(x.phone);else if(x.name)used.add(x.name);}const samplePhones=new Set([...phones,...Object.keys(s.patients||{}).filter(p=>/^010000\d{5}$/.test(p)),...rows.filter(x=>/^demo[-_]/.test(x.id||'')).map(x=>x.phone)]);let serial=0;const summary={patients:0,bookings:0,notifications:0};
 for(const phone of [...phones].sort()){const patient=s.patients?.[phone],proper=patient?.n&&!placeholder(patient.n)?patient.n:rows.find(x=>x.phone===phone&&x.name&&!placeholder(x.name))?.name;let name=proper;if(!name){do{name=egyptianName(serial++)}while(used.has(name));used.add(name);}if(patient&&placeholder(patient.n)){patient.n=name;summary.patients++;}for(const row of rows)if(row.phone===phone&&placeholder(row.name)){row.name=name;row.rev=(row.rev||0)+1;summary.bookings++;}for(const note of Object.values(s.inbox||{}))if(note.p===phone&&placeholder(note.n)){note.n=name;summary.notifications++;}}
 summary.spouses=0;summary.clinicalFields=0;for(const [i,p]of [...samplePhones].sort().entries()){
  const patient=s.patients?.[p];if(!patient)continue;let changed=false;for(const [k,v]of Object.entries(spouse(p)))if(patient[k]===undefined||patient[k]===null){patient[k]=v;changed=true;}if(changed)summary.spouses++;
  const {profile,bookingNote,file}=profiles.clinicalProfile(i);
  for(const row of rows)if(row.phone===p&&legacyText(row.nt)){row.nt=bookingNote;row.rev=(row.rev||0)+1;summary.clinicalFields++;}
  const old=s.files?.[p];let fileChanged=false;if(old)for(const [k,v]of Object.entries(file))if(legacyText(old[k])){old[k]=v;fileChanged=true;summary.clinicalFields++;}if(fileChanged){old.rev=(old.rev||0)+1;old.t=new Date().toISOString();}
  for(const complaint of Object.values(s.complaints?.[p]||{})){if((legacyText(complaint.text)||legacyText(complaint.tx))&&!complaint.reason){complaint.reason=profile.reason;summary.clinicalFields++;}for(const [k,v]of Object.entries({reason:profile.reason,text:profile.text,tx:profile.treatment}))if(legacyText(complaint[k])){complaint[k]=v;summary.clinicalFields++;}if(complaint.by==='بيانات تجريبية')complaint.by='nurse';}
  for(const note of Object.values(s.inbox||{}))if(note.p===p&&note.by==='بيانات تجريبية')note.by='nurse';
 }s.settings||={};s.settings.demoProfileVersion=1;s.settings.demoSpouseVersion=1;s.settings.demoNamesVersion=1;return {state:s,summary};
}
module.exports={normalize,placeholder,egyptianName,spouse};
