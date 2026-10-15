BEGIN;
CREATE TEMP TABLE restore_bookings (LIKE public.clinic_bookings INCLUDING ALL) ON COMMIT DROP;
CREATE TEMP TABLE restore_files (LIKE public.clinic_files INCLUDING ALL) ON COMMIT DROP;
CREATE TEMP TABLE restore_roles (LIKE public.clinic_roles INCLUDING ALL) ON COMMIT DROP;
CREATE TEMP TABLE restore_patients (LIKE public.clinic_patients INCLUDING ALL) ON COMMIT DROP;
DO $$ DECLARE p jsonb;expected_hash text;BEGIN
 SELECT payload,checksum INTO p,expected_hash FROM public.clinic_backups ORDER BY created_at DESC LIMIT 1;
 IF p IS NULL OR md5(p::text)<>expected_hash THEN RAISE EXCEPTION 'backup checksum invalid';END IF;
 INSERT INTO restore_bookings SELECT r.key,(r.value->>'date')::date,r.value->>'b',r.value->>'phone',(r.value->>'no')::int,r.value->>'s',r.value FROM jsonb_each(p->'bookings') d CROSS JOIN LATERAL jsonb_each(d.value) r;
 INSERT INTO restore_files SELECT key,value FROM jsonb_each(p->'files');
 INSERT INTO restore_patients SELECT key,value FROM jsonb_each(p->'patients');
 INSERT INTO restore_roles SELECT key,value FROM jsonb_each(p->'roles');
 IF (SELECT jsonb_object_agg(phone,data) FROM restore_files) IS DISTINCT FROM p->'files' THEN RAISE EXCEPTION 'medical restore mismatch';END IF;
 IF (SELECT jsonb_object_agg(uid,data) FROM restore_roles) IS DISTINCT FROM p->'roles' THEN RAISE EXCEPTION 'role restore mismatch';END IF;
END $$;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT (SELECT count(*) FROM restore_bookings) AS restored_bookings,(SELECT count(*) FROM restore_files) AS restored_medical_files,(SELECT count(*) FROM restore_patients) AS restored_patients,(SELECT count(*) FROM restore_roles) AS restored_roles;
ROLLBACK;
