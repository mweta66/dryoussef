-- Branch membership is validated against the versioned clinic settings by the gateway.
ALTER TABLE public.clinic_bookings DROP CONSTRAINT IF EXISTS clinic_bookings_branch_check;
ALTER TABLE public.clinic_bookings ADD CONSTRAINT clinic_bookings_branch_check CHECK (branch ~ '^[a-z][a-z0-9-]{1,31}$' AND branch NOT IN ('all','presence','constructor','prototype'));
CREATE OR REPLACE FUNCTION public.clinic_read_day(selected_day date,patient_phone text default null)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('settings',jsonb_build_object(
 'avg',(select data->'avg' from public.clinic_settings where id=true),
 'branches',(select coalesce(data->'branches',data->'site'->'branches') from public.clinic_settings where id=true)),
 'sessions',coalesce((select jsonb_object_agg(key,data) from public.clinic_sessions where key like selected_day::text||'_%'),'{}'),
 'bookings',jsonb_build_object(selected_day::text,coalesce((select jsonb_object_agg(id,data-'name'-'nt') from public.clinic_bookings where day=selected_day and(patient_phone is null or branch=(select branch from public.clinic_bookings where day=selected_day and phone=patient_phone limit 1))),'{}')));
$$;
REVOKE ALL ON FUNCTION public.clinic_read_day(date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_read_day(date,text) TO service_role;
