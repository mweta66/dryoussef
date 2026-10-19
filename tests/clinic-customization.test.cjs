const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {replaceBranches}=require('../server/replace-branches.cjs');
test('branch replacement clears old clinical data and schedules, preserves accounts and branding, and requires admin',()=>{
 const state={roles:{a:{r:'admin',u:'admin'},s:{r:'sec',u:'secretary',br:'dmn'}},settings:{site:{design:{themePreset:2},branches:{dmn:{name:'old'}}},sched:{dmn:{d:[1],f:'09:00',t:'12:00'}}},bookings:{old:{x:{b:'alex'}}},patients:{old:{}},files:{old:{}},complaints:{old:{}},inbox:{old:{}},deletedBookings:{old:{}},sessions:{old:{}},sequences:{old:10},audit:[{action:'old'}]};
 assert.throws(()=>replaceBranches(state,'s'),{status:403});const result=replaceBranches(state,'a');
 assert.deepEqual(Object.keys(result.settings.branches),['alex','matrouh','dmn','libya']);
 for(const field of ['bookings','patients','files','complaints','inbox','deletedBookings','sessions','sequences'])assert.deepEqual(result[field],{});
 assert.deepEqual(result.roles,state.roles);assert.equal(result.settings.site.design.themePreset,2);
 for(const [b,branch]of Object.entries(result.settings.branches)){assert.equal(branch.address,'');assert.equal(branch.phone,'');assert.equal(result.settings.sched[b].mode,'flexible');}
 assert.ok(state.bookings.old);const expanded=structuredClone(state);expanded.settings.branches={other:{}};assert.throws(()=>replaceBranches(expanded,'a'),{status:409});
});
test('header controls are validated and round-trip through saved site data',()=>{
 const management=require('../server/management.cjs'),core=require('../server/core.cjs');
 const design={headerAlign:'center',headerTitleSize:42,headerSubtitleSize:22,headerTextSize:20,headerPadding:0,headerGap:24};
 assert.deepEqual(management.site({design},core.fail).design,design);
 for(const invalid of [{headerTitleSize:200},{headerPadding:-1},{headerGap:1.5},{headerAlign:'invalid'}])assert.throws(()=>management.site({design:invalid},core.fail));
});
test('stored personal themes no longer override the shared clinic design',()=>{
 const values=new Map(),box={me:{role:'doctor',u:'doctor'},AUTH:{uid:'doctor-id'},localStorage:{getItem:k=>values.get(k)??null},window:{},console};
 vm.createContext(box);vm.runInContext(fs.readFileSync('public/clinic-theme.js','utf8'),box);
 const shared={themePreset:0,headerHeight:220,palettes:{light:{headerBackground:'#123456',headerText:'#ffffff'}}};
 values.set('clinic_staff_theme_doctor-id','4');let personal=box.personalClinicDesign(shared);
 assert.equal(personal,shared);assert.equal(personal.themePreset,0);assert.equal(personal.headerHeight,220);assert.equal(personal.palettes.light.headerBackground,'#123456');assert.equal(shared.themePreset,0);
 box.me={role:'sec',u:'secretary'};box.AUTH={uid:'sec-id'};assert.equal(box.personalClinicDesign(shared),shared);
 box.me.role='admin';box.AUTH.uid='doctor-id';assert.equal(box.personalClinicDesign(shared),shared);
});
test('four-branch sample has exactly 100 distinct patients and valid bookings per branch with consistent tracking',()=>{
 const {addBranchDemo}=require('../server/branch-demo-data.cjs'),core=require('../server/core.cjs');
 const clean=replaceBranches({roles:{a:{r:'admin',u:'admin'},s:{r:'sec',u:'secretary',br:'dmn'}},settings:{},bookings:{}},'a');
 const s=addBranchDemo(clean,'a'),rows=Object.values(s.bookings).flatMap(Object.values);
 assert.equal(rows.length,400);assert.equal(Object.keys(s.patients).length,400);assert.equal(Object.keys(s.files).length,400);assert.equal(new Set(rows.map(x=>x.phone)).size,400);
 for(const b of ['alex','matrouh','dmn','libya'])assert.equal(rows.filter(x=>x.b===b).length,100);
 for(const x of rows){assert.match(x.phone,/^010000\d{5}$/);assert.equal(core.booking(x,s).b,x.b);assert.ok(s.track[x.date][x.phone]);assert.equal(s.patients[x.phone].n,x.name);assert.ok(s.files[x.phone]);assert.ok(s.complaints[x.phone]);}
 assert.equal(rows.filter(x=>x.s==='exam').length,0);assert.deepEqual(s.roles,clean.roles);assert.throws(()=>addBranchDemo(s,'a'),{status:409});assert.throws(()=>addBranchDemo(clean,'s'),{status:403});
});
test('booking suggestions follow weekdays, multiple intervals, exceptions and closures, excluding inactive branches',()=>{
 const box={clinicBookingSuggestions:require('../public/clinic-schedule.js').availability};
 const registry={alex:{enabled:true},dmn:{enabled:true},libya:{enabled:true},matrouh:{enabled:false}},date='2026-10-18';
 const schedules={alex:{mode:'weekly',weekly:{0:[{f:'09:00',t:'12:00'},{f:'17:00',t:'20:00'}]},exceptions:{[date]:[]}},dmn:{d:[0],f:'10:00',t:'13:00'},libya:{mode:'flexible'},matrouh:{mode:'weekly',weekly:{0:[{f:'09:00',t:'12:00'}]}}};
 let result=box.clinicBookingSuggestions(registry,schedules,date);assert.equal(result.scheduled.length,1);assert.equal(result.scheduled[0].id,'dmn');assert.equal(result.flexible.join(','),'libya');
 delete schedules.alex.exceptions[date];result=box.clinicBookingSuggestions(registry,schedules,date);assert.equal(result.scheduled.length,2);assert.equal(result.scheduled[0].slots.length,2);
 schedules.libya.exceptions={[date]:[{f:'14:00',t:'15:00'}]};result=box.clinicBookingSuggestions(registry,schedules,date);assert.equal(result.scheduled.length,3);assert.equal(result.flexible.length,0);
 assert.equal(box.clinicBookingSuggestions(registry,schedules,'2026-02-30').scheduled.length,0);
});
