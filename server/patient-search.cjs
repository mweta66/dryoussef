const core=require('./core.cjs');
const perms=require('./permissions.cjs');
const cases=require('./cases.cjs');
const identity=require('./patient-identity.cjs');
const actions=['patientSearch','patientHistoryPage'];
const missingPageRPC=e=>e?.upstreamStatus===404&&e?.upstreamCode==='PGRST202';
function paging(input){const page=input.page===undefined?0:Number(input.page),pageSize=input.pageSize===undefined?20:Number(input.pageSize);if(!Number.isInteger(page)||page<0||page>100000||!Number.isInteger(pageSize)||pageSize<1||pageSize>50)core.fail('حدود الصفحة غير صحيحة');return {page,pageSize};}
function normalized(text){const value=String(text||'').normalize('NFKC').toLocaleLowerCase('ar').replace(/[٠-٩۰-۹]/g,d=>{const n=d.charCodeAt(0);return n>=1776?n-1776:n-1632}).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();return /^[0-9\s()+-]+$/.test(value)?identity.normalizePhone(value):value;}
function scope(s,uid,input={}){const r=core.role(s,uid);perms.requirePermission(r,'patients.read');const selected=input.branch&&input.branch!=='all'?input.branch:null;if(selected&&!core.branchIds(s).includes(selected))core.fail('الفرع غير موجود',404);if(!cases.allPatients(r)&&selected&&selected!==r.br)core.fail('غير مصرح ببيانات هذا الفرع',403);return {r,branch:selected||(!cases.allPatients(r)?r.br:null)};}
function accessBranch(s,phone,branch){return !branch||s.patients?.[phone]?.br===branch||Object.values(s.bookings||{}).some(rows=>Object.values(rows).some(x=>x.phone===phone&&x.b===branch));}
function search(s,uid,input={}){
 const {r,branch}=scope(s,uid,input),{page,pageSize}=paging(input),query=normalized(input.query);if(query.length>120)core.fail('نص البحث طويل');const indexed=cases.indexPatients(structuredClone(s));
 const rows=Object.entries(indexed.patients||{}).filter(([phone,p])=>cases.canAccess(indexed,r,phone)&&accessBranch(indexed,phone,branch)&&(!query||normalized(phone).includes(query)||normalized(p.n).includes(query))).sort(([ap,a],[bp,b])=>String(a.n||'').localeCompare(String(b.n||''),'ar',{numeric:true,sensitivity:'base'})||ap.localeCompare(bp));
 return {query:String(input.query||''),page,pageSize,total:rows.length,pages:Math.max(1,Math.ceil(rows.length/pageSize)),hasMore:(page+1)*pageSize<rows.length,rows:rows.slice(page*pageSize,(page+1)*pageSize).map(([phone,p])=>({phone,patientId:identity.idForPhone(indexed,phone),name:p.n||'',registeredDate:p.d||'',branch:p.br||null,spouseName:p.spouseName||'',spouseJob:p.spouseJob||'',spousePhone:p.spousePhone||'',training:identity.isTrainingPatient(indexed,phone)}))};
}
function history(s,uid,input={}){
 const {r}=scope(s,uid),{page,pageSize}=paging(input),kind=input.kind||'all';if(!['all','booking','complaint','attachment','medical'].includes(kind))core.fail('نوع السجل غير صحيح');const indexed=cases.indexPatients(structuredClone(s)),patient=identity.resolve(indexed,input);cases.assertAccess(indexed,r,patient.phone);const phone=patient.phone,rows=[],push=x=>{if(kind==='all'||x.kind===kind)rows.push(x)};
 if(perms.can(r,'bookings.read'))for(const records of Object.values(indexed.bookings||{}))for(const b of Object.values(records))if(b.phone===phone&&(cases.allPatients(r)||b.b===r.br)){const data=perms.can(r,'notes.read')?b:{...b,nt:''};push({id:b.id,kind:'booking',date:b.date,at:b.updatedAt||b.createdAt||b.date,no:b.no,title:'حجز',text:b.v,by:b.updatedBy||b.createdBy||'',data})}
 if(perms.can(r,'complaints.read'))for(const [id,c]of Object.entries(indexed.complaints?.[phone]||{}))push({id,kind:'complaint',date:c.date,at:c.at||c.date,no:c.no||0,title:'شكوى',reason:c.reason||'',text:c.text||'',tx:c.tx||'',by:c.by||'',data:{...c,id}});
 if(perms.can(r,'attachments.read'))for(const [id,a]of Object.entries(indexed.attachments?.[phone]||{})){const data={id:a.id||id,name:a.name,mime:a.mime,size:a.size,category:a.category,reportDate:a.reportDate,createdAt:a.createdAt,by:a.by};push({id,kind:'attachment',date:a.reportDate||String(a.createdAt||'').slice(0,10),at:a.createdAt||a.reportDate,title:a.name,text:a.category||'report',by:a.by||'',data})}
 if(perms.can(r,'notes.read'))for(const [id,visit]of Object.entries(indexed.clinicalVisits||{}))if(visit.phone===phone||visit.patientId===patient.patientId)push({id,kind:'medical',date:visit.date||String(visit.completedAt||'').slice(0,10),at:visit.completedAt||visit.date||'',title:'سجل الكشف',text:visit.medical?.n||'',by:visit.by||'',data:visit});
 if(perms.can(r,'notes.read')&&indexed.files?.[phone]){const f=indexed.files[phone];push({id:'medical-current',kind:'medical',date:String(f.t||patient.patient.d||'').slice(0,10),at:f.t||patient.patient.d||'',title:'الملف الطبي',text:f.n||'',by:f.by||'',data:f})}
 rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.at||'').localeCompare(String(a.at||''))||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));return {phone,patientId:patient.patientId,patient:{name:patient.patient.n||''},page,pageSize,total:rows.length,pages:Math.max(1,Math.ceil(rows.length/pageSize)),hasMore:(page+1)*pageSize<rows.length,rows:rows.slice(page*pageSize,(page+1)*pageSize)};
}
async function handle(adapter,input,uid){
 const {page,pageSize}=paging(input),roles=adapter.readFields?await adapter.readFields(['roles']):await adapter.read(),r=core.role(roles,uid);perms.requirePermission(r,'patients.read');
 if(input.action==='patientSearch'){
  const rawQuery=String(input.query||'').trim(),query=normalized(rawQuery);if(query.length>120)core.fail('نص البحث طويل');if(input.branch&&input.branch!=='all'&&!cases.allPatients(r)&&input.branch!==r.br)core.fail('غير مصرح ببيانات هذا الفرع',403);
  if(adapter.patientSearchPage)try{return {...await adapter.patientSearchPage({actor_uid:uid,search_query:query,selected_branch:input.branch&&input.branch!=='all'?input.branch:null,selected_page:page,page_size:pageSize}),query:rawQuery};}catch(e){if(!missingPageRPC(e))throw e;}return search(await adapter.read(),uid,input);
 }
 const phone=input.phone?identity.normalizePhone(input.phone):null,id=input.patientId||null;if(phone&&!/^01[0125]\d{8}$/.test(phone)||id&&!/^pat_[a-f0-9]{32}$/.test(id)||!phone&&!id)core.fail('حدد الحالة بهاتف أو هوية داخلية صحيحة');if(!['all','booking','complaint','attachment','medical'].includes(input.kind||'all'))core.fail('نوع السجل غير صحيح');
 if(adapter.patientHistoryPage)try{return await adapter.patientHistoryPage({actor_uid:uid,patient_phone:phone,patient_id:id,entry_kind:input.kind||'all',selected_page:page,page_size:pageSize});}catch(e){if(!missingPageRPC(e))throw e;}return history(await adapter.read(),uid,input);
}
module.exports={actions,search,history,handle,paging};
