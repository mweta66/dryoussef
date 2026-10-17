// Synthetic clinical examples use the same schema and screens as newly entered records.
const {egyptianName,spouse}=require('./demo-names.cjs');
const profiles=[
 {reason:'متابعة حمل',text:'متابعة دورية للحمل مع غثيان متقطع دون نزيف أو ألم شديد.',diagnosis:'متابعة حمل داخل الرحم',treatment:'استمرار المتابعة الدورية ومراجعة نتائج التحاليل المطلوبة.',notes:'مراجعة صورة الدم وتحليل البول والسونار في الزيارة القادمة.'},
 {reason:'اضطراب الدورة الشهرية',text:'عدم انتظام الدورة خلال الأشهر الثلاثة الأخيرة مع تقلصات متوسطة.',diagnosis:'اضطراب بالدورة الشهرية قيد التقييم',treatment:'تسجيل مواعيد الدورة واستكمال الفحوصات ثم مراجعة النتائج.',notes:'طلب سونار للحوض وتحاليل حسب التقييم الإكلينيكي.'},
 {reason:'تأخر الإنجاب',text:'مراجعة لبحث تأخر حدوث الحمل ومناقشة الفحوصات السابقة.',diagnosis:'تقييم أسباب تأخر الإنجاب',treatment:'استكمال تقييم الزوجين وتحديد الخطة بعد مراجعة الفحوصات.',notes:'تمت مراجعة التاريخ المرضي وشرح خطوات التقييم.'},
 {reason:'مراجعة نتائج التحاليل',text:'حضور لمراجعة التحاليل والسونار دون أعراض جديدة.',diagnosis:'متابعة نتائج الفحوصات',treatment:'متابعة وفق نتائج الفحوصات والتقييم في الزيارة.',notes:'مقارنة النتائج الحالية بالسابقة ومناقشة الخطة مع المريضة.'},
 {reason:'ألم أسفل البطن',text:'ألم متقطع أسفل البطن منذ عدة أيام دون حرارة أو قيء مستمر.',diagnosis:'ألم بالحوض قيد التقييم',treatment:'استكمال الفحص والسونار ومراجعة عاجلة عند زيادة الألم أو حدوث نزيف.',notes:'مراجعة الأعراض المصاحبة والتاريخ المرضي قبل تحديد العلاج.'},
 {reason:'متابعة بعد الولادة',text:'متابعة بعد الولادة ومناقشة التعافي والرضاعة وتنظيم الأسرة.',diagnosis:'متابعة ما بعد الولادة',treatment:'إرشادات التعافي والمتابعة ومناقشة الخيارات المناسبة لتنظيم الأسرة.',notes:'تمت مناقشة التغذية والرضاعة وعلامات تستدعي المراجعة.'}
];
function realisticDemo(original){const s=structuredClone(original),phones=Object.keys(s.patients||{}).filter(p=>/^010000\d{5}$/.test(p)).sort();for(const [i,p]of phones.entries()){
 const name=egyptianName(i),profile=profiles[i%profiles.length];
 s.patients[p].n=name;for(const [k,v]of Object.entries(spouse(p)))if(s.patients[p][k]===undefined)s.patients[p][k]=v;
 for(const rows of Object.values(s.bookings||{}))for(const x of Object.values(rows))if(x.phone===p){x.name=name;x.nt=['','يفضل التواصل بعد الظهر','الحضور قبل الموعد بربع ساعة','مراجعة نتائج الفحوصات السابقة'][i%4];}
 const old=s.files?.[p];if(old)s.files[p]={...old,n:profile.notes,allergies:i%11===0?'حساسية من البنسلين':'لا توجد حساسية معروفة',chronic:i%13===0?'قصور بالغدة الدرقية تحت المتابعة':i%17===0?'ارتفاع ضغط الدم تحت المتابعة':'لا توجد أمراض مزمنة مسجلة',diagnosis:profile.diagnosis,treatment:profile.treatment,rev:old.rev||1};
 let no=0;for(const c of Object.values(s.complaints?.[p]||{})){c.no=++no;c.reason=profile.reason;c.text=profile.text;c.tx=profile.treatment;c.by='nurse';}
 s.complaintSequences||={};s.complaintSequences[p]=Math.max(s.complaintSequences[p]||0,no);
 for(const n of Object.values(s.inbox||{}))if(n.p===p){n.n=name;n.by='nurse';}
 }return s;}
module.exports={realisticDemo,egyptianName};
