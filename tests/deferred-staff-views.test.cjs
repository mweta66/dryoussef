const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const lines=fs.readFileSync('public/clinic-workflow.js','utf8').split('\n'),source=lines.filter(x=>x.startsWith('async function workflowDraft(')||x.startsWith('var timelineRequest=')||x.startsWith('async function showPatientTimeline(')).join('\n');
function harness(){let current=null;const boxes=[],reads=[];const c={AUTH:{uid:'sec'},me:{role:'sec',br:'alex',permissions:{'notes.read':true}},WF:{drafts:[{id:'a',kind:'booking'}]},gateway:(action,input)=>new Promise(resolve=>reads.push({action,input,resolve})),notify(){},document:{querySelector:()=>current,createElement:()=>({style:{},children:[],append(x){this.children.push(x)}})},openForm(){current={prepend(x){this.content=x}};boxes.push(current)}};vm.createContext(c);vm.runInContext(source,c);return {c,boxes,reads,setCurrent:x=>{current=x}};}
test('private timeline cannot reopen after logout or changed branch permissions',async()=>{
 for(const change of ['logout','branch']){const {c,boxes,reads}=harness();const pending=c.showPatientTimeline('01011111111');if(change==='logout'){c.AUTH=null;c.me=null}else c.me.br='matrouh';reads[0].resolve([{kind:'medical',text:'private patient note'}]);await pending;assert.equal(boxes.length,0);}
});
test('older patient timeline cannot replace the newest requested patient or another modal',async()=>{
 const {c,boxes,reads}=harness();const a=c.showPatientTimeline('01011111111'),b=c.showPatientTimeline('01011111112');reads[1].resolve([{kind:'booking',date:'2026-11-04'}]);await b;reads[0].resolve([{kind:'medical',text:'older private patient'}]);await a;assert.equal(boxes.length,1);
 const other=harness();const pending=other.c.showPatientTimeline('01011111111');other.setCurrent({unrelated:true});other.reads[0].resolve([]);await pending;assert.equal(other.boxes.length,0);
});
test('a private draft preview retains its captured identity when the sidebar list refreshes',async()=>{
 const {c,reads}=harness();const pending=c.workflowDraft(0);c.WF={drafts:[{id:'b',kind:'medical'}]};reads[0].resolve({id:'a',data:{name:'own draft'}});const preview=await pending;assert.equal(reads[0].input.id,'a');assert.equal(preview.meta.id,'a');assert.equal(preview.meta.kind,'booking');
});
test('a delayed draft response cannot render private text after another account signs in',async()=>{
 const {c,reads,boxes}=harness();const pending=c.workflowDraft(0);c.AUTH={uid:'other'};reads[0].resolve({id:'a',data:{n:'private old account'}});assert.equal(await pending,undefined);assert.equal(boxes.length,0);
});
