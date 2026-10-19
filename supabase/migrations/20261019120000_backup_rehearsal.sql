-- Existing database only. This check never writes restored rows into clinical tables.
create table if not exists public.clinic_backup_checks (
 id uuid primary key default gen_random_uuid(), checked_at timestamptz not null default now(),
 backup_id uuid, backup_at timestamptz, passed boolean not null, counts jsonb not null default '{}',
 detail text not null
);
alter table public.clinic_backup_checks enable row level security;
revoke all on public.clinic_backup_checks from anon, authenticated;
grant select,insert,delete on public.clinic_backup_checks to service_role;
create or replace function public.clinic_rehearse_latest_backup() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.clinic_backups%rowtype; ok boolean:=false; message text; totals jsonb:='{}';
begin
 select * into b from public.clinic_backups order by created_at desc limit 1;
 if not found then message:='No stored backup';
 else
  begin
   if md5(b.payload::text)<>b.checksum then raise exception 'Backup checksum mismatch';end if;
   if jsonb_typeof(coalesce(b.payload->'patients','{}'::jsonb))<>'object' or jsonb_typeof(coalesce(b.payload->'bookings','{}'::jsonb))<>'object' then raise exception 'Invalid clinical roots';end if;
   create temporary table clinic_rehearsal_patients(phone text primary key,record jsonb) on commit drop;
   insert into clinic_rehearsal_patients select key,value from jsonb_each(coalesce(b.payload->'patients','{}'));
   create temporary table clinic_rehearsal_bookings(day text,id text,record jsonb,primary key(day,id)) on commit drop;
   insert into clinic_rehearsal_bookings select d.key,r.key,r.value from jsonb_each(coalesce(b.payload->'bookings','{}')) d cross join lateral jsonb_each(d.value) r;
   if exists(select 1 from clinic_rehearsal_bookings r left join clinic_rehearsal_patients p on p.phone=r.record->>'phone' where p.phone is null) then raise exception 'Booking without patient';end if;
   if exists(select 1 from clinic_rehearsal_bookings group by day,record->>'phone' having count(*)>1) then raise exception 'Duplicate daily patient booking';end if;
   totals:=jsonb_build_object('patients',(select count(*) from clinic_rehearsal_patients),'bookings',(select count(*) from clinic_rehearsal_bookings));
   drop table clinic_rehearsal_bookings,clinic_rehearsal_patients;
   ok:=true;message:='Isolated clinical JSON reconstruction passed; image objects and Auth accounts were not restored or verified';
  exception when others then message:='Isolated backup reconstruction failed';end;
 end if;
 insert into public.clinic_backup_checks(backup_id,backup_at,passed,counts,detail) values(b.id,b.created_at,ok,totals,message);
 delete from public.clinic_backup_checks where checked_at<now()-interval '90 days';
 return jsonb_build_object('at',now(),'backupAt',b.created_at,'passed',ok,'counts',totals,'detail',message,'imagesVerified',false);
end $$;
revoke all on function public.clinic_rehearse_latest_backup() from public,anon,authenticated;
grant execute on function public.clinic_rehearse_latest_backup() to service_role;
create or replace function public.clinic_backup_check_status() returns jsonb
language sql stable security definer set search_path=public as $$
 select to_jsonb(x) from (select checked_at,backup_at,passed,counts,detail from public.clinic_backup_checks order by checked_at desc limit 1) x;
$$;
revoke all on function public.clinic_backup_check_status() from public,anon,authenticated;
grant execute on function public.clinic_backup_check_status() to service_role;
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  if not exists(select 1 from cron.job where jobname='clinic-backup-rehearsal') then
   perform cron.schedule('clinic-backup-rehearsal','30 3 * * *','select public.clinic_rehearse_latest_backup();');
  end if;
 end if;
end $$;
