-- Apply to a dedicated clinic project. Browser access is denied; the Edge API
-- checks fresh roles and permissions before every operation.
create table if not exists public.clinic_state (
 id boolean primary key default true check (id),
 version bigint not null default 0,
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object')
);
create table if not exists public.clinic_lookup_limits (
 key text primary key, count integer not null, expires timestamptz not null
);
create index if not exists clinic_lookup_limits_expires_idx on public.clinic_lookup_limits(expires);
alter table public.clinic_state enable row level security;
alter table public.clinic_lookup_limits enable row level security;
revoke all on public.clinic_state, public.clinic_lookup_limits from public, anon, authenticated;
grant select,insert,update,delete on public.clinic_state, public.clinic_lookup_limits to service_role;
insert into public.clinic_state(id) values(true) on conflict do nothing;

create or replace function public.clinic_compare_and_swap(expected_version bigint,next_payload jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(next_payload)<>'object' then raise exception 'Invalid state'; end if;
 update public.clinic_state set payload=next_payload,version=version+1 where id=true and version=expected_version;
 return found;
end $$;

create or replace function public.clinic_lookup_slot(rate_key text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 delete from public.clinic_lookup_limits where expires<now();
 insert into public.clinic_lookup_limits(key,count,expires) values(rate_key,1,now()+interval '2 minutes')
 on conflict(key) do update set count=public.clinic_lookup_limits.count+1 returning count into n;
 return n<=20;
end $$;

-- Only the server service role receives the minimum session privileges.
grant usage on schema auth to service_role;
grant select,delete on auth.sessions to service_role;
create or replace function public.clinic_session_active(session_uuid uuid,user_uuid uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from auth.sessions where id=session_uuid and user_id=user_uuid and (not_after is null or not_after>now()));
$$;
create or replace function public.clinic_revoke_sessions(user_uuid uuid)
returns void language sql security invoker set search_path='' as $$
 delete from auth.sessions where user_id=user_uuid;
$$;
revoke all on function public.clinic_compare_and_swap(bigint,jsonb),public.clinic_lookup_slot(text),public.clinic_session_active(uuid,uuid),public.clinic_revoke_sessions(uuid) from public,anon,authenticated;
grant execute on function public.clinic_compare_and_swap(bigint,jsonb),public.clinic_lookup_slot(text),public.clinic_session_active(uuid,uuid),public.clinic_revoke_sessions(uuid) to service_role;
