-- Clinical workflow release 2026.11.01.1: three migrations, one atomic transaction.
-- Run as the database owner in Supabase SQL Editor, after saving a backup.
-- Does not generate, delete, or replace clinic patient records or attachments.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
do $$
declare missing text; relation_name text;
begin
 foreach relation_name in array array['clinic_state','clinic_patients','clinic_bookings','clinic_files','clinic_complaints','clinic_roles','clinic_settings','clinic_misc','clinic_sessions'] loop
  if to_regclass('public.'||relation_name) is null then missing=concat_ws(', ',missing,relation_name);end if;
 end loop;
 if missing is not null then raise exception 'Missing prerequisite tables: %. Stop and apply prerequisite migrations first.',missing;end if;
 if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.clinic_state'::regclass and tgname='clinic_projection' and not tgisinternal and tgenabled in ('O','A')) then
  raise exception 'Missing active clinic_projection trigger. Stop and check prerequisite migrations.';
 end if;
 if not exists(select 1 from public.clinic_state where id=true) then raise exception 'Clinic state is not initialized. Stop and check existing setup.';end if;
end $$;

-- Source: 20261031120000_patient_identity_pagination.sql
-- Helpers normalize searches consistently with the clinical gateway; no browser execution grants.
create or replace function public.clinic_patient_search_text(value text)
returns text language sql immutable security invoker set search_path='' as $$
 with folded as(select translate(lower(normalize(coalesce(value,''),NFKC)), 'أإآىة٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','ااايه01234567890123456789') v)
 select case when v ~ '^[[:space:]+()0-9-]+$' then regexp_replace(regexp_replace(v,'[[:space:]()+-]','','g'),'^(0020|20)(?=1)','0') else trim(regexp_replace(v,'[[:space:]]+',' ','g')) end from folded;
$$;
create or replace function public.clinic_patient_identity_id(patient_phone text,patient_data jsonb)
returns text language sql immutable security invoker set search_path='' as $$
 select case when coalesce(patient_data->>'patientId',patient_data->>'id','') ~ '^pat_[a-f0-9]{32}$' then coalesce(patient_data->>'patientId',patient_data->>'id') else 'pat_'||md5('clinic-patient/v1|'||patient_phone) end;
$$;
revoke all on function public.clinic_patient_search_text(text),public.clinic_patient_identity_id(text,jsonb) from public,anon,authenticated;
grant execute on function public.clinic_patient_search_text(text),public.clinic_patient_identity_id(text,jsonb) to service_role;
-- Bounded clinical search/history reads. Browser roles cannot call these privileged RPCs.
create extension if not exists pg_trgm;
do $$ declare ns text; begin
 select n.nspname into ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
 execute format('create index if not exists clinic_patient_name_search on public.clinic_patients using gin ((public.clinic_patient_search_text(data->>''n'')) %I.gin_trgm_ops)',ns);
 execute format('create index if not exists clinic_patient_phone_search on public.clinic_patients using gin (phone %I.gin_trgm_ops)',ns);
end $$;
create index if not exists clinic_patients_internal_identity on public.clinic_patients ((public.clinic_patient_identity_id(phone,data)));
create index if not exists clinic_complaints_phone_date on public.clinic_complaints(phone,((data->>'date')) desc,id);

create or replace function public.clinic_patient_search_page(actor_uid text,search_query text default '',selected_branch text default null,selected_page integer default 0,page_size integer default 20)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare r jsonb;q text; b text;all_allowed boolean;cnt bigint;result jsonb;
begin
 select data into r from public.clinic_roles where uid=actor_uid;
 if r is null or r->>'enabled'='false' or not (r->>'r'='admin' or coalesce((r->'permissions'->>'patients.read')::boolean,r->>'r' in ('doctor','nurse'))) then raise insufficient_privilege using message='غير مصرح بقراءة الحالات';end if;
 if selected_page is null or page_size is null or selected_page<0 or selected_page>100000 or page_size<1 or page_size>50 or length(coalesce(search_query,''))>120 then raise invalid_parameter_value using message='حدود البحث غير صحيحة';end if;
 all_allowed:=r->>'r'='admin' or coalesce(r->>'scope'='all',false) or (r->>'r' in ('doctor','nurse') and not (r?'scope'));
 if not all_allowed and nullif(r->>'br','') is null then raise insufficient_privilege using message='لا يوجد فرع مصرح لهذا الحساب';end if;
 b:=nullif(selected_branch,'all');if not all_allowed then if b is not null and b is distinct from r->>'br' then raise insufficient_privilege using message='غير مصرح ببيانات هذا الفرع';end if;b:=r->>'br';end if;
 if b is not null and not exists(select 1 from public.clinic_settings where id=true and (coalesce(data->'branches',data->'site'->'branches','{}')?b or (not (data?'branches') and not(coalesce(data->'site','{}')?'branches') and b in ('alex','dmn')))) then raise invalid_parameter_value using message='الفرع غير موجود';end if;
 q:=public.clinic_patient_search_text(search_query);
 select count(*) into cnt from public.clinic_patients p where (b is null or p.data->>'br'=b or exists(select 1 from public.clinic_bookings z where z.phone=p.phone and z.branch=b)) and (q='' or public.clinic_patient_search_text(p.data->>'n') like '%'||replace(replace(replace(q,'!','!!'),'%','!%'),'_','!_')||'%' escape '!' or p.phone like '%'||replace(replace(replace(q,'!','!!'),'%','!%'),'_','!_')||'%' escape '!');
 select coalesce(jsonb_agg(x.item order by x.patient_name,x.phone),'[]') into result from (
  select p.phone,coalesce(p.data->>'n','') patient_name,jsonb_build_object('phone',p.phone,'patientId',public.clinic_patient_identity_id(p.phone,p.data),'name',coalesce(p.data->>'n',''),'registeredDate',coalesce(p.data->>'d',''),'branch',p.data->>'br','spouseName',coalesce(p.data->>'spouseName',''),'spouseJob',coalesce(p.data->>'spouseJob',''),'spousePhone',coalesce(p.data->>'spousePhone',''),'training',p.data?'trainingBatch' or coalesce(p.data->>'training','false')='true' or exists(select 1 from public.clinic_bookings z where z.phone=p.phone and (z.data?'trainingBatch' or z.id ~ '^demo[-_]'))) item
  from public.clinic_patients p where (b is null or p.data->>'br'=b or exists(select 1 from public.clinic_bookings z where z.phone=p.phone and z.branch=b)) and (q='' or public.clinic_patient_search_text(p.data->>'n') like '%'||replace(replace(replace(q,'!','!!'),'%','!%'),'_','!_')||'%' escape '!' or p.phone like '%'||replace(replace(replace(q,'!','!!'),'%','!%'),'_','!_')||'%' escape '!')
  order by coalesce(p.data->>'n',''),p.phone limit page_size offset selected_page*page_size
 ) x;
 return jsonb_build_object('page',selected_page,'pageSize',page_size,'total',cnt,'pages',greatest(1,ceil(cnt::numeric/page_size)::int),'hasMore',(selected_page+1)::bigint*page_size<cnt,'rows',result);
end $$;
revoke all on function public.clinic_patient_search_page(text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.clinic_patient_search_page(text,text,text,integer,integer) to service_role;

create or replace function public.clinic_patient_history_page(actor_uid text,patient_phone text default null,patient_id text default null,entry_kind text default 'all',selected_page integer default 0,page_size integer default 20)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare r jsonb;p jsonb;ph text;pid text;all_allowed boolean;can_book boolean;can_notes boolean;can_complaint boolean;can_report boolean;items jsonb;cnt bigint;attachments jsonb;visits jsonb;
begin
 select data into r from public.clinic_roles where uid=actor_uid;
 if r is null or r->>'enabled'='false' or not (r->>'r'='admin' or coalesce((r->'permissions'->>'patients.read')::boolean,r->>'r' in ('doctor','nurse'))) then raise insufficient_privilege using message='غير مصرح بقراءة الحالات';end if;
 if selected_page is null or page_size is null or selected_page<0 or selected_page>100000 or page_size<1 or page_size>50 or entry_kind is null or entry_kind not in ('all','booking','complaint','attachment','medical') then raise invalid_parameter_value using message='حدود التاريخ غير صحيحة';end if;
 if patient_phone is null and patient_id is null then raise invalid_parameter_value using message='حدد الحالة';end if;
 if patient_id is not null and (select count(*) from public.clinic_patients x where (patient_phone is null or x.phone=patient_phone) and public.clinic_patient_identity_id(x.phone,x.data)=patient_id)>1 then raise invalid_parameter_value using message='الهوية مرتبطة بأكثر من حالة؛ راجع الملفات أولًا';end if;
 select x.phone,x.data into ph,p from public.clinic_patients x where (patient_phone is null or x.phone=patient_phone) and (patient_id is null or public.clinic_patient_identity_id(x.phone,x.data)=patient_id) limit 1;
 if p is null then raise no_data_found using message='الحالة غير موجودة';end if;
 pid:=public.clinic_patient_identity_id(ph,p);
 all_allowed:=r->>'r'='admin' or coalesce(r->>'scope'='all',false) or (r->>'r' in ('doctor','nurse') and not (r?'scope'));
 if not all_allowed and nullif(r->>'br','') is null then raise insufficient_privilege using message='لا يوجد فرع مصرح لهذا الحساب';end if;
 if not all_allowed and p->>'br' is distinct from r->>'br' and not exists(select 1 from public.clinic_bookings b where b.phone=ph and b.branch=r->>'br') then raise insufficient_privilege using message='غير مصرح ببيانات هذا الفرع';end if;
 can_book:=r->>'r'='admin' or coalesce((r->'permissions'->>'bookings.read')::boolean,r->>'r' in ('doctor','sec','nurse'));
 can_notes:=r->>'r'='admin' or coalesce((r->'permissions'->>'notes.read')::boolean,r->>'r'='doctor');
 can_complaint:=r->>'r'='admin' or coalesce((r->'permissions'->>'complaints.read')::boolean,r->>'r' in ('doctor','nurse'));
 can_report:=r->>'r'='admin' or coalesce((r->'permissions'->>'attachments.read')::boolean,r->>'r' in ('doctor','nurse'));
 select coalesce(data->ph,'{}') into attachments from public.clinic_misc where key='attachments';attachments:=coalesce(attachments,'{}');
 select coalesce(data,'{}') into visits from public.clinic_misc where key='clinicalVisits';visits:=coalesce(visits,'{}');
 with timeline as (
  select b.id,'booking' kind,b.day::text date,coalesce(b.data->>'updatedAt',b.data->>'createdAt',b.day::text) at,jsonb_build_object('id',b.id,'kind','booking','date',b.day::text,'at',coalesce(b.data->>'updatedAt',b.data->>'createdAt',b.day::text),'no',b.ticket,'title','حجز','text',b.data->>'v','by',coalesce(b.data->>'updatedBy',b.data->>'createdBy',''),'data',case when can_notes then b.data else b.data||'{"nt":""}'::jsonb end) item
  from public.clinic_bookings b where can_book and b.phone=ph and (all_allowed or b.branch=r->>'br') and entry_kind in ('all','booking')
  union all select c.id,'complaint',coalesce(c.data->>'date',''),coalesce(c.data->>'at',c.data->>'date',''),jsonb_build_object('id',c.id,'kind','complaint','date',c.data->>'date','at',coalesce(c.data->>'at',c.data->>'date'),'no',coalesce(c.data->'no','0'::jsonb),'title','شكوى','reason',coalesce(c.data->>'reason',''),'text',coalesce(c.data->>'text',''),'tx',coalesce(c.data->>'tx',''),'by',coalesce(c.data->>'by',''),'data',c.data||jsonb_build_object('id',c.id)) from public.clinic_complaints c where can_complaint and c.phone=ph and entry_kind in ('all','complaint')
  union all select a.key,'attachment',coalesce(a.value->>'reportDate',left(a.value->>'createdAt',10),''),coalesce(a.value->>'createdAt',a.value->>'reportDate',''),jsonb_build_object('id',a.key,'kind','attachment','date',coalesce(a.value->>'reportDate',left(a.value->>'createdAt',10)), 'at',coalesce(a.value->>'createdAt',a.value->>'reportDate'),'title',a.value->>'name','text',coalesce(a.value->>'category','report'),'by',coalesce(a.value->>'by',''),'data',jsonb_build_object('id',coalesce(a.value->>'id',a.key),'name',a.value->>'name','mime',a.value->>'mime','size',a.value->'size','category',a.value->>'category','reportDate',a.value->>'reportDate','createdAt',a.value->>'createdAt','by',a.value->>'by')) from jsonb_each(attachments) a where can_report and entry_kind in ('all','attachment')
  union all select v.key,'medical',coalesce(v.value->>'date',left(v.value->>'completedAt',10),''),coalesce(v.value->>'completedAt',v.value->>'date',''),jsonb_build_object('id',v.key,'kind','medical','date',coalesce(v.value->>'date',left(v.value->>'completedAt',10)), 'at',coalesce(v.value->>'completedAt',v.value->>'date'),'title','سجل الكشف','text',coalesce(v.value->'medical'->>'n',''),'by',coalesce(v.value->>'by',''),'data',v.value) from jsonb_each(visits) v where can_notes and v.value->>'phone'=ph and entry_kind in ('all','medical')
  union all select 'medical-current','medical',left(coalesce(f.data->>'t',p->>'d',''),10),coalesce(f.data->>'t',p->>'d',''),jsonb_build_object('id','medical-current','kind','medical','date',left(coalesce(f.data->>'t',p->>'d',''),10),'at',coalesce(f.data->>'t',p->>'d',''),'title','الملف الطبي','text',coalesce(f.data->>'n',''),'by',coalesce(f.data->>'by',''),'data',f.data) from public.clinic_files f where can_notes and f.phone=ph and entry_kind in ('all','medical')
 ), paged as (select * from timeline order by date desc,at desc,kind,id limit page_size offset selected_page*page_size)
 select (select count(*) from timeline),coalesce((select jsonb_agg(item order by date desc,at desc,kind,id) from paged),'[]') into cnt,items;
 return jsonb_build_object('phone',ph,'patientId',pid,'patient',jsonb_build_object('name',coalesce(p->>'n','')),'page',selected_page,'pageSize',page_size,'total',cnt,'pages',greatest(1,ceil(cnt::numeric/page_size)::int),'hasMore',(selected_page+1)::bigint*page_size<cnt,'rows',items);
end $$;
revoke all on function public.clinic_patient_history_page(text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.clinic_patient_history_page(text,text,text,text,integer,integer) to service_role;

-- Source: 20261031123000_operational_delta_receipts.sql
-- Private, atomic operational deltas. Clinical archives remain canonical and recoverable.
create table if not exists public.clinic_mutation_receipts (
 actor_id text not null, request_key text not null, action text not null, request_hash text not null,
 committed_at timestamptz not null default now(), version bigint not null,
 primary key(actor_id,request_key),
 check(length(request_key) between 8 and 128), check(length(action) between 1 and 64), check(length(request_hash)=64)
);
alter table public.clinic_mutation_receipts enable row level security;
revoke all on public.clinic_mutation_receipts from public,anon,authenticated;
grant select,insert,update,delete on public.clinic_mutation_receipts to service_role;

create or replace function public.clinic_operational_snapshot()
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',version,'payload',payload-array['audit','activityDetails','activityContext','recycleBin','clinicalVisits'])
 from public.clinic_state where id=true;
$$;
create or replace function public.clinic_mutation_receipt(actor_id_input text,request_key_input text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('status','saved','action',action,'requestHash',request_hash,'committedAt',committed_at,'version',version)
 from public.clinic_mutation_receipts where actor_id=actor_id_input and request_key=request_key_input;
$$;
-- Recursively create intermediate objects. jsonb_set alone does not create them.
create or replace function public.clinic_apply_json_delta(document jsonb,path text[],value jsonb,remove_value boolean)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
 declare head text; child jsonb;
 begin
  if coalesce(array_length(path,1),0)=0 then raise exception 'Invalid delta path'; end if;
  head=path[1];document=coalesce(document,'{}'::jsonb);
  if array_length(path,1)=1 then
   if remove_value then return document-head; else return jsonb_set(document,array[head],coalesce(value,'null'::jsonb),true); end if;
  end if;
  if remove_value and not document?head then return document; end if;
  child=public.clinic_apply_json_delta(coalesce(document->head,'{}'::jsonb),path[2:array_length(path,1)],value,remove_value);
  return jsonb_set(document,array[head],child,true);
 end;
$$;
create or replace function public.clinic_compare_and_swap_delta(expected_version bigint,changes jsonb,archive_delta jsonb default '{}'::jsonb,receipt jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
 declare row_value public.clinic_state%rowtype; p jsonb; change jsonb; path text[]; root text; saved public.clinic_mutation_receipts%rowtype; v_actor text; v_key text;
 begin
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)>20000 then raise exception 'Invalid operational delta'; end if;
  if jsonb_typeof(archive_delta) is distinct from 'object' then raise exception 'Invalid archive delta'; end if;
  -- Canonical row lock also serializes receipt creation. Nothing is replayed on ambiguous network failures.
  select * into row_value from public.clinic_state where id=true for update;
  if not found then raise exception 'Clinic schema is not initialized'; end if;
  if receipt is not null then
   v_actor=receipt->>'uid';v_key=receipt->>'key';
   if length(coalesce(v_actor,''))<1 or length(coalesce(v_key,'')) not between 8 and 128 or length(coalesce(receipt->>'requestHash',''))<>64 or length(coalesce(receipt->>'action','')) not between 1 and 64 then raise exception 'Invalid mutation receipt'; end if;
   select * into saved from public.clinic_mutation_receipts where actor_id=v_actor and request_key=v_key;
   if found then
    if saved.action<>receipt->>'action' or saved.request_hash<>receipt->>'requestHash' then raise exception 'Mutation key already used for another operation' using errcode='23505'; end if;
    return jsonb_build_object('applied',false,'alreadyCommitted',true,'version',saved.version,'committedAt',saved.committed_at);
   end if;
  end if;
  if row_value.version<>expected_version then return jsonb_build_object('applied',false,'conflict',true); end if;
  p=row_value.payload;
  for change in select x from jsonb_array_elements(changes) x loop
   if jsonb_typeof(change->'path') is distinct from 'array' or jsonb_array_length(change->'path')=0 or jsonb_array_length(change->'path')>12 then raise exception 'Invalid operational delta path'; end if;
   select array_agg(x order by ord) into path from jsonb_array_elements_text(change->'path') with ordinality a(x,ord);
   if path[1]=any(array['audit','activityDetails','activityContext','recycleBin','clinicalVisits']) then raise exception 'Archive replacement is not allowed'; end if;
   if exists(select 1 from unnest(path) x where x is null or length(x)>256 or x in ('__proto__','prototype','constructor')) then raise exception 'Invalid operational delta key'; end if;
   p=public.clinic_apply_json_delta(p,path,change->'value',coalesce((change->>'remove')::boolean,false));
  end loop;
  for root in select jsonb_object_keys(archive_delta) loop
   if root not in ('audit','activityDetails','activityContext','recycleBin','clinicalVisits') then raise exception 'Invalid archive root'; end if;
   if root='audit' then
    if jsonb_typeof(archive_delta->root)<>'array' then raise exception 'Invalid audit append'; end if;
    if exists(select 1 from jsonb_array_elements(archive_delta->root) a where jsonb_typeof(a) is distinct from 'object' or coalesce(a->>'id','')='') then raise exception 'Audit entries need stable IDs';end if;
    if exists(select 1 from jsonb_array_elements(archive_delta->root) a join jsonb_array_elements(coalesce(p->root,'[]'::jsonb)) b on a->>'id'=b->>'id') or exists(select 1 from jsonb_array_elements(archive_delta->root) a group by a->>'id' having count(*)>1) then raise exception 'Audit ID already exists';end if;
    p=jsonb_set(p,array[root],coalesce(p->root,'[]'::jsonb)||(archive_delta->root),true);
   else
    if jsonb_typeof(archive_delta->root)<>'object' or jsonb_typeof(coalesce(p->root,'{}'::jsonb))<>'object' then raise exception 'Invalid archive entries'; end if;
    -- Existing archive IDs must never be overwritten by a routine write.
    if exists(select 1 from jsonb_each(archive_delta->root) a where coalesce(p->root,'{}'::jsonb)?a.key and (p->root->a.key) is distinct from a.value) then raise exception 'Archive entry already exists'; end if;
    p=jsonb_set(p,array[root],coalesce(p->root,'{}'::jsonb)||(archive_delta->root),true);
   end if;
  end loop;
  update public.clinic_state set payload=p,version=version+1 where id=true;
  if receipt is not null then
   insert into public.clinic_mutation_receipts(actor_id,request_key,action,request_hash,version)
   values(v_actor,v_key,receipt->>'action',receipt->>'requestHash',row_value.version+1);
  end if;
  return jsonb_build_object('applied',true,'version',row_value.version+1,'committedAt',now());
 end;
$$;
revoke all on function public.clinic_operational_snapshot(),public.clinic_mutation_receipt(text,text),public.clinic_apply_json_delta(jsonb,text[],jsonb,boolean),public.clinic_compare_and_swap_delta(bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.clinic_operational_snapshot(),public.clinic_mutation_receipt(text,text),public.clinic_apply_json_delta(jsonb,text[],jsonb,boolean),public.clinic_compare_and_swap_delta(bigint,jsonb,jsonb,jsonb) to service_role;

create or replace function public.clinic_operational_capabilities()
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('state','ready','verified',true,'deltaWrites',to_regprocedure('public.clinic_compare_and_swap_delta(bigint,jsonb,jsonb,jsonb)') is not null,'receipts',to_regprocedure('public.clinic_mutation_receipt(text,text)') is not null,'schemaVersion','2026.10.31.1');
$$;
revoke all on function public.clinic_operational_capabilities() from public,anon,authenticated;
grant execute on function public.clinic_operational_capabilities() to service_role;

-- Source: 20261031124500_clinical_workflow_slice.sql
-- Service-only projected reads; an entity limits patient medical data to the selected phone.
create or replace function public.clinic_read_slice(fields text[],selected_day date default null,entity text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb='{}';k text;v jsonb;
begin
 foreach k in array fields loop
  v='{}';
  case k
   when 'settings' then select data into v from public.clinic_settings where id=true;
   when 'roles' then select jsonb_object_agg(uid,data) into v from public.clinic_roles;
   when 'patients' then select jsonb_object_agg(phone,data) into v from public.clinic_patients where entity is null or phone=entity;
   when 'files' then select jsonb_object_agg(phone,data) into v from public.clinic_files where entity is null or phone=entity;
   when 'followupFiles' then select jsonb_object_agg(phone,jsonb_build_object('followUp',data->'followUp','followUpBranch',data->'followUpBranch')) into v from public.clinic_files where coalesce(data->>'followUp','')<>'';
   when 'sessions' then select jsonb_object_agg(key,data) into v from public.clinic_sessions;
   when 'complaints' then select jsonb_object_agg(phone,rows) into v from(select phone,jsonb_object_agg(id,data) rows from public.clinic_complaints where entity is null or phone=entity group by phone) q;
   when 'bookings' then select jsonb_object_agg(day::text,rows) into v from(select day,jsonb_object_agg(id,data) rows from public.clinic_bookings where selected_day is null or day=selected_day group by day) q;
   when 'clinicalVisits' then select coalesce(jsonb_object_agg(x.key,x.value),'{}') into v from public.clinic_misc m cross join lateral jsonb_each(m.data) x where m.key='clinicalVisits' and (entity is null or x.value->>'phone'=entity);
   else select data into v from public.clinic_misc where key=k and k in ('sequences','deletedBookings','followups','inbox','audit','checkins','urgentReviews','followupPlans','bookingContacts','patientIdentities','patientPhoneIndex','recordProvenance','appointmentRequests','clinicalVisits','waitingList','slotOpenings','dayClosures');
  end case;
  result=result||jsonb_build_object(case when k='followupFiles' then 'files' else k end,coalesce(v,case when k='audit' then '[]'::jsonb else '{}'::jsonb end));
 end loop;return result;
end $$;
revoke all on function public.clinic_read_slice(text[],date,text) from public,anon,authenticated;
grant execute on function public.clinic_read_slice(text[],date,text) to service_role;

commit;
select 'Clinic database update 2026.11.01.1 completed' as result;
