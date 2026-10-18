/* A short branded splash never reveals stale settings or clinical data. */
(function(){
 const links=()=>Array.from(document.querySelectorAll?.('link[data-clinic-style]')||[]);
 const stylesReady=()=>links().every(x=>x.dataset.ready==='1');
 const ready={settings:false,view:false,styles:stylesReady()};let complete=false;
 function message(text){const node=document.getElementById('clinic-loading-message');if(node)node.textContent=text;}
 function waiting(){if(complete)return;const overlay=document.getElementById('clinic-loading');if(overlay?.dataset)overlay.dataset.phase='waiting';const retry=document.getElementById('clinic-loading-retry');if(retry)retry.hidden=false;}
 function finish(){if(!complete&&ready.settings&&ready.view&&ready.styles){complete=true;document.documentElement.removeAttribute('data-clinic-loading');document.getElementById('clinic-loading')?.remove();clearTimeout(timer);}}
 window.ClinicBoot={
  get loading(){return !complete},
  ready(part){ready[part]=true;finish();},
  checkStyles(){ready.styles=stylesReady();finish();},
  pending(part){if(!complete)ready[part]=false;},
  fail(text){if(complete)return;waiting();message(text||'تعذر تحميل أحدث البيانات. تحقق من الاتصال ثم أعد المحاولة.');}
 };
 const timer=setTimeout(waiting,2900);
 document.addEventListener('DOMContentLoaded',()=>ClinicBoot.checkStyles());
})();
