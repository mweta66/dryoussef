const perms=require('./permissions.cjs'),management=require('./management.cjs');
const core=require('./core.cjs');
function createService(adapter) {
 return async function handle(input,uid,client='local') {
  const {action}=input||{};
  if(action==='exportData'){const s=await adapter.read();perms.requirePermission(core.role(s,uid),'data.export');return {exportedAt:new Date().toISOString(),bookings:s.bookings||{},settings:s.settings||{},roles:s.roles||{},patients:s.patients||{},files:s.files||{},complaints:s.complaints||{},inbox:s.inbox||{}};}
  if(action==='lookup'){
   await adapter.limit(client);return core.lookup(await adapter.read(),input.phone);
  }
  if(action==='get')return core.read(await adapter.read(),uid,input.path);
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
  if(action==='userDelete'){await adapter.mutate(s=>{perms.requirePermission(core.role(s,uid),'users.manage');if(!s.roles?.[input.uid])core.fail('المستخدم غير موجود',404);if(input.uid===uid)core.fail('لا يمكنك حذف الحساب المستخدم حاليًا');if(s.roles[input.uid].r==='doctor'&&!Object.entries(s.roles).some(([id,r])=>id!==input.uid&&r.r==='doctor'&&r.enabled!==false))core.fail('يجب إبقاء طبيب فعال');s=structuredClone(s);delete s.roles[input.uid];return s;});await adapter.deleteUser(input.uid);return {ok:true};}
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
module.exports={createService};
