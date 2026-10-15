import * as perms from './permissions.js';
import * as management from './management.js';
import * as core from './core.js';
import * as features from './clinic-features.js';
function createService(baseAdapter) {
 return async function handle(input,uid,client='local') {
  const {action}=input||{};
  const adapter={...baseAdapter,mutate:fn=>baseAdapter.mutate(original=>{
   const next=fn(original);next.audit=[...(next.audit||[]),{at:new Date().toISOString(),actor:uid,actorName:original.roles?.[uid]?.displayName||original.roles?.[uid]?.u,action,target:input.uid,paths:action==='patch'?Object.keys(input.updates||{}).map(p=>p.split('/')[0]):undefined}].slice(-2000);return next;
  })};
  const readFields=(fields,day=null,entity=null)=>adapter.readFields?adapter.readFields(fields,day,entity):adapter.read();
  if(action==='exportData'){const s=await adapter.read();perms.requirePermission(core.role(s,uid),'data.export');return {exportedAt:new Date().toISOString(),bookings:s.bookings||{},settings:s.settings||{},roles:s.roles||{},patients:s.patients||{},files:s.files||{},complaints:s.complaints||{},inbox:s.inbox||{}};}
  if(action==='lookup'){
   const d=input.date===undefined?core.today():core.date(input.date),p=core.phone(input.phone);if(!/^01[0125]\d{8}$/.test(p))return null;await adapter.limit(client,p);return core.lookup(await (adapter.readLookup?adapter.readLookup(p,d):adapter.read()),p,d);
  }
  if(action==='lookupHistory'){const p=core.phone(input.phone);if(!/^01[0125]\d{8}$/.test(p))return [];await adapter.limit(client,p);const s=await(adapter.readHistory?adapter.readHistory(p):adapter.read());return Object.entries(s.bookings||{}).flatMap(([d,rows])=>Object.values(rows).filter(x=>core.phone(x.phone)===p).map(x=>({date:d,no:x.no,b:x.b,s:x.s}))).sort((a,b)=>b.date.localeCompare(a.date));}
  if(action==='publicQueue'){const d=core.date(input.date||core.today());if(!['dmn','alex'].includes(input.branch))core.fail('اختر الفرع');await adapter.limit?.(client,'display:'+input.branch);return features.publicQueue(await (adapter.readDay?adapter.readDay(d):adapter.read()),input.branch,d);}
  if(action==='followups'||action==='followupContact')core.fail('تم إلغاء مواعيد المتابعة',410);
  if(action==='systemHealth'||action==='backupDownload'){const s=await readFields(['roles']);perms.requirePermission(core.role(s,uid),'data.export');if(action==='systemHealth')return adapter.systemHealth?adapter.systemHealth():{lastBackup:null,retentionDays:14,errors:[]};const backup=await adapter.latestBackup?.();if(!backup)core.fail('لا توجد نسخة آلية بعد',404);return backup;}
  if(action==='workspace'){
   const d=input.date?core.date(input.date):null,fields=['roles','settings','sessions','inbox','bookings'];if(input.tab==='cases')fields.push('patients');if(input.tab==='audit')fields.push('audit');if(input.tab==='deleted')fields.push('deletedBookings');const s=await readFields(fields,d),r=core.role(s,uid),result={role:perms.normalize(r),settings:s.settings||{},sessions:{},bookings:null};
   if(perms.can(r,'bookings.read')){result.bookings=core.read(s,uid,d?'bookings/'+d:'bookings');result.sessions={...s.sessions};const present=core.presence(s,core.today());if(present)result.sessions[core.today()+'_presence']={...s.sessions?.[core.today()+'_presence'],branch:present};}
   if(input.tab==='users'&&perms.can(r,'users.manage'))result.roles=core.read(s,uid,'roles');if(input.tab==='cases'&&perms.can(r,'patients.read'))result.patients=core.read(s,uid,'patients');
   if(perms.can(r,'notifications.read'))result.inbox=s.inbox||{};if(input.tab==='audit'&&perms.can(r,'audit.read'))result.audit=s.audit||[];if(input.tab==='deleted'&&perms.can(r,'bookings.delete'))result.deletedBookings=core.read(s,uid,'deletedBookings');return result;
  }
  if(action==='presenceSet'){await adapter.mutate(original=>{const s=structuredClone(original),r=core.role(s,uid);perms.requirePermission(r,'sessions.manage');const d=core.today(),b=input.branch;if(!['dmn','alex'].includes(b)||!perms.allBranches(r)&&r.br!==b)core.fail('غير مصرح لهذا الفرع',403);const previous=s.sessions?.[d+'_presence']?.branch;if(previous===b)return s;core.assertExamine({...s,sessions:Object.fromEntries(Object.entries(s.sessions||{}).filter(([key])=>key!==d+'_presence'))},d,b);s.sessions||={};s.sessions[d+'_presence']={branch:b,selectedAt:new Date().toISOString()};return s;});return {ok:true};}
  if(action==='sessionSet'){
   await adapter.mutate(original=>{const s=structuredClone(original),r=core.role(s,uid);perms.requirePermission(r,'sessions.manage');const d=core.date(input.date),b=input.branch;
    if(d!==core.today()||!['dmn','alex'].includes(b)||!['running','paused','ended'].includes(input.status))core.fail('راجع تاريخ وفرع وحالة جلسة الكشف');if(!perms.allBranches(r)&&r.br!==b)core.fail('غير مصرح',403);
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
   const s=await adapter.read(),r=core.role(s,uid);perms.requirePermission(r,'reports.export');const from=core.date(input.from),to=core.date(input.to),b=input.branch;
   if(from>to||!['all','dmn','alex'].includes(b))core.fail('راجع فترة وفرع التقرير');if(!perms.allBranches(r)&&(b==='all'||b!==r.br))core.fail('غير مصرح لهذا الفرع',403);
   const bookings=Object.values(s.bookings||{}).flatMap(Object.values).filter(x=>x.date>=from&&x.date<=to&&(b==='all'||x.b===b)).sort((a,z)=>a.date.localeCompare(z.date)||a.b.localeCompare(z.b)||a.no-z.no).map(({id,name,phone,date,b,no,v,s,startedAt})=>({id,name,phone,date,b,no,v,s,startedAt}));
   const phones=new Set(bookings.map(x=>x.phone));return {from,to,branch:b,generatedAt:new Date().toISOString(),site:s.settings?.site||{},avg:s.settings?.avg||15,bookings,files:perms.can(r,'notes.read')?Object.fromEntries(Object.entries(s.files||{}).filter(([p])=>phones.has(p))):{},complaints:perms.can(r,'complaints.read')?Object.fromEntries(Object.entries(s.complaints||{}).filter(([p])=>phones.has(p))):{}};
  }
  if(action==='get'){const root=String(input.path||'').split('/')[0],entity=['files','complaints'].includes(root)?input.path.split('/')[1]||null:null,fields=root==='settings'?['settings']:root==='patients'?['roles','patients']:['roles',root],d=root==='bookings'&&input.path.split('/')[1]?core.date(input.path.split('/')[1]):null;return core.read(await readFields(fields,d,entity),uid,input.path);}
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
  if(['siteSave','userSave','patientSave','patientDelete','dataClear'].includes(action)){await adapter.mutate(s=>management.mutate(s,uid,input,core));return {ok:true};}
  if(action==='userPassword'){perms.requirePermission(core.role(await adapter.read(),uid),'users.manage');if(!input.uid||typeof input.password!=='string'||input.password.length<6||input.password.length>128)core.fail('كلمة السر من 6 إلى 128 حرفاً');if(!(await adapter.read()).roles?.[input.uid])core.fail('المستخدم غير موجود',404);await adapter.updateUser(input.uid,input.password);return {ok:true};}
  if(action==='userCredentials'){
   const state=await adapter.read();perms.requirePermission(core.role(state,uid),'users.manage');const old=state.roles?.[input.uid];if(!old)core.fail('المستخدم غير موجود',404);
   const username=String(input.username||'').trim().toLowerCase(),password=input.password||'';
   if(!/^[a-z0-9._-]{3,64}$/.test(username)||typeof password!=='string'||password&&(password.length<6||password.length>128))core.fail('راجع اسم الدخول وكلمة السر (6 إلى 128 حرفًا)');
   if(Object.entries(state.roles).some(([id,r])=>id!==input.uid&&r.u===username))core.fail('اسم الدخول مستخدم بالفعل',409);
   await adapter.updateCredentials(input.uid,{username,password});
   try{await adapter.mutate(s=>{perms.requirePermission(core.role(s,uid),'users.manage');if(!s.roles[input.uid])core.fail('المستخدم حُذف أثناء التعديل',409);s=structuredClone(s);s.roles[input.uid].u=username;return s})}catch(e){await adapter.updateCredentials(input.uid,{username:old.u,password:''});throw e}
   await adapter.revokeUserSessions(input.uid);return {ok:true,username};
  }
  if(action==='userDelete'){await adapter.mutate(s=>{perms.requirePermission(core.role(s,uid),'users.manage');if(!s.roles?.[input.uid])core.fail('المستخدم غير موجود',404);if(input.uid===uid)core.fail('لا يمكنك حذف الحساب المستخدم حاليًا');if(s.roles[input.uid].r==='admin'&&!Object.entries(s.roles).some(([id,r])=>id!==input.uid&&r.r==='admin'&&r.enabled!==false))core.fail('يجب إبقاء مدير فعال');if(s.roles[input.uid].r==='doctor'&&!Object.entries(s.roles).some(([id,r])=>id!==input.uid&&r.r==='doctor'&&r.enabled!==false))core.fail('يجب إبقاء طبيب فعال');s=structuredClone(s);delete s.roles[input.uid];return s;});await adapter.deleteUser(input.uid);return {ok:true};}
  if(action==='userCreate') {
   perms.requirePermission(core.role(await adapter.read(),uid),'users.manage');
   if(!/^[a-z0-9._-]{3,64}$/.test(input.u||'')||typeof input.p!=='string'||input.p.length<6||input.p.length>128||(!input.role&&!['dmn','alex','nurse'].includes(input.br)))core.fail('بيانات الحساب غير صحيحة');
   const assigned=perms.validateRole(input.role?{...input.role,u:input.u}:input.br==='nurse'?{r:'nurse',u:input.u}:{r:'sec',u:input.u,br:input.br},core.fail);const user=await adapter.createUser(input.u,input.p);
   try{await adapter.mutate(s=>{perms.requirePermission(core.role(s,uid),'users.manage');s=structuredClone(s);s.roles[user]=assigned;return s;});}
   catch(e){await adapter.deleteUser(user);throw e;}
   return {uid:user};
  }
  core.fail('عملية غير مسموحة',403);
 };
}
export {createService};
