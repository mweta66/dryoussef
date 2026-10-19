/* Fresh public branch information; no patient data or staff bundles are loaded. */
(function(){
 const id=document.body.dataset.publicBranch,details=document.getElementById('branch-details'),loader=document.getElementById('branch-loader'),schema=document.getElementById('branch-schema');let flight=null;
 function show(settings){
  const x=ClinicBranchPages.details(settings,id);details.innerHTML=ClinicBranchPages.content(x);details.hidden=false;loader.hidden=true;schema.textContent=JSON.stringify(x.schema||{});document.querySelector('meta[name=robots]').content=x.enabled?'index,follow':'noindex,nofollow';
  document.title=x.enabled?'عيادة '+x.doctor+' — '+x.name+' | مواعيد وحجز':'الفرع غير متاح | عيادة د. يوسف';
  if(typeof applyAdvancedDesign==='function')applyAdvancedDesign(x.data.site.design||{},x.data.site);
  const logo=document.querySelector('.branch-logo');if(logo){logo.src=x.data.site.design?.logo||'/brand-current.webp';logo.hidden=x.data.site.design?.logo==='';}
  document.querySelector('.branch-header .nm h2').textContent=x.data.site.headerTitle??x.doctor;document.querySelector('.branch-header .nm p').textContent=x.data.site.headerSubtitle??x.data.site.specialty??'عيادة النساء والولادة والحقن المجهري';
  const nav=document.getElementById('branch-links');nav.replaceChildren();for(const key of Object.keys(ClinicBranchPages.names)){const branch=x.data.branches[key];if(!branch||branch.enabled===false)continue;const a=document.createElement('a');a.href='/branches/'+key;a.textContent=branch.name;nav.append(a);}
  ClinicWhatsApp.update(x.data.site.whatsappPhone,x.enabled);
 }
 async function refresh(){
  if(document.hidden||flight)return flight;const config=window.CLINIC_CONFIG;
  flight=(async()=>{try{const response=await fetch(config.endpoint||'/api/clinic',{method:'POST',headers:{'Content-Type':'application/json',...(config.publishableKey?{apikey:config.publishableKey}:{})},body:JSON.stringify({action:'get',path:'settings'}),cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('network');const result=await response.json();if(!result.data)throw Error('settings');show(result.data);}catch{details.hidden=true;schema.textContent='{}';loader.hidden=false;document.getElementById('branch-load-status').textContent='تعذر تحميل أحدث بيانات الفرع. تحقق من الاتصال أو أعد المحاولة؛ لن نعرض مواعيد قديمة.';ClinicWhatsApp.update('',false);}finally{flight=null;}})();return flight;
 }
 const initial=JSON.parse(document.getElementById('branch-settings').textContent);if(initial)show(initial);else refresh();
 setInterval(refresh,60000);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});if(typeof ClinicLive!=='undefined')ClinicLive.onchange=refresh;
})();
