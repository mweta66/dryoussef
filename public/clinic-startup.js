/* Fetch fresh account/settings/view in one consolidated request on staff reload. */
window.addEventListener('DOMContentLoaded',async()=>{
 if(!window.ClinicBoot)return;
 try{
  if(location.protocol==='file:'){await restoreSession();ClinicBoot.ready('settings');ClinicBoot.ready('view');return;}
  if(AUTH){
   const owner=AUTH,initialTab=tab;
   // Only the authenticated server response grants role and permissions.
   me={u:'',role:'staff',permissions:{}};
   try{await refreshWorkspaceData();}catch(e){
    if(e.status===401||e.status===403||/NOAUTH/.test(e.message)){logout();if(adminPage())return;await loadSettings();ClinicBoot.ready('settings');draw();applySite(SITE);ClinicBoot.ready('view');return;}
    throw e;
   }
   if(AUTH!==owner)return;
   if(!workspaceLast)throw Error('Workspace not loaded');
   if(me.role==='admin'&&!adminPage()){openAdmin();return;}
   if(me.role!=='admin'&&adminPage()){location.replace('staff.html#staff');return;}
   const tabs=workspaceTabs();if(!tabs.some(x=>x[0]===tab))tab=tabs[0]?.[0]||'set';
   if(tab!==initialTab)await refreshWorkspaceData();
   ClinicBoot.ready('settings');
   if(me.role==='admin'&&((settingsCache?.demoNamesVersion||0)<1||(settingsCache?.demoSpouseVersion||0)<1||(settingsCache?.demoProfileVersion||0)<1)){
    try{const upgraded=await gateway('normalizeDemoNames',{},true);if(upgraded.profileMigrationVersion!==1)throw Error('تحتاج خدمة العيادة إلى تحديث');PT=null;await refreshWorkspaceData();}
    catch(e){notify('تعذر تحديث بيانات الحالات القديمة. تأكد من نشر خدمة العيادة الحديثة ثم أعد المحاولة من الإعدادات.');}
   }
  }else{await loadSettings();ClinicBoot.ready('settings');}
  draw();applySite(SITE);ClinicBoot.ready('view');
 }catch(e){ClinicBoot.fail('تعذر تحميل أحدث بيانات العيادة. تحقق من الاتصال ثم أعد المحاولة.');}
});
