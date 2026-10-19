/* Informational and 404 pages load only the public shared design, never staff data. */
(function(){
 let flight=null;
 async function refresh(){if(document.hidden||flight)return flight;const config=window.CLINIC_CONFIG;
  flight=(async()=>{try{const response=await fetch(config.endpoint||'/api/clinic',{method:'POST',headers:{'Content-Type':'application/json',...(config.publishableKey?{apikey:config.publishableKey}:{})},body:JSON.stringify({action:'get',path:'settings'}),cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Theme unavailable');const result=await response.json(),site=result.data?.site;if(site)applyAdvancedDesign(site.design||{},site);}catch{/* Privacy and error information remain readable offline. */}finally{flight=null;}})();return flight;
 }
 document.addEventListener('DOMContentLoaded',refresh);setInterval(refresh,60000);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
