-- Existing report storage stays private; authenticated clinic-api enforces role and branch access.
update storage.buckets
set public = false,
    file_size_limit = 5000000,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
where id = 'clinic-patient-reports';
