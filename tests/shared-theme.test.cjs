const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

for(const runtime of ['Node','Edge'])test(runtime+': retired personal themes cannot be read or saved through older clients',async()=>{
 const {createService}=runtime==='Node'?require('../server/service.cjs'):await import('../supabase/functions/clinic-api/service.js');
 let state={roles:{admin:{r:'admin',u:'admin'},doctor:{r:'doctor',u:'doctor'},nurse:{r:'nurse',u:'nurse'},sec:{r:'sec',u:'sec',br:'alex'},staff:{r:'staff',u:'staff',br:'alex'},disabled:{r:'sec',u:'disabled',enabled:false}},settings:{site:{design:{themePreset:2}}},userPreferences:{doctor:{themePreset:8,customColor:'#ffffff',mode:'dark'}}};
 const before=structuredClone(state),service=createService({read:async()=>structuredClone(state),mutate:async fn=>{state=fn(state)}});
 for(const uid of ['admin','doctor','nurse','sec','staff']){
  assert.deepEqual(await service({action:'preferencesGet'},uid),{themePreset:null,customColor:null,mode:'system'});
  await assert.rejects(service({action:'preferencesSave',preferences:{themePreset:4,customColor:'#123456',mode:'light'}},uid),{status:403});
 }
 for(const uid of [null,'disabled'])await assert.rejects(service({action:'preferencesGet'},uid),{status:403});
 assert.deepEqual(state,before);
});

function theme(){const box={};vm.createContext(box);vm.runInContext(fs.readFileSync('public/clinic-theme.js','utf8').split('function applyAdvancedDesign')[0],box);return box}
test('dark text, secondary labels and control boundaries remain readable with saved low-contrast palettes',()=>{
 const c=theme(),legacy={background:'#151c24',card:'#202b35',text:'#e1e8ed',primary:'#b7c9d4',accent:'#b89ca5',muted:'#adbac5',line:'#50606e',headerBackground:'#202e3a',headerText:'#e1e8ed'},fixtures=[legacy,...Array.from({length:10},(_,i)=>c.clinicPalette(i,'dark')),Object.fromEntries(Object.keys(legacy).map(k=>[k,'#222222'])),Object.fromEntries(Object.keys(legacy).map(k=>[k,'#ffffff']))];
 for(const palette of fixtures){
  const before=structuredClone(palette),v=Object.fromEntries(c.clinicStyleVars(palette,'dark').split(';').map(x=>x.split(':')));
  for(const bg of ['--bg','--card','--soft','--field-bg'])assert.ok(c.clinicRatio(v['--ink'],v[bg])>=7,'body '+bg);
  for(const bg of ['--bg','--card','--field-bg'])assert.ok(c.clinicRatio(v['--mut'],v[bg])>=5.5,'secondary '+bg);
  for(const bg of ['--bg','--card','--field-bg'])assert.ok(c.clinicRatio(v['--line'],v[bg])>=3,'boundary '+bg);
  for(const [fg,bg]of [['--btnink','--btn'],['--secondaryink','--secondary'],['--accent-button-ink','--accent-button'],['--header-ink','--header-bg']])assert.ok(c.clinicRatio(v[fg],v[bg])>=4.5,fg);
  assert.deepEqual(JSON.parse(JSON.stringify(palette)),before);
 }
 const old=Object.fromEntries(c.clinicStyleVars(legacy,'dark').split(';').map(x=>x.split(':')));assert.equal(old['--bg'],c.clinicPalette(0,'dark').background);assert.equal(old['--card'],c.clinicPalette(0,'dark').card);
});
test('dark queue numbers remain readable when an administrator selected identical foreground and background colors',()=>{
 const c=theme();for(const color of ['#111111','#333333','#ffffff','#ffcc00']){
  const input={background:color,currentBackground:color,currentText:color,nextBackground:color,nextText:color,accent:color},before=structuredClone(input),out=c.clinicQueuePalette(input,'dark');
  assert.ok(c.clinicRatio(out.currentText,out.currentBackground)>=7);assert.ok(c.clinicRatio(out.nextText,out.nextBackground)>=7);assert.ok(c.clinicLuminance(out.currentBackground)<.16);assert.deepEqual(input,before);assert.equal(c.clinicQueuePalette(input,'light'),input);
 }
});
