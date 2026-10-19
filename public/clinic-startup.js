/* Apply the owner's requested color/access changes once, on login or session restore. */
var clinicReleaseUpdateFlight=null;
async function ensureClinicReleaseUpdates(){
 if(!AUTH||me?.role!=='admin')return;
 const owner=AUTH;if(clinicReleaseUpdateFlight?.owner===owner)return clinicReleaseUpdateFlight.promise;
 const job={owner};job.promise=(async()=>{let refreshed=false;for(const [action,key]of [['refreshClinicColors','colorSystemVersion'],['nurseRequestAccessUpgrade','nurseRequestAccessVersion']]){if(AUTH!==owner||me?.role!=='admin')return;if(settingsCache?.[key]===1)continue;try{await gateway(action,{},true);refreshed=true}catch(e){notify('تعذر تطبيق تحديث الألوان وصلاحية الطلبات. انشر أحدث خدمة للعيادة ثم أعد المحاولة.')}}if(refreshed&&AUTH===owner){try{await refreshWorkspaceData()}catch(e){notify('تم حفظ تحديث العيادة، لكن تعذر تحميله الآن. أعد تحميل الصفحة عند عودة الاتصال.')}}})().finally(()=>{if(clinicReleaseUpdateFlight===job)clinicReleaseUpdateFlight=null});clinicReleaseUpdateFlight=job;return job.promise;
}
var clinicReleaseLogin=login;login=async function(){await clinicReleaseLogin();if(AUTH&&me?.role==='admin'&&adminPage()){const owner=AUTH;await ensureClinicReleaseUpdates();if(AUTH===owner){draw();applySite(SITE)}}};
/* Fetch fresh account/settings/view in one consolidated request on staff reload. */
var clinicBootFlight=null,clinicBootRetry=null;
function bootClinicPage(){
 if(!window.ClinicBoot||!ClinicBoot.loading||clinicBootFlight)return clinicBootFlight;
 clearTimeout(clinicBootRetry);ClinicBoot.pending('settings');ClinicBoot.pending('view');
 const run=(async()=>{
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
  await ensureClinicReleaseUpdates();
  draw();applySite(SITE);ClinicBoot.ready('view');
 }catch(e){ClinicBoot.fail('تعذر تحميل أحدث بيانات العيادة. نعيد المحاولة عند تحسن الاتصال؛ يمكنك إعادة المحاولة الآن.');clinicBootRetry=setTimeout(()=>{if(navigator.onLine!==false)bootClinicPage();},5000);}
 })();clinicBootFlight=run.finally(()=>{clinicBootFlight=null;});return clinicBootFlight;
}
window.addEventListener('DOMContentLoaded',bootClinicPage);window.addEventListener('online',()=>{if(ClinicBoot?.loading)bootClinicPage();});
