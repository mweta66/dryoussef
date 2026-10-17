// Local demo only. Never connects to or changes Supabase.
const fs=require('node:fs'),path=require('node:path'),{replaceBranches}=require('../server/replace-branches.cjs');
const args=process.argv.slice(2).join(' '),seed=args==='--local --apply --cases-per-branch=100';
if(args!=='--local --apply'&&!seed)throw Error('Explicit local reset required: node scripts/replace-local-branches.cjs --local --apply');
const root=path.resolve(__dirname,'..'),file=path.join(root,'.demo/state.json');
const original=JSON.parse(fs.readFileSync(file,'utf8'));
const admin=Object.keys(original.roles||{}).find(uid=>original.roles[uid].r==='admin'&&original.roles[uid].enabled!==false);
if(!admin)throw Error('No active local administrator');
let next=replaceBranches(original,admin);
if(seed)next=require('../server/branch-demo-data.cjs').addBranchDemo(next,admin);
const backupDir=path.join(root,'.private');fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
const backup=path.join(backupDir,'before-branch-replacement-'+Date.now()+'.json');
fs.writeFileSync(backup,JSON.stringify(original),{flag:'wx',mode:0o600});
if(fs.readFileSync(backup,'utf8')!==JSON.stringify(original))throw Error('Backup verification failed');
const temp=file+'.replacement.tmp';fs.writeFileSync(temp,JSON.stringify(next),{flag:'wx',mode:0o600});fs.renameSync(temp,file);
const accounts=JSON.parse(fs.readFileSync(path.join(root,'.demo/accounts.json'),'utf8'));
const phones=Object.values(next.bookings[require('../server/core.cjs').today()]||{}).filter(x=>x.s==='wait').slice(0,8).map(x=>x.phone);
fs.writeFileSync(path.join(root,'.demo/guide.txt'),'LOCAL DEMO ONLY\n'+accounts.map(a=>a.u+' / '+(a.password||'unchanged')).join('\n')+'\n\nToday tracking examples:\n'+phones.join('\n')+'\n',{mode:0o600});
console.log('Local branch replacement complete; four branches; '+(seed?'100 synthetic cases each':'empty clinical data')+'; accounts retained; verified backup in .private.');
