/* Public screens start with no controls; setup requires a live staff permission. */
(function(){
 const button=document.getElementById('display-settings-toggle'),panel=document.getElementById('display-settings-panel');
 if(!button||!panel)return;
 let setupMode=new URLSearchParams(location.search).get('settings')==='1',authorized=false,flight;
 function closePanel(){panel.hidden=true;panel.inert=true;button.setAttribute('aria-expanded','false');}
 function lock(){authorized=false;closePanel();button.hidden=true;}
 function session(){try{return JSON.parse(sessionStorage.getItem('clinic_supabase_auth'))}catch{return null}}
 async function check(){
  if(!setupMode){lock();return false;}if(flight)return flight;
  flight=(async()=>{try{
   const auth=session();if(!auth?.idToken||!auth.uid){lock();return false;}
   const cfg=window.CLINIC_CONFIG||{},response=await fetch(cfg.endpoint||'/api/clinic',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',...(cfg.publishableKey?{apikey:cfg.publishableKey}:{}),Authorization:'Bearer '+auth.idToken},body:JSON.stringify({action:'get',path:'roles/'+auth.uid}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('unauthorized');const role=(await response.json()).data;
   const allowed=role?.r==='admin'||role?.permissions?.['display.manage']===true||role?.permissions?.['queue.configure']===true;
   if(!setupMode||session()?.idToken!==auth.idToken||!allowed){lock();return false;}
   authorized=true;button.hidden=false;return true;
  }catch{lock();return false;}})().finally(()=>{flight=null;});return flight;
 }
 button.addEventListener('click',async()=>{if(!panel.hidden){closePanel();return;}if(!await check()||!authorized)return;panel.hidden=false;panel.inert=false;button.setAttribute('aria-expanded','true');panel.querySelector('select:not(:disabled),input:not(:disabled),button')?.focus();});
 document.getElementById('display-patient-mode').addEventListener('click',()=>{setupMode=false;lock();const url=new URL(location.href);url.searchParams.delete('settings');history.replaceState(null,'',url.pathname+url.search+url.hash);document.getElementById('current').focus({preventScroll:true});});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){closePanel();button.focus();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('focus',check);
 setInterval(()=>{if(!document.hidden)check();},30000);
 new MutationObserver(()=>{if(document.documentElement.hasAttribute('data-display-hide-showControls'))closePanel();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-display-hide-showControls']});
 lock();check();
})();
