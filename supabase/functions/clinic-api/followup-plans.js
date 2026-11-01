// Doctor-authored follow-up plans. Reception receives scheduling-only projections.
import * as core from './core.js';
import * as patientIdentity from './patient-identity.js';
import * as perms from './permissions.js';
import * as cases from './cases.js';
import * as branches from './branches.js';
import * as schedule from './schedule.js';
const actions=['followupPlanList','followupPlanSave','followupPlanBook'];
const TYPES=['follow','cons'];
function checkId(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))core.fail('معرّف غير صحيح');return value;}
function text(value,max=1000){if(typeof value!=='string'||value.length>max)core.fail('راجع نص خطة المتابعة');return value.trim();}
function role(s,uid,key){const r=core.role(s,uid);perms.requirePermission(r,key);return r;}
function records(s){return Object.values(s.bookings||{}).flatMap(rows=>Object.values(rows||{}));}
function identity(s,input={}){const indexed=cases.indexPatients(structuredClone(s)),resolved=patientIdentity.resolve(indexed,input),phone=resolved.phone,patient=resolved.patient,patientId=resolved.patientId,bookings=records(s).filter(x=>x.phone===phone||x.patientId&&x.patientId===patientId),latest=bookings.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];return {phone,patientId,patient,name:patient.n||latest?.name||'',bookings};}
function source(s,r,person,id){if(!id)return null;checkId(id);const row=person.bookings.find(x=>x.id===id);if(!row)core.fail('الحجز السابق غير موجود',404);core.allowed(r,row.b);return row;}
function access(s,r,person){cases.assertAccess(s,r,person.phone);}
function canClinical(r){return ['doctor','admin'].includes(r.r)&&perms.can(r,'notes.read');}
function planPhone(s,p){if(p.patientId){const pair=Object.entries(s.patients||{}).find(([phone])=>patientIdentity.idForPhone(s,phone)===p.patientId);if(pair)return pair[0];}return p.phone;}
function derive(s,p,now=core.today()){
 const appointment=records(s).find(x=>x.id===(p.linkedBookingId||p.bookingId)),end=p.sensitive?p.windowTo:p.targetDate;
 const status=appointment?.s==='done'?'done':appointment&&['cx','no'].includes(appointment.s)?'needs_followup':appointment&&['wait','exam'].includes(appointment.s)?(appointment.date<now?'needs_followup':'booked'):end<now?'needs_followup':'unbooked';
 return {status,statusLabel:{unbooked:'لم تُحجز',booked:'محجوزة',done:'تمت',needs_followup:'تحتاج متابعة'}[status],appointment:appointment?{id:appointment.id,date:appointment.date,branch:appointment.b,no:appointment.no,status:appointment.s,patientId:appointment.patientId||p.patientId||null}:null};
}
function available(s,r,date){const registry=branches.branches(s),a=schedule.availability(registry,s.settings?.sched||{},date);return Object.entries(registry).filter(([b,x])=>x.enabled!==false&&(perms.allBranches(r)||r.br===b)&&(a.scheduled.some(x=>x.id===b)||a.flexible.includes(b))).map(([id,x])=>({id,name:x.name,scheduled:a.scheduled.some(x=>x.id===id),flexible:a.flexible.includes(id),full:!!x.maxBookings&&Object.values(s.bookings?.[date]||{}).filter(y=>y.b===id&&y.s!=='cx'&&y.v!=='emergency').length>=x.maxBookings}));}
function project(s,r,p){const phone=planPhone(s,p),patient=s.patients?.[phone]||{},x={id:p.id,phone,patientId:patientIdentity.idForPhone(s,phone)||p.patientId||null,name:patient.n||p.name,type:p.type,lastVisit:p.lastVisit,targetDate:p.targetDate,windowFrom:p.windowFrom,windowTo:p.windowTo,sensitive:p.sensitive,schedulingInstructions:p.schedulingInstructions||'',branch:p.branch,sourceBookingId:p.sourceBookingId||null,revision:p.revision,createdAt:p.createdAt,updatedAt:p.updatedAt,...derive(s,p)};if(canClinical(r))Object.assign(x,{kind:p.kind,label:p.label,requirements:p.requirements||'',createdBy:p.createdBy});return x;}
function personView(person){return {phone:person.phone,patientId:person.patientId,name:person.name,spouseName:person.patient.spouseName||'',spouseJob:person.patient.spouseJob||'',spousePhone:person.patient.spousePhone||''};}
function list(s,uid,input={}){
 const r=role(s,uid,'bookings.read');let person=null;if(input.phone||input.patientId){person=identity(s,input);access(s,r,person);source(s,r,person,input.sourceBookingId);}
 const branch=input.branch||'all';if(branch!=='all')core.allowed(r,branch);
 const plans=Object.values(s.followupPlans||{}).filter(p=>{const ph=planPhone(s,p);return (!person||ph===person.phone||person.patientId&&p.patientId===person.patientId)&&(branch==='all'||p.branch===branch)&&(perms.allBranches(r)||p.branch===r.br||person?.bookings.some(x=>x.b===r.br))&&cases.canAccess(s,r,ph)}).map(p=>project(s,r,p)).sort((a,b)=>{const rank=x=>x.status==='done'?1:0;return rank(a)-rank(b)||String(b.updatedAt).localeCompare(String(a.updatedAt))});
 const date=input.date?core.date(input.date):null,dateBranches=date?available(s,r,date):[];
 // A full or rescheduled branch must not hide this patient's already issued booking.
 const existing=date&&person?person.bookings.find(x=>x.date===date&&(perms.allBranches(r)||x.b===r.br)):null;
 if(existing){const option=dateBranches.find(x=>x.id===existing.b);if(option)option.existing=true;else dateBranches.push({id:existing.b,name:branches.branches(s)[existing.b]?.name||existing.b,scheduled:false,flexible:false,full:true,existing:true});}
 const offset=Math.max(0,Math.floor(Number(input.offset)||0)),limit=Math.max(1,Math.min(100,Number(input.limit)||30));return {plans:plans.slice(offset,offset+limit),total:plans.length,offset,hasMore:plans.length>offset+limit,patient:person?personView(person):null,branches:dateBranches};
}
function save(original,uid,input){
 const r=role(original,uid,'notes.edit');if(!['doctor','admin'].includes(r.r))core.fail('خطة المتابعة يحددها الطبيب فقط',403);const person=identity(original,input);access(original,r,person);const previous=source(original,r,person,input.sourceBookingId),id=input.id?checkId(input.id):'followup_'+crypto.randomUUID(),old=original.followupPlans?.[id];
 if(old&&planPhone(original,old)!==person.phone)core.fail('خطة المتابعة تخص ملفًا آخر',409);
 const type=input.type||'follow';if(!TYPES.includes(type))core.fail('اختر متابعة أو استشارة');
 const lastVisit=core.date(input.lastVisit||previous?.date||core.today());let targetDate=input.targetDate;
 if(input.afterDays!==undefined){if(!Number.isInteger(input.afterDays)||input.afterDays<1||input.afterDays>365)core.fail('عدد أيام المتابعة من 1 إلى 365');const d=new Date(lastVisit+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+input.afterDays);targetDate=d.toISOString().slice(0,10);}
 targetDate=core.date(targetDate);if(targetDate<lastVisit)core.fail('موعد المتابعة يجب ألا يسبق الزيارة');
 const sensitive=input.sensitive===true,windowFrom=core.date(sensitive?input.windowFrom||targetDate:targetDate),windowTo=core.date(sensitive?input.windowTo||targetDate:targetDate);if(windowFrom>windowTo||targetDate<windowFrom||targetDate>windowTo)core.fail('الموعد المقترح يجب أن يكون داخل نافذة المتابعة');
 const branch=previous?.b||input.branch||old?.branch||person.patient.br||branches.ids(original,true)[0];if(!branches.ids(original).includes(branch))core.fail('فرع غير صحيح');core.allowed(r,branch);
 const values={phone:person.phone,patientId:person.patientId,name:person.name,type,kind:text(input.kind||'general',50),label:text(input.label||'خطة متابعة',120),requirements:text(input.requirements||'',2000),schedulingInstructions:text(input.schedulingInstructions||'',1000),lastVisit,targetDate,windowFrom,windowTo,sensitive,branch,sourceBookingId:input.sourceBookingId||old?.sourceBookingId||null};
 const operation=input.idempotencyKey||input.operationId||null;if(operation)checkId(operation);const signature=JSON.stringify(values);
 const retry=!old&&operation?Object.values(original.followupPlans||{}).find(x=>x.createdBy===uid&&x.lastOperation===operation):null;if(retry){if(retry.signature!==signature)core.fail('معرف الحفظ مستخدم لبيانات مختلفة',409);return {state:original,plan:project(original,r,retry),alreadySaved:true};}
 if(old&&operation&&old.lastOperation===operation){if(old.signature!==signature)core.fail('معرف الحفظ مستخدم لبيانات مختلفة',409);return {state:original,plan:project(original,r,old),alreadySaved:true};}
 if(old&&Number(input.revision)!==old.revision)core.fail('الخطة عدلها مستخدم آخر؛ أعد فتحها قبل الحفظ',409);if(!old&&input.revision!==undefined&&Number(input.revision)!==0)core.fail('خطة المتابعة غير موجودة أو تغيرت',409);
 const s=structuredClone(original),at=new Date().toISOString(),next={...old,...values,id,revision:(old?.revision||0)+1,createdAt:old?.createdAt||at,createdBy:old?.createdBy||uid,updatedAt:at,updatedBy:uid,lastOperation:operation,signature};
 const linked=records(s).find(x=>x.id===(next.linkedBookingId||next.bookingId));if(linked&&['wait','exam'].includes(linked.s)&&sensitive&&(linked.date<windowFrom||linked.date>windowTo))core.fail('الحجز المرتبط خارج نافذة المتابعة الجديدة؛ راجع موعده أولًا',409);
 s.followupPlans||={};s.followupPlans[id]=next;
 if(linked&&['wait','exam'].includes(linked.s)&&linked.followupPlanId===id){
  const booking=s.bookings[linked.date][linked.id],window=sensitive?{from:windowFrom,to:windowTo,sensitive:true,planId:id}:null;
  if(window&&JSON.stringify(booking.timingWindow)!==JSON.stringify(window)){booking.timingWindow=window;booking.rev=(booking.rev||0)+1;}
  else if(!window&&booking.timingWindow?.planId===id){delete booking.timingWindow;booking.rev=(booking.rev||0)+1;}
 }
 return {state:s,plan:project(s,r,next)};
}
function book(original,uid,input){
 const r=role(original,uid,'bookings.create');perms.requirePermission(r,'bookings.read');const plan=input.planId?original.followupPlans?.[checkId(input.planId)]:null;if(input.planId&&!plan)core.fail('خطة المتابعة غير موجودة',404);
 const person=identity(original,{phone:input.phone||plan?.phone,patientId:input.patientId||plan?.patientId});access(original,r,person);if(plan&&planPhone(original,plan)!==person.phone)core.fail('خطة المتابعة تخص ملفًا آخر',409);const previous=source(original,r,person,input.sourceBookingId||plan?.sourceBookingId);
 const date=core.date(input.date||plan?.targetDate);if(date<core.today())core.fail('اختر موعدًا قادمًا للزيارة');const type=input.type||plan?.type||'follow';if(!TYPES.includes(type))core.fail('اختر متابعة أو استشارة');let branch=input.branch||schedule.choose(branches.branches(original),original.settings?.sched||{},date);
 if(plan?.sensitive&&(date<plan.windowFrom||date>plan.windowTo))core.fail('الموعد خارج نافذة المتابعة التي حددها الطبيب؛ راجع الطبيب قبل تغييره',409);
 const same=Object.values(original.bookings?.[date]||{}).find(x=>x.phone===person.phone||person.patientId&&x.patientId===person.patientId);
 if(same){
  core.allowed(r,same.b);let state=original,booking=same;
  if(plan&&['wait','exam'].includes(same.s)&&same.id!==previous?.id){
   const linked=records(original).find(x=>x.id===(plan.linkedBookingId||plan.bookingId)&&['wait','exam'].includes(x.s));
   if(linked&&linked.id!==same.id)core.fail('الخطة لها حجز قائم بالفعل؛ افتح الحجز المرتبط بدل ربط حجز آخر',409);
   if(same.followupPlanId&&same.followupPlanId!==plan.id||same.timingWindow?.planId&&same.timingWindow.planId!==plan.id)core.fail('الحجز الموجود مرتبط بخطة متابعة أخرى؛ راجع الطبيب قبل تغييره',409);
   if(same.followupPlanId!==plan.id||plan.linkedBookingId!==same.id){
    state=structuredClone(original);booking=state.bookings[date][same.id];const at=new Date().toISOString();
    Object.assign(booking,{followupPlanId:plan.id,patientId:person.patientId,nextVisitOf:booking.nextVisitOf||previous?.id||null,rev:(booking.rev||0)+1});
    if(plan.sensitive)booking.timingWindow={from:plan.windowFrom,to:plan.windowTo,sensitive:true,planId:plan.id};
    state.followupPlans[plan.id]={...plan,bookingId:same.id,linkedBookingId:same.id,bookedAt:at,bookedBy:uid,revision:plan.revision+1,updatedAt:at,updatedBy:uid};
   }
  }
  return {state,booking:safeBooking(booking),existing:true,plan:plan?project(state,r,state.followupPlans[plan.id]):null,patient:personView(person)};
 }
 if(!branch||!available(original,r,date).some(x=>x.id===branch&&!x.full))core.fail('اختر فرعًا متاحًا حسب جدول الطبيب',409);core.allowed(r,branch);
 const already=plan&&records(original).find(x=>x.id===(plan.linkedBookingId||plan.bookingId)&&['wait','exam'].includes(x.s));if(already)core.fail('الخطة لها حجز قائم بالفعل؛ افتح الحجز لتعديله بدل إنشاء حجز آخر',409);
 const operation=input.idempotencyKey||input.operationId;if(operation)checkId(operation);const receipt=operation&&records(original).find(x=>x.nextVisitRequestKey===operation&&x.nextVisitBookedBy===uid);if(receipt){if(receipt.date!==date||receipt.b!==branch||receipt.phone!==person.phone||receipt.v!==type)core.fail('معرف الطلب مستخدم لحجز مختلف',409);return {state:original,booking:safeBooking(receipt),existing:true,plan:plan?project(original,r,plan):null,patient:personView(person)};}
 const id='next_'+crypto.randomUUID(),family=Object.fromEntries(['spouseName','spouseJob','spousePhone'].filter(k=>person.patient[k]!==undefined).map(k=>[k,person.patient[k]]));
 const put={n:{id,name:person.name,phone:person.phone,date,b:branch,v:type,s:'wait',nt:''},patient:family};let s=core.commit(original,uid,[put],[]).state;const row=s.bookings[date][id];row.patientId=person.patientId||s.patients?.[person.phone]?.patientId||s.patients?.[person.phone]?.id||null;row.nextVisitOf=previous?.id||null;row.nextVisitRequestKey=operation||null;row.nextVisitBookedBy=uid;if(plan){row.followupPlanId=plan.id;if(plan.sensitive)row.timingWindow={from:plan.windowFrom,to:plan.windowTo,sensitive:true,planId:plan.id};s.followupPlans[plan.id]={...plan,bookingId:id,linkedBookingId:id,bookedAt:new Date().toISOString(),bookedBy:uid,revision:plan.revision+1,updatedAt:new Date().toISOString()};}
 return {state:s,booking:safeBooking(row),existing:false,plan:plan?project(s,r,s.followupPlans[plan.id]):null,patient:personView(person)};
}
function safeBooking(x){return {id:x.id,date:x.date,b:x.b,no:x.no,name:x.name,phone:x.phone,v:x.v,s:x.s,patientId:x.patientId||null};}
function guardWindow(before,next){const prior=new Map(records(before).map(x=>[x.id,x]));for(const rows of Object.values(next.bookings||{}))for(const x of Object.values(rows||{})){const old=prior.get(x.id),p=x.followupPlanId&&next.followupPlans?.[x.followupPlanId];if(p?.sensitive&&['wait','exam'].includes(x.s)&&(x.date<p.windowFrom||x.date>p.windowTo)&&(!old||old.date!==x.date||old.s!==x.s||old.followupPlanId!==x.followupPlanId))core.fail('نقل الحجز خارج نافذة المتابعة يحتاج مراجعة الطبيب أولًا',409);}return next;}
async function handle(adapter,input,uid){if(input.action==='followupPlanList')return list(await adapter.read(),uid,input);let result;await adapter.mutate(s=>{result=input.action==='followupPlanSave'?save(s,uid,input):book(s,uid,input);return result.state});const {state,...value}=result;return {ok:true,...value};}
export {actions,list,save,book,derive,project,available,guardWindow,handle};
