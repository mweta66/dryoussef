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
