-- Public read projections need current branch visibility and attendance rules.
-- Membership and schedules remain informational; no staff/clinical notes are added.
create or replace function public.clinic_read_day(selected_day date,patient_phone text default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('settings',jsonb_build_object(
  'avg',(select data->'avg' from public.clinic_settings where id=true),
  'branches',(select coalesce(data->'branches',data->'site'->'branches') from public.clinic_settings where id=true),
  'sched',(select data->'sched' from public.clinic_settings where id=true)),
 'sessions',coalesce((select jsonb_object_agg(key,data) from public.clinic_sessions where key like selected_day::text||'_%'),'{}'),
 'bookings',jsonb_build_object(selected_day::text,coalesce((select jsonb_object_agg(id,data-'name'-'nt') from public.clinic_bookings where day=selected_day and(patient_phone is null or branch=(select branch from public.clinic_bookings where day=selected_day and phone=patient_phone limit 1))),'{}')));
$$;
revoke all on function public.clinic_read_day(date,text) from public,anon,authenticated;
grant execute on function public.clinic_read_day(date,text) to service_role;

create or replace function public.clinic_patient_history(patient_phone text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'settings',jsonb_build_object('branches',(select coalesce(data->'branches',data->'site'->'branches') from public.clinic_settings where id=true)),
 'bookings',coalesce((select jsonb_object_agg(day,rows) from(select day::text,jsonb_object_agg(id,jsonb_build_object('date',day,'no',ticket,'b',branch,'s',status,'phone',phone)) rows from public.clinic_bookings where phone=patient_phone group by day) q),'{}'));
$$;
revoke all on function public.clinic_patient_history(text) from public,anon,authenticated;
grant execute on function public.clinic_patient_history(text) to service_role;
