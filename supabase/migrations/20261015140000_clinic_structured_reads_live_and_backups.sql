-- Compatible projection: canonical versioned writes remain atomic during rollout.
-- No direct browser access to clinical tables or privileged RPCs.
create table if not exists public.clinic_bookings (
 id text primary key, day date not null, branch text not null check(branch in ('dmn','alex')),
 phone text not null, ticket integer not null, status text not null, data jsonb not null,
 unique(day,branch,ticket) deferrable initially deferred
);
create index if not exists clinic_bookings_day_branch on public.clinic_bookings(day,branch,status,ticket);
create index if not exists clinic_bookings_phone_day on public.clinic_bookings(phone,day);
create table if not exists public.clinic_patients(phone text primary key,data jsonb not null);
create table if not exists public.clinic_files(phone text primary key,data jsonb not null);
create table if not exists public.clinic_complaints(phone text not null,id text not null,data jsonb not null,primary key(phone,id));
create table if not exists public.clinic_roles(uid text primary key,data jsonb not null);
create table if not exists public.clinic_settings(id boolean primary key default true check(id),data jsonb not null);
create table if not exists public.clinic_sessions(key text primary key,data jsonb not null);
create table if not exists public.clinic_misc(key text primary key,data jsonb not null);
create table if not exists public.clinic_backups(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),version bigint not null,payload jsonb not null,checksum text not null);
create index if not exists clinic_backups_created on public.clinic_backups(created_at desc);
create table if not exists public.clinic_diagnostics(request_id uuid primary key,at timestamptz not null default now(),action text not null,status integer not null,duration_ms integer not null);
do $$ declare t text; begin
 foreach t in array array['clinic_bookings','clinic_patients','clinic_files','clinic_complaints','clinic_roles','clinic_settings','clinic_sessions','clinic_misc','clinic_backups','clinic_diagnostics'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;

create or replace function public.clinic_sync_records(p jsonb)
returns void language plpgsql security invoker set search_path='' as $$
begin
 delete from public.clinic_bookings b where not exists(select 1 from jsonb_each(coalesce(p->'bookings','{}')) d cross join lateral jsonb_each(d.value) r where r.key=b.id);
 insert into public.clinic_bookings(id,day,branch,phone,ticket,status,data)
 select r.key,(r.value->>'date')::date,r.value->>'b',r.value->>'phone',(r.value->>'no')::int,r.value->>'s',r.value
 from jsonb_each(coalesce(p->'bookings','{}')) d cross join lateral jsonb_each(d.value) r
 on conflict(id) do update set day=excluded.day,branch=excluded.branch,phone=excluded.phone,ticket=excluded.ticket,status=excluded.status,data=excluded.data where clinic_bookings.data is distinct from excluded.data;
 delete from public.clinic_patients where not coalesce(p->'patients','{}')?phone;
 insert into public.clinic_patients select key,value from jsonb_each(coalesce(p->'patients','{}')) on conflict(phone) do update set data=excluded.data where clinic_patients.data is distinct from excluded.data;
 delete from public.clinic_files where not coalesce(p->'files','{}')?phone;
 insert into public.clinic_files select key,value from jsonb_each(coalesce(p->'files','{}')) on conflict(phone) do update set data=excluded.data where clinic_files.data is distinct from excluded.data;
 delete from public.clinic_roles where not coalesce(p->'roles','{}')?uid;
 insert into public.clinic_roles select key,value from jsonb_each(coalesce(p->'roles','{}')) on conflict(uid) do update set data=excluded.data where clinic_roles.data is distinct from excluded.data;
 delete from public.clinic_sessions where not coalesce(p->'sessions','{}')?key;
 insert into public.clinic_sessions select key,value from jsonb_each(coalesce(p->'sessions','{}')) on conflict(key) do update set data=excluded.data where clinic_sessions.data is distinct from excluded.data;
 delete from public.clinic_complaints c where not coalesce(p->'complaints'->c.phone,'{}')?c.id;
 insert into public.clinic_complaints select ph.key,r.key,r.value from jsonb_each(coalesce(p->'complaints','{}')) ph cross join lateral jsonb_each(ph.value) r
 on conflict(phone,id) do update set data=excluded.data where clinic_complaints.data is distinct from excluded.data;
 insert into public.clinic_settings values(true,coalesce(p->'settings','{}')) on conflict(id) do update set data=excluded.data where clinic_settings.data is distinct from excluded.data;
 delete from public.clinic_misc where not p?key;
 insert into public.clinic_misc select key,value from jsonb_each(p) where key not in ('bookings','patients','files','roles','sessions','complaints','settings','track')
 on conflict(key) do update set data=excluded.data where clinic_misc.data is distinct from excluded.data;
end $$;
revoke all on function public.clinic_sync_records(jsonb) from public,anon,authenticated;
grant execute on function public.clinic_sync_records(jsonb) to service_role;

create or replace function public.clinic_projection_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.clinic_sync_records(new.payload);
 begin perform realtime.send(jsonb_build_object('version',new.version),'changed','clinic-live',false);
 exception when others then raise log 'clinic realtime broadcast unavailable'; end;
 return new;
end $$;
revoke all on function public.clinic_projection_trigger() from public,anon,authenticated,service_role;
drop trigger if exists clinic_projection on public.clinic_state;
create trigger clinic_projection after insert or update of payload on public.clinic_state for each row execute function public.clinic_projection_trigger();
select public.clinic_sync_records(payload) from public.clinic_state where id=true;

create or replace function public.clinic_read_slice(fields text[],selected_day date default null,entity text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb='{}';k text;v jsonb;
begin
 foreach k in array fields loop
  v='{}';
  case k
   when 'settings' then select data into v from public.clinic_settings where id=true;
   when 'roles' then select jsonb_object_agg(uid,data) into v from public.clinic_roles;
   when 'patients' then select jsonb_object_agg(phone,data) into v from public.clinic_patients;
   when 'files' then select jsonb_object_agg(phone,data) into v from public.clinic_files where entity is null or phone=entity;
   when 'followupFiles' then select jsonb_object_agg(phone,jsonb_build_object('followUp',data->'followUp','followUpBranch',data->'followUpBranch')) into v from public.clinic_files where coalesce(data->>'followUp','')<>'';
   when 'sessions' then select jsonb_object_agg(key,data) into v from public.clinic_sessions;
   when 'complaints' then select jsonb_object_agg(phone,rows) into v from(select phone,jsonb_object_agg(id,data) rows from public.clinic_complaints where entity is null or phone=entity group by phone) q;
   when 'bookings' then select jsonb_object_agg(day::text,rows) into v from(select day,jsonb_object_agg(id,data) rows from public.clinic_bookings where selected_day is null or day=selected_day group by day) q;
   else select data into v from public.clinic_misc where key=k and k in ('sequences','deletedBookings','followups','inbox','audit');
  end case;
  result=result||jsonb_build_object(case when k='followupFiles' then 'files' else k end,coalesce(v,case when k='audit' then '[]'::jsonb else '{}'::jsonb end));
 end loop;return result;
end $$;
revoke all on function public.clinic_read_slice(text[],date,text) from public,anon,authenticated;
grant execute on function public.clinic_read_slice(text[],date,text) to service_role;

create or replace function public.clinic_read_day(selected_day date,patient_phone text default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('settings',jsonb_build_object('avg',(select data->'avg' from public.clinic_settings where id=true)),
 'sessions',coalesce((select jsonb_object_agg(key,data) from public.clinic_sessions where key like selected_day::text||'_%'),'{}'),
 'bookings',jsonb_build_object(selected_day::text,coalesce((select jsonb_object_agg(id,data-'name'-'nt') from public.clinic_bookings where day=selected_day and(patient_phone is null or branch=(select branch from public.clinic_bookings where day=selected_day and phone=patient_phone limit 1))),'{}')));
$$;
revoke all on function public.clinic_read_day(date,text) from public,anon,authenticated;
grant execute on function public.clinic_read_day(date,text) to service_role;

create or replace function public.clinic_lookup_budget(ip_key text,patient_key text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n int;m int;begin
 delete from public.clinic_lookup_limits where expires<now();
 insert into public.clinic_lookup_limits values(ip_key,1,now()+interval '2 minutes') on conflict(key) do update set count=clinic_lookup_limits.count+1 returning count into n;
 insert into public.clinic_lookup_limits values(patient_key,1,now()+interval '2 minutes') on conflict(key) do update set count=clinic_lookup_limits.count+1 returning count into m;
 return n<=300 and m<=20;
end $$;
revoke all on function public.clinic_lookup_budget(text,text) from public,anon,authenticated;
grant execute on function public.clinic_lookup_budget(text,text) to service_role;

create or replace function public.clinic_take_backup(force_copy boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if not force_copy and exists(select 1 from public.clinic_backups where created_at>=date_trunc('day',now())) then return null;end if;
 insert into public.clinic_backups(version,payload,checksum) select version,payload,md5(payload::text) from public.clinic_state where id=true returning id into result;
 delete from public.clinic_backups where created_at<now()-interval '14 days';
 delete from public.clinic_diagnostics where at<now()-interval '14 days';return result;
end $$;
revoke all on function public.clinic_take_backup(boolean) from public,anon,authenticated;
grant execute on function public.clinic_take_backup(boolean) to service_role;
select public.clinic_take_backup();
create extension if not exists pg_cron;
select cron.schedule('clinic-daily-private-backup','0 1 * * *','select public.clinic_take_backup();');

create or replace function public.clinic_health_metadata()
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('lastBackup',(select max(created_at) from public.clinic_backups),'retentionDays',14,
 'errors',coalesce((select jsonb_agg(q) from(select request_id,at,action,status,duration_ms from public.clinic_diagnostics order by at desc limit 20) q),'[]'));
$$;
revoke all on function public.clinic_health_metadata() from public,anon,authenticated;
grant execute on function public.clinic_health_metadata() to service_role;
