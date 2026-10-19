/* A branded splash that stays visible until fresh data and the page are ready never reveals stale settings or clinical data. */
(function(){
 const links=()=>Array.from(document.querySelectorAll?.('link[data-clinic-style]')||[]);
 const stylesReady=()=>links().every(x=>x.dataset.ready==='1');
 const ready={settings:false,view:false,styles:stylesReady(),assets:!document.fonts?.load};let complete=false;
 function message(text){const node=document.getElementById('clinic-loading-message');if(node)node.textContent=text;}
 function waiting(){if(complete)return;const overlay=document.getElementById('clinic-loading');if(overlay?.dataset)overlay.dataset.phase='waiting';const retry=document.getElementById('clinic-loading-retry');if(retry)retry.hidden=false;}
 function finish(){if(!complete&&ready.settings&&ready.view&&ready.styles&&ready.assets){complete=true;document.documentElement.removeAttribute('data-clinic-loading');document.getElementById('clinic-loading')?.remove();clearTimeout(timer);}}
 window.ClinicBoot={
  get loading(){return !complete},
  ready(part){ready[part]=true;finish();},
  checkStyles(){ready.styles=stylesReady();finish();},
  pending(part){if(!complete)ready[part]=false;},
  fail(text){if(complete)return;waiting();message(text||'تعذر تحميل أحدث البيانات. تحقق من الاتصال ثم أعد المحاولة.');}
 };
 const timer=setTimeout(waiting,8000);
 document.addEventListener('DOMContentLoaded',()=>{
  ClinicBoot.checkStyles();if(ready.assets)return;
  const logo=document.querySelector?.('#clinic-loading .clinic-logo-orbit img');
  Promise.all([document.fonts.load('400 16px Cairo'),document.fonts.load('700 16px Cairo'),logo?.decode?.()]).then(()=>{ready.assets=true;finish();}).catch(()=>ClinicBoot.fail('تعذر تحميل الخط أو شعار العيادة. تحقق من الاتصال وأعد المحاولة.'));
 });
})();
