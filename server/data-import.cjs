const perms=require('./permissions.cjs');
const {createHash}=require('node:crypto');
const core=require('./core.cjs');
const management=require('./management.cjs');
const branchConfig=require('./branches.cjs'),cases=require('./cases.cjs');
const bad=(path,message)=>core.fail('ملف الاستيراد: '+path+' - '+message);
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x)&&!Object.hasOwn(Object.prototype,x);
function canonical(x){return Array.isArray(x)?x.map(canonical):object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function text(x,max,path,optional=false){if(optional&&x===undefined)return '';if(typeof x!=='string'||x.length>max)bad(path,'نص غير صحيح أو أطول من الحد المسموح');return x;}
function stamp(x,path){if(x===undefined||x==='')return undefined;if(typeof x!=='string'||x.length>60||!Number.isFinite(Date.parse(x)))bad(path,'توقيت غير صحيح');return new Date(x).toISOString();}
function phone(x,path){const p=core.phone(x);if(!/^01[0125]\d{8}$/.test(p))bad(path,'رقم موبايل غير صحيح');return p;}
function guardTree(value,depth=0){if(depth>18)bad('الملف','بنية متداخلة أكثر من المسموح');if(object(value)||Array.isArray(value))for(const [k,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))bad('الملف','مفتاح غير مسموح');guardTree(v,depth+1);}}
function normalize(input,state={},withSettings=false){
 if(!object(input))bad('الملف','اختر نسخة JSON صحيحة أو القالب المخصص');
 if(Buffer.byteLength(JSON.stringify(input),'utf8')>850000)bad('الحجم','البيانات بعد القراءة تتجاوز 850 كيلوبايت؛ قسّم الملف');
 guardTree(input);const data=object(input.payload)?input.payload:input;
 if(data.schemaVersion!==undefined&&data.schemaVersion!==1)bad('الإصدار','إصدار النسخة غير مدعوم');
 if(!['patients','bookings','files','complaints','settings'].some(k=>Object.hasOwn(data,k)))bad('المحتوى','لا توجد بيانات عيادة قابلة للاستيراد');
 if(withSettings&&data.settings?.branches)for(const [b,x]of Object.entries(data.settings.branches))if(x?.enabled===false&&(Object.values(state.bookings?.[core.today()]||{}).some(v=>v.b===b&&v.s==='exam')||['running','paused'].includes(state.sessions?.[core.today()+'_'+b]?.status)))core.fail('أنه جلسة الفرع قبل استيراد تعطيله',409);
 if(withSettings&&data.settings?.branches)state={...state,settings:{...state.settings,branches:{...branchConfig.branches(state),...branchConfig.validateRegistry(data.settings.branches,core.fail)}}};
 const out={patients:{},bookings:{},files:{},complaints:{},complaintSequences:{},settings:null,ignored:Object.keys(data).filter(k=>!['patients','bookings','files','complaints','complaintSequences','settings','exportedAt','format','schemaVersion'].includes(k))};
 let count=0;const map=(value,path,fn)=>{if(value===undefined)return;if(!object(value))bad(path,'يجب أن يكون مجموعة سجلات');for(const [k,v]of Object.entries(value)){if(++count>5000)bad('السجلات','عدد السجلات أكبر من المسموح');fn(k,v);}};
 map(data.patients,'patients',(raw,x)=>{const p=phone(raw,'patients');if(out.patients[p])bad('patients','رقم مكرر بصيغة مختلفة');if(!object(x))bad('patients','سجل غير صحيح');const n=text(x.n,120,'اسم المريض').trim();if(!n)bad('الاسم','اسم الحالة مطلوب');out.patients[p]={n,d:x.d?core.date(x.d):core.today()};for(const k of ['spouseName','spouseJob','spousePhone'])if(x[k]!==undefined)out.patients[p][k]=k==='spousePhone'?(x[k]?phone(x[k],k):''):text(x[k],120,k);});
 const seenIds=new Set(),seenPhones=new Set();
 map(data.bookings,'bookings',(d,rows)=>{core.date(d);map(rows,'bookings/'+d,(id,x)=>{if(!object(x)||x.id!==id||x.date!==d||!safeId(id))bad('bookings/'+d,'معرّف أو تاريخ حجز غير متطابق');const n=core.booking(x,state);if(seenIds.has(id)||seenPhones.has(d+'|'+n.phone))bad('bookings/'+d,'حجز مكرر في الملف');seenIds.add(id);seenPhones.add(d+'|'+n.phone);if(seenIds.size>1000)bad('الحجوزات','الحد الأقصى 1000 حجز في العملية');if(x.no!==undefined&&(!Number.isSafeInteger(x.no)||x.no<1||x.no>10000000))bad('رقم التذكرة','رقم غير صحيح');const startedAt=stamp(x.startedAt,'بدء الكشف');out.bookings[d]||={};out.bookings[d][id]={...n,...(x.no?{no:x.no}:{}),...(startedAt?{startedAt}:{}),rev:1};});});
 map(data.files,'files',(raw,x)=>{const p=phone(raw,'files');if(!object(x)||out.files[p])bad('files','ملف غير صحيح أو رقم مكرر');const f={n:text(x.n,5000,'ملاحظات الطبيب',true)};for(const k of ['allergies','chronic','diagnosis','treatment','followUp','source'])if(x[k]!==undefined){f[k]=text(x[k],k==='source'?512:2000,'files/'+k);if(k==='followUp'&&f[k])core.date(f[k]);}if(x.t)f.t=stamp(x.t,'تحديث الملف');out.files[p]=f;});
 map(data.complaints,'complaints',(raw,rows)=>{const p=phone(raw,'complaints');if(out.complaints[p])bad('complaints','رقم مكرر');out.complaints[p]={};map(rows,'complaints/'+p,(id,x)=>{if(!safeId(id)||!object(x)||x.id!==id)bad('complaints','معرّف شكوى غير صحيح');const date=core.date(x.date);if(date>core.today())bad('complaints','تاريخ الشكوى لا يكون في المستقبل');const body=text(x.text,2000,'الشكوى');if(!body.trim())bad('الشكوى','النص مطلوب');if(x.no!==undefined&&(!Number.isSafeInteger(x.no)||x.no<1))bad('complaints','رقم شكوى غير صحيح');out.complaints[p][id]={id,...(x.no?{no:x.no}:{}),reason:text(x.reason,2000,'سبب الشكوى',true),date,text:body,tx:text(x.tx,1000,'العلاج',true),by:text(x.by,128,'كاتب الشكوى',true)||'مستورد',...(x.at?{at:stamp(x.at,'وقت الشكوى')}: {})};});});
 map(data.complaintSequences,'complaintSequences',(raw,value)=>{const p=phone(raw,'complaintSequences');if(!Number.isSafeInteger(value)||value<0||value>100000000)bad('complaintSequences','عداد شكوى غير صحيح');out.complaintSequences[p]=value;});
 if(data.settings!==undefined){if(!object(data.settings))bad('settings','إعدادات غير صحيحة');out.settings={};if(data.settings.branches!==undefined)out.settings.branches=branchConfig.validateRegistry(data.settings.branches,core.fail);if(data.settings.avg!==undefined){if(!Number.isInteger(data.settings.avg)||data.settings.avg<1||data.settings.avg>180)bad('المتوسط','من 1 إلى 180 دقيقة');out.settings.avg=data.settings.avg;}if(data.settings.sched!==undefined){if(!object(data.settings.sched))bad('المواعيد','إعداد غير صحيح');out.settings.sched={};for(const b of Object.keys(data.settings.sched)){if(!core.branchIds(state).includes(b))bad('المواعيد','فرع غير صحيح');out.settings.sched[b]=core.schedule(data.settings.sched[b]);}}if(data.settings.site!==undefined)out.settings.site=management.site(data.settings.site,core.fail);}
 return out;
}
function prepare(original,uid,input,options={}){
 perms.requirePermission(core.role(original,uid),'data.import');
 if(!object(options)||Object.keys(options).some(k=>k!=='importSettings')||options.importSettings!==undefined&&typeof options.importSettings!=='boolean')core.fail('خيارات الاستيراد غير صحيحة');
 const data=normalize(input,original,options.importSettings===true),s=structuredClone(original),summary={patients:{added:0,duplicates:0,conflicts:0},bookings:{added:0,duplicates:0,conflicts:0},files:{added:0,duplicates:0,conflicts:0},complaints:{added:0,duplicates:0,conflicts:0},renumbered:0,examsToWaiting:0,settingsChanged:false,ignored:data.ignored};
 s.patients||={};s.bookings||={};s.files||={};s.complaints||={};s.sequences||={};
 const blockedPhones=new Set();
 const addPatient=(p,x)=>{const old=s.patients[p];if(!old){s.patients[p]=x;summary.patients.added++;}else{summary.patients[same(old,x)?'duplicates':'conflicts']++;if(old.n!==x.n)blockedPhones.add(p);}};
 for(const [p,x]of Object.entries(data.patients))addPatient(p,x);
 const ids=new Map(),phones=new Set();for(const [d,rows]of Object.entries(s.bookings))for(const x of Object.values(rows)){ids.set(x.id,x);phones.add(d+'|'+x.phone);}
 for(const [d,rows]of Object.entries(data.bookings))for(const incoming of Object.values(rows)){
  const old=ids.get(incoming.id),p=incoming.phone;
  if(original.deletedBookings?.[incoming.id]){summary.bookings.conflicts++;continue;}
  if(old){const comparison={...incoming,no:old.no};if(comparison.s==='exam'){comparison.s='wait';delete comparison.startedAt;}summary.bookings[same({...old,rev:1},comparison)?'duplicates':'conflicts']++;continue;}
  if(phones.has(d+'|'+p)||s.patients[p]&&s.patients[p].n!==incoming.name){summary.bookings.conflicts++;continue;}
  const x={...incoming};if(x.s==='exam'){x.s='wait';delete x.startedAt;summary.examsToWaiting++;}
  const key=d+'_'+x.b,existing=Object.values(s.bookings[d]||{}).filter(y=>y.b===x.b),max=Math.max(s.sequences[key]||0,0,...existing.map(y=>y.no||0));
  if(!x.no||existing.some(y=>y.no===x.no)){if(x.no)summary.renumbered++;x.no=max+1;}
  (s.bookings[d]||={})[x.id]=x;s.sequences[key]=Math.max(max,x.no);ids.set(x.id,x);phones.add(d+'|'+p);summary.bookings.added++;if(!s.patients[p])addPatient(p,{n:x.name,d});
 }
 for(const [p,f]of Object.entries(data.files)){
  if(blockedPhones.has(p)){summary.files.conflicts++;continue;}
  if(!s.patients[p])bad('files','يوجد ملف طبي بلا حالة مسجلة في النسخة أو العيادة');
  if(s.files[p]){const withoutTime=x=>Object.fromEntries(Object.entries(x).filter(([k])=>k!=='t'));summary.files[same(withoutTime(s.files[p]),withoutTime(f))?'duplicates':'conflicts']++;}
  else{s.files[p]={...f,t:f.t||new Date().toISOString()};summary.files.added++;}
 }
 for(const [p,rows]of Object.entries(data.complaints)){
  if(blockedPhones.has(p)){summary.complaints.conflicts+=Object.keys(rows).length;continue;}
  if(!s.patients[p])bad('complaints','توجد شكاوى بلا حالة مسجلة');s.complaints[p]||={};
  for(const [id,x]of Object.entries(rows)){if(s.complaints[p][id])summary.complaints[same(s.complaints[p][id],{...x,no:x.no||s.complaints[p][id].no,at:x.at||s.complaints[p][id].at})?'duplicates':'conflicts']++;else{s.complaints[p][id]={...x,at:x.at||new Date().toISOString()};summary.complaints.added++;}}
 }
 if(options.importSettings&&data.settings){const previous=s.settings||{};s.settings={...previous,...data.settings,...(data.settings.branches?{branches:{...branchConfig.branches(s),...data.settings.branches}}:{}),...(data.settings.sched?{sched:{...previous.sched,...data.settings.sched}}:{})};summary.settingsChanged=!same(previous,s.settings);}
 s.complaintSequences||={};for(const [phone,value]of Object.entries(data.complaintSequences)){if(!s.patients[phone])bad('complaintSequences','عداد دون حالة');s.complaintSequences[phone]=Math.max(s.complaintSequences[phone]||0,value);}
 summary.totalAdded=['patients','bookings','files','complaints'].reduce((n,k)=>n+summary[k].added,0);summary.totalConflicts=['patients','bookings','files','complaints'].reduce((n,k)=>n+summary[k].conflicts,0);
 const token=createHash('sha256').update(JSON.stringify(canonical({uid,day:core.today(),input,options,bookings:original.bookings,patients:original.patients,files:original.files,complaints:original.complaints,complaintSequences:original.complaintSequences,settings:original.settings,sequences:original.sequences,sessions:original.sessions,deletedBookings:original.deletedBookings}))).digest('hex');
 cases.numberComplaints(s);core.rebuild(s);return {state:s,summary,token};
}
module.exports={prepare};
