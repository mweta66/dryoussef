/* Keep defaults private until this navigation has fresh settings and view data. */
(function(){
 const ready={settings:false,view:false};let complete=false;
 function message(text){const node=document.getElementById('clinic-loading-message');if(node)node.textContent=text;}
 window.ClinicBoot={
  get loading(){return !complete},
  ready(part){ready[part]=true;if(!complete&&ready.settings&&ready.view){complete=true;document.documentElement.removeAttribute('data-clinic-loading');document.getElementById('clinic-loading')?.remove();clearTimeout(timer);}},
  pending(part){if(!complete)ready[part]=false;},
  fail(text){if(complete)return;message(text||'تعذر تحميل أحدث البيانات. تحقق من الاتصال ثم أعد المحاولة.');const retry=document.getElementById('clinic-loading-retry');if(retry)retry.hidden=false;}
 };
 const timer=setTimeout(()=>ClinicBoot.fail('تحميل أحدث البيانات استغرق وقتًا أطول. تحقق من الاتصال أو أعد المحاولة.'),25000);
 document.addEventListener('DOMContentLoaded',()=>{document.getElementById('clinic-loading-retry')?.addEventListener('click',()=>location.reload());});
})();
