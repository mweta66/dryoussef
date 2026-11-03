const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createService}=require('../server/service.cjs'),core=require('../server/core.cjs');
const source=fs.readFileSync(require.resolve('../public/display.js'),'utf8');
const refreshSource=source.slice(source.indexOf('async function refreshDisplay('),source.indexOf('const initialParams='));

function displayHarness(responses){
 let clock=100000,calls=0,timerId=0;const timers=new Map(),nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='branch'?'alex':'',textContent:'',dataset:{},style:{setProperty(){}},options:[],replaceChildren(){},appendChild(){}});return nodes.get(id)};
 const queue={branch:'alex',date:'2026-11-03',status:'running',current:1,next:[{no:2}],waiting:1,followBranch:null};
 const context={console,Date:class extends Date{static now(){return clock}},Intl,AbortSignal,Response,Math,Promise,Array,Object,Number,String,Error,
  displayBusy:false,displayRefreshQueued:false,displayRetryAt:0,displayFailures:0,displayScreenId:'qa_screen_1234567890',displayRetryTimer:null,lastDisplayAttempt:0,lastDisplay:0,displayEpoch:0,displayFollowDoctor:false,displayDate:'',displayBranches:{alex:{name:'Alex'}},
  window:{displayFixedUnavailable:false},document:{hidden:false,getElementById:node,createElement:()=>({appendChild(){}}),createTextNode:x=>x},CLINIC_CONFIG:{endpoint:'/api/clinic'},
  selectedDisplayDate:()=>queue.date,displayToday:()=>queue.date,displaySetting:(key,fallback)=>fallback,updateDisplayBranchName(){},setCurrentNumber:value=>{node('current').textContent=value},
  setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),
  fetch:async(...args)=>{calls++;return responses(calls,queue,args)}};
 vm.createContext(context);vm.runInContext(refreshSource,context);
 return {context,node,calls:()=>calls,advance:async ms=>{clock+=ms;const due=[...timers.values()];timers.clear();for(const fn of due)await fn();},response:(queue,overrides={})=>new Response(JSON.stringify({data:{...queue,...overrides}}),{status:200})};
}

test('queue invalidation received during a read is retained without overlapping or replaying stale data',async()=>{
 let release;const held=new Promise(resolve=>{release=resolve});
 const h=displayHarness(async(n,queue)=>{if(n===1)await held;return h.response(queue,{current:n});});
 const first=h.context.refreshDisplay(true);await Promise.resolve();
 await h.context.refreshDisplay(true);assert.equal(h.calls(),1,'Do not overlap reads');
 release();await first;assert.equal(h.node('current').textContent,'1');
 await h.advance(3100);assert.equal(h.calls(),2,'A queued invalidation must trigger the follow-up read');
 assert.equal(h.node('current').textContent,'2');assert.equal(h.context.displayBusy,false);
});

test('a reply from the prior branch/date cannot repaint a newer selection',async()=>{
 let release;const held=new Promise(resolve=>{release=resolve});
 const h=displayHarness(async(n,queue)=>{if(n===1)await held;return h.response(queue,{current:n});});
 const first=h.context.refreshDisplay(true);await Promise.resolve();h.context.displayEpoch++;
 await h.context.refreshDisplay(true);release();await first;
 assert.equal(h.node('current').textContent,'','The stale ticket must not paint');
 await h.advance(3100);assert.equal(h.node('current').textContent,'2');
});

test('public queue respects Retry-After rather than continuing normal polls through a429',async()=>{
 const h=displayHarness(async(n,queue)=>n===1?new Response(JSON.stringify({error:'rate limit'}),{status:429,headers:{'Retry-After':'15'}}):h.response(queue,{current:7}));
 await h.context.refreshDisplay();assert.equal(h.calls(),1);assert.equal(h.node('current').textContent,'—');
 assert.equal(h.context.displayRetryAt,115000);
 await h.advance(5000);await h.context.refreshDisplay(true);assert.equal(h.calls(),1,'Do not spend more rate-limit calls while backing off');
 await h.advance(10000);assert.equal(h.calls(),2);assert.equal(h.node('current').textContent,'7');assert.equal(h.context.displayRetryAt,0);
});

test('transport failures back off while the display clears stale ticket data and then recovers',async()=>{
 const h=displayHarness(async(n,queue)=>{if(n===1)throw Error('connection lost');return h.response(queue,{current:8});});
 h.node('current').textContent='3';await h.context.refreshDisplay();assert.equal(h.node('current').textContent,'—');assert.equal(h.node('connection').dataset.error,'true');
 await h.context.refreshDisplay();assert.equal(h.calls(),1);await h.advance(3100);
 assert.equal(h.node('current').textContent,'8');assert.equal(h.node('connection').dataset.error,'false');
});

for(const runtime of ['Node','Edge'])test(runtime+' queue budgets distinguish display windows, reject malformed IDs and keep phone lookup limits unchanged',async()=>{
 const serviceFactory=runtime==='Node'?createService:(await import('../supabase/functions/clinic-api/service.js')).createService;
 const day=core.today(),state={settings:{branches:{alex:{name:'Alex'}}},bookings:{}},counts=new Map(),subjects=new Set();let total=0;
 const adapter={read:async()=>state,limit:async(client,subject)=>{total++;subjects.add(subject);const count=(counts.get(subject)||0)+1;counts.set(subject,count);if(total>300||subjects.size>20||count>20){const e=Error('budget exceeded');e.status=429;throw e}}};
 const service=serviceFactory(adapter),one='qa_screen_document_one',two='qa_screen_document_two';
 for(let i=0;i<12;i++)for(const screenId of [one,two])await service({action:'publicQueue',branch:'alex',date:day,screenId},null,'same-ip');
 assert.equal(counts.get('display:alex:'+one),12);assert.equal(counts.get('display:alex:'+two),12);
 for(const screenId of ['',123,[],{},'short','x'.repeat(65),'bad/id_with_slash'])await assert.rejects(service({action:'publicQueue',branch:'alex',date:day,screenId},null,'same-ip'),{status:400});
 assert.equal(total,24,'Invalid window identifiers must fail before spending a budget');
 await service({action:'publicQueue',branch:'alex',date:day},null,'same-ip');assert.equal(counts.get('display:alex'),1,'Keep old clients supported');
 for(let i=0;i<20;i++)await service({action:'lookup',phone:'01012345678',date:day,screenId:i%2?one:two},null,'same-ip');
 await assert.rejects(service({action:'lookup',phone:'01012345678',date:day,screenId:'qa_another_window_id'},null,'same-ip'),{status:429});
 assert.equal(counts.get('01012345678'),21,'The display identifier never partitions patient lookup limits');
 for(let i=0;i<8;i++)await service({action:'publicQueue',branch:'alex',date:day,screenId:one},null,'same-ip');
 await assert.rejects(service({action:'publicQueue',branch:'alex',date:day,screenId:one},null,'same-ip'),{status:429},'Each window still has the existing twenty-read allowance');
});
