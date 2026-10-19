import {AsyncLocalStorage} from 'node:async_hooks';
const requestContext=new AsyncLocalStorage();
export function withRequestContext(id,fn){return requestContext.run(id,fn)}
import {createHash} from 'node:crypto';
export function supabaseAdapter(url,secret,fetcher=fetch){
 if(!url||!secret)throw Error('Supabase server configuration is missing');
 const base=url.replace(/\/$/,'');
 async function call(path,options={},token=secret){
  const safeRead=!options.method||options.method==='GET'||['clinic_session_active','clinic_read_slice','clinic_read_day','clinic_patient_history','clinic_health_metadata'].some(name=>path==='/rest/v1/rpc/'+name);
  let response;
  for(let attempt=0;attempt<(safeRead?2:1);attempt++){
   try{response=await fetcher(base+path,{...options,signal:AbortSignal.timeout(safeRead?4500:10000),headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}})}catch(e){if(safeRead&&attempt<1){await new Promise(r=>setTimeout(r,250));continue}console.error('Clinic upstream transport failure',{requestId:requestContext.getStore(),operation:path.replace(/\/[0-9a-f-]{36}/gi,'/:id'),attempt:attempt+1,kind:e?.name==='TimeoutError'?'timeout':'network'});const err=new Error('انقطع الاتصال مؤقتًا. حاول مجددًا بعد لحظة.');err.status=503;throw err}
   if(!safeRead||![429,502,503,504].includes(response.status)||attempt===1)break;
   await response.body?.cancel();await new Promise(r=>setTimeout(r,350*(attempt+1)));
  }
  if(response.status===404&&options.method==='DELETE'&&path.startsWith('/auth/v1/admin/users/'))return {deleted:true};
  const data=await response.json().catch(()=>null);if(response.ok&&data===null){const err=new Error('استجابة غير مكتملة من خدمة البيانات. حاول بعد لحظة.');err.status=503;throw err}if(!response.ok){
   console.error('Clinic upstream rejected request',{requestId:requestContext.getStore(),operation:path.replace(/\/[0-9a-f-]{36}/gi,'/:id'),status:response.status,code:data?.code||data?.error_code||'unknown'});
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
  readAttachmentBytes:async(id,mime)=>{const maximum=mime==='application/pdf'?5000000:600000;let response;try{response=await fetcher(base+'/storage/v1/object/authenticated/clinic-patient-reports/'+encodeURIComponent(id),{headers:{apikey:secret,Authorization:'Bearer '+secret},signal:AbortSignal.timeout(15000)})}catch{const e=Error('تعذر تنزيل الصورة؛ لم تكتمل النسخة الاحتياطية');e.status=503;throw e}if(!response.ok||Number(response.headers.get('content-length')||0)>maximum){await response.body?.cancel();const e=Error('تعذر تنزيل الصورة للنسخة الاحتياطية');e.status=503;throw e}const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>maximum){const e=Error('صورة أكبر من الحد المسموح');e.status=413;throw e}let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {data:btoa(binary),mime}},
  uploadAttachment:async(id,bytes,mime)=>call('/storage/v1/object/clinic-patient-reports/'+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':mime,'x-upsert':'false'},body:bytes}),
  readAttachment:async id=>{const data=await call('/storage/v1/object/sign/clinic-patient-reports/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({expiresIn:60})});const signed=data?.signedURL;if(typeof signed!=='string'||!signed.startsWith('/object/sign/clinic-patient-reports/')){const e=Error('تعذر تجهيز رابط التقرير');e.status=503;throw e}return {url:base+'/storage/v1'+signed}},
  deleteAttachment:async id=>call('/storage/v1/object/clinic-patient-reports',{method:'DELETE',body:JSON.stringify({prefixes:[id]})}),
  read:async()=> (await snapshot()).payload,
  readFields:async(fields,day=null,entity=null)=>rpc('clinic_read_slice',{fields,selected_day:day,entity}),
  readHistory:async p=>rpc('clinic_patient_history',{patient_phone:p}),
  readDay:async day=>rpc('clinic_read_day',{selected_day:day}),
  readLookup:async(p,day)=>rpc('clinic_read_day',{selected_day:day,patient_phone:p}),
  systemHealth:async()=>{const health=await rpc('clinic_health_metadata',{});try{health.backupCheck=await rpc('clinic_backup_check_status',{})}catch{}return health},
  latestBackup:async()=>{const rows=await call('/rest/v1/clinic_backups?select=created_at,version,payload,checksum&order=created_at.desc&limit=1');return rows?.[0]||null},
  recordError:async x=>call('/rest/v1/clinic_diagnostics',{method:'POST',body:JSON.stringify(x)}),
  mutate:async fn=>{for(let attempt=0;attempt<8;attempt++){const current=await snapshot(),next=fn(structuredClone(current.payload));if(await rpc('clinic_compare_and_swap',{expected_version:current.version,next_payload:next}))return;await new Promise(r=>setTimeout(r,20*(attempt+1)))}const e=new Error('تحديث متزامن. أعد المحاولة.');e.status=409;throw e},
  limit:async(client,p='')=>{const minute=Math.floor(Date.now()/60000),hash=x=>createHash('sha256').update(x).digest('hex');if(!await rpc('clinic_lookup_budget',{ip_key:hash('ip|'+client+'|'+minute),patient_key:hash('patient|'+client+'|'+p+'|'+minute)})){const e=new Error('طلبات كثيرة. حاول بعد دقيقة.');e.status=429;throw e}},
  createUser:async(u,p)=>{const data=await call('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:u+'@clinic.app',password:p,email_confirm:true})});return data.id},
  deleteUser:async uid=>{await rpc('clinic_revoke_sessions',{user_uuid:uid});await call('/auth/v1/admin/users/'+encodeURIComponent(uid),{method:'DELETE'})},
  updateUser:async(uid,password)=>{await call('/auth/v1/admin/users/'+encodeURIComponent(uid),{method:'PUT',body:JSON.stringify({password})})},
  updateCredentials:async(uid,{username,password})=>{await call('/auth/v1/admin/users/'+encodeURIComponent(uid),{method:'PUT',body:JSON.stringify({email:username+'@clinic.app',email_confirm:true,...(password?{password}:{})})})},
  revokeUserSessions:async uid=>{await rpc('clinic_revoke_sessions',{user_uuid:uid})},
  verify:async token=>{
   const user=await call('/auth/v1/user',{method:'GET'},token);
   let session;try{session=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id}catch{}
   if(!user?.id||!session||!await rpc('clinic_session_active',{session_uuid:session,user_uuid:user.id})){const e=new Error('NOAUTH');e.status=401;throw e}return user.id;
  }
 };
}
