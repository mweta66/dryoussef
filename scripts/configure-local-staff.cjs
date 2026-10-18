// Explicit local maintenance only. No production connections or password output.
const fs=require('node:fs'),path=require('node:path'),{randomBytes,scryptSync}=require('node:crypto'),{createService}=require('../server/service.cjs');
async function main(){
 if(process.argv.slice(2).join(' ')!=='--apply')throw Error('Usage: CLINIC_STAFF_PASSWORD=... node scripts/configure-local-staff.cjs --apply');
 const password=process.env.CLINIC_STAFF_PASSWORD;if(!password||password.length<6||password.length>128)throw Error('Set CLINIC_STAFF_PASSWORD to the requested secretary password');
 const root=path.resolve(__dirname,'..'),stateFile=path.join(root,'.demo/state.json'),accountFile=path.join(root,'.demo/accounts.json');
 let state=JSON.parse(fs.readFileSync(stateFile)),accounts=JSON.parse(fs.readFileSync(accountFile));
 const admin=Object.keys(state.roles||{}).find(id=>state.roles[id].r==='admin'&&state.roles[id].enabled!==false);if(!admin)throw Error('Active local administrator required');
 const backupDir=path.join(root,'.private');fs.mkdirSync(backupDir,{recursive:true,mode:0o700});const backup=path.join(backupDir,'before-staff-access-'+Date.now()+'.json');
 const snapshot=JSON.stringify({state,accounts});fs.writeFileSync(backup,snapshot,{flag:'wx',mode:0o600});if(fs.readFileSync(backup,'utf8')!==snapshot)throw Error('Backup verification failed');
 function setPassword(account,value){account.salt=randomBytes(16).toString('hex');account.hash=scryptSync(value,account.salt,32).toString('hex');delete account.password;}
 const handle=createService({read:async()=>structuredClone(state),mutate:async fn=>{state=fn(state)},createUser:async(u,p)=>{if(accounts.some(a=>a.u===u))throw Error('Login already exists');const account={uid:'local_'+randomBytes(12).toString('hex'),u};setPassword(account,p);accounts.push(account);return account.uid},deleteUser:async uid=>{accounts=accounts.filter(a=>a.uid!==uid)},updateCredentials:async(uid,{username})=>{const account=accounts.find(a=>a.uid===uid);if(!account)throw Error('Account missing');if(accounts.some(a=>a.uid!==uid&&a.u===username))throw Error('Login already exists');account.u=username},updateUser:async(uid,p)=>{const account=accounts.find(a=>a.uid===uid);if(!account)throw Error('Account missing');setPassword(account,p)},revokeUserSessions:async()=>{}});
 const preview=await handle({action:'staffAccessPreview'},admin),result=await handle({action:'staffAccessApply',previewToken:preview.previewToken,password},admin);
 if(!result.ok)throw Error('Local setup aborted; original files retained. '+JSON.stringify(result.results));
 const dataAccounts=Object.fromEntries([['dmn','dmn-sec'],['libya','libya-sec']].map(([branch,u])=>[branch,Object.keys(state.roles).find(id=>state.roles[id].u===u)]));
 const trainingPreview=await handle({action:'organizeTrainingPreview',accounts:dataAccounts},admin),training=await handle({action:'organizeTrainingApply',accounts:dataAccounts,previewToken:trainingPreview.previewToken},admin);
 if(!training.ok)throw Error('Local organization aborted; original files retained');
 const serial=Date.now();for(const [file,value]of [[accountFile,accounts],[stateFile,state]]){const temp=file+'.'+serial+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});fs.renameSync(temp,file);}
 console.log(JSON.stringify({localOnly:true,accounts:result.results.map(x=>({username:x.username,ok:x.ok})),verifiedBackup:true,trainingCounts:training.counts}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
