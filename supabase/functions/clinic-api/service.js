import * as demoNames from './demo-names.js';
import * as history from './history.js';
import * as perms from './permissions.js';
import * as management from './management.js';
import * as core from './core.js';
import * as features from './clinic-features.js';
import * as imports from './data-import.js';
import * as branchConfig from './branches.js';
import * as attachments from './attachments.js';
import * as cleanup from './storage-cleanup.js';
import * as cases from './cases.js';
import * as backup from './complete-backup.js';
import * as scheduleReview from './schedule-review.js';
function createService(baseAdapter) {
 return async function handle(input,uid,client='local') {
  const {action}=input||{};
  const adapter={...baseAdapter,mutate:fn=>baseAdapter.mutate(original=>{
   const before=structuredClone(original);return history.record(before,fn(original),input,uid);
  })};
  if(action==='normalizeDemoNames'){let summary;await adapter.mutate(s=>{const result=demoNames.normalize(s,uid);summary=result.summary;return result.state;});return {ok:true,...summary,profileMigrationVersion:1};}
  if(action==='trashList')return history.list(await adapter.read(),uid,input);
  if(action==='trashRestore'){await adapter.mutate(s=>history.restore(s,uid,input.id));return {ok:true};}
  if(action==='auditDetail'){const s=await adapter.read();history.admin(s,uid,'audit.details');const entry=(s.audit||[]).find(x=>x.id===input.id);if(!entry)core.fail('السجل غير موجود',404);const changes=s.activityDetails?.[input.id]||[];return {...entry,changes,context:s.activityContext?.[input.id]||history.context(s,s,changes,entry)};}
  if(action==='attachmentExport')return backup.exportImage(adapter,input,uid);
  if(['attachmentList','attachmentUpload','attachmentRead','attachmentDelete'].includes(action))return attachments.handleAttachments(adapter,input,uid);
  const readFields=(fields,day=null,entity=null)=>adapter.readFields?adapter.readFields(fields,day,entity):adapter.read();
  if(action==='importPreview'){const plan=imports.prepare(await adapter.read(),uid,input.data,input.options);return {summary:plan.summary,token:plan.token};}
  if(action==='importApply'){if(input.confirmation!=='IMPORT_CLINIC_DATA'||typeof input.previewToken!=='string')core.fail('راجع المعاينة وأكد الاستيراد أولًا');let summary;await adapter.mutate(s=>{const plan=imports.prepare(s,uid,input.data,input.options);if(plan.token!==input.previewToken)core.fail('تغيرت بيانات العيادة أو الملف منذ المعاينة؛ أعد المعاينة أولًا',409);summary=plan.summary;return plan.state;});return {ok:true,summary};}
  if(action==='exportData'){const s=await adapter.read();perms.requirePermission(core.role(s,uid),'data.export');return {format:'clinic-backup',schemaVersion:1,exportedAt:new Date().toISOString(),bookings:s.bookings||{},settings:s.settings||{},roles:s.roles||{},patients:s.patients||{},files:s.files||{},complaints:cases.numberComplaints(structuredClone(s)).complaints||{},inbox:s.inbox||{},complaintSequences:cases.numberComplaints(structuredClone(s)).complaintSequences||{},attachments:s.attachments||{}};}
  if(action==='lookup'){
   const d=input.date===undefined?core.today():core.date(input.date),p=core.phone(input.phone);if(!/^01[0125]\d{8}$/.test(p))return null;await adapter.limit(client,p);const state=await (adapter.readLookup?adapter.readLookup(p,d):adapter.read()),result=core.lookup(state,p,d);return result&&core.branchIds(state,true).includes(result.b)?result:null;
  }
  if(action==='lookupHistory'){const p=core.phone(input.phone);if(!/^01[0125]\d{8}$/.test(p))return [];await adapter.limit(client,p);const s=await(adapter.readHistory?adapter.readHistory(p):adapter.read());return Object.entries(s.bookings||{}).flatMap(([d,rows])=>Object.values(rows).filter(x=>core.phone(x.phone)===p&&core.branchIds(s,true).includes(x.b)).map(x=>({date:d,no:x.no,b:x.b,s:x.s}))).sort((a,b)=>b.date.localeCompare(a.date));}
  if(action==='designRestore'){await adapter.mutate(original=>{const s=structuredClone(original);perms.requirePermission(core.role(s,uid),'site.manage');if(!s.settings?.previousDesign)core.fail('لا يوجد تصميم سابق',404);const current=s.settings.site?.design||{};s.settings.site||={};s.settings.site.design=s.settings.previousDesign;s.settings.previousDesign=current;return s;});return {ok:true};}
  if(action==='branchDelete'){let archived=false;await adapter.mutate(original=>{let s=structuredClone(original);perms.requirePermission(core.role(s,uid),'clinic.manage');const b=input.branch,registry=branchConfig.branches(s);if(!Object.hasOwn(registry,b))core.fail('الفرع غير موجود',404);const linked=Object.values(s.bookings||{}).some(rows=>Object.values(rows).some(x=>x.b===b))||Object.values(s.roles||{}).some(x=>x.br===b)||Object.keys(s.sessions||{}).some(key=>key.endsWith('_'+b))||Object.values(s.deletedBookings||{}).some(x=>x.booking?.b===b);if(linked){archived=true;return branchConfig.save(s,uid,{branch:b,details:{...registry[b],enabled:false}},core,perms)}if(Object.keys(registry).length===1||registry[b].enabled!==false&&!Object.entries(registry).some(([id,x])=>id!==b&&x.enabled!==false))core.fail('يجب إبقاء فرع فعال');s.settings||={};s.settings.branches={...registry};delete s.settings.branches[b];delete s.settings.sched?.[b];delete s.settings.site?.branches?.[b];if(s.sessions?.[core.today()+'_presence']?.branch===b)delete s.sessions[core.today()+'_presence'];return s;});return {ok:true,archived};}
  if(action==='schedulePreview'){const state=await adapter.read();perms.requirePermission(core.role(state,uid),'clinic.manage');return scheduleReview.review(state,input.branch,input.schedule)}
  if(action==='branchDaysSet'){await adapter.mutate(original=>{perms.requirePermission(core.role(original,uid),'clinic.manage');if(!Object.hasOwn(branchConfig.branches(original),input.branch))core.fail('الفرع غير موجود',404);const s=structuredClone(original);s.settings||={};s.settings.sched||={};s.settings.sched[input.branch]=core.schedule({mode:'days',d:input.days,exceptions:s.settings.sched[input.branch]?.exceptions||{}});return s;});return {ok:true};}
  if(action==='branchSave'){await adapter.mutate(s=>branchConfig.save(s,uid,input,core,perms));return {ok:true};}
  if(action==='publicQueue'){const d=core.date(input.date||core.today());if(!branchConfig.validId(input.branch))core.fail('اختر الفرع');await adapter.limit?.(client,'display:'+input.branch);return features.publicQueue(await (adapter.readDay?adapter.readDay(d):adapter.read()),input.branch,d);}
  if(action==='followups'||action==='followupContact')core.fail('تم إلغاء مواعيد المتابعة',410);
  if(action==='retryAttachmentCleanup'){perms.requirePermission(core.role(await adapter.read(),uid),'data.delete');return {cleanupPending:await cleanup.drain(adapter)}}
  if(action==='systemHealth'||action==='backupDownload'){const s=await readFields(['roles']);perms.requirePermission(core.role(s,uid),'data.export');if(action==='systemHealth'){const health=adapter.systemHealth?await adapter.systemHealth():{lastBackup:null,retentionDays:14,errors:[]};return {...health,cleanupPending:Object.keys((await adapter.read()).attachmentGarbage||{}).length}}const backup=await adapter.latestBackup?.();if(!backup)core.fail('لا توجد نسخة آلية بعد',404);return backup;}
  if(action==='workspace'){
   const d=input.date?core.date(input.date):null,fields=['roles','settings','sessions','inbox','bookings'];if(input.tab==='cases')fields.push('patients');if(input.tab==='audit')fields.push('audit');if(input.tab==='deleted')fields.push('deletedBookings');const s=await readFields(fields,input.tab==='cases'?null:d),r=core.role(s,uid),result={role:perms.normalize(r),settings:core.publicSettings(s)||{},sessions:{},bookings:null};
   if(perms.can(r,'bookings.read')){result.bookings=core.read(s,uid,d?'bookings/'+d:'bookings');result.sessions={...s.sessions};const present=core.presence(s,core.today());if(present)result.sessions[core.today()+'_presence']={...s.sessions?.[core.today()+'_presence'],branch:present};}
   if(input.tab==='users'&&perms.can(r,'users.manage'))result.roles=core.read(s,uid,'roles');if(input.tab==='cases'&&perms.can(r,'patients.read'))result.patients=core.read(s,uid,'patients');
   if(perms.can(r,'notifications.read'))result.inbox=core.read(s,uid,'inbox');if(input.tab==='audit'&&perms.can(r,'audit.read'))result.audit=s.audit||[];if(input.tab==='deleted'&&perms.can(r,'bookings.delete'))result.deletedBookings=core.read(s,uid,'deletedBookings');return result;
  }
  if(action==='presenceSet'){await adapter.mutate(original=>{const s=structuredClone(original),r=core.role(s,uid);perms.requirePermission(r,'sessions.manage');const d=core.today(),b=input.branch;if(!core.branchIds(s,true).includes(b)||!perms.allBranches(r)&&r.br!==b)core.fail('غير مصرح لهذا الفرع',403);const previous=s.sessions?.[d+'_presence']?.branch;core.assertExamine({...s,sessions:Object.fromEntries(Object.entries(s.sessions||{}).filter(([key])=>key!==d+'_presence'))},d,b);s.sessions||={};s.sessions[d+'_presence']={branch:b,selectedAt:new Date().toISOString(),source:'manual'};return s;});return {ok:true};}
  if(action==='sessionSet'){
   await adapter.mutate(original=>{const s=structuredClone(original),r=core.role(s,uid);perms.requirePermission(r,'sessions.manage');const d=core.date(input.date),b=input.branch;
    if(d!==core.today()||!core.branchIds(s,true).includes(b)||!['running','paused','ended'].includes(input.status))core.fail('راجع تاريخ وفرع وحالة جلسة الكشف');if(!perms.allBranches(r)&&r.br!==b)core.fail('غير مصرح',403);
    s.sessions||={};const key=d+'_'+b,old=s.sessions[key]||{},now=new Date().toISOString(),rows=Object.values(s.bookings?.[d]||{}).filter(x=>x.b===b),active=rows.find(x=>x.s==='exam');
    if(input.status==='running'){core.assertExamine(s,d,b);s.sessions[d+'_presence']={branch:b,selectedAt:new Date().toISOString()};}
    if(old.status===input.status)return s;
    if(input.status==='running'){
     if(active&&!Number.isFinite(Date.parse(active.startedAt))){active.startedAt=now;active.rev=(active.rev||0)+1;}
     else if(old.status==='paused'&&active&&Number.isFinite(Date.parse(old.pausedAt))){const pause=Math.max(0,Date.now()-Date.parse(old.pausedAt));active.startedAt=new Date(Date.parse(active.startedAt)+pause).toISOString();active.rev=(active.rev||0)+1;}
     if(!active){const next=rows.filter(x=>x.s==='wait').sort(core.queueOrder)[0];if(next){next.s='exam';next.startedAt=now;next.rev=(next.rev||0)+1;}}
    }else if(input.status==='ended'&&active){active.s='done';active.rev=(active.rev||0)+1;}
    s.sessions[key]={...old,status:input.status,startedAt:old.startedAt||(input.status==='running'&&rows.some(x=>x.s==='exam')?now:null),pausedAt:input.status==='paused'?now:null,endedAt:input.status==='ended'?now:null};core.rebuild(s);return s;
   });return {ok:true};
  }
  if(action==='bookingRestore'){
   await adapter.mutate(original=>{const s=structuredClone(original),r=core.role(s,uid);perms.requirePermission(r,'bookings.delete');perms.requirePermission(r,'bookings.create');const item=s.deletedBookings?.[input.id];if(!item)core.fail('الحجز المحذوف غير موجود',404);const n={...item.booking,s:'wait'};if(!perms.allBranches(r)&&r.br!==n.b)core.fail('غير مصرح لهذا الفرع',403);if(Object.values(s.bookings||{}).some(rows=>rows[n.id]))core.fail('الحجز موجود بالفعل',409);const rows=(s.bookings||={})[n.date]||={};if(Object.values(rows).some(x=>core.phone(x.phone)===core.phone(n.phone)))core.fail('يوجد حجز للحالة في هذا اليوم بالفعل',409);s.sequences||={};const key=n.date+'_'+n.b;n.no=Math.max(s.sequences[key]||0,0,...Object.values(rows).filter(x=>x.b===n.b).map(x=>x.no))+1;n.rev=(n.rev||0)+1;delete n.startedAt;rows[n.id]=n;s.sequences[key]=n.no;delete s.deletedBookings[input.id];core.rebuild(s);return s;});return {ok:true};
  }
  if(action==='reportData'){
   const s=cases.numberComplaints(structuredClone(await adapter.read())),r=core.role(s,uid);perms.requirePermission(r,'reports.export');const from=core.date(input.from),to=core.date(input.to),b=input.branch;
   if(from>to||!['all',...core.branchIds(s)].includes(b))core.fail('راجع فترة وفرع التقرير');if(!perms.allBranches(r)&&(b==='all'||b!==r.br))core.fail('غير مصرح لهذا الفرع',403);
   const bookings=Object.values(s.bookings||{}).flatMap(Object.values).filter(x=>x.date>=from&&x.date<=to&&(b==='all'||x.b===b)).sort((a,z)=>a.date.localeCompare(z.date)||a.b.localeCompare(z.b)||a.no-z.no).map(({id,name,phone,date,b,no,v,s,startedAt})=>({id,name,phone,date,b,no,v,s,startedAt}));
   const phones=new Set(bookings.map(x=>x.phone));return {from,to,branch:b,generatedAt:new Date().toISOString(),site:{...s.settings?.site,branches:branchConfig.branches(s)},avg:s.settings?.avg||15,bookings,files:perms.can(r,'notes.read')?Object.fromEntries(Object.entries(s.files||{}).filter(([p])=>phones.has(p))):{},complaints:perms.can(r,'complaints.read')?Object.fromEntries(Object.entries(s.complaints||{}).filter(([p])=>phones.has(p))):{}};
  }
  if(action==='get'){const root=String(input.path||'').split('/')[0],entity=['files','complaints'].includes(root)?input.path.split('/')[1]||null:null,fields=root==='settings'?['settings']:['patients','files','complaints','inbox'].includes(root)?['roles','patients','bookings',root]:['roles',root],d=root==='bookings'&&input.path.split('/')[1]?core.date(input.path.split('/')[1]):null;return core.read(await readFields(fields,d,entity),uid,input.path);}
  if(action==='commit') {
   let result;
   await adapter.mutate(state=>{result=core.commit(state,uid,input.puts,input.dels);return result.state});
   return {ok:true};
  }
  if(action==='patch'){await adapter.mutate(s=>core.patch(s,uid,input.updates));return {ok:true};}
  if(action==='purgeDemo'){
   await adapter.mutate(original=>{
    perms.requirePermission(core.role(original,uid),'data.delete');const state=structuredClone(original),phones=new Set();
    for(const rows of Object.values(state.bookings||{}))for(const [id,x] of Object.entries(rows))if(/^demo[-_]/.test(id)&&/^010000\d{5}$/.test(x.phone)){phones.add(x.phone);delete rows[id];}
    for(const p of phones){
     if(Object.values(state.bookings||{}).some(rows=>Object.values(rows).some(x=>x.phone===p)))continue;
     delete state.patients?.[p];delete state.files?.[p];delete state.complaints?.[p];
     for(const [id,n] of Object.entries(state.inbox||{}))if(n.p===p)delete state.inbox[id];
    }
    // Remove synthetic ticket counters only for queues emptied by this purge.
    // Real queues retain their high-water mark, so issued tickets are never reused.
    for(const key of Object.keys(state.sequences||{})){
     const d=key.slice(0,10),b=key.slice(11);
     if(!Object.values(original.bookings?.[d]||{}).some(x=>x.b===b&&phones.has(x.phone)))continue;
     if(!Object.values(state.bookings?.[d]||{}).some(x=>x.b===b))delete state.sequences[key];
    }
    state.settings||={};state.settings.demoPurged=true;core.rebuild(state);return state;
   });return {ok:true};
  }
  if(['displaySave','headerSave','siteContentSave','siteSave','userSave','patientSave','patientDelete','dataClear'].includes(action)){await adapter.mutate(s=>management.mutate(s,uid,input,core));return {ok:true,...(['patientDelete','dataClear'].includes(action)?{cleanupPending:await cleanup.drain(adapter)}:{})};}
  if(action==='userRevokeSessions'){const state=await adapter.read();perms.requirePermission(core.role(state,uid),'users.manage');if(!state.roles?.[input.uid])core.fail('المستخدم غير موجود',404);await adapter.revokeUserSessions(input.uid);await adapter.mutate(s=>structuredClone(s));return {ok:true};}
  if(action==='userPassword'){const state=await adapter.read();perms.requirePermission(core.role(state,uid),'users.manage');if(!input.uid||typeof input.password!=='string'||input.password.length<6||input.password.length>128)core.fail('كلمة السر من 6 إلى 128 حرفاً');const target=state.roles?.[input.uid];if(!target)core.fail('المستخدم غير موجود',404);try{await adapter.updateUser(input.uid,input.password)}catch(e){if(e.status>=500)core.fail('تعذر تأكيد نتيجة تغيير كلمة السر لحساب '+target.u+'. تحقق من تسجيل الدخول قبل إعادة المحاولة.',503);throw e}let warning='';try{await adapter.revokeUserSessions(input.uid)}catch(e){warning='تم حفظ كلمة السر، لكن تعذر إنهاء الجلسات القديمة. أعد محاولة إنهائها.'}await adapter.mutate(s=>structuredClone(s));return {ok:true,username:target.u,enabled:target.enabled!==false,warning};}
  if(action==='userCredentials'){
   const state=await adapter.read();perms.requirePermission(core.role(state,uid),'users.manage');const old=state.roles?.[input.uid];if(!old)core.fail('المستخدم غير موجود',404);
   const username=String(input.username||'').trim().toLowerCase(),password=input.password||'';
   if(!/^[a-z0-9._-]{3,64}$/.test(username)||typeof password!=='string'||password&&(password.length<6||password.length>128))core.fail('راجع اسم الدخول وكلمة السر (6 إلى 128 حرفًا)');
   if(Object.entries(state.roles).some(([id,r])=>id!==input.uid&&r.u===username))core.fail('اسم الدخول مستخدم بالفعل',409);
   // Synchronize the login name before changing any password.
   if(username!==old.u)await adapter.updateCredentials(input.uid,{username,password:''});
   try{await adapter.mutate(s=>{perms.requirePermission(core.role(s,uid),'users.manage');if(!s.roles[input.uid])core.fail('المستخدم حُذف أثناء التعديل',409);if(s.roles[input.uid].u!==old.u||Object.entries(s.roles).some(([id,r])=>id!==input.uid&&r.u===username))core.fail('تغيرت بيانات الدخول أثناء التعديل؛ أعد تحميل المستخدمين',409);s=structuredClone(s);s.roles[input.uid].u=username;return s})}catch(e){if(username!==old.u){try{await adapter.updateCredentials(input.uid,{username:old.u,password:''})}catch(rollback){core.fail('تعذر تأكيد اسم الدخول بعد انقطاع الاتصال. كلمة السر لم تُغيّر؛ أعد تحميل المستخدمين وتحقق من اسم الدخول قبل إعادة المحاولة.',503)}}throw e}
   if(password){try{await adapter.updateUser(input.uid,password)}catch(e){if(e.status>=500)core.fail('تم حفظ اسم الدخول '+username+'، لكن تعذر تأكيد نتيجة تغيير كلمة السر. تحقق من تسجيل الدخول قبل إعادة المحاولة.',503);e.message='تم حفظ اسم الدخول '+username+'. '+e.message;throw e}}
   let warning='';try{await adapter.revokeUserSessions(input.uid)}catch(e){warning='تم حفظ بيانات الدخول، لكن تعذر إنهاء الجلسات القديمة. أعد محاولة إنهائها.'}return {ok:true,username,warning};
  }
  if(action==='userDelete'){
   await adapter.mutate(original=>{const s=structuredClone(original);perms.requirePermission(core.role(s,uid),'users.manage');const target=s.roles?.[input.uid];if(!target)core.fail('المستخدم غير موجود',404);if(input.uid===uid)core.fail('لا يمكنك حذف الحساب المستخدم حاليًا');for(const role of ['admin'])if(target.r===role&&!Object.entries(s.roles).some(([id,r])=>id!==input.uid&&r.r===role&&r.enabled!==false))core.fail('يجب إبقاء '+(role==='admin'?'مدير':'طبيب')+' فعال');s.roles[input.uid]={...target,enabled:false,deletePending:false,archivedAt:new Date().toISOString()};return s;});
   // Retain the identity so the administrator can restore access without losing credentials.
   return {ok:true,archived:true};
  }
  if(action==='userRestore'){await adapter.mutate(original=>{history.admin(original,uid);const s=structuredClone(original),r=s.roles?.[input.uid];if(!r?.archivedAt)core.fail('الحساب المؤرشف غير موجود',404);r.enabled=true;delete r.archivedAt;delete r.deletePending;return s;});return {ok:true};}

  if(action==='userCreate') {
   perms.requirePermission(core.role(await adapter.read(),uid),'users.manage');
   if(!/^[a-z0-9._-]{3,64}$/.test(input.u||'')||typeof input.p!=='string'||input.p.length<6||input.p.length>128||(!input.role&&![...core.branchIds(await adapter.read()),'nurse'].includes(input.br)))core.fail('بيانات الحساب غير صحيحة');
   const assigned=perms.validateRole(input.role?{...input.role,u:input.u}:input.br==='nurse'?{r:'nurse',u:input.u}:{r:'sec',u:input.u,br:input.br},core.fail,core.branchIds(await adapter.read()));const user=await adapter.createUser(input.u,input.p);
   try{await adapter.mutate(s=>{perms.requirePermission(core.role(s,uid),'users.manage');s=structuredClone(s);s.roles[user]=assigned;return s;});}
   catch(e){await adapter.deleteUser(user);throw e;}
   return {uid:user};
  }
  core.fail('عملية غير مسموحة',403);
 };
}
export {createService};
