-- Shared clinic Wi-Fi can track multiple patients, while enumeration is bounded.
create table if not exists public.clinic_lookup_subjects(ip_key text not null,patient_key text not null,expires timestamptz not null,primary key(ip_key,patient_key));
create index if not exists clinic_lookup_subjects_expiry on public.clinic_lookup_subjects(expires);
alter table public.clinic_lookup_subjects enable row level security;
revoke all on public.clinic_lookup_subjects from public,anon,authenticated;
grant select,insert,update,delete on public.clinic_lookup_subjects to service_role;
create or replace function public.clinic_lookup_budget(ip_key text,patient_key text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n int;m int;subjects int;begin
 delete from public.clinic_lookup_limits where expires<now();delete from public.clinic_lookup_subjects where expires<now();
 insert into public.clinic_lookup_limits values(ip_key,1,now()+interval '2 minutes') on conflict(key) do update set count=clinic_lookup_limits.count+1 returning count into n;
 insert into public.clinic_lookup_subjects values(ip_key,patient_key,now()+interval '2 minutes') on conflict do nothing;
 select count(*) into subjects from public.clinic_lookup_subjects s where s.ip_key=clinic_lookup_budget.ip_key;
 insert into public.clinic_lookup_limits values(patient_key,1,now()+interval '2 minutes') on conflict(key) do update set count=clinic_lookup_limits.count+1 returning count into m;
 return n<=300 and m<=20 and subjects<=20;
end $$;
revoke all on function public.clinic_lookup_budget(text,text) from public,anon,authenticated;
grant execute on function public.clinic_lookup_budget(text,text) to service_role;
