/* All account/theme extensions must be installed before the first render. */
window.addEventListener('DOMContentLoaded',async()=>{
 if(!window.ClinicBoot)return;
 try{
  if(location.protocol==='file:'){await restoreSession();ClinicBoot.ready('settings');ClinicBoot.ready('view');return;}
  await loadSettings();ClinicBoot.ready('settings');
  await restoreSession();
  if(location.protocol==='file:'){ClinicBoot.ready('view');return;}
  if(AUTH&&!me)throw Error('تعذر التحقق من حسابك؛ أعد المحاولة لتحميل البيانات الحالية.');
  if(me?.role==='admin'&&!adminPage()||me&&me.role!=='admin'&&adminPage())return;
  let initialDataFresh=false;
  if(me?.role==='admin'&&((settingsCache?.demoNamesVersion||0)<1||(settingsCache?.demoSpouseVersion||0)<1||(settingsCache?.demoProfileVersion||0)<1)){try{await refreshData();const upgraded=await gateway('normalizeDemoNames',{},true);if(upgraded.profileMigrationVersion!==1)throw Error('تحتاج خدمة العيادة إلى تحديث');await refreshData();initialDataFresh=true;}catch(e){notify('تعذر تحديث بيانات الحالات القديمة. تأكد من نشر خدمة العيادة الحديثة ثم أعد المحاولة من الإعدادات.');}}
  if(me&&staffView()){await new Promise(resolve=>setTimeout(resolve,0));if(!initialDataFresh)await refreshData();if(!workspaceLast)await refreshData();if(!workspaceLast)throw Error('Workspace not loaded');}
  draw();applySite(SITE);ClinicBoot.ready('view');
 }catch(e){ClinicBoot.fail('تعذر تحميل أحدث بيانات العيادة. تحقق من الاتصال ثم أعد المحاولة.');}
});
