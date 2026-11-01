/* Save acknowledgements and read-only verification. No clinical payload is persisted here. */
var ClinicSaveStatus=(function(){
 if(typeof window!=='undefined'&&window.ClinicSaveStatus)return window.ClinicSaveStatus;
 var baseGateway=gateway,current=null,serial=0;
 var reads=new Set(['exportData','get','workspace','systemHealth','systemVersion','reportData','lookup','lookupHistory','publicQueue','bookingAvailability','bookingCapabilities','appointmentChangeOptions','requestSummary','requestNotifications','requestAssignees','bookingContactList','bookingContactGet','followupPlanList','consultationView','patientSearch','patientHistoryPage','workflowList','timeline','daySummary','similarPatients','patientMergeList','draftGet','preferencesGet','backupDownload','backupRehearsalStatus','auditDetail','trashList','attachmentList','attachmentRead','attachmentExport','recoveryBackupExport','recoveryFileExport','recoveryBackupVerify','mutationReceiptGet']);
 var silentWrites=new Set(['editingPresence','draftSave','draftDelete','requestNotificationRead','requestNotificationsReadAll','preferencesSave','refreshClinicColors','nurseRequestAccessUpgrade']);
 var receipted=new Set(['commit','patch','sessionSet','presenceSet','checkinSet','consultationComplete','consultationUrgentReview','consultationUrgentResolve','bookingContactSet','requestAssign','requestDecide']);
 function owner(){return typeof AUTH!=='undefined'&&AUTH?.uid||null;}
 function fresh(uid){return {owner:uid,status:'idle',lastRead:null,lastWrite:null,lastReadFailure:null,readCount:0,writeCount:0,active:new Map(),unresolved:new Map()};}
 function state(){var uid=owner();if(!current||current.owner!==uid)current=fresh(uid);return current;}
 function now(){return new Date().toISOString();}
 function same(s){return current===s&&owner()===s.owner;}
 function transient(e){return [500,502,503,504].includes(e?.status)||!e?.status&&(e?.name==='AbortError'||e?.name==='TimeoutError'||e?.name==='TypeError'||e?.name==='SyntaxError'||/fetch|network|timeout|abort|اتصال/i.test(e?.message||''));}
 function newOperationId(){if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return 'op_'+crypto.randomUUID().replace(/-/g,'');return 'op_'+Date.now().toString(36)+'_'+(++serial).toString(36)+'_'+Math.random().toString(36).slice(2);}
 function refreshStatus(s,fallback){if(s.unresolved.size)s.status='verifying';else if(s.active.size)s.status='saving';else s.status=fallback||s.status;}
 function readSaved(s,action){if(!same(s))return;s.lastRead={action,at:now()};s.lastReadFailure=null;s.readCount++;render();}
 function writeSaved(s,operation,receipt,readback){if(!same(s))return;s.active.delete(operation.id);s.unresolved.delete(operation.id);s.lastWrite={action:operation.action,at:receipt?.committedAt||now(),acknowledgedAt:now(),verifiedByReceipt:!!receipt,verifiedByRead:readback===true};s.writeCount++;refreshStatus(s,'saved');render();}
 function failed(s,operation,error,uncertain){if(!same(s))return;s.active.delete(operation.id);if(uncertain)s.unresolved.set(operation.id,{id:operation.id,action:operation.action,receipted:operation.receipted,at:operation.at});refreshStatus(s,uncertain?'verifying':'not_saved');render();}
 async function receiptFor(operation,s){const value=await baseGateway('mutationReceiptGet',{operationId:operation.id},true);readSaved(s,'mutationReceiptGet');return value?.status==='saved'&&value.action===operation.action?value:null;}
 gateway=async function(action,payload,auth){
  if(silentWrites.has(action))return baseGateway(action,payload,auth);
  var s=state(),isRead=reads.has(action),operation=null,input=payload;
  if(!isRead){var receiptEnabled=!!auth&&!!s.owner&&receipted.has(action);operation={id:newOperationId(),action,receipted:receiptEnabled,at:now()};if(receiptEnabled)input=Object.assign({},payload,{operationId:operation.id});s.active.set(operation.id,operation);refreshStatus(s,'saving');render();}
  try{var result=await baseGateway(action,input,auth);if(isRead)readSaved(s,action);else writeSaved(s,operation,result?.receipt);return result;}
  catch(error){
   if(isRead){if(same(s)){s.lastReadFailure={at:now(),status:Number(error?.status)||0};render();}throw error;}
   if(transient(error)){
    if(same(s)){s.status='verifying';render();}
    if(operation.receipted){try{var receipt=await receiptFor(operation,s);if(receipt){writeSaved(s,operation,receipt);return {ok:true,reconciled:true,writeStatus:'saved',receipt};}}catch{/* A missing/unreachable receipt cannot prove that a write failed. */}}
    failed(s,operation,error,true);error.writeStatus='verifying';error.operationId=operation.id;error.requiresVerification=true;throw error;
   }
   failed(s,operation,error,false);error.writeStatus='not_saved';throw error;
  }
 };
 async function verifyPending(){var s=state(),confirmed=0;for(const operation of [...s.unresolved.values()]){if(!operation.receipted)continue;try{const receipt=await receiptFor(operation,s);if(!same(s))return {confirmed:0,remaining:state().unresolved.size};if(receipt){writeSaved(s,operation,receipt);confirmed++;}}catch{}}
  if(same(s)){refreshStatus(s,s.lastWrite?'saved':'idle');render();}return {confirmed,remaining:s.unresolved.size};
 }
 function confirmReadVerification(action,operationId){var s=state(),operation=s.unresolved.get(operationId);if(!operation||operation.action!==action)return false;writeSaved(s,operation,null,true);return true;}
 function snapshot(){var s=state();return {owner:s.owner,status:s.status,lastRead:s.lastRead&&{...s.lastRead},lastWrite:s.lastWrite&&{...s.lastWrite},lastReadFailure:s.lastReadFailure&&{...s.lastReadFailure},readCount:s.readCount,writeCount:s.writeCount,pending:s.active.size,unconfirmed:s.unresolved.size,verifiable:[...s.unresolved.values()].filter(x=>x.receipted).length};}
 function label(status){return {idle:'لا توجد عملية حفظ في هذه الجلسة',saving:'جارٍ الحفظ',saved:'حُفظ',not_saved:'لم يُحفظ',verifying:'جارٍ التحقق'}[status]||status;}
 function stamp(value){if(!value)return 'لا توجد نتيجة مسجلة في هذه الجلسة';try{return new Date(value).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})}catch{return value;}}
 function renderDiagnostics(node){if(!node||typeof document==='undefined')return;var x=snapshot(),values=[['حالة الحفظ',label(x.status)],['آخر قراءة ناجحة لهذا الحساب في المتصفح',stamp(x.lastRead?.at)],['آخر تأكيد حفظ',stamp(x.lastWrite?.at)],['عمليات غير مؤكدة',String(x.unconfirmed)],['حالة آخر قراءة',x.lastReadFailure?'تعذرت آخر قراءة؛ بيانات آخر نجاح موضحة أعلاه':x.lastRead?'نجحت آخر قراءة':'لم يتم الاتصال بعد']];node.replaceChildren();for(const [name,value]of values){const p=document.createElement('p');p.textContent=name+': '+value;node.append(p)}if(x.verifiable){const button=document.createElement('button');button.type='button';button.className='btn sm x';button.textContent='التحقق من عمليات الحفظ غير المؤكدة';button.onclick=()=>verifyPending();node.append(button)}}
 function render(){if(typeof document==='undefined'||!document.getElementById)return;var x=snapshot(),node=document.getElementById('clinic-save-state'),active=typeof me!=='undefined'&&!!me&&!!x.owner&&typeof staffView==='function'&&staffView();if(!active||x.status==='idle'){node?.remove();}else{var app=document.getElementById('app');if(app?.parentNode){if(!node){node=document.createElement('div');node.id='clinic-save-state';node.className='box clinic-save-state';node.setAttribute('role','status');node.setAttribute('aria-live','polite');app.before(node)}node.replaceChildren();node.dataset.status=x.status;var text=document.createElement('span');text.textContent=label(x.status)+(x.status==='verifying'?' — لم نؤكد النتيجة بعد؛ راجع السجل قبل تكرار العملية':x.status==='saved'&&x.lastWrite?.action==='draftSave'?' — مسودة خاصة، وليست إضافة للملف الطبي':'');node.append(text);if(x.verifiable){var button=document.createElement('button');button.type='button';button.className='btn sm x';button.textContent='تحقق من الحفظ';button.onclick=()=>verifyPending();node.append(button)}}}renderDiagnostics(document.getElementById('clinic-io-diagnostics'));}
 if(typeof draw==='function'){var previousDraw=draw;draw=function(){var result=previousDraw.apply(this,arguments);render();return result;};}
 if(typeof logout==='function'){var previousLogout=logout;logout=function(){current=fresh(null);var result=previousLogout.apply(this,arguments);render();return result;};}
 return {snapshot,label,verifyPending,confirmReadVerification,render,renderDiagnostics};
})();
if(typeof window!=='undefined')window.ClinicSaveStatus=ClinicSaveStatus;
