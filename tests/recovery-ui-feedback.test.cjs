const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

test('the current-state recovery rehearsal shows its result in its own panel and preserves the automatic-backup result',async()=>{
 const panels={'recovery-status':{textContent:''},'backup-rehearsal-status':{textContent:'Previous automatic backup result'}},calls=[];
 const context={me:{role:'admin'},window:{},document:{getElementById:id=>panels[id]},notify:()=>{},gateway:async(action,input)=>{calls.push({action,input});return {at:'2026-11-03T12:00:00Z',counts:{reports:2},warning:'Provider accounts require separate recovery.',imagesVerified:true}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('public/clinic-backup.js','utf8'),context);
 await context.runCurrentRecoveryRehearsal();
 assert.equal(calls.length,1);assert.equal(calls[0].action,'backupRehearsal');assert.equal(calls[0].input.source,'current');
 assert.match(panels['recovery-status'].textContent,/2 أصل تقرير/);
 assert.equal(panels['backup-rehearsal-status'].textContent,'Previous automatic backup result');
 assert.equal(context.window.ClinicLastRecoveryCheck.imagesVerified,true);
});
