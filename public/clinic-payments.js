/* Payment destinations are configured by the doctor/admin; no payment credentials are collected. */
function patientPaymentConfig(){
 const x=settingsCache?.payments||{};let url='';try{const u=new URL(x.instapayUrl);if(u.protocol==='https:'&&!u.username&&!u.password)url=u.href}catch{}
 const items=Array.isArray(x.items)?x.items.filter(row=>row&&row.enabled===true&&typeof row.id==='string'&&typeof row.label==='string'&&row.label.trim()&&typeof row.amount==='string'&&/^\d{1,7}\.\d{2}$/.test(row.amount)).map(row=>({id:row.id,label:row.label,amount:row.amount})):[];
 return {catalog:Array.isArray(x.items)&&x.items.length>0,enabled:x.enabled===true,wallet:x.walletEnabled===true&&/^01[0125]\d{8}$/.test(x.walletNumber||'')?x.walletNumber:'',instapay:x.instapayEnabled===true?url:'',message:typeof x.message==='string'?x.message:'بعد الدفع، يُرجى إرسال صورة إثبات الدفع على واتساب العيادة.',proofUrl:window.ClinicWhatsApp?.href(SITE.whatsappPhone)||window.ClinicWhatsApp?.href(SITE.bookingPhone)||window.ClinicWhatsApp?.href()||'',items};
}
function paymentAmountText(amount){return new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(Number(amount))+' جنيه مصري';}
function patientPaymentsMarkup(){
 const p=patientPaymentConfig(),signature=esc(JSON.stringify(p)),wallet='<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8V5l14-3v3M16 11h5v5h-5z"/></svg>',transfer='<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7h17l-4-4M21 17H4l4 4M20 7l-4 4M4 17l4-4"/></svg>';
 const choices=p.catalog?'<label for="patient-payment-item">اختاري نوع الدفع</label><select id="patient-payment-item" '+(!p.items.length?'disabled':'')+' onchange="updatePatientPaymentSelection()"><option value="">اختاري البند المطلوب</option>'+p.items.map(row=>'<option value="'+esc(row.id)+'">'+esc(row.label)+'</option>').join('')+'</select><p id="patient-payment-amount" class="patient-payment-amount" role="status" aria-live="polite">'+(p.items.length?'اختاري البند لعرض المبلغ المطلوب.':'لا توجد بنود دفع متاحة حاليًا. تواصلي مع العيادة.')+'</p>':'';
 return '<section id="patient-payments" class="box patient-payment-card" data-payments-signature="'+signature+'" '+(!p.enabled||!p.wallet&&!p.instapay?'hidden':'')+'><h2>وسائل الدفع</h2>'+(p.message?'<p id="patient-payment-message" class="patient-payment-message">'+esc(p.message)+'</p>':'')+choices+'<div id="patient-payment-destinations" '+(p.catalog?'hidden':'')+'><div class="patient-payment-methods">'+(p.wallet?'<details class="patient-payment-wallet"><summary>'+wallet+'<span>محفظة إلكترونية</span></summary><div class="patient-wallet-number"><span>رقم المحفظة</span><strong dir="ltr">'+esc(p.wallet)+'</strong></div></details>':'')+(p.instapay?'<a id="patient-instapay" class="patient-payment-link" href="'+esc(p.instapay)+'" target="_blank" rel="noopener noreferrer">'+transfer+'<span>إنستا باي</span></a>':'')+'</div>'+(p.proofUrl?'<a id="patient-payment-proof" class="btn x patient-payment-proof" href="'+esc(p.proofUrl)+'" target="_blank" rel="noopener noreferrer">إرسال إثبات الدفع عبر واتساب العيادة</a><p class="hint">افتح المحادثة وأرفق صورة إيصال الدفع.</p>':'')+'</div></section>';
}
function updatePatientPaymentSelection(){
 const p=patientPaymentConfig(),node=document.getElementById('patient-payments');if(!node)return;
 if(node.dataset.paymentsSignature!==JSON.stringify(p)){syncPatientPayments();return;}
 const selected=p.items.find(row=>row.id===node.querySelector('#patient-payment-item')?.value),amount=node.querySelector('#patient-payment-amount'),destinations=node.querySelector('#patient-payment-destinations');
 if(amount)amount.textContent=selected?'المبلغ المطلوب — '+selected.label+': '+paymentAmountText(selected.amount):'اختاري البند لعرض المبلغ المطلوب.';
 if(destinations)destinations.hidden=p.catalog&&!selected;
}
var paymentsPatient=patient;patient=function(){return paymentsPatient()+patientPaymentsMarkup()};
function syncPatientPayments(){var node=document.getElementById('patient-payments');if(!node||staffView()||node.dataset.paymentsSignature===JSON.stringify(patientPaymentConfig()))return;var template=document.createElement('template');template.innerHTML=patientPaymentsMarkup();const hadSelection=!!node.querySelector('#patient-payment-item')?.value;node.replaceWith(template.content.firstElementChild);if(hadSelection){const amount=document.getElementById('patient-payment-amount');if(amount)amount.textContent='تغيّرت بيانات الدفع. اختاري البند من جديد لمراجعة المبلغ الحالي.';}}
var paymentsApplySite=applySite;applySite=function(s){paymentsApplySite(s);syncPatientPayments()};
var paymentsSettings=settings;settings=function(){return paymentsSettings()+(['doctor','admin'].includes(me?.role)?'<section class="box"><h3>وسائل دفع المرضى</h3><p>تحكّم في ظهور قسم الدفع ورقم المحفظة ورابط إنستا باي ورسالة السعر وبنود الدفع وأسعارها وتعليمات إرسال الإثبات.</p><button type="button" class="btn" onclick="editPatientPayments()">إعداد وسائل الدفع</button></section>':'')};
var paymentWrite=null;
function updatePaymentCache(result,owner){
 if(AUTH!==owner||!result?.payments||!Number.isSafeInteger(result.revision))return false;
 if((settingsCache?.paymentsRev||0)>result.revision)return true;
 settingsCache={...(settingsCache||{}),payments:result.payments,paymentsRev:result.revision};settingsTime=Date.now();syncPatientPayments();return true;
}
function refreshConfirmedPayments(owner){
 settingsTime=0;
 // A receipt replay or an older service may acknowledge without returning the settings.
 // This read must never keep the editor or the rest of the page locked.
 gateway('get',{path:'settings'},false).then(s=>updatePaymentCache({payments:s?.payments,revision:s?.paymentsRev},owner)).catch(()=>{
  if(AUTH===owner)notify('تم حفظ بيانات الدفع، لكن تعذر تحديث عرضها الآن. حدّث الصفحة عند عودة الاتصال.');
 });
}
function paymentEditorStatus(box,text,error){const node=box.querySelector('#fe');if(node){node.className=error?'err':'hint';node.setAttribute('role',error?'alert':'status');node.textContent=text;}}
function paymentEditorBusy(box,pending){
 box.querySelectorAll('input,select,textarea,[data-payment-save],[data-payment-item-action]').forEach(n=>n.disabled=pending);
 const save=box.querySelector('[data-payment-save]'),cancel=box.querySelector('[data-payment-cancel]');
 if(save)save.textContent=pending?'جارٍ الحفظ…':'حفظ';if(cancel){cancel.disabled=false;cancel.textContent=pending?'إغلاق':'إلغاء';}
}
async function savePaymentEditor(box,owner,revision){
 if(AUTH!==owner||box!==document.querySelector('.mod')||paymentWrite?.owner===owner)return;
 const value=k=>box.querySelector('#f_'+k).value;
 const config={enabled:value('enabled')==='1',walletEnabled:value('walletEnabled')==='1',walletNumber:value('walletNumber'),instapayEnabled:value('instapayEnabled')==='1',instapayUrl:value('instapayUrl'),message:value('message'),items:[...box.querySelectorAll('[data-payment-item]')].filter(row=>!(row.dataset.paymentStarterLabel===row.querySelector('[data-fee-label]').value&&row.dataset.paymentStarterLabel&&!row.querySelector('[data-fee-enabled]').checked&&!row.querySelector('[data-fee-amount]').value.trim())).map(row=>({id:row.dataset.paymentItem,label:row.querySelector('[data-fee-label]').value,amount:row.querySelector('[data-fee-amount]').value,enabled:row.querySelector('[data-fee-enabled]').checked}))};
 const job={owner,box};paymentWrite=job;paymentEditorBusy(box,true);
 paymentEditorStatus(box,'جارٍ حفظ إعدادات الدفع. يمكنك إغلاق النافذة ومتابعة العمل؛ إغلاقها لا يلغي طلب الحفظ الجاري.');
 try{
  const result=await gateway('paymentSettingsSave',{revision,config},true);
  if(AUTH!==owner)return;
  if(!updatePaymentCache(result,owner))refreshConfirmedPayments(owner);
  if(box===document.querySelector('.mod'))closeM();
  notify('تم حفظ وسائل الدفع');
 }catch(e){
  if(AUTH!==owner)return;
  const text=e.requiresVerification?'تعذر تأكيد نتيجة الحفظ. استخدم «تحقق من الحفظ» قبل إعادة المحاولة. '+errMsg(e):errMsg(e);
  if(box===document.querySelector('.mod'))paymentEditorStatus(box,text,true);else notify(text);
 }finally{if(paymentWrite===job)paymentWrite=null;if(AUTH===owner&&box===document.querySelector('.mod'))paymentEditorBusy(box,false);}
}
function editPatientPayments(){
 if(!['doctor','admin'].includes(me?.role))return;
 if(paymentWrite?.owner===AUTH){notify('طلب حفظ وسائل الدفع ما زال جاريًا. يمكنك متابعة باقي الموقع حتى تظهر النتيجة.');return;}
 const owner=AUTH,x=settingsCache?.payments||{},revision=settingsCache?.paymentsRev||0,yesNo=[['0','متوقف'],['1','مفعّل']];
 openForm('وسائل دفع المرضى',[
  {k:'message',l:'رسالة الدفع للمرضى — سعر الكشف وتعليمات إرسال الإثبات',t:'area',v:x.message===undefined?'بعد الدفع، يُرجى إرسال صورة إثبات الدفع على واتساب العيادة.':x.message},
  {k:'enabled',l:'إظهار قسم الدفع للمرضى',t:'select',o:[['0','إخفاء'],['1','إظهار']],v:x.enabled?'1':'0'},
  {k:'walletEnabled',l:'المحفظة الإلكترونية',t:'select',o:yesNo,v:x.walletEnabled?'1':'0'},
  {k:'walletNumber',l:'رقم المحفظة الإلكترونية',v:x.walletNumber||''},
  {k:'instapayEnabled',l:'إنستا باي',t:'select',o:yesNo,v:x.instapayEnabled?'1':'0'},
  {k:'instapayUrl',l:'رابط دفع إنستا باي الكامل (https://)',v:x.instapayUrl||''}
 ],()=> 'استخدم زر حفظ إعدادات الدفع داخل النافذة.');
 const box=document.querySelector('.mod');box.dataset.paymentEditor='true';buildPaymentItemsEditor(box,x.items);
 const buttons=box.querySelectorAll('.acts button'),save=buttons[0],cancel=buttons[1];
 save.removeAttribute('onclick');save.type='button';save.dataset.paymentSave='true';save.onclick=()=>savePaymentEditor(box,owner,revision);
 cancel.removeAttribute('onclick');cancel.type='button';cancel.dataset.paymentCancel='true';cancel.onclick=closeM;
 box.querySelector('#f_message').maxLength=2000;
 const wallet=box.querySelector('#f_walletNumber');wallet.inputMode='tel';wallet.maxLength=20;
 const link=box.querySelector('#f_instapayUrl');link.inputMode='url';link.maxLength=2048;
}
if(typeof ACTION_NAMES!=='undefined')ACTION_NAMES.paymentSettingsSave='تحديث وسائل دفع المرضى';

function buildPaymentItemsEditor(box,stored){
 const fieldset=document.createElement('fieldset');fieldset.className='payment-items-editor';const legend=document.createElement('legend');legend.textContent='بنود الدفع وأسعارها';fieldset.append(legend);
 const hint=document.createElement('p');hint.className='hint';hint.textContent='عدّل اسم كل بند وسعره بالجنيه المصري، وفعّل ظهوره للمريضة. يمكن إضافة أو حذف البنود.';fieldset.append(hint);
 const rows=document.createElement('div');rows.id='payment-items-editor';fieldset.append(rows);
 function addItem(item){
  if(rows.children.length>=20){notify('يمكن إضافة ٢٠ بند دفع كحد أقصى');return;}
  const id=item?.id||'fee_'+crypto.randomUUID().replaceAll('-',''),row=document.createElement('div');row.className='payment-item-editor';row.dataset.paymentItem=id;if(item?.starter)row.dataset.paymentStarterLabel=item.label;
  function input(label,kind,value,marker){const wrap=document.createElement('label');wrap.textContent=label;const n=document.createElement('input');n.type=kind;n.dataset[marker]='true';if(kind==='checkbox')n.checked=value===true;else n.value=value||'';wrap.append(n);row.append(wrap);return n;}
  input('اسم البند','text',item?.label,'feeLabel').maxLength=80;
  const price=input('السعر بالجنيه المصري','text',item?.amount,'feeAmount');price.inputMode='decimal';price.placeholder='0.00';price.maxLength=12;
  input('إظهار للمريضة','checkbox',item?.enabled??true,'feeEnabled');
  const remove=document.createElement('button');remove.type='button';remove.className='btn sm x';remove.dataset.paymentItemAction='remove';remove.textContent='حذف البند';remove.onclick=()=>row.remove();row.append(remove);rows.append(row);
 }
 const defaults=['كشف','طوارئ','متابعة'].map((label,i)=>({id:'fee_default_'+i,label,amount:'',enabled:false,starter:true}));for(const item of Array.isArray(stored)?stored:defaults)addItem(item);
 const add=document.createElement('button');add.type='button';add.className='btn sm';add.dataset.paymentItemAction='add';add.textContent='إضافة بند دفع';add.onclick=()=>addItem();fieldset.append(add);box.insertBefore(fieldset,box.querySelector('#fe'));
}
