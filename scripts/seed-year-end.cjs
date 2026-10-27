// Local-only operation. Production is seeded through the authenticated admin action.
const fs=require('node:fs'),path=require('node:path'),{createService}=require('../server/service.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),file=path.join(root,'.demo/state.json'),original=JSON.parse(fs.readFileSync(file,'utf8')),uid=Object.keys(original.roles||{}).find(id=>original.roles[id].r==='admin'&&original.roles[id].enabled!==false);if(!uid)throw Error('No enabled local administrator');
 const folder=path.join(root,'.private');fs.mkdirSync(folder,{recursive:true,mode:0o700});const copy=path.join(folder,'before-year-end-training-'+Date.now()+'.json');fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);fs.chmodSync(copy,0o600);
 let state=structuredClone(original);const handle=createService({read:async()=>structuredClone(state),mutate:async fn=>{state=fn(state)}});
 const result=await handle({action:'trainingYearSeed',confirmation:'SEED_YEAR_END_TRAINING'},uid);const temp=file+'.year-end.tmp';fs.writeFileSync(temp,JSON.stringify(state),{mode:0o600,flag:'wx'});JSON.parse(fs.readFileSync(temp,'utf8'));fs.renameSync(temp,file);console.log(JSON.stringify({localOnly:true,...result}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
