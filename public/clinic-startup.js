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
  if(me&&staffView()){await new Promise(resolve=>setTimeout(resolve,0));await refreshData();if(!workspaceLast)await refreshData();if(!workspaceLast)throw Error('Workspace not loaded');}
  draw();applySite(SITE);ClinicBoot.ready('view');
 }catch(e){ClinicBoot.fail('تعذر تحميل أحدث بيانات العيادة. تحقق من الاتصال ثم أعد المحاولة.');}
});
