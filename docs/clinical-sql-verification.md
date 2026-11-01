# Clinical SQL migration verification

The new migrations were executed against **real PostgreSQL 17.6**, in an isolated Docker container, using the existing clinical projection trigger and tables. This is not a Supabase production verification and does not exercise Supabase Auth or Storage.

Run explicitly from the repository root, with the managed local Docker daemon available:

```sh
node scripts/qa/verify-clinical-sql.cjs --output /tmp/clinical-sql-result.json
node --test tests/operational-adapter.test.cjs tests/upstream.test.cjs
```

The SQL script starts `postgres:17.6-alpine` with `--network none`, without published ports, creates only generated test data, and removes its own container when finished. It never uses an existing clinic database or production credentials. Docker endpoint overrides are cleared for the managed local socket; registry/CA configuration remains unchanged. The image must be available or pullable through the environment's supported Docker network policy.

The validated SQL fixture includes the actual `clinic_projection` / `clinic_sync_records` definitions from the existing migration, configurable branch constraints, service-role grants and RLS, and the three migrations below. Each new migration is applied twice to verify repeatability:

- `20261031120000_patient_identity_pagination.sql`
- `20261031123000_operational_delta_receipts.sql`
- `20261031124500_clinical_workflow_slice.sql`

Latest isolated run: **47 assertions passed**. Coverage includes:

- direct browser roles cannot call the privileged search/snapshot/receipt RPCs or read the receipt table;
- branch-scoped users cannot read another branch; a malformed branch-scoped account without a branch fails closed;
- disabled accounts and invalid/null page sizes are rejected;
- Arabic/Persian digits, international Egyptian phone notation, Arabic letter folding, NFKC and repeated-space search normalization;
- wildcard characters in a search are literal, and paginated results remain bounded;
- ambiguous duplicate patient IDs are rejected instead of selecting the first clinical file;
- nurse and limited staff history excludes medical fields they cannot read, and report results omit private storage keys and embedded data;
- selected-patient sliced reads include the new workflow roots and filter patient/clinical-visit records;
- operational snapshots exclude the existing audit/trash archives;
- a delta CAS preserves old archive entries, appends new entries, and updates the existing booking/patient projections;
- stale versions, duplicate/reused receipt keys, invalid archive replacement and unsafe paths do not change canonical state;
- the real JavaScript adapter sends a delta into PostgreSQL, experiences a simulated lost response **after actual SQL commit**, then proves the result by reading the receipt without sending a second write.

The separate adapter/upstream tests cover valid nullable receipt responses versus malformed JSON, narrow missing-RPC fallback, and actionable status classification for permission/validation/missing-record/conflict SQL errors.

## Single-file deployment variant

`deployment/clinical-workflow-upgrade.sql` combines the exact three migrations in one transaction, with prerequisite checks and finite lock/statement timeouts. Regenerate with `node scripts/build-clinical-sql.cjs`. Verify with `node scripts/qa/verify-clinical-sql.cjs --deployment-bundle`. Its isolated PostgreSQL run passed **49 assertions**, including rejection when the projection trigger is disabled, repeat application, and unchanged canonical patient payload/version. Evidence: [combined-sql-verification.json](qa-clinical-upgrade-2026-11-01/combined-sql-verification.json).

## Limits

The delta RPC reduces archive transfer and request payloads and preserves canonical archives atomically. It **does not physically split all archives into separate tables**, and the existing projection trigger still examines the canonical JSON payload internally. These checks do not establish O(1) SQL cost, production capacity, network reliability, or deployment readiness.

Legacy fallback is used only for a missing PostgREST RPC (`404` / `PGRST202`). Old databases without the new receipt migration do not gain SQL receipt reconciliation merely because the adapter method exists. Production readiness still requires applying migrations, publishing the gateway, and verifying the actual provider's authentication, storage and service-role configuration.
