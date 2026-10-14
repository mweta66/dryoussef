// Local files only; preserve existing accounts and bookings.
const fs=require('node:fs'),path=require('node:path'),{randomBytes,scryptSync}=require('node:crypto');
const core=require('../functions/core.cjs'),cases=require('../functions/cases.cjs');
const dir=path.resolve(__dirname,'../.demo'),file=path.join(dir,'state.json'),accountFile=path.join(dir,'accounts.json');
const state=JSON.parse(fs.readFileSync(file)),accounts=JSON.parse(fs.readFileSync(accountFile));
if(!accounts.some(a=>state.roles[a.uid]?.r==='nurse')){
 const uid='demo_nurse',u='nurse',password=randomBytes(12).toString('base64url'),salt=randomBytes(16).toString('hex');
 accounts.push({uid,u,password,salt,hash:scryptSync(password,salt,32).toString('hex')});state.roles[uid]={u,r:'nurse'};
}
const baseline=core.today();let workdays=0,serial=1000;
for(let offset=-12;workdays<20;offset++){
 const dt=new Date(baseline+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+offset);const day=dt.getUTCDay(),d=dt.toISOString().slice(0,10);
 const branches=['dmn','alex'].filter(b=>state.settings.sched[b].d.includes(day));if(!branches.length)continue;workdays++;
 for(const b of branches){
  const rows=state.bookings[d]||={};const total=15+(workdays%11);
  for(let n=0;n<total;n++){
   serial++;const id='demo-extended-'+serial;if(rows[id])continue;
   const ph='010000'+String(serial).padStart(5,'0');
   if(Object.values(rows).some(x=>x.phone===ph))continue;
   const no=Math.max(state.sequences[d+'_'+b]||0,0,...Object.values(rows).filter(x=>x.b===b).map(x=>x.no))+1;
   rows[id]={id,no,date:d,b,name:'مريضة تجريبية '+serial,phone:ph,v:n%2?'exam':'cons',s:d<baseline?['done','no','cx'][n%3]:['wait','exam','done','no','cx'][n%5],nt:'بيانات تجريبية فقط',rev:1};state.sequences[d+'_'+b]=no;
  }
 }
}
cases.indexPatients(state);state.files||={};state.complaints||={};state.inbox||={};
const samples=Object.keys(state.patients).filter(p=>/^010000\d{5}$/.test(p)).slice(0,12);
for(const [i,p] of samples.entries()){
 state.files[p]||={n:'ملاحظات دكتور تجريبية: متابعة التحاليل والسونار في الزيارة القادمة.',t:new Date().toISOString()};
 const id='demo-complaint-'+i;
 state.complaints[p]||={};state.complaints[p][id]||={id,date:baseline,text:'شكوى تجريبية لمراجعة الطبيب',tx:'علاج تجريبي مسجل للاختبار فقط',by:'nurse',at:new Date().toISOString()};
 if(i<3)state.inbox[id]||={p,n:state.patients[p].n,by:'nurse',at:state.complaints[p][id].at,d:baseline};
}
core.rebuild(state);
fs.writeFileSync(file,JSON.stringify(state,null,2));fs.writeFileSync(accountFile,JSON.stringify(accounts,null,2));
const todayRows=Object.values(state.bookings[baseline]||{}).filter(x=>x.s==='wait');
fs.writeFileSync(path.join(dir,'guide.txt'),'LOCAL DEMO ONLY\n'+accounts.map(a=>a.u+' / '+(a.password||'unchanged')).join('\n')+'\n\nToday tracking examples:\n'+todayRows.slice(0,6).map(x=>x.phone).join('\n')+'\n');
console.log('Local demo upgraded: '+Object.values(state.bookings).flatMap(Object.values).length+' bookings, nurse account, files, complaints and notifications. Existing data preserved.');
