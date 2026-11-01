# Single-file Supabase dashboard deployment

`clinic-api.js` bundles the current `supabase/functions/clinic-api/index.js` and all of its relative imports. It contains no credentials or patient records. Its only external imports are Deno-supported Node built-ins.

To regenerate from source with Node/npm:

```sh
node scripts/build-edge-bundle.cjs
```

The script pins esbuild 0.25.10 and uses the existing npm cache configuration. On restricted cloud machines, an allowed temporary cache can be selected with `npm_config_cache=/tmp/clinic-npm-cache`.

The build also regenerates `supabase/functions/clinic-api/training-assignment.js` from its Node source with its 500-entry training branch map embedded. Uploading just the Edge function directory therefore no longer requires a `../../../fixtures` directory outside the deployed root. No training records are inserted or changed by this packaging step.

The generated dashboard bundle starts with `// CLINIC_API_BUNDLE_START 2026.11.01.3` and ends with `// CLINIC_API_BUNDLE_END 2026.11.01.3`. The version follows `clinic-release.json`. These markers help verify a complete copy in the dashboard editor.

If the dashboard reports `Module not found file:///fixtures/training-branch-assignments-500.json` in `training-assignment.js`, replace that file's entire contents with the current [self-contained source](../supabase/functions/clinic-api/training-assignment.js), then replace the configured entry file with the current `deployment/clinic-api.js` and confirm both bundle markers before deploying. Keep the existing files and hosted secrets. This addresses the missing source dependency without manually creating paths outside the function directory.

Local regression: `node --test tests/edge-dashboard-package.test.cjs tests/training-assignment.test.cjs`. It runs the Edge source directory with no fixtures directory and the generated bundle alone in an empty directory, using a mocked Deno entry/HTTP provider under Node. Public settings, unauthenticated rejection, authenticated release metadata, and execution of the embedded training map are verified. This does not claim a live Supabase or actual Deno deployment test.

In the Supabase dashboard for project `matkxrnobjdewhptybpj`, open Edge Functions → `clinic-api` → Code. Back up the existing entry file, then replace the entry file's entire contents (`index.js` or `index.ts`, whichever is configured) with the contents of `clinic-api.js` and deploy the update. The generated file is valid JavaScript in either extension. Keep the function's existing environment secrets and its existing `verify_jwt=false` configuration; the function validates protected requests itself while intentionally permitting public queue/settings requests. No secret values should be copied into the editor.

For release `2026.11.01.1`, follow the coordinated migration → gateway → frontend checklist in [the clinical workflow report](../docs/clinical-workflow-upgrade-ar.md). Apply the three new SQL migrations after their prerequisites, publish the gateway, then release the matching frontend. Verify both versions and acknowledged reads/writes from administrator diagnostics before use. Training-data upgrade/delete controls are separate administrator operations, not a required deployment step.

Local verification: the bundled handler was executed with mocked Auth/database services to verify public settings, rejection of an unauthenticated migration, authorized legacy profile migration, spouse data completion, and audit identity context. This is not verification of a live deployment or of the production database migrations.

Booking family metadata: the updated frontend checks `bookingCapabilities` before submitting spouse data. The updated service saves the booking and patient family fields in one transaction. An older service is detected before creating a partial booking; deploy this regenerated bundle together with the frontend. Existing spouse data cannot be overwritten without patient-edit permission. New registrations can include spouse fields through the secretary's booking permission.

For the patient-deletion fixes in `2026.11.01.2`, see [the action audit and deployment checklist](../docs/action-audit-2026-11-01-ar.md). This fix adds no new SQL migration beyond the earlier clinical-workflow prerequisites; publish the updated gateway and matching frontend.

Release `2026.11.01.3` adds the owner-authorized secretary clinical read permissions. After deploying the matching gateway and frontend, sign in once as administrator to apply the one-time persisted grants. No new SQL migration is required for this change. See [the secretary access notes](../docs/secretary-clinical-read-ar.md).
