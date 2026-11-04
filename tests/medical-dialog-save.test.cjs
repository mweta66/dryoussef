const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const tick=()=>new Promise(setImmediate),phone='01011111111';
function harness(){
 let current;const messages=[],writes=[],fields={cn:{value:'saved medical text'},clinical_allergies:{value:'allergy'},clinical_chronic:{value:''},clinical_diagnosis:{value:'diagnosis'},clinical_treatment:{value:'plan'}},button={disabled:false,isConnected:true},box={dataset:{medicalPhone:phone,medicalVersion:'1',medicalDirty:'true',privateDirty:'true'},querySelector:()=>button};current=box;
 const c={AUTH:{uid:'doctor'},me:{role:'doctor'},can:()=>true,document:{querySelector:()=>current,getElementById:id=>fields[id]||null,addEventListener(){}},window:{addEventListener(){}},notify:x=>messages.push(x),openForm(title,defs,save){c.lastSubmit=save;},closeM(){current=null},openCase:async()=>{},cForm(){},workflowDraft:async()=>{},logout(){c.AUTH=null},clearTimeout(){},clearInterval(){},setTimeout(){},setInterval(){},confirm:()=>true,WF_KEY:'',gateway:async()=>({ok:true}),jpatch:async updates=>{writes.push(updates);return {ok:true}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('public/clinic-private-drafts.js','utf8'),c);const d=c.activePrivateDraft={owner:c.AUTH,kind:'medical',entity:phone,fields:{n:'cn'},id:'private-medical-draft',box};return {c,d,box,button,fields,messages,writes,setCurrent:x=>{current=x}};
}
test('acknowledged medical file remains saved when private-draft cleanup fails',async()=>{
 const {c,d,box,messages}=harness();c.gateway=async()=>{throw Error('cleanup unavailable')};await c.saveNotes(phone);await d.queue;assert.equal(box.dataset.medicalDirty,'false');assert.equal(box.dataset.medicalVersion,'2');assert.ok(messages.every(x=>x.startsWith('تم حفظ الملف الطبي')));assert.ok(messages.some(x=>x.includes('المسودة القديمة')));
});
test('medical save rejects duplicate submission and retains newer typing after acknowledgement',async()=>{
 const {c,box,button,fields,writes}=harness();let release;c.jpatch=async updates=>{writes.push(updates);return new Promise(r=>{release=r})};const first=c.saveNotes(phone);await c.saveNotes(phone);assert.equal(writes.length,1);assert.equal(button.disabled,true);fields.cn.value='newer text typed during save';release({ok:true});await first;assert.equal(fields.cn.value,'newer text typed during save');assert.equal(box.dataset.medicalDirty,'true');assert.equal(box.dataset.medicalVersion,'2');assert.equal(button.disabled,false);
});
test('a delayed medical acknowledgement cannot touch another account or its editor',async()=>{
 const {c,d,box,messages,setCurrent}=harness();let release;c.jpatch=()=>new Promise(r=>{release=r});const pending=c.saveNotes(phone);c.AUTH={uid:'another_user'};setCurrent({dataset:{medicalVersion:'99'}});release({ok:true});await pending;assert.equal(box.dataset.medicalVersion,'1');assert.equal(d.saved,undefined);assert.deepEqual(messages,[]);
});
test('private-draft deletion finishes before a newer autosave for the same medical file',async()=>{
 const {c,d,fields}=harness();let release,stored={n:'old text'},saves=0;c.gateway=async(action,input)=>{if(action==='draftDelete'){await new Promise(r=>{release=r});stored=null;return {ok:true}}if(action==='draftSave'){saves++;stored=input.data;return {id:'private-medical-draft',updatedAt:new Date().toISOString()}}throw Error(action)};
 await c.saveNotes(phone);await tick();assert.equal(typeof release,'function');fields.cn.value='new unsaved medical text';d.saved=false;const queued=c.savePrivateDraft(d,{n:fields.cn.value});await tick();assert.equal(saves,0);release();await queued;assert.equal(saves,1);assert.equal(stored.n,'new unsaved medical text');
});
test('lost medical write reply is verified against exact fields and revision without replay',async()=>{
 const {c,writes,box}=harness();c.jpatch=async input=>{writes.push(input);throw Object.assign(Error('network lost'),{status:503})};c.gateway=async action=>action==='get'?{n:'saved medical text',allergies:'allergy',chronic:'',diagnosis:'diagnosis',treatment:'plan',rev:2}:{ok:true};await c.saveNotes(phone);assert.equal(writes.length,1);assert.equal(box.dataset.medicalDirty,'false');assert.equal(box.dataset.medicalVersion,'2');
});
test('permission rejection preserves unsaved medical text and unlocks save',async()=>{
 const {c,box,button,fields,messages}=harness();c.jpatch=async()=>{throw Object.assign(Error('permission denied'),{status:403})};await c.saveNotes(phone);assert.equal(box.dataset.medicalDirty,'true');assert.equal(box.dataset.medicalVersion,'1');assert.equal(fields.cn.value,'saved medical text');assert.equal(button.disabled,false);assert.ok(messages[0].includes('لم نؤكد'));
});
test('a late successful form callback cannot mark another open form draft as saved',async()=>{
 const {c,box}=harness();c.document.createElement=()=>({});box.append=()=>{};box.setAttribute=()=>{};let release;
 c.openForm('first',[{k:'name'},{k:'phone'}],()=>new Promise(r=>{release=r}));const oldDraft=c.activePrivateDraft,submit=c.lastSubmit,pending=submit({});
 c.openForm('second',[{k:'name'},{k:'phone'}],async()=>{});const newDraft=c.activePrivateDraft;release({successMessage:'saved first'});await pending;assert.equal(oldDraft.saved,true);assert.equal(newDraft.saved,undefined);assert.equal(c.activePrivateDraft,newDraft);
});
