/* Public screens start with no controls; setup requires a live staff permission. */
(function(){
 const button=document.getElementById('display-settings-toggle'),panel=document.getElementById('display-settings-panel'),backdrop=document.getElementById('display-settings-backdrop');
 if(!button||!panel)return;
 let setupMode=new URLSearchParams(location.search).get('settings')==='1',authorized=false,flight;
 function closePanel(){if(backdrop)backdrop.hidden=true;panel.hidden=true;panel.inert=true;button.setAttribute('aria-expanded','false');}
 function lock(){authorized=false;closePanel();button.hidden=true;window.ScreenNoticeControls?.authorized(null);}
 function session(){try{return JSON.parse(sessionStorage.getItem('clinic_supabase_auth'))}catch{return null}}
 async function freshSession(){const auth=session();if(!auth?.idToken||!auth.uid)return null;if(!auth.refresh||!auth.exp||Date.now()<auth.exp-60000)return auth;const cfg=window.CLINIC_CONFIG||{},url=cfg.demo?'/api/auth':cfg.supabaseUrl+'/auth/v1/token?grant_type=refresh_token',headers={'Content-Type':'application/json',...(cfg.demo?{Authorization:'Bearer '+auth.idToken}:{apikey:cfg.publishableKey||''})},payload=cfg.demo?{ep:'refresh',body:{refresh_token:auth.refresh}}:{refresh_token:auth.refresh};const response=await fetch(url,{method:'POST',cache:'no-store',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('session expired');const data=await response.json();if(session()?.idToken!==auth.idToken)throw Error('session changed');const token=cfg.demo?data.idToken:data.access_token;if(!token)throw Error('invalid session');const next={...auth,idToken:token,refresh:(cfg.demo?data.refreshToken:data.refresh_token)||auth.refresh,exp:Date.now()+Number((cfg.demo?data.expiresIn:data.expires_in)||3600)*1000};sessionStorage.setItem('clinic_supabase_auth',JSON.stringify(next));return next;}
 async function check(){
  if(!setupMode){lock();return false;}if(flight)return flight;
  flight=(async()=>{try{
   const auth=await freshSession();if(!auth?.idToken||!auth.uid){lock();return false;}
   const cfg=window.CLINIC_CONFIG||{},response=await fetch(cfg.endpoint||'/api/clinic',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',...(cfg.publishableKey?{apikey:cfg.publishableKey}:{}),Authorization:'Bearer '+auth.idToken},body:JSON.stringify({action:'get',path:'roles/'+auth.uid}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('unauthorized');const role=(await response.json()).data;
   const allowed=role?.r==='admin'||role?.permissions?.['display.manage']===true||role?.permissions?.['queue.configure']===true;
   if(!setupMode||session()?.idToken!==auth.idToken||!allowed){lock();return false;}
   authorized=true;button.hidden=false;window.ScreenNoticeControls?.authorized(role,async input=>{const current=await freshSession();if(!current)throw Error('انتهت جلسة الدخول');const r=await fetch(cfg.endpoint||'/api/clinic',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',...(cfg.publishableKey?{apikey:cfg.publishableKey}:{}),Authorization:'Bearer '+current.idToken},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)}),value=await r.json();if(!r.ok)throw Error(value.error||'تعذر حفظ إعدادات الشاشة');return value.data;});return true;
  }catch{lock();return false;}})().finally(()=>{flight=null;});return flight;
 }
 button.addEventListener('click',async()=>{if(!panel.hidden){closePanel();return;}if(!await check()||!authorized)return;panel.hidden=false;panel.inert=false;if(backdrop)backdrop.hidden=false;button.setAttribute('aria-expanded','true');panel.querySelector('select:not(:disabled),input:not(:disabled),button')?.focus();});
 document.getElementById('display-settings-close')?.addEventListener('click',()=>{closePanel();button.focus();});backdrop?.addEventListener('click',()=>{closePanel();button.focus();});
 document.getElementById('display-patient-mode').addEventListener('click',()=>{setupMode=false;lock();const url=new URL(location.href);url.searchParams.delete('settings');history.replaceState(null,'',url.pathname+url.search+url.hash);document.getElementById('current').focus({preventScroll:true});});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){closePanel();button.focus();}});
 document.addEventListener('keydown',event=>{if(event.key!=='Tab'||panel.hidden)return;const items=Array.from(panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')).filter(x=>x.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});window.addEventListener('focus',check);
 setInterval(()=>{if(!document.hidden)check();},30000);
 new MutationObserver(()=>{if(document.documentElement.hasAttribute('data-display-hide-showControls'))closePanel();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-display-hide-showControls']});
 lock();check();
})();
