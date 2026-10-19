/* Patient appointment notifications only; no tasks and no external push service. */
var REQUEST_ALERT={owner:null,key:'',data:null,flight:null,notified:false};
function requestAlertKey(){return JSON.stringify([AUTH?.uid,me?.role,me?.br,me?.scope,can('requests.read')]);}
function drawRequestAlert(){
 const bar=document.getElementById('topbar');if(!bar)return;let button=document.getElementById('patient-request-alert');
 if(!me||!AUTH||!can('requests.read')){button?.remove();return;}
 if(!button){button=document.createElement('button');button.id='patient-request-alert';button.type='button';button.className='gb';button.onclick=()=>{tab='work';render();loadWorkflow(true);};bar.append(button);}
 const x=REQUEST_ALERT.owner===AUTH&&REQUEST_ALERT.key===requestAlertKey()?REQUEST_ALERT.data:null;
 button.textContent='طلبات المرضى'+(x?' · '+x.pending:'');button.classList.toggle('has-overdue',!!x?.overdue);button.setAttribute('aria-label',x?'طلبات المرضى: '+x.pending+' قيد المراجعة، منها '+x.overdue+' متأخرة':'فتح طلبات المرضى');button.title=x?'طلبات تعديل: '+x.reschedule+' · حجز جديد: '+x.newBookings+' · إلغاء: '+x.cancellations:'';
}
async function readRequestSummary(){
 try{return await gateway('requestSummary',{},true);}catch(e){if(![400,403,404].includes(e.status))throw e;const result=await gateway('workflowList',{branch:allBranches()?'all':workflowBranch(),date:today()},true),rows=(result.requests||[]).filter(x=>x.status==='pending'&&['new','reschedule','cancel'].includes(x.kind)),thresholdMinutes=settingsCache?.bookingRequests?.requestOverdueMinutes||60;return {pending:rows.length,reschedule:rows.filter(x=>x.kind==='reschedule').length,newBookings:rows.filter(x=>x.kind==='new').length,cancellations:rows.filter(x=>x.kind==='cancel').length,overdue:rows.filter(x=>Date.now()-Date.parse(x.createdAt)>=thresholdMinutes*60000).length,thresholdMinutes,latestAt:rows.map(x=>x.createdAt).filter(Boolean).sort().at(-1)||null};}
}
async function refreshRequestAlerts(){
 if(document.hidden||!me||!AUTH||!can('requests.read')){drawRequestAlert();return;}
 const owner=AUTH,key=requestAlertKey();if(REQUEST_ALERT.owner!==owner||REQUEST_ALERT.key!==key)REQUEST_ALERT={owner,key,data:null,flight:null,notified:false};
 if(REQUEST_ALERT.flight)return REQUEST_ALERT.flight;const current=REQUEST_ALERT,previous=current.data;
 current.flight=readRequestSummary().then(data=>{
  if(AUTH!==owner||key!==requestAlertKey()||REQUEST_ALERT!==current)return;current.data=data;drawRequestAlert();
  if(data.pending&&(!current.notified||data.pending>(previous?.pending||0)||data.latestAt>(previous?.latestAt||'')||data.overdue>(previous?.overdue||0))){
   notify('طلبات مرضى بانتظار المتابعة: '+data.pending+(data.reschedule?'، منها '+data.reschedule+' طلب تغيير موعد':'')+(data.overdue?' — '+data.overdue+' متأخرة عن المراجعة':'')+'. افتح زر طلبات المرضى.');current.notified=true;
  }
 }).catch(()=>{/* Keep the last count; clinical pages remain usable during a transient failure. */}).finally(()=>{if(REQUEST_ALERT===current)current.flight=null;});return current.flight;
}
var alertTopbar=topbar;topbar=function(){alertTopbar();drawRequestAlert();if(me&&AUTH&&can('requests.read')&&(REQUEST_ALERT.owner!==AUTH||REQUEST_ALERT.key!==requestAlertKey()||!REQUEST_ALERT.data))refreshRequestAlerts();};
setInterval(refreshRequestAlerts,30000);window.addEventListener('online',refreshRequestAlerts);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshRequestAlerts();});
if(typeof ClinicLive!=='undefined'){var requestAlertChanged=ClinicLive.onchange;ClinicLive.onchange=function(){requestAlertChanged?.();refreshRequestAlerts();};}
var alertGateway=gateway;gateway=async function(action,payload,auth){const result=await alertGateway(action,payload,auth);if(auth&&['requestDecide','bookingRequestSettings'].includes(action))refreshRequestAlerts();return result;};
