import * as perms from './permissions.js';
import * as cases from './cases.js';
const BRANCHES = ['dmn','alex'];
const STATES = ['wait','exam','done','no','cx'];
const fail = (message, status=400) => { const e=new Error(message);e.status=status;throw e; };
function phone(p) {
 return String(p||'').replace(/[٠-٩۰-۹]/g,d=>{const n=d.charCodeAt(0);return n>=1776?n-1776:n-1632}).replace(/[\s()+-]/g,'').replace(/^(?:0020|20)(?=1)/,'0');
}
function today(now=new Date()) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function date(d) {
 const parsed=new Date(d+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d||'')||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==d)fail('اختر تاريخاً صحيحاً');
 return d;
}
function id(s) { if(typeof s!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(s))fail('معرّف غير صحيح');return s; }
function role(state,uid,doctor=false) {
 const r=state.roles?.[uid];
 if(!r||r.enabled===false||!['admin','doctor','sec','nurse','staff'].includes(r.r))fail('NOAUTH',403);
 if(doctor&&r.r!=='doctor')fail('غير مصرح بهذه العملية',403);
 return r;
}
function allowed(r,b) {if(!perms.allBranches(r)&&r.br!==b)fail('غير مصرح بتعديل هذا الفرع',403);}
function booking(n) {
 if(!n||typeof n!=='object')fail('حجز غير صحيح');
 const p=phone(n.phone);
 if(!/^01[0125]\d{8}$/.test(p)||!BRANCHES.includes(n.b)||!['exam','cons','follow','emergency'].includes(n.v)||!STATES.includes(n.s||'wait'))fail('بيانات الحجز غير صحيحة');
 const name=String(n.name||'').trim(),nt=String(n.nt||'').trim();
 if(!name||name.length>120||nt.length>2000)fail('راجع الاسم والملاحظات');
 return {id:id(n.id),name,phone:p,b:n.b,v:n.v,s:n.s||'wait',date:date(n.date),nt};
}
function queueOrder(a,b){const rank=x=>x.s==='exam'?0:x.s==='wait'?(x.v==='emergency'?1:2):3;return rank(a)-rank(b)||a.no-b.no;}
function queueTrack(state,list,x,clock=Date.now(),prepared){
 const ordered=prepared?.ordered||list.filter(y=>y.b===x.b).sort(queueOrder),active=prepared?prepared.active:ordered.find(y=>y.s==='exam'),waiting=prepared?.waiting||ordered.filter(y=>y.s==='wait');
 const avg=Math.max(1,Math.min(180,Number(state.settings?.avg)||15)),index=Math.max(0,prepared?prepared.positions.get(x.id)??0:waiting.findIndex(y=>y.id===x.id));
 const session=state.sessions?.[x.date+'_'+x.b],blocked=session&&session.status!=='running';
 const started=!blocked&&active&&(prepared?prepared.isToday:x.date===today(new Date(clock)))&&Number.isFinite(Date.parse(active.startedAt)),remaining=started?Math.max(0,avg*60000-(clock-Date.parse(active.startedAt))):avg*60000;
 const delay=x.s==='wait'?(active?remaining:0)+index*avg*60000:0;
 return {date:x.date,no:x.no,s:x.s,b:x.b,v:x.v,sessionStatus:session?.status||'not_started',ahead:x.s==='wait'?index+(active?1:0):0,avg,queueStarted:!!started,estimatedWaitMinutes:started?Math.ceil(delay/60000):null,expectedAt:started?(x.s==='exam'?active.startedAt:x.s==='wait'?new Date(clock+delay).toISOString():null):null};
}
function rebuild(state) {
 state.track={};const clock=Date.now(),currentDay=today(new Date(clock));
 for(const [d,rows] of Object.entries(state.bookings||{})){
  const list=Object.values(rows||{});
  for(const b of BRANCHES) {
   const q=list.filter(x=>x.b===b).sort(queueOrder);
   const waiting=q.filter(x=>x.s==='wait'),prepared={ordered:q,active:q.find(x=>x.s==='exam'),waiting,positions:new Map(waiting.map((x,i)=>[x.id,i])),isToday:d===currentDay};
   for(const x of q){
    state.track[d]||={};
    state.track[d][x.phone]=queueTrack(state,list,x,clock,prepared);
   }
  }
 }
 return state;
}
function commit(state, uid, puts, dels, now=today()) {
 state=structuredClone(state||{}); const r=role(state,uid);
 if(!Array.isArray(puts)||!Array.isArray(dels)||puts.length+dels.length>100||!puts.length&&!dels.length)fail('دفعة غير صحيحة');
 state.bookings||={};state.sequences||={};
 const seen=new Set(),advance=new Set();
 for(const raw of [...dels,...puts.map(p=>p.n)]){if(seen.has(raw?.id))fail('معرّف مكرر');seen.add(raw?.id);}
 const remove = (old, deleteOnly) => {
  date(old.date);id(old.id);
  const live=state.bookings[old.date]?.[old.id];
  if(!live)fail('الحجز تغيّر أو حُذف. أعد التحميل.',409);
  allowed(r,live.b);
  if(deleteOnly)perms.requirePermission(r,'bookings.delete');
  if((live.rev||0)!==(old.rev||0))fail('الحجز عُدّل في جلسة أخرى. أعد التحميل.',409);
  if(live.s==='exam')advance.add(live.date+'_'+live.b);
  if(deleteOnly){state.deletedBookings||={};state.deletedBookings[live.id]={booking:structuredClone(live),deletedAt:new Date().toISOString(),deletedBy:uid};}
  delete state.bookings[old.date][old.id];return live;
 };
 dels.forEach(x=>remove(x,true));
 for(const p of puts){
  const n=booking(p.n);allowed(r,n.b);
  const old=p.o?remove(p.o,false):null;
  if(!perms.can(r,'notes.edit'))n.nt=old?.nt||'';
  if(!old)perms.requirePermission(r,'bookings.create');
  if(!old&&!['doctor','admin'].includes(r.r)&&n.date<now)fail('لا يمكن الحجز في تاريخ سابق');
  if(old&&['name','phone','v','nt','date','b'].some(k=>n[k]!==old[k]))perms.requirePermission(r,'bookings.edit');
  const otherActive=Object.values(state.bookings[n.date]||{}).find(x=>x.b===n.b&&x.s==='exam');
  const sessionKey=n.date+'_'+n.b,session=state.sessions?.[sessionKey];
  if(n.v==='emergency'&&(!old||old.v!=='emergency'||old.date!==n.date)){perms.requirePermission(r,'bookings.status');if(n.date!==now)fail('حجز الطوارئ متاح لليوم الحالي فقط');n.s=otherActive||!session||session.status!=='running'?'wait':'exam';}
  if(n.s==='exam'&&!session)perms.requirePermission(r,'sessions.manage');
  if(n.s==='exam'&&session&&session.status!=='running')fail('جلسة الكشف متوقفة؛ اطلب من الطبيب بدء العيادة أولًا',409);
  if(!old&&n.s!=='wait')perms.requirePermission(r,'bookings.status');
  if(n.s==='exam'&&otherActive)fail('يوجد كشف جاري بالفعل. أنهِ الحالة الحالية أولًا.',409);
  if(n.s==='exam'&&old?.s!=='exam'&&n.date!==now)fail('بدء الكشف متاح لليوم الحالي فقط');
  if(n.s==='exam')n.startedAt=old?.s==='exam'&&old.startedAt?old.startedAt:new Date().toISOString();else if(old?.startedAt)n.startedAt=old.startedAt;
  if(n.s==='exam'){state.sessions||={};state.sessions[sessionKey]||={status:'running',startedAt:n.startedAt};state.sessions[sessionKey].startedAt||=n.startedAt;}
  if(old&&n.s!==old.s)perms.requirePermission(r,'bookings.status');
  if(old&&n.s===old.s)perms.requirePermission(r,'bookings.edit');
  for(const rows of Object.values(state.bookings))if(rows?.[n.id])fail('معرّف الحجز موجود بالفعل',409);
  const rows=state.bookings[n.date]||={};
  if(Object.values(rows).some(x=>phone(x.phone)===n.phone))fail('هذا الرقم لديه حجز بالفعل في هذا اليوم',409);
  const moved=!old||old.date!==n.date||old.b!==n.b;
  const seqKey=n.date+'_'+n.b;
  const max=Math.max(state.sequences[seqKey]||0,0,...Object.values(rows).filter(x=>x.b===n.b).map(x=>Number(x.no)||0));
  n.no=moved?max+1:old.no;
  state.sequences[seqKey]=Math.max(max,n.no);
  n.rev=(old?.rev||0)+1;
  rows[n.id]=n;
  if(old?.s==='exam'&&n.s==='wait'&&old.date===n.date&&old.b===n.b)advance.delete(old.date+'_'+old.b);
 }
 for(const key of advance){const d=key.slice(0,10),b=key.slice(11);if(d!==now||state.sessions?.[key]&&state.sessions[key].status!=='running')continue;const list=Object.values(state.bookings[d]||{}).filter(x=>x.b===b);if(list.some(x=>x.s==='exam'))continue;const next=list.filter(x=>x.s==='wait').sort(queueOrder)[0];if(next){next.s='exam';next.startedAt=new Date().toISOString();next.rev=(next.rev||0)+1;}}
 rebuild(state);cases.indexPatients(state);return {state};
}
function read(state,uid,path) {
 if(path==='settings')return state.settings||null;
 const r=role(state,uid);
 if(path==='sessions'){perms.requirePermission(r,'bookings.read');return state.sessions||{};}
 if(path==='audit'){perms.requirePermission(r,'audit.read');return state.audit||[];}
 if(path==='deletedBookings'){perms.requirePermission(r,'bookings.delete');return Object.fromEntries(Object.entries(state.deletedBookings||{}).filter(([,x])=>perms.allBranches(r)||x.booking.b===r.br));}
 if(path==='roles/'+uid)return perms.normalize(state.roles[uid]);
 if(path==='roles'){perms.requirePermission(r,'users.manage');return state.roles||{};}
 if(/^(patients|complaints|files|inbox)(?:\/|$)/.test(path))return cases.read(state,r,path);

 if(/^bookings(?:\/\d{4}-\d{2}-\d{2})?$/.test(path)){
  perms.requirePermission(r,'bookings.read');const d=path.split('/')[1];if(d)date(d);
  const sanitize=rows=>Object.fromEntries(Object.entries(rows).map(([id,x])=>[id,perms.can(r,'notes.read')?x:{...x,nt:''}]));
  if(perms.allBranches(r))return d?sanitize(state.bookings?.[d]||{}):Object.fromEntries(Object.entries(state.bookings||{}).map(([day,rows])=>[day,sanitize(rows)]));
  if(!d)fail('اختر يوماً لعرض الحجوزات',403);
  return sanitize(Object.fromEntries(Object.entries(state.bookings?.[d]||{}).filter(([,x])=>x.b===r.br)));
 }
 fail('مسار غير مسموح',403);
}
function schedule(s) {
 if(!s||!Array.isArray(s.d)||!s.d.length||!s.d.every(d=>Number.isInteger(d)&&d>=0&&d<=6)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.f)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.t)||s.f>=s.t)fail('مواعيد غير صحيحة');
 return {d:[...new Set(s.d)],f:s.f,t:s.t};
}
function patch(state,uid,updates) {
 state=structuredClone(state||{});const r=role(state,uid);
 if(updates&&Object.keys(updates).every(p=>/^(patients|complaints|files|inbox)\//.test(p)))return cases.patch(state,r,updates,api);
 if(!updates||Array.isArray(updates)||typeof updates!=='object'||Object.keys(updates).length>10)fail('تحديث غير صحيح');
 state.settings||={};state.roles||={};
 for(const [path,value] of Object.entries(updates)){
  if(path==='settings'||path==='settings/avg'){perms.requirePermission(r,path==='settings/avg'?'queue.configure':'clinic.manage');
   const avg=path==='settings'?value.avg:value;
   if(!Number.isInteger(avg)||avg<1||avg>180)fail('متوسط الكشف من 1 إلى 180 دقيقة');
   state.settings.avg=avg;
   if(path==='settings'&&value.sched){state.settings.sched||={};for(const b of BRANCHES)state.settings.sched[b]=schedule(value.sched[b]);}
  }else if(/^settings\/sched\/(dmn|alex)$/.test(path)){
   perms.requirePermission(r,'clinic.manage');state.settings.sched||={};state.settings.sched[path.split('/')[2]]=schedule(value);
  }else if(/^roles\/[A-Za-z0-9_-]{1,128}(?:\/br)?$/.test(path)){
   perms.requirePermission(r,'users.manage');const [,key,field]=path.split('/');if(key===uid||['doctor','admin'].includes(state.roles[key]?.r))fail('لا يمكن تغيير صلاحية الدكتور',403);
   if(field){if(!state.roles[key]||!BRANCHES.includes(value))fail('فرع غير صحيح');state.roles[key].br=value;}
   else if(value===null)delete state.roles[key];
   else{if(!['sec','nurse'].includes(value.r)||(value.r==='sec'&&!BRANCHES.includes(value.br))||!/^[a-z0-9._-]{3,64}$/.test(value.u))fail('حساب غير صحيح');state.roles[key]={r:value.r,u:value.u,...(value.r==='sec'?{br:value.br}:{})};}
  }else fail('مسار كتابة غير مسموح',403);
 }
 return state;
}
function lookup(state,p,now=today(),clock=Date.now()) {
 p=phone(p);if(!/^01[0125]\d{8}$/.test(p))return null;
 const x=Object.values(state.bookings?.[now]||{}).find(x=>x.phone===p);
 if(!x)return null;return queueTrack(state,Object.values(state.bookings[now]||{}),x,clock);
}
export {phone,today,date,role,booking,commit,read,patch,lookup,rebuild,fail,schedule,queueOrder,queueTrack};

const api={phone,today,date,role,booking,commit,read,patch,lookup,rebuild,fail,schedule,queueOrder,queueTrack};
