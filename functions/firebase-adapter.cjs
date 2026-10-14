const {createHash}=require('node:crypto');
function firebaseAdapter(db,auth){
 return {
  read:async()=> (await db.ref('/').get()).val()||{},
  mutate:async fn=>{
   // Transactions may first receive null before the SDK has loaded the root.
   // A provisional empty value causes a server retry; protected logic runs on
   // the actual state. Never call permission checks against a cold SDK cache.
   await db.ref('/').get();
   let applied=false,error=null;
   const result=await db.ref('/').transaction(current=>{
    if(current===null){applied=false;return {};}
    try{const next=fn(current);error=null;applied=true;return next;}
    catch(e){error=e;applied=false;return undefined;}
   },undefined,false);
   if(error)throw error;
   if(!result.committed||!applied){const e=new Error('NOAUTH');e.status=403;throw e;}
  },
  limit:async client=>{
   const window=Math.floor(Date.now()/60000);
   const key=createHash('sha256').update(client+'|'+window).digest('hex');
   let blocked=false;
   await db.ref('_lookupLimits/'+key).transaction(old=>{
    blocked=(old?.count||0)>=20;
    return {count:blocked?old.count:(old?.count||0)+1,expires:Date.now()+120000};
   });
   if(blocked){const e=new Error('طلبات كثيرة. حاول بعد دقيقة.');e.status=429;throw e;}
  },
  createUser:async(u,p)=>(await auth.createUser({email:u+'@clinic.app',password:p})).uid,
  updateUser:(uid,password)=>auth.updateUser(uid,{password}),
  deleteUser:uid=>auth.deleteUser(uid)
 };
}
module.exports={firebaseAdapter};
