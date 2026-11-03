const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/clinic-focused-care.js','utf8');
function harness(extra={}){
 const owner={uid:'doctor'},nodes={},events={};
 const c=vm.createContext({AUTH:owner,me:{role:'doctor'},S:{bk:[]},SESSIONS:{},BR:{alex:{name:'الإسكندرية',enabled:true}},tab:'consultation',CARE:null,can:()=>true,allBranches:()=>true,today:()=> '2026-10-31',displayBookingOrder:(a,b)=>(a.no||0)-(b.no||0),esc:x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),workspaceTabs:()=>[],doctor:()=>'',render:()=>{},logout:()=>{},busy:()=>false,confirm:()=>true,notify:()=>{},errMsg:e=>e.message,modalOpen:()=>false,act:async fn=>fn(),commit:async()=>{},gateway:async()=>({}),loadPatientReports:()=>{},openForm:()=>{},Date,Promise,clearTimeout:()=>{},setTimeout:()=>0,setInterval:()=>0,document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[],addEventListener:(name,fn)=>{events[name]=fn}},window:{addEventListener:()=>{}},...extra});
 vm.runInContext(source,c);c.careResetOwner();c.CARE.view='consultation';c.CARE.date='2026-10-31';c.CARE.branch='alex';return {c,nodes,events,owner};
}
const row=(id='a',s='exam')=>({id,phone:'01011111111',name:'مريم أحمد',date:'2026-10-31',b:'alex',no:1,v:'exam',s,rev:2});
function seed(c){c.CARE.rows=[row(),{...row('b','wait'),phone:'01011111112',name:'سارة',no:2}];c.CARE.selectedId='a';c.CARE.selected={phone:'01011111111',name:'مريم أحمد',file:{n:'نص أصلي',rev:1,allergies:'حساسية مسجلة'},complaints:[]};c.CARE.draft=c.careMedicalDraft(c.CARE.selected.file)}
test('doctor focused section and reception respect role and clinical read permissions',()=>{const {c}=harness();assert.ok(c.workspaceTabs().some(x=>x[0]==='consultation'));c.me.role='sec';assert.ok(!c.workspaceTabs().some(x=>x[0]==='consultation'));assert.ok(c.workspaceTabs().some(x=>x[0]==='reception'));c.can=()=>false;assert.ok(!c.workspaceTabs().some(x=>['consultation','reception'].includes(x[0])));});
test('unified reception labels, arrival time and elapsed wait retain original ticket values',()=>{const {c}=harness();assert.equal(c.careStatus(row('a','done'),{status:'arrived'}),'done');assert.equal(c.careStatus(row('a','wait'),{status:'arrived'}),'arrived');assert.equal(c.careStatus(row('a','wait'),{}),'not_arrived');assert.equal(c.careWaitingMinutes(row('a','wait'),{status:'arrived',arrivalAt:'2026-10-31T10:00:00Z'},Date.parse('2026-10-31T10:12:30Z')),12);c.CARE.rows=[{...row('a','wait'),no:19}];assert.ok(c.careReceptionMarkup().includes('19'));assert.ok(c.careReceptionMarkup().includes('طلب مراجعة عاجلة'));assert.ok(!c.careReceptionMarkup().includes('prioritizeEmergency'));});
test('clinical header and full medical/history content are escaped and complete',()=>{const {c}=harness();seed(c);c.CARE.selected.name='<img src=x onerror=alert(1)>';c.CARE.selected.complaints=Array.from({length:11},(_,i)=>({no:i+1,date:'2026-10-'+String(i+1).padStart(2,'0'),text:'زيارة '+i,tx:'الخطة السابقة'}));const html=c.careClinicalMarkup();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('care-n'));assert.ok(html.includes('care-allergies'));assert.ok(html.includes('تم الكشف وفتح الحالة التالية'));assert.equal((html.match(/care-history-item/g)||[]).length,11);assert.ok(html.includes('care-reports'));});
test('unsaved clinical notes prevent leaving the workspace or selecting another case when cancellation is chosen',async()=>{const {c}=harness({confirm:()=>false});seed(c);c.CARE.dirty=true;c.tab='reception';c.render();assert.equal(c.tab,'consultation');await c.careSelect('b');assert.equal(c.CARE.selectedId,'a');assert.equal(c.CARE.dirty,true);});
test('completion includes medical revision and booking revision in one write; next opens only after confirmed read',async()=>{const calls=[],{c}=harness();seed(c);c.CARE.draft.n='زيارة اليوم';c.CARE.dirty=true;c.gateway=async(a,p)=>{calls.push({a,p});if(a==='consultationComplete')return {ok:true,nextBooking:{...row('b','exam'),phone:'01011111112'}};return {bookings:[{...row('a','done'),rev:3},{...row('b','exam'),phone:'01011111112',no:2}],checkins:{},selected:{phone:'01011111112',name:'سارة',file:{n:'ملف الحالة التالية',rev:1},complaints:[]}}};await c.careSave(true);assert.equal(calls[0].a,'consultationComplete');assert.equal(calls[0].p.bookingId,'a');assert.equal(calls[0].p.revision,2);assert.equal(calls[0].p.medical.rev,1);assert.equal(calls[0].p.medical.n,'زيارة اليوم');assert.equal(c.CARE.selectedId,'b');assert.equal(c.CARE.selected.phone,'01011111112');assert.equal(c.CARE.dirty,false);});
test('failed completion keeps current medical draft and does not open the next patient',async()=>{const {c}=harness();seed(c);c.CARE.dirty=true;c.CARE.draft.n='لم يحفظ';c.gateway=async()=>{throw Object.assign(Error('لا يمكن التأكيد'),{status:409})};await c.careSave(true);assert.equal(c.CARE.selectedId,'a');assert.equal(c.CARE.selected.phone,'01011111111');assert.equal(c.CARE.dirty,true);assert.equal(c.CARE.draft.n,'لم يحفظ');});
test('when no examination is active, current file stays closed until explicit selection or a confirmed start',async()=>{const {c}=harness();c.gateway=async()=>({bookings:[row('a','wait')],checkins:{},selected:{phone:'01011111111',name:'مريم',file:{rev:1}}});await c.careLoad(true);assert.equal(c.CARE.selectedId,'');assert.equal(c.CARE.selected,null);assert.ok(c.careClinicalMarkup().includes('بدء جلسة الكشف'));});
test('failed refresh after a confirmed completion does not leave the old completion button available',async()=>{const {c}=harness();seed(c);c.gateway=async(a)=>{if(a==='consultationComplete')return {ok:true};throw Object.assign(Error('network'),{status:503})};await c.careSave(true);assert.equal(c.CARE.rows[0].s,'done');assert.equal(c.CARE.dirty,false);assert.match(c.careClinicalMarkup(),/data-care-action="complete" disabled/);});
test('future and past visits cannot be completed from the focused action',async()=>{let called=false;const {c}=harness({gateway:async()=>{called=true}});seed(c);c.CARE.rows[0].date='2026-11-01';await c.careSave(true);assert.equal(called,false);});
test('next-case sidebar follows clinical priority rather than reception arrival or dashboard sorting preference',()=>{const {c}=harness();c.CARE.rows=[{...row('normal','wait'),no:1,name:'عادية'},{...row('urgent','wait'),no:9,name:'عاجلة',v:'emergency'},{...row('current','exam'),no:4,name:'حالية'}];c.CARE.checkins={normal:{status:'arrived'}};c.displayBookingOrder=(a,b)=>b.no-a.no;const html=c.careQueueMarkup();assert.ok(html.indexOf('حالية')<html.indexOf('عاجلة'));assert.ok(html.indexOf('عاجلة')<html.indexOf('عادية'));assert.ok(html.includes('وصلت'));});
test('failed clinical save unlocks the original controls without discarding text',async()=>{const {c}=harness(),field={disabled:false,isConnected:true},button={disabled:false,isConnected:true};seed(c);c.CARE.dirty=true;c.CARE.draft.n='ملاحظات لم تحفظ';c.document.querySelectorAll=()=>[field,button];c.gateway=async()=>{throw Object.assign(Error('تعارض'),{status:409})};await c.careSave(false);assert.equal(field.disabled,false);assert.equal(button.disabled,false);assert.equal(c.CARE.draft.n,'ملاحظات لم تحفظ');assert.equal(c.CARE.dirty,true);});
test('case selection and tab navigation remain locked until the clinical write is confirmed',async()=>{const {c}=harness();seed(c);let release;const pending=new Promise(resolve=>{release=resolve});c.gateway=async action=>action==='consultationComplete'?pending:{bookings:[{...row('a','done'),rev:3},{...row('b','exam'),phone:'01011111112'}],selected:{phone:'01011111112',name:'التالية',file:{rev:1}},checkins:{}};const saving=c.careSave(true);assert.equal(c.CARE.saving,true);c.tab='reception';c.render();assert.equal(c.tab,'consultation');await c.careSelect('b');assert.equal(c.CARE.selectedId,'a');release({ok:true});await saving;assert.equal(c.CARE.selectedId,'b');});
test('a poll started before completion cannot prevent loading the confirmed next patient',async()=>{const {c}=harness();seed(c);c.CARE.loading=Promise.resolve('old poll');c.gateway=async action=>action==='consultationComplete'?{ok:true}:{bookings:[{...row('a','done'),rev:3},{...row('b','exam'),phone:'01011111112'}],selected:{phone:'01011111112',name:'التالية',file:{rev:1}},checkins:{}};await c.careSave(true);assert.equal(c.CARE.selectedId,'b');assert.equal(c.CARE.selected.phone,'01011111112');});
test('an unresolved write status does not advance to another medical file',async()=>{const {c}=harness();seed(c);c.CARE.dirty=true;c.CARE.draft.n='نص جديد';c.gateway=async action=>action==='consultationComplete'?{ok:true,writeStatus:'verifying'}:{bookings:c.CARE.rows,selected:{phone:'01011111111',file:{n:'نص أصلي',rev:1}}};await c.careSave(true);assert.equal(c.CARE.selectedId,'a');assert.equal(c.CARE.dirty,true);assert.equal(c.CARE.draft.n,'نص جديد');});
test('older complaint pages load without replacing unsaved current notes',async()=>{const {c}=harness();seed(c);const selected=c.CARE.selected;selected.complaints=Array.from({length:20},(_,i)=>({id:'c'+i,no:i+1,date:'2026-10-01',text:'شكوى'}));selected.historyHasMore=true;c.CARE.dirty=true;c.CARE.draft.n='نص ما زال يكتب';c.gateway=async(action,payload)=>{assert.equal(action,'patientHistoryPage');assert.equal(payload.kind,'complaint');assert.equal(payload.page,1);return {rows:[{id:'c20',date:'2026-09-01',data:{no:21,text:'شكوى أقدم'}}],hasMore:false}};await c.careLoadOlderHistory('complaint');assert.equal(selected.complaints.length,21);assert.equal(selected.historyHasMore,false);assert.equal(c.CARE.draft.n,'نص ما زال يكتب');assert.equal(c.CARE.dirty,true);});
test('visit snapshots remain explicitly dated and are not copied into todays editor',()=>{const {c}=harness();seed(c);c.CARE.selected.visits=[{id:'visit1',date:'2026-09-01',by:'doctor',medical:{n:'ملخص زيارة سابقة',diagnosis:'تشخيص سابق',treatment:'خطة سابقة'}}];const html=c.careHistoryMarkup(c.CARE.selected);assert.ok(html.includes('2026-09-01'));assert.ok(html.includes('ملخص الملف وقت إنهاء الزيارة'));assert.ok(html.includes('تشخيص سابق'));assert.equal(c.CARE.draft.n,'نص أصلي');assert.ok(!c.careClinicalHeader(row(),{...c.CARE.selected,patientId:'pat_1234'}).includes('pat_1234'));});
test('admin visit duration editor validates numbers and submits all types without financial fields',async()=>{let form,calls=[];const {c}=harness({me:{role:'admin'},settingsCache:{visitDurations:{exam:20,cons:10,follow:12,emergency:25}},settingsTime:1,loadSettings:async()=>{},openForm:(title,fields,save)=>{form={title,fields,save}},gateway:async(a,p)=>{calls.push({a,p});return {ok:true}}});c.document.querySelector=()=>null;c.openVisitDurations();assert.deepEqual(Array.from(form.fields,x=>x.k),['exam','cons','follow','emergency']);assert.equal(form.fields[0].v,20);assert.equal(typeof await form.save({exam:'0',cons:'10',follow:'5',emergency:'20'}),'string');assert.equal(calls.length,0);const saved=await form.save({exam:'20',cons:'10',follow:'5',emergency:'25'});assert.equal(calls[0].a,'visitDurationsSave');assert.equal(calls[0].p.durations.follow,5);assert.ok(saved.successMessage.includes('حُفظت'));assert.ok(!form.fields.some(x=>/دفع|سعر|مال|تحصيل/.test(x.l)));});

test('returning to a remounted focused screen invalidates a cached examination revision and in-flight read',async()=>{const {c}=harness();seed(c);c.CARE.loadedAt=Date.now();c.CARE.loading=Promise.resolve('old request');const prior=c.CARE.request;c.carePage('consultation');assert.equal(c.CARE.loadedAt,0);assert.equal(c.CARE.loading,null);assert.ok(c.CARE.request>prior);c.gateway=async()=>({bookings:[{...row(),rev:4}],selected:{phone:row().phone,file:{rev:1,n:'ملف حديث'}},checkins:{}});await c.careLoad(false);assert.equal(c.CARE.rows[0].rev,4);assert.equal(c.CARE.selectedId,'a');});

test('focused medical draft requests are serialized and an older response never reports newer text as saved',async()=>{
 const {c,nodes}=harness();seed(c);c.CARE.dirty=true;c.CARE.draft.n='الأقدم';
 const calls=[],release=[];nodes['care-save-status']={textContent:'نص أحدث لم يؤكد بعد'};
 c.gateway=(action,input)=>{assert.equal(action,'draftSave');calls.push(input);return new Promise(resolve=>release.push(resolve));};
 const older=c.careSavePrivateDraft();await new Promise(setImmediate);assert.equal(calls.length,1);
 c.CARE.draft.n='الأحدث';const newer=c.careSavePrivateDraft();await new Promise(setImmediate);assert.equal(calls.length,1);
 release.shift()({id:'draft'});await new Promise(setImmediate);
 assert.equal(calls.length,2);assert.equal(calls[0].data.n,'الأقدم');assert.equal(calls[1].data.n,'الأحدث');
 assert.equal(nodes['care-save-status'].textContent,'نص أحدث لم يؤكد بعد');
 release.shift()({id:'draft'});await Promise.all([older,newer]);
 assert.match(nodes['care-save-status'].textContent,/حُفظت مسودة خاصة/);assert.equal(c.CARE.draft.n,'الأحدث');
});

test('confirmed completion cleans a pending old draft after it settles without touching the next patient draft',async()=>{
 const {c}=harness();seed(c);c.CARE.dirty=true;c.CARE.draft.n='مسودة قديمة';
 const calls=[];let release;
 c.gateway=async(action,input)=>{
  calls.push({action,input});
  if(action==='draftSave'&&input.entity==='01011111111')return new Promise(resolve=>release=resolve);
  if(action==='draftSave')return {id:'next-draft'};
  if(action==='draftDelete')return {ok:true};
  if(action==='consultationComplete')return {ok:true};
  if(action==='consultationView')return {bookings:[{...row('a','done'),rev:3},{...row('b','exam'),phone:'01011111112',no:2}],checkins:{},selected:{phone:'01011111112',name:'التالية',file:{n:'ملف التالية',rev:1},complaints:[]}};
  throw Error('Unexpected '+action);
 };
 const older=c.careSavePrivateDraft();await new Promise(setImmediate);
 c.CARE.draft.n='النص الطبي النهائي';await c.careSave(true);
 const pending=c.CARE.privateDrafts.get('01011111111').queue;
 assert.equal(c.CARE.selected.phone,'01011111112');assert.equal(c.CARE.draftId,null);
 c.CARE.dirty=true;c.CARE.draft=c.careMedicalDraft(c.CARE.selected.file);c.CARE.draft.n='مسودة التالية';
 await c.careSavePrivateDraft();assert.equal(c.CARE.draftId,'next-draft');
 release({id:'old-draft'});await older;await pending;
 assert.deepEqual(calls.filter(x=>x.action==='draftDelete').map(x=>x.input.id),['old-draft']);
 assert.equal(c.CARE.selected.phone,'01011111112');assert.equal(c.CARE.draftId,'next-draft');assert.equal(c.CARE.draft.n,'مسودة التالية');
});

test('an old medical draft keeps its captured patient and branch and cannot update another branch UI',async()=>{
 const {c,nodes}=harness();seed(c);c.CARE.dirty=true;c.CARE.draft.n='فرع الإسكندرية';
 let input,release;nodes['care-save-status']={textContent:'حالة الفرع الحالي'};
 c.gateway=(action,payload)=>{input=payload;return new Promise(resolve=>release=resolve);};
 const pending=c.careSavePrivateDraft();await new Promise(setImmediate);
 c.CARE.branch='matrouh';c.CARE.selected={phone:'01011111112',file:{rev:1}};c.CARE.draftId=null;c.CARE.draft={n:'نص حالة أخرى',rev:1};
 release({id:'old-draft'});await pending;
 assert.equal(input.entity,'01011111111');assert.equal(input.branch,'alex');assert.equal(input.data.n,'فرع الإسكندرية');
 assert.equal(c.CARE.draftId,null);assert.equal(c.CARE.draft.n,'نص حالة أخرى');assert.equal(nodes['care-save-status'].textContent,'حالة الفرع الحالي');
});

test('logout cancels queued medical drafts and late responses cannot alter a new account',async()=>{
 const {c,nodes}=harness();seed(c);c.CARE.dirty=true;c.CARE.draft.n='نص الحساب الأول';
 let calls=0,release;nodes['care-save-status']={textContent:'حالة الحساب الجديد'};
 c.gateway=()=>{calls++;return new Promise(resolve=>release=resolve);};
 const first=c.careSavePrivateDraft();await new Promise(setImmediate);
 c.CARE.draft.n='نص أحدث بالحساب الأول';const queued=c.careSavePrivateDraft();
 c.logout();c.AUTH={uid:'second'};
 release({id:'old-account-draft'});await Promise.all([first,queued]);
 assert.equal(calls,1);assert.equal(c.CARE.draftId,null);assert.equal(c.CARE.privateDrafts.size,0);
 assert.equal(nodes['care-save-status'].textContent,'حالة الحساب الجديد');
});

test('an older draft response cannot mark newer typing saved before its debounce starts',async()=>{
 const {c,nodes,events}=harness();seed(c);c.CARE.dirty=true;c.CARE.draft.n='النص الأقدم';
 let release;nodes['care-save-status']={textContent:'توجد تعديلات لم تُحفظ'};
 c.gateway=()=>new Promise(resolve=>release=resolve);
 const pending=c.careSavePrivateDraft();await new Promise(setImmediate);
 events.input({target:{dataset:{careMedical:'n'},value:'نص أحدث لم يبدأ حفظه بعد'}});
 release({id:'older-draft'});await pending;
 assert.equal(c.CARE.draft.n,'نص أحدث لم يبدأ حفظه بعد');
 assert.equal(nodes['care-save-status'].textContent,'توجد تعديلات لم تُحفظ');
});

test('a late draft read for another branch cannot replace the current recovery candidate',async()=>{
 const {c}=harness();seed(c);let release;
 c.gateway=async action=>action==='workflowList'?new Promise(resolve=>release=resolve):assert.fail('Stale branch must not fetch the draft');
 const pending=c.careLoadPrivateDraft();await new Promise(setImmediate);
 c.CARE.branch='matrouh';c.CARE.draftCandidate={id:'current-branch-draft'};
 release({drafts:[{id:'old-branch-draft',kind:'medical',entity:c.CARE.selected.phone}]});await pending;
 assert.equal(c.CARE.draftCandidate.id,'current-branch-draft');assert.equal(c.CARE.draftId,null);
});

test('refreshing the same medical file retains its recoverable private draft banner',async()=>{
 const {c}=harness();seed(c);c.CARE.draftCandidate={id:'recoverable-draft',data:{n:'كتابة سابقة',rev:1}};c.CARE.draftId='recoverable-draft';
 c.gateway=async()=>({bookings:[row()],checkins:{},selected:{phone:row().phone,file:{n:'نص أصلي',rev:1}}});
 await c.careLoad(true);
 assert.equal(c.CARE.draftCandidate.id,'recoverable-draft');assert.equal(c.CARE.draftId,'recoverable-draft');
 assert.match(c.carePrivateDraftMarkup(),/مراجعة واستعادة المسودة/);
});
