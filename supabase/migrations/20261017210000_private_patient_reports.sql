-- Private patient images. Only the server's service role accesses these objects.
-- No anonymous/authenticated storage policy is granted; the clinic API checks
-- the current user's role and patient scope before returning a 60-second URL.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('clinic-patient-reports','clinic-patient-reports',false,600000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
