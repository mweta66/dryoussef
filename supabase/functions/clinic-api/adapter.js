import {AsyncLocalStorage} from 'node:async_hooks';
const requestContext=new AsyncLocalStorage();
export function withRequestContext(id,fn){return requestContext.run(id,fn)}
import {createHash} from 'node:crypto';
export function supabaseAdapter(url,secret,fetcher=fetch){
 if(!url||!secret)throw Error('Supabase server configuration is missing');
 const base=url.replace(/\/$/,'');
 async function call(path,options={},token=secret){
  const safeRead=!options.method||options.method==='GET'||['clinic_session_active','clinic_read_slice','clinic_read_day','clinic_patient_history','clinic_health_metadata','clinic_operational_snapshot','clinic_mutation_receipt','clinic_patient_search_page','clinic_patient_history_page','clinic_operational_capabilities'].some(name=>path==='/rest/v1/rpc/'+name);
  let response;
  for(let attempt=0;attempt<(safeRead?2:1);attempt++){
   try{response=await fetcher(base+path,{...options,signal:AbortSignal.timeout(safeRead?4500:10000),headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}})}catch(e){if(safeRead&&attempt<1){await new Promise(r=>setTimeout(r,250));continue}console.error('Clinic upstream transport failure',{requestId:requestContext.getStore(),operation:path.replace(/\/[0-9a-f-]{36}/gi,'/:id'),attempt:attempt+1,kind:e?.name==='TimeoutError'?'timeout':'network'});const err=new Error('انقطع الاتصال مؤقتًا. حاول مجددًا بعد لحظة.');err.status=503;throw err}
   if(!safeRead||![429,502,503,504].includes(response.status)||attempt===1)break;
   await response.body?.cancel();await new Promise(r=>setTimeout(r,350*(attempt+1)));
  }
  if(response.status===404&&options.method==='DELETE'&&path.startsWith('/auth/v1/admin/users/'))return {deleted:true};
  let decoded=true;const data=await response.json().catch(()=>{decoded=false;return null});const nullable=path==='/rest/v1/rpc/clinic_mutation_receipt';if(response.ok&&(!decoded||data===null&&!nullable)){const err=new Error('استجابة غير مكتملة من خدمة البيانات. حاول بعد لحظة.');err.status=503;throw err}if(!response.ok){
   console.error('Clinic upstream rejected request',{requestId:requestContext.getStore(),operation:path.replace(/\/[0-9a-f-]{36}/gi,'/:id'),status:response.status,code:data?.code||data?.error_code||'unknown'});
   let status=503,message='تعذر الوصول إلى خدمة البيانات مؤقتًا. حاول بعد لحظة.';
   if(path==='/auth/v1/user'&&[400,401,403].includes(response.status)){status=401;message='انتهت جلسة الدخول. سجّل الدخول مجددًا.'}
   else if(response.status===429){status=429;message='طلبات كثيرة إلى الخدمة. انتظر قليلًا ثم أعد المحاولة.'}
   else if(path.startsWith('/rest/v1/rpc/')&&data?.code==='42501'){status=403;message='ليس لديك صلاحية لهذه البيانات أو لهذا الفرع.'}
   else if(path.startsWith('/rest/v1/rpc/')&&['22023','22004'].includes(data?.code)){status=400;message='راجع مدخلات الطلب وحدود الصفحة.'}
   else if(path.startsWith('/rest/v1/rpc/')&&data?.code==='P0002'){status=404;message='السجل المطلوب غير موجود.'}
   else if(path.startsWith('/rest/v1/rpc/')&&data?.code==='23505'){status=409;message='تعارض مع عملية محفوظة؛ حدّث البيانات قبل إعادة المحاولة.'}
   else if([400,409,422].includes(response.status)&&path.startsWith('/auth/v1/admin/users')){status=400;const code=data?.code||data?.error_code;message=code==='email_exists'||code==='user_already_exists'?'اسم الدخول مستخدم بالفعل. اختر اسمًا آخر.':code==='same_password'?'اختر كلمة سر مختلفة عن الحالية.':code==='weak_password'?'كلمة السر لا تستوفي متطلبات الأمان. اختر كلمة أطول وأكثر تنوعًا.':'رفضت الخدمة بيانات الحساب أو كلمة السر. راجع المدخلات وحاول مجددًا.'}
   const e=new Error(message);e.status=status;e.upstreamStatus=response.status;e.upstreamCode=data?.code||data?.error_code||null;throw e;
  }return data;
 }
 const rpc=(name,body)=>call('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body)});
 const snapshot=async()=>{const data=await call('/rest/v1/clinic_state?id=eq.true&select=version,payload');if(!data?.[0])throw Error('Clinic schema is not initialized');return data[0]};
 const archiveRoots=new Set(['audit','activityDetails','activityContext','recycleBin','clinicalVisits']);
 let operationalSupported=true,operationalVerified=false;
 const missingRPC=e=>e?.upstreamStatus===404&&e?.upstreamCode==='PGRST202';
 const probeOperationalCapabilities=async()=>{try{const value=await rpc('clinic_operational_capabilities',{});if(!value||value.verified!==true||value.deltaWrites!==true||value.receipts!==true)throw Error('Invalid operational capability response');operationalSupported=true;operationalVerified=true;return {state:'ready',verified:true,deltaWrites:true,receipts:true,schemaVersion:value.schemaVersion||null};}catch(e){if(missingRPC(e)){operationalSupported=false;operationalVerified=true;return {state:'missing',verified:true,deltaWrites:false,receipts:false};}operationalVerified=false;throw e}};
 const mutationReceipt=async(key,uid)=>{try{return await rpc('clinic_mutation_receipt',{actor_id_input:uid,request_key_input:key})||null}catch(e){if(missingRPC(e))return null;throw e}};
 const receiptMatch=(saved,receipt)=>saved&&saved.action===receipt.action&&saved.requestHash===receipt.requestHash;
 const committedError=saved=>{const e=new Error('حُفظت هذه العملية بالفعل. حدّث العرض للتحقق من النتيجة.');e.status=409;e.code='MUTATION_ALREADY_COMMITTED';e.receipt=saved;return e};
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const delta=(before,after,path=[],out=[])=>{
  if(JSON.stringify(before)===JSON.stringify(after))return out;
  if(object(before)&&object(after))for(const key of new Set([...Object.keys(before),...Object.keys(after)]))delta(before[key],after[key],path.concat(key),out);
  else out.push(after===undefined?{path,remove:true}:{path,value:after});return out;
 };
 async function mutate(fn,options={}){
  const receipt=options.receipt||null;
  if(options.operational&&operationalSupported){
   if(receipt){const existing=await mutationReceipt(receipt.key,receipt.uid);if(existing){if(!receiptMatch(existing,receipt)){const e=Error('مفتاح العملية مستخدم لطلب مختلف');e.status=409;throw e}throw committedError(existing)}}
   for(let attempt=0;attempt<8;attempt++){
    let current;try{current=await rpc('clinic_operational_snapshot',{});if(!current?.payload||!Number.isSafeInteger(Number(current.version)))throw Error('Invalid operational snapshot')}catch(e){if(missingRPC(e)){operationalSupported=false;operationalVerified=true;break}throw e}
    const next=fn(structuredClone(current.payload)),operational=Object.fromEntries(Object.entries(next).filter(([key])=>!archiveRoots.has(key))),archiveDelta=Object.fromEntries([...archiveRoots].filter(key=>next[key]!==undefined).map(key=>[key,next[key]])),changes=delta(current.payload,operational);
    let result;try{result=await rpc('clinic_compare_and_swap_delta',{expected_version:current.version,changes,archive_delta:archiveDelta,receipt})}catch(e){
     if(missingRPC(e)){operationalSupported=false;operationalVerified=true;break}
     // A failed response is ambiguous: only a matching receipt can prove it committed.
     if(receipt){let saved;try{saved=await mutationReceipt(receipt.key,receipt.uid)}catch{}if(receiptMatch(saved,receipt)){operationalVerified=true;return {saved:true,reconciled:true,receipt:saved};}}
     throw e;
    }
    if(result?.applied){operationalVerified=true;return {saved:true,version:result.version,committedAt:result.committedAt};}
    if(result?.alreadyCommitted)throw committedError({status:'saved',action:receipt?.action,requestHash:receipt?.requestHash,version:result.version,committedAt:result.committedAt});
    if(!result?.conflict)throw Error('Invalid delta mutation response');
    await new Promise(r=>setTimeout(r,20*(attempt+1)));
   }
   if(operationalSupported){const e=Error('تحديث متزامن. أعد المحاولة.');e.status=409;throw e}
  }
  for(let attempt=0;attempt<8;attempt++){const current=await snapshot(),next=fn(structuredClone(current.payload));if(await rpc('clinic_compare_and_swap',{expected_version:current.version,next_payload:next}))return {saved:true,legacy:true};await new Promise(r=>setTimeout(r,20*(attempt+1)))}const e=new Error('تحديث متزامن. أعد المحاولة.');e.status=409;throw e;
 }

 return {
  readAttachmentBytes:async(id,mime)=>{const maximum=mime==='application/pdf'?5000000:600000;let response;try{response=await fetcher(base+'/storage/v1/object/authenticated/clinic-patient-reports/'+encodeURIComponent(id),{headers:{apikey:secret,Authorization:'Bearer '+secret},signal:AbortSignal.timeout(15000)})}catch{const e=Error('تعذر تنزيل الصورة؛ لم تكتمل النسخة الاحتياطية');e.status=503;throw e}if(!response.ok||Number(response.headers.get('content-length')||0)>maximum){await response.body?.cancel();const e=Error('تعذر تنزيل الصورة للنسخة الاحتياطية');e.status=503;throw e}const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>maximum){const e=Error('صورة أكبر من الحد المسموح');e.status=413;throw e}let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {data:btoa(binary),mime}},
  uploadAttachment:async(id,bytes,mime)=>call('/storage/v1/object/clinic-patient-reports/'+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':mime,'x-upsert':'false'},body:bytes}),
  readAttachment:async id=>{const data=await call('/storage/v1/object/sign/clinic-patient-reports/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify({expiresIn:60})});const signed=data?.signedURL;if(typeof signed!=='string'||!signed.startsWith('/object/sign/clinic-patient-reports/')){const e=Error('تعذر تجهيز رابط التقرير');e.status=503;throw e}return {url:base+'/storage/v1'+signed}},
  deleteAttachment:async id=>call('/storage/v1/object/clinic-patient-reports',{method:'DELETE',body:JSON.stringify({prefixes:[id]})}),
  read:async()=> (await snapshot()).payload,
  readRequestNotifications:async()=>{const selection='roles:payload->roles,settings:payload->settings,appointmentRequests:payload->appointmentRequests,requestNotificationReads:payload->requestNotificationReads';const rows=await call('/rest/v1/clinic_state?id=eq.true&select='+encodeURIComponent(selection));if(!rows?.[0])throw Error('Clinic schema is not initialized');return rows[0]},
  readFields:async(fields,day=null,entity=null)=>rpc('clinic_read_slice',{fields,selected_day:day,entity}),
  patientSearchPage:async query=>rpc('clinic_patient_search_page',query),
  patientHistoryPage:async query=>rpc('clinic_patient_history_page',query),
  readHistory:async p=>rpc('clinic_patient_history',{patient_phone:p}),
  readDay:async day=>rpc('clinic_read_day',{selected_day:day}),
  readLookup:async(p,day)=>rpc('clinic_read_day',{selected_day:day,patient_phone:p}),
  systemHealth:async()=>{const health=await rpc('clinic_health_metadata',{});try{health.backupCheck=await rpc('clinic_backup_check_status',{})}catch{}return health},
  latestBackup:async()=>{const rows=await call('/rest/v1/clinic_backups?select=created_at,version,payload,checksum&order=created_at.desc&limit=1');return rows?.[0]||null},
  recordError:async x=>call('/rest/v1/clinic_diagnostics',{method:'POST',body:JSON.stringify(x)}),
  mutate,
  mutationReceipt,
  probeOperationalCapabilities,
  operationalCapabilities:()=>({state:operationalVerified?(operationalSupported?'ready':'missing'):'unverified',verified:operationalVerified,deltaWrites:operationalVerified&&operationalSupported,receipts:operationalVerified&&operationalSupported}),
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
