BEGIN;
DO $$ DECLARE ip text='test-ip-'||gen_random_uuid()::text; p text='test-patient-'||gen_random_uuid()::text;i int;BEGIN
 FOR i IN 1..20 LOOP IF NOT public.clinic_lookup_budget(ip,p) THEN RAISE EXCEPTION 'normal patient requests rejected';END IF;END LOOP;
 IF public.clinic_lookup_budget(ip,p) THEN RAISE EXCEPTION 'single patient limit not enforced';END IF;
 FOR i IN 2..20 LOOP IF NOT public.clinic_lookup_budget(ip,p||i::text) THEN RAISE EXCEPTION 'shared Wi-Fi patient rejected';END IF;END LOOP;
 IF public.clinic_lookup_budget(ip,p||'21') THEN RAISE EXCEPTION 'enumeration limit not enforced';END IF;
END $$;
SELECT 'shared Wi-Fi accepted; per-patient and enumeration limits enforced; no test counters committed' AS result;
ROLLBACK;
