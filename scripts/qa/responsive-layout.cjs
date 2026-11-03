// Responsive inspection on synthetic isolated data; no production access or committed UI actions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const repo=path.resolve(__dirname,'../..'),root=process.env.CLINIC_QA_ROOT||'/tmp/clinic-final-layout',out=process.env.CLINIC_QA_OUTPUT||'/tmp/clinic-final-audit-evidence/layout',port=Number(process.env.CLINIC_QA_PORT||4427),base='http://127.0.0.1:'+port;
assert.ok(path.resolve(root)!==repo&&!path.resolve(root).startsWith(repo+path.sep),'Generated fixture outside checkout required');
const accounts=JSON.parse(fs.readFileSync(root+'/.demo/accounts.json')),baseline=JSON.parse(fs.readFileSync(root+'/baseline-state.json')),rows=[],errors=[],networkErrors=[],fontProof=[];
assert.ok(accounts.length===8&&accounts.every(x=>x.uid.startsWith('qa_')),'Only generated QA accounts are permitted');
fs.mkdirSync(out,{recursive:true});
function save(){fs.writeFileSync(out+'/responsive-layout-results.json',JSON.stringify({scope:'Generated isolated data; Chromium; display inspection and modal opening, not confirmed mutation coverage',widths:[320,390,768,1366],themes:['light','dark'],results:rows,errors,networkErrors,fontProof,notCovered:['Native iPhone Safari and other browser engines','Supabase Auth/Storage and production network','Every arbitrary future customization or clinical field value']},null,2));}
function visibleMetric(){
 const shown=x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
 const scrollParent=x=>{for(let p=x.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowX)&&p.scrollWidth>p.clientWidth+2)return true}return false};
 const controls=[...document.querySelectorAll('button,select,input:not([type=hidden]),textarea')].filter(shown);
 const clipped=controls.filter(x=>{const r=x.getBoundingClientRect();return (r.left< -2||r.right>innerWidth+2)&&!scrollParent(x)}).map(x=>({id:x.id,text:(x.textContent||x.getAttribute('aria-label')||x.type||'').trim().slice(0,90),left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right}));
 const fields=controls.filter(x=>x.matches('select,textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=button]):not([type=submit])'));
 const smallFields=fields.filter(x=>parseFloat(getComputedStyle(x).fontSize)<16).map(x=>({id:x.id,fontSize:getComputedStyle(x).fontSize}));
 const targets=controls.filter(x=>x.matches('button,select,input[type=button],input[type=submit]'));
 const smallTargets=targets.filter(x=>{const r=x.getBoundingClientRect();return r.width<24||r.height<24}).map(x=>({id:x.id,text:x.textContent.trim().slice(0,60),width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height}));
 const modal=document.querySelector('.mod,dialog[open]'),r=modal?.getBoundingClientRect();
 return {overflow:document.documentElement.scrollWidth>innerWidth+2,clipped,smallFields,smallTargets,visibleControls:controls.length,font:getComputedStyle(document.body).fontFamily,cairoLoaded:document.fonts.check('16px Cairo'),modal:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,clientHeight:modal.clientHeight,scrollHeight:modal.scrollHeight,overflowY:getComputedStyle(modal).overflowY}:null};
}
async function geometry(page,role,screen){
 for(const width of [320,390,768,1366]){await page.setViewportSize({width,height:width<600?844:900});for(const theme of ['light','dark']){
  await page.evaluate(theme=>{localStorage.setItem('clinic_theme',theme);document.documentElement.dataset.theme=theme},theme);await page.waitForTimeout(35);
  const metrics=await page.evaluate(visibleMetric),modalFits=!metrics.modal||(metrics.modal.left>=-2&&metrics.modal.right<=width+2&&metrics.modal.top>=-2&&metrics.modal.bottom<=(width<600?844:900)+2),pass=!metrics.overflow&&!metrics.clipped.length&&!metrics.smallFields.length&&!metrics.smallTargets.length&&metrics.cairoLoaded&&modalFits;
  rows.push({role,screen,width,theme,pass,...metrics});save();
  if(!pass){console.log('FAIL',role,screen,width,theme,JSON.stringify({overflow:metrics.overflow,clipped:metrics.clipped,smallFields:metrics.smallFields,smallTargets:metrics.smallTargets,modal:metrics.modal}));await page.screenshot({path:path.join(out,'layout-fail-'+rows.length+'.png'),fullPage:true})}
 }}
}
async function fontCheck(page,role){
 const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root:document}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:document.nodeId,selector:'h2,h1,label,p'});const proof=nodeId?await cdp.send('CSS.getPlatformFontsForNode',{nodeId}):{fonts:[]};fontProof.push({role,fonts:proof.fonts});await cdp.detach();
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CLINIC_QA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const account of process.env.CLINIC_QA_PUBLIC_ONLY==='1'?[]:accounts){fs.writeFileSync(root+'/.demo/state.json',JSON.stringify(baseline));const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-EG'}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push({role:account.u,error:e.message}));page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=500)networkErrors.push({role:account.u,status:r.status()})});page.on('dialog',d=>d.dismiss());
  try{await page.goto(base+'/'+(account.u==='admin'?'admin.html#admin':'staff.html#staff'));await page.locator('#u').fill(account.u);await page.locator('#pw').fill(account.password);await page.locator('#lb').click();await page.waitForFunction(()=>window.me&&!window.ClinicBoot?.loading&&!window.refreshingData&&!window.featureBusy);await page.evaluate(()=>document.fonts.ready);await fontCheck(page,account.u);
   const tabs=await page.locator('button.tab').evaluateAll(xs=>xs.map(x=>({label:x.textContent,id:/tab='([^']+)'/.exec(x.getAttribute('onclick')||'')?.[1]})).filter(x=>x.id));
   for(const tab of tabs){if(await page.locator('.staff-mobile-nav select').first().isVisible())await page.locator('.staff-mobile-nav select').first().selectOption(tab.id);else await page.locator('button.tab').filter({hasText:tab.label}).first().click();await page.waitForFunction(()=>!window.refreshingData&&!window.featureBusy);await page.waitForTimeout(80);await geometry(page,account.u,tab.id)}
   if(account.u==='admin'){
    const booking=Object.values(baseline.bookings).flatMap(Object.values).find(x=>x.b==='alex'&&x.date===new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'}));assert.ok(booking);
    for(const [screen,fn]of [['new-booking',()=>page.evaluate(()=>newBk('exam'))],['medical-file',()=>page.evaluate(phone=>openCase(phone),booking.phone)],['follow-up-plan',()=>page.evaluate(x=>openFollowupPlan(x.phone,x.id),booking)],['next-visit',()=>page.evaluate(x=>bookNextVisit(x.phone,x.id),booking)]]){
     await page.evaluate(()=>{document.querySelectorAll('.mod').forEach(x=>{x.dataset.medicalDirty='false';x.dataset.complaintDirty='false';x.dataset.privateDirty='false'});closeM()});await fn();await page.waitForSelector('.mod');await page.waitForTimeout(150);await geometry(page,account.u,'modal-'+screen);await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'modal-'+screen+'-390.png'),fullPage:true});
    }
   }
  }catch(e){rows.push({role:account.u,screen:'runner',pass:false,error:e.message});save();throw e}finally{await context.close()}
 }
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-EG'}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push({role:'public',error:e.message}));
 const routes=process.env.CLINIC_QA_ROUTES?process.env.CLINIC_QA_ROUTES.split(','):['/','/privacy.html','/terms.html','/404.html','/missing-page-qa','/branches/alex','/branches/matrouh','/branches/dmn','/branches/libya','/branches/alex.html','/branches/matrouh.html','/branches/dmn.html','/branches/libya.html','/display.html?branch=alex','/admin.html','/staff.html'];
 for(const route of routes){const response=await page.goto(base+route);assert.equal(response.status(),route==='/missing-page-qa'?404:200);await page.waitForFunction(()=>!window.ClinicBoot?.loading);await page.evaluate(()=>document.fonts.ready);await fontCheck(page,route);await geometry(page,'public',route);const links=await page.locator('a[href^="tel:"],a[href^="https://wa.me/"]').evaluateAll(xs=>xs.map(x=>({text:x.textContent.trim(),href:x.getAttribute('href')})));for(const link of links)assert.ok(/^tel:\+?[\d\s()-]+$/.test(link.href)||/^https:\/\/wa\.me\/\d+$/.test(link.href),'Valid contact href required; no external call or message is sent');rows.push({role:'public',screen:route+' contact-links',pass:true,links,verification:'href only; never activated'});save();if(route==='/'||route.startsWith('/display')){await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,route==='/'?'public-390.png':'display-390.png'),fullPage:true})}}
 await context.close();
}finally{save();await browser.close()}const result={views:rows.length,failed:rows.filter(x=>!x.pass).length,scriptErrors:errors.length,serverErrors:networkErrors.length,fontChecks:fontProof.length};console.log(JSON.stringify(result));if(result.failed||result.scriptErrors||result.serverErrors)process.exitCode=1;})().catch(e=>{save();console.error(e.message);process.exitCode=1});
