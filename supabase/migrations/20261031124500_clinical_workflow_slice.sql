-- Service-only projected reads; an entity limits patient medical data to the selected phone.
create or replace function public.clinic_read_slice(fields text[],selected_day date default null,entity text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb='{}';k text;v jsonb;
begin
 foreach k in array fields loop
  v='{}';
  case k
   when 'settings' then select data into v from public.clinic_settings where id=true;
   when 'roles' then select jsonb_object_agg(uid,data) into v from public.clinic_roles;
   when 'patients' then select jsonb_object_agg(phone,data) into v from public.clinic_patients where entity is null or phone=entity;
   when 'files' then select jsonb_object_agg(phone,data) into v from public.clinic_files where entity is null or phone=entity;
   when 'followupFiles' then select jsonb_object_agg(phone,jsonb_build_object('followUp',data->'followUp','followUpBranch',data->'followUpBranch')) into v from public.clinic_files where coalesce(data->>'followUp','')<>'';
   when 'sessions' then select jsonb_object_agg(key,data) into v from public.clinic_sessions;
   when 'complaints' then select jsonb_object_agg(phone,rows) into v from(select phone,jsonb_object_agg(id,data) rows from public.clinic_complaints where entity is null or phone=entity group by phone) q;
   when 'bookings' then select jsonb_object_agg(day::text,rows) into v from(select day,jsonb_object_agg(id,data) rows from public.clinic_bookings where selected_day is null or day=selected_day group by day) q;
   when 'clinicalVisits' then select coalesce(jsonb_object_agg(x.key,x.value),'{}') into v from public.clinic_misc m cross join lateral jsonb_each(m.data) x where m.key='clinicalVisits' and (entity is null or x.value->>'phone'=entity);
   else select data into v from public.clinic_misc where key=k and k in ('sequences','deletedBookings','followups','inbox','audit','checkins','urgentReviews','followupPlans','bookingContacts','patientIdentities','patientPhoneIndex','recordProvenance','appointmentRequests','clinicalVisits','waitingList','slotOpenings','dayClosures');
  end case;
  result=result||jsonb_build_object(case when k='followupFiles' then 'files' else k end,coalesce(v,case when k='audit' then '[]'::jsonb else '{}'::jsonb end));
 end loop;return result;
end $$;
revoke all on function public.clinic_read_slice(text[],date,text) from public,anon,authenticated;
grant execute on function public.clinic_read_slice(text[],date,text) to service_role;
