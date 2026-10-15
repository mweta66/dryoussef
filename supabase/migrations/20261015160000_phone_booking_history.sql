-- Service-only indexed phone history. No identity or clinical content leaves this RPC.
create or replace function public.clinic_patient_history(patient_phone text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('bookings',coalesce((select jsonb_object_agg(day,rows) from(select day::text, jsonb_object_agg(id,jsonb_build_object('date',day,'no',ticket,'b',branch,'s',status,'phone',phone)) rows from public.clinic_bookings where phone=patient_phone group by day) q),'{}'));
$$;
revoke all on function public.clinic_patient_history(text) from public,anon,authenticated;
grant execute on function public.clinic_patient_history(text) to service_role;
