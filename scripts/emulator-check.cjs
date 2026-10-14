const fs=require('node:fs'),assert=require('node:assert/strict');
const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if(!host||! /^(127\.0\.0\.1|localhost):\d+$/.test(host))throw new Error('Only a loopback database emulator is allowed.');
const project='demo-clinic';process.env.GCLOUD_PROJECT=project;
const runtimeRequire=require('node:module').createRequire(require('node:path').resolve(__dirname,'../functions/package.json'));
const {initializeApp,deleteApp}=runtimeRequire('firebase-admin/app');
const {getDatabase}=runtimeRequire('firebase-admin/database');
const {firebaseAdapter}=require('../functions/firebase-adapter.cjs');
const {createService}=require('../functions/service.cjs');
const {makeDemo}=require('./demo-data.cjs'),core=require('../functions/core.cjs');
const url='http://'+host;
(async()=>{
 const rules=fs.readFileSync(require('node:path').join(__dirname,'../database.rules.json'),'utf8');
 const ruleResponse=await fetch(url+'/.settings/rules.json?ns='+project,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:rules});
 assert.equal(ruleResponse.status,200);
 const app=initializeApp({projectId:project,databaseURL:'https://'+project+'.firebaseio.com'},'admin-emulator');
 const limited=initializeApp({projectId:project,databaseURL:'https://'+project+'.firebaseio.com',databaseAuthVariableOverride:{uid:'demo_dmn'}},'secretary-emulator');
 const db=getDatabase(app),restricted=getDatabase(limited),data=makeDemo().state;
 await db.ref('/').set(data);
 await assert.rejects(restricted.ref('bookings').get());
 await assert.rejects(restricted.ref('roles/demo_dmn').set({r:'doctor'}));
 assert.ok((await restricted.ref('settings').get()).exists());
 const anonymous=await fetch(url+'/track.json?ns='+project);assert.equal(anonymous.status,401);
 const handler=createService(firebaseAdapter(db,{}));
 const n=(id,phone,b='dmn')=>({id,phone,b,date:core.today(),name:'Emulator test',nt:'',v:'exam',s:'wait'});
 await Promise.all([
  handler({action:'commit',puts:[{n:n('atomic1','01275884716'),o:null}],dels:[]},'demo_dmn'),
  handler({action:'commit',puts:[{n:n('atomic2','01112345678'),o:null}],dels:[]},'demo_dmn')
 ]);
 const rows=(await db.ref('bookings/'+core.today()).get()).val();
 assert.notEqual(rows.atomic1.no,rows.atomic2.no);
 const duplicates=await Promise.allSettled([
  handler({action:'commit',puts:[{n:n('dup1','01512345678'),o:null}],dels:[]},'demo_doctor'),
  handler({action:'commit',puts:[{n:n('dup2','01512345678','alex'),o:null}],dels:[]},'demo_doctor')
 ]);
 assert.equal(duplicates.filter(x=>x.status==='fulfilled').length,1);
 const old=rows.atomic1;
 await handler({action:'commit',puts:[{o:old,n:{...old,s:'done'}}],dels:[]},'demo_dmn');
 await assert.rejects(handler({action:'commit',puts:[{o:old,n:{...old,s:'cx'}}],dels:[]},'demo_dmn'),{status:409});
 for(let i=0;i<20;i++)await handler({action:'lookup',phone:'01275884716'},null,'test-client');
 await assert.rejects(handler({action:'lookup',phone:'01275884716'},null,'test-client'),{status:429});
 await deleteApp(limited);await deleteApp(app);
 console.log('Real RTDB emulator checks passed: rules deny patient/secretary direct access, settings readable, concurrent allocation, duplicate rejection, stale update rejection and distributed lookup rate limit.');
})().catch(e=>{console.error(e);process.exit(1)});
