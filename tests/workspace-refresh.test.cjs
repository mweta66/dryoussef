const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
test('switching tabs during a slow consolidated read fetches the selected tab before drawing its records',async()=>{
 const src=fs.readFileSync('public/clinic-enhancements.js','utf8').split('\n').find(s=>s.startsWith('refreshWorkspaceData=async'));let finish;const calls=[];
 const role={r:'sec',u:'secretary',br:'dmn',permissions:{}},response={role,settings:{},bookings:{},sessions:{},inbox:{}},c=vm.createContext({me:{role:'sec',br:'dmn'},tab:'dash',dataEpoch:0,SD:'2026-10-15',allBranches:()=>false,gateway:async(action,args)=>{calls.push(args.tab);if(calls.length===1)return new Promise(r=>finish=r);return {...response,patients:{'01599999999':{n:'Test'}}}},applyWorkspaceSettings:()=>{},applyInbox:()=>{},S:{},U:{},Date,Object,F:{d:'2026-10-15'}});
 vm.runInContext(src,c);const pending=c.refreshWorkspaceData();c.tab='cases';finish(response);await pending;assert.deepEqual(calls,['dash','cases']);assert.equal(Object.keys(c.PT).length,1);
});
