-- Event trigger remains owned and callable by its owner, but is not a browser API.
DO $$ BEGIN
 IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
 END IF;
END $$;
