const {onRequest}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {initializeApp}=require('firebase-admin/app');
const {getDatabase}=require('firebase-admin/database');
const {getAuth}=require('firebase-admin/auth');
const {firebaseAdapter}=require('./firebase-adapter.cjs');
const {createService}=require('./service.cjs');
initializeApp();
const db=getDatabase();
const handle=createService(firebaseAdapter(db,getAuth()));
exports.cleanLookupLimits=onSchedule({schedule:"every 60 minutes",region:"europe-west1"},async()=>{
 const snapshot=await db.ref('_lookupLimits').get(),updates={};
 snapshot.forEach(child=>{if(child.val().expires<Date.now())updates[child.key]=null;});
 if(Object.keys(updates).length)await db.ref('_lookupLimits').update(updates);
});
exports.clinicApi=onRequest({region:'europe-west1',cors:false,maxInstances:10,timeoutSeconds:30},async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 if(!req.is('application/json'))return res.status(415).json({error:'JSON required'});
 if(Buffer.byteLength(JSON.stringify(req.body||{}))>900000)return res.status(413).json({error:'Payload too large'});
 try{
  let uid=null;
  if(!['lookup'].includes(req.body.action)&&!(req.body.action==='get'&&req.body.path==='settings')){
   const token=(req.get('authorization')||'').match(/^Bearer (.+)$/)?.[1];
   if(!token)return res.status(401).json({error:'NOAUTH'});
   try{uid=(await getAuth().verifyIdToken(token,true)).uid;}catch{return res.status(401).json({error:'NOAUTH'});}
  }
  const result=await handle(req.body,uid,req.ip);
  return res.json({data:result});
 }catch(e){return res.status(e.status||500).json({error:e.status?e.message:'تعذر تنفيذ العملية'});}
});
