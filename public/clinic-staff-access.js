Object.assign(ACTION_NAMES,{staffAccessPreview:'معاينة ضبط حسابات الطاقم',staffAccessApply:'ضبط حسابات السكرتارية والممرضة'});
var staffAccessUsers=users;users=function(){return staffAccessUsers()+(me?.role==='admin'?'<section class="box staff-access-setup"><h3>ضبط حسابات الفروع</h3><p>أسماء الدخول: <b dir="ltr">alex-sec</b>، <b dir="ltr">matrouh-sec</b>، <b dir="ltr">dmn-sec</b>، <b dir="ltr">libya-sec</b>. كل سكرتارية تدير حجوزات ودور فرعها. الممرضة تدير الحجوزات والدور وتسجل الشكاوى وتعرض طلبات حجز وتعديل وإلغاء المواعيد في جميع الفروع.</p><p class="hint">يُحدّث الحساب الموجود أو ينشئ الحساب الناقص، مع الاحتفاظ ببيانات الحالات. كلمات سر الممرضات لا تتغير.</p><button class="btn" onclick="setupStaffAccess()">ضبط حسابات السكرتارية والممرضة</button></section>':'');};
async function setupStaffAccess(){
 if(me?.role!=='admin')return;
 let preview;try{preview=await gateway('staffAccessPreview',{},true)}catch(e){notify('تعذر معاينة ضبط الحسابات: '+errMsg(e)+' — تأكد من نشر أحدث خدمة Supabase');return}
 openForm('ضبط حسابات السكرتارية والممرضة',[{k:'password',l:'كلمة السر لحسابات السكرتارية الأربعة (6 أحرف على الأقل)',t:'password'},{k:'confirm',l:'تأكيد كلمة السر',t:'password'}],async function(values){
  if(values.password.length<6||values.password.length>128)return 'كلمة السر من 6 إلى 128 حرفًا';
  if(values.password!==values.confirm)return 'كلمتا السر غير متطابقتين';
  const result=await gateway('staffAccessApply',{password:values.password,previewToken:preview.previewToken},true);
  const summary=result.results.map(x=>x.username+': '+(x.ok?'تم الضبط':x.warning||x.error)).join('\n');
  if(!result.ok){preview=await gateway('staffAccessPreview',{},true);return summary+'\nلم تُنفّذ الحسابات التالية للخطأ. راجع النتيجة ثم أعد المحاولة.';}
  return {successMessage:summary};
 });
 const info=document.createElement('p');info.className='hint';info.textContent=preview.staff.map(x=>(x.create?'إنشاء: ':'تحديث: ')+x.username+(x.role.r==='nurse'?' — جميع الفروع':' — '+(BR[x.role.br]?.name||x.role.br))).join(' · ');document.querySelector('.mod')?.prepend(info);
}

Object.assign(ACTION_NAMES,{organizeTrainingApply:'تنظيم الحالات التدريبية وحسابات دمنهور وليبيا'});
var trainingUsers=users;users=function(){return trainingUsers()+(me?.role==='admin'?'<section class="box staff-access-setup"><h3>حسابا إدخال بيانات دمنهور وليبيا</h3><p>اختَر حسابَي «داتا» الحاليين. تظل الفروع الأربعة كما هي، ويصبح اسم الدخول <b dir="ltr">dmn-sec</b> و<b dir="ltr">libya-sec</b> مع الاحتفاظ بكلمتي السر.</p><p>التوزيع: ١٥٠ للإسكندرية، ١٥٠ لمطروح، ١٠٠ لدمنهور، و١٠٠ لليبيا. تُنقل حالات التدريب المحددة فقط، وتظل ملفاتها وشكاواها محفوظة.</p><button class="btn" onclick="setupTrainingAccounts()">تنظيم الحالات وحسابَي داتا</button></section>':'');};
async function setupTrainingAccounts(){
 if(me?.role!=='admin')return;
 const choices=branch=>Object.entries(ROLE_LIST).filter(([,r])=>(r.r==='staff'||r.r==='sec'&&r.br===branch)&&r.enabled!==false&&!r.archivedAt),options=branch=>[['','اختَر الحساب'],...choices(branch).map(([id,r])=>[id,(r.displayName||r.u)+' — '+r.u])],selected=branch=>choices(branch).find(([,r])=>r.u===branch+'-sec')?.[0]||choices(branch).find(([,r])=>r.r==='sec'&&r.br===branch)?.[0]||'';
 openForm('اختيار حسابَي إدخال البيانات',[{k:'dmn',l:'حساب داتا أو السكرتارية الخاص بدمنهور',t:'select',o:options('dmn'),v:selected('dmn')},{k:'libya',l:'حساب داتا أو السكرتارية الخاص بليبيا',t:'select',o:options('libya'),v:selected('libya')}],async function(accounts){
  if(!accounts.dmn||!accounts.libya||accounts.dmn===accounts.libya)return 'اختَر حسابين مختلفين';
  const preview=await gateway('organizeTrainingPreview',{accounts},true);
  if(preview.missing)return 'استورد ملف الحالات التدريبية الكامل أولًا. الحالات الناقصة: '+preview.missing;
  const result=await gateway('organizeTrainingApply',{accounts,previewToken:preview.previewToken},true);
  if(!result.ok)return 'تم تنظيم الحالات؛ تعذر إكمال الحسابات: '+result.results.map(x=>x.username+': '+(x.ok?'تم':x.error)).join(' · ');
  PT=null;PTt=0;settingsTime=0;settingsCache=null;
  return {successMessage:'تم تنظيم الـ٥٠٠ حالة. حساب دمنهور: dmn-sec، وحساب ليبيا: libya-sec. كلمتا السر كما هما؛ استخدم ضبط السكرتارية لتوحيدهما.'};
 });
}
