import {createHash} from 'node:crypto';
export function supabaseAdapter(url,secret,fetcher=fetch){
 if(!url||!secret)throw Error('Supabase server configuration is missing');
 const base=url.replace(/\/$/,'');
 async function call(path,options={},token=secret){
  const response=await fetcher(base+path,{...options,headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}});
  const data=await response.json().catch(()=>null);if(!response.ok){const e=new Error('تعذر الاتصال بخدمة البيانات');e.status=response.status===401||(path==='/auth/v1/user'&&response.status===403)?401:500;throw e}return data;
 }
 const rpc=(name,body)=>call('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body)});
 const snapshot=async()=>{const data=await call('/rest/v1/clinic_state?id=eq.true&select=version,payload');if(!data?.[0])throw Error('Clinic schema is not initialized');return data[0]};
 return {
  read:async()=> (await snapshot()).payload,
  mutate:async fn=>{for(let attempt=0;attempt<8;attempt++){const current=await snapshot(),next=fn(structuredClone(current.payload));if(await rpc('clinic_compare_and_swap',{expected_version:current.version,next_payload:next}))return;await new Promise(r=>setTimeout(r,20*(attempt+1)))}const e=new Error('تحديث متزامن. أعد المحاولة.');e.status=409;throw e},
  limit:async client=>{const key=createHash('sha256').update(client+'|'+Math.floor(Date.now()/60000)).digest('hex');if(!await rpc('clinic_lookup_slot',{rate_key:key})){const e=new Error('طلبات كثيرة. حاول بعد دقيقة.');e.status=429;throw e}},
  createUser:async(u,p)=>{const data=await call('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:u+'@clinic.app',password:p,email_confirm:true})});return data.id},
  deleteUser:async uid=>{await rpc('clinic_revoke_sessions',{user_uuid:uid});await call('/auth/v1/admin/users/'+encodeURIComponent(uid),{method:'DELETE'})},
  updateUser:async(uid,password)=>{await call('/auth/v1/admin/users/'+encodeURIComponent(uid),{method:'PUT',body:JSON.stringify({password})});await rpc('clinic_revoke_sessions',{user_uuid:uid})},
  verify:async token=>{
   const user=await call('/auth/v1/user',{method:'GET'},token);
   let session;try{session=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id}catch{}
   if(!user?.id||!session||!await rpc('clinic_session_active',{session_uuid:session,user_uuid:user.id})){const e=new Error('NOAUTH');e.status=401;throw e}return user.id;
  }
 };
}
