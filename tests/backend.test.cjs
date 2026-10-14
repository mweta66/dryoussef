const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../server/core.cjs'),{createService}=require('../server/service.cjs'),{makeDemo}=require('../scripts/demo-data.cjs');
function fixture(){let state=makeDemo().state,queue=Promise.resolve();return {
 state:()=>state,
 handle:createService({
  read:async()=>structuredClone(state),
  mutate:fn=>{const run=queue.then(()=>{state=fn(state)});queue=run.catch(()=>{});return run},
  limit:async()=>{},createUser:async()=> 'demo_new_account',deleteUser:async()=>{}
 })
};}
const booking=(id,phone='01275884716',b='dmn')=>({id,name:'Test',phone,b,date:core.today(),v:'exam',nt:'',s:'wait'});
test('demo purge persists dismissal and preserves real bookings, accounts and clinic settings',async()=>{
 const f=fixture();await assert.rejects(f.handle({action:'purgeDemo'},'demo_dmn'),{status:403});
 await f.handle({action:'commit',puts:[{n:booking('real_booking')}],dels:[]},'demo_doctor');
 const before=structuredClone(f.state());await f.handle({action:'purgeDemo'},'demo_doctor');
 assert.equal(f.state().settings.demoPurged,true);assert.deepEqual(f.state().roles,before.roles);assert.deepEqual(f.state().settings.sched,before.settings.sched);
 assert.deepEqual(Object.values(f.state().bookings).flatMap(Object.values).map(x=>x.id),['real_booking']);
 assert.equal((await f.handle({action:'get',path:'settings'},'demo_doctor')).demoPurged,true);
});
test('seed provides 60 bookings, all states, both branches, 5 clinic days, 3 roles and matching tracking',()=>{
 const {state,accounts}=makeDemo(),rows=Object.values(state.bookings).flatMap(Object.values);
 assert.equal(rows.length,60);assert.equal(accounts.length,3);assert.equal(Object.keys(state.bookings).length,5);
 assert.deepEqual(new Set(rows.map(x=>x.s)),new Set(['wait','exam','done','no','cx']));
 for(const x of rows){assert.ok(state.track[x.date][x.phone]);assert.equal(x.lookupCode,undefined);}
});
test('server isolates secretary reads and denies unauthorized paths and role escalation',async()=>{
 const f=fixture(),rows=await f.handle({action:'get',path:'bookings/'+core.today()},'demo_dmn');
 assert.ok(Object.values(rows).every(x=>x.b==='dmn'));
 await assert.rejects(f.handle({action:'get',path:'roles'},'demo_dmn'),{status:403});
 await assert.rejects(f.handle({action:'patch',updates:{'roles/demo_dmn':{r:'doctor',u:'evil'}}},'demo_dmn'),{status:403});
 await assert.rejects(f.handle({action:'get',path:'bookings'},null),{status:403});
});
test('atomic simultaneous creates allocate distinct ticket numbers',async()=>{
 const f=fixture();
 await Promise.all([f.handle({action:'commit',puts:[{n:booking('new1'),o:null}],dels:[]},'demo_dmn'),f.handle({action:'commit',puts:[{n:booking('new2','01112345678'),o:null}],dels:[]},'demo_dmn')]);
 const rows=f.state().bookings[core.today()];assert.equal(rows.new1.no,7);assert.equal(rows.new2.no,8);
});
test('simultaneous same-phone creates across branches allow exactly one booking',async()=>{
 const f=fixture(),result=await Promise.allSettled([f.handle({action:'commit',puts:[{n:booking('new1'),o:null}],dels:[]},'demo_doctor'),f.handle({action:'commit',puts:[{n:booking('new2','01275884716','alex'),o:null}],dels:[]},'demo_doctor')]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(result.find(x=>x.status==='rejected').reason.status,409);
});
test('stale updates fail without changing stored data',async()=>{
 const f=fixture(),old=Object.values(f.state().bookings[core.today()])[0];
 await f.handle({action:'commit',puts:[{o:old,n:{...old,s:'done'}}],dels:[]},'demo_doctor');
 await assert.rejects(f.handle({action:'commit',puts:[{o:old,n:{...old,s:'cx'}}],dels:[]},'demo_doctor'),{status:409});
 assert.equal(f.state().bookings[old.date][old.id].s,'done');
});
test('secretary cannot change another branch, delete bookings or rewrite patient details',async()=>{
 const f=fixture(),old=Object.values(f.state().bookings[core.today()]).find(x=>x.b==='alex');
 await assert.rejects(f.handle({action:'commit',puts:[{o:old,n:{...old,s:'done'}}],dels:[]},'demo_dmn'),{status:403});
 await assert.rejects(f.handle({action:'commit',puts:[],dels:[old]},'demo_alex'),{status:403});
 await assert.rejects(f.handle({action:'commit',puts:[{o:old,n:{...old,name:'Changed'}}],dels:[]},'demo_alex'),{status:403});
});
test('move/change phone increments revision and clears obsolete tracking',async()=>{
 const f=fixture(),old=Object.values(f.state().bookings[core.today()])[0];
 await f.handle({action:'commit',puts:[{o:old,n:{...old,phone:'01275884716',date:'2030-01-01',b:'alex'}}],dels:[]},'demo_doctor');
 const state=f.state();assert.equal(state.track[old.date][old.phone],undefined);
 assert.equal(state.bookings['2030-01-01'][old.id].rev,old.rev+1);
});
test('lookup uses phone only and never returns patient identity or notes',()=>{
 const {state}=makeDemo(),x=Object.values(state.bookings[core.today()])[0];
 assert.equal(core.lookup(state,'invalid'),null);
 const result=core.lookup(state,x.phone);assert.ok(result);
 for(const key of ['name','nt','phone','lookupCode'])assert.equal(result[key],undefined);
});
test('deleted tickets are not reused',async()=>{
 const f=fixture(),d=core.today(),old=Object.values(f.state().bookings[d]).find(x=>x.b==='dmn'&&x.no===6);
 await f.handle({action:'commit',puts:[],dels:[old]},'demo_doctor');
 await f.handle({action:'commit',puts:[{n:booking('new_ticket'),o:null}],dels:[]},'demo_doctor');
 assert.equal(f.state().bookings[d].new_ticket.no,7);
});
test('server validates dates, schedules, averages and payload sizes',()=>{
 assert.throws(()=>core.booking(booking('invalid/id')));
 assert.throws(()=>core.date('2026-02-30'));
 assert.throws(()=>core.schedule({d:[8],f:'14:00',t:'18:00'}));
 assert.throws(()=>core.patch(makeDemo().state,'demo_doctor',{'settings/avg':181}));
});
test('server rechecks revoked roles on every operation',async()=>{
 const f=fixture();await f.handle({action:'patch',updates:{'roles/demo_dmn':null}},'demo_doctor');
 await assert.rejects(f.handle({action:'get',path:'bookings/'+core.today()},'demo_dmn'),{status:403});
});
test('Supabase tables and privileged RPCs deny direct browser access',()=>{const sql=require('node:fs').readFileSync('supabase/schema.sql','utf8');assert.match(sql,/alter table public.clinic_state enable row level security/);assert.match(sql,/revoke all on public.clinic_state, public.clinic_lookup_limits from public, anon, authenticated/);assert.match(sql,/security invoker/g);assert.doesNotMatch(sql,/security definer/i)});
