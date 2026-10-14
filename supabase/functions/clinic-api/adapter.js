import {createHash} from 'node:crypto';
export function supabaseAdapter(url,secret,fetcher=fetch){
 if(!url||!secret)throw Error('Supabase server configuration is missing');
 const base=url.replace(/\/$/,'');
 async function call(path,options={},token=secret){
  const safeRead=!options.method||options.method==='GET'||path==='/rest/v1/rpc/clinic_session_active';
  let response;
  for(let attempt=0;attempt<(safeRead?3:1);attempt++){
   try{response=await fetcher(base+path,{...options,signal:AbortSignal.timeout(10000),headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}})}catch(e){if(safeRead&&attempt<2){await new Promise(r=>setTimeout(r,250*(attempt+1)));continue}const err=new Error('انقطع الاتصال مؤقتًا. حاول مجددًا بعد لحظة.');err.status=503;throw err}
   if(!safeRead||![429,502,503,504].includes(response.status)||attempt===2)break;
   await response.body?.cancel();await new Promise(r=>setTimeout(r,350*(attempt+1)));
  }
  const data=await response.json().catch(()=>null);if(!response.ok){
   console.error('Clinic upstream rejected request',{operation:path.replace(/\/[0-9a-f-]{36}/gi,'/:id'),status:response.status,code:data?.code||data?.error_code||'unknown'});
   let status=503,message='تعذر الوصول إلى خدمة البيانات مؤقتًا. حاول بعد لحظة.';
   if(path==='/auth/v1/user'&&[400,401,403].includes(response.status)){status=401;message='انتهت جلسة الدخول. سجّل الدخول مجددًا.'}
   else if(response.status===429){status=429;message='طلبات كثيرة إلى الخدمة. انتظر قليلًا ثم أعد المحاولة.'}
   else if([400,409,422].includes(response.status)&&path.startsWith('/auth/v1/admin/users')){status=400;const code=data?.code||data?.error_code;message=code==='email_exists'||code==='user_already_exists'?'اسم الدخول مستخدم بالفعل. اختر اسمًا آخر.':code==='same_password'?'اختر كلمة سر مختلفة عن الحالية.':code==='weak_password'?'كلمة السر لا تستوفي متطلبات الأمان. اختر كلمة أطول وأكثر تنوعًا.':'رفضت الخدمة بيانات الحساب أو كلمة السر. راجع المدخلات وحاول مجددًا.'}
   const e=new Error(message);e.status=status;throw e;
  }return data;
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
