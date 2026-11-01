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
