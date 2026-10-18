# Single-file Supabase dashboard deployment

`clinic-api.js` bundles the current `supabase/functions/clinic-api/index.js` and all of its relative imports. It contains no credentials or patient records. Its only external imports are Deno-supported Node built-ins.

To regenerate from source with Node/npm:

```sh
node scripts/build-edge-bundle.cjs
```

The script pins esbuild 0.25.10 and uses the existing npm cache configuration. On restricted cloud machines, an allowed temporary cache can be selected with `npm_config_cache=/tmp/clinic-npm-cache`.

In the Supabase dashboard for project `matkxrnobjdewhptybpj`, open Edge Functions → `clinic-api` → Code. Back up the existing entry file, then replace the entry file's entire contents (`index.js` or `index.ts`, whichever is configured) with the contents of `clinic-api.js` and deploy the update. The generated file is valid JavaScript in either extension. Keep the function's existing environment secrets and its existing `verify_jwt=false` configuration; the function validates protected requests itself while intentionally permitting public queue/settings requests. No secret values should be copied into the editor.

After deployment, open the administrator account and use Settings → «تحديث بيانات الحالات الافتراضية القديمة». This updates the persisted known sample records without reseeding or deleting the database. The latest frontend also attempts this upgrade automatically at administrator startup. Deploy the GitHub frontend changes through the normal Vercel workflow to obtain the latest queue controls and readable audit UI.

Local verification: the bundled handler was executed with mocked Auth/database services to verify public settings, rejection of an unauthenticated migration, authorized legacy profile migration, spouse data completion, and audit identity context. This is not verification of a live deployment or of the production database migrations.

Booking family metadata: the updated frontend checks `bookingCapabilities` before submitting spouse data. The updated service saves the booking and patient family fields in one transaction. An older service is detected before creating a partial booking; deploy this regenerated bundle together with the frontend. Existing spouse data cannot be overwritten without patient-edit permission. New registrations can include spouse fields through the secretary's booking permission.
