const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const names=['20261031120000_patient_identity_pagination.sql','20261031123000_operational_delta_receipts.sql','20261031124500_clinical_workflow_slice.sql'];
const preflight=`-- Clinical workflow release 2026.11.01.1: three migrations, one atomic transaction.
-- Run as the database owner in Supabase SQL Editor, after saving a backup.
-- Does not generate, delete, or replace clinic patient records or attachments.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';
do $$
declare missing text; relation_name text;
begin
 foreach relation_name in array array['clinic_state','clinic_patients','clinic_bookings','clinic_files','clinic_complaints','clinic_roles','clinic_settings','clinic_misc','clinic_sessions'] loop
  if to_regclass('public.'||relation_name) is null then missing=concat_ws(', ',missing,relation_name);end if;
 end loop;
 if missing is not null then raise exception 'Missing prerequisite tables: %. Stop and apply prerequisite migrations first.',missing;end if;
 if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.clinic_state'::regclass and tgname='clinic_projection' and not tgisinternal and tgenabled in ('O','A')) then
  raise exception 'Missing active clinic_projection trigger. Stop and check prerequisite migrations.';
 end if;
 if not exists(select 1 from public.clinic_state where id=true) then raise exception 'Clinic state is not initialized. Stop and check existing setup.';end if;
end $$;
`;
const content=preflight+names.map(name=>'\n-- Source: '+name+'\n'+fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8').trim()+'\n').join('')+"\ncommit;\nselect 'Clinic database update 2026.11.01.1 completed' as result;\n";
fs.writeFileSync(path.join(root,'deployment/clinical-workflow-upgrade.sql'),content);
console.log('Generated one transactional clinical workflow SQL bundle.');
