const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
test('demo removal button stays hidden when the persisted dismissal is loaded',()=>{
 const source=fs.readFileSync('public/clinic-management.js','utf8').split('\n').find(x=>x.startsWith('settings=function'));
 const c=vm.createContext({me:{role:"admin"},can:()=>true,S:{avg:15},DEMO_PURGED:false});vm.runInContext(source,c);
 assert.ok(c.settings().includes('onclick="purgeDemo()"'));c.DEMO_PURGED=true;
 assert.ok(!c.settings().includes('onclick="purgeDemo()"'));assert.ok(c.settings().includes('onclick="clearClinicData()"'));
});
