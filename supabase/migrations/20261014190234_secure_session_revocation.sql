-- Only the trusted Edge service may revoke sessions. Do not grant browser roles access.
create or replace function public.clinic_revoke_sessions(user_uuid uuid)
returns void language sql security definer set search_path='' as $$
 delete from auth.sessions where user_id=user_uuid;
$$;
alter function public.clinic_revoke_sessions(uuid) owner to postgres;
revoke all on function public.clinic_revoke_sessions(uuid) from public,anon,authenticated;
grant execute on function public.clinic_revoke_sessions(uuid) to service_role;
revoke delete on auth.sessions from service_role;
