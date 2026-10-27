# Isolated UI QA

Requires Node.js 22+, Playwright 1.62.1 (the version used is recorded in the report), and Chromium at `/usr/bin/chromium` or `CLINIC_QA_CHROMIUM`. These optional browser scripts are separate from `npm test`.

Run from the repository root:

```sh
node scripts/qa/prepare.cjs
CLINIC_DEMO_PORT=4427 node /tmp/clinic-full-qa/scripts/demo-server.cjs
```

In a second terminal, run one suite at a time:

```sh
node scripts/qa/screens.cjs
node scripts/qa/controls.cjs
node scripts/qa/actions.cjs
node scripts/qa/resilience.cjs
node scripts/qa/performance.cjs
```

Restart only this isolated server between suites to reset the local login limiter; do not disable rate limits. Each suite uses generated accounts, not production credentials. `prepare.cjs` creates the fixture report image. The default fixture path is `/tmp/clinic-full-qa`; the default evidence path is `/tmp/clinic-full-qa-evidence`. Override with `CLINIC_QA_ROOT` and `CLINIC_QA_OUTPUT`; never point either at production data. Preparation refuses a fixture root inside the source checkout.

Preparation copies the current application to a temporary directory and seeds 8 roles and 80 neutral cases across five dates. The scripts modify and delete **fixture data only**. No original `.demo`, `.private`, remote patient data or cloud projects are touched. Keep the server bound to loopback.

The browser engine is Chromium. Resizing is not a substitute for native iOS Safari, Android Chrome, Firefox or Edge validation. File-backed local timings do not measure Supabase capacity. Screens enumerate the available controls; not every one of those controls is exercised end to end. Unit tests and action/resilience suites cover additional transitions.

`controls.cjs` activates each representative non-navigation admin control. Destructive confirmation dialogs are deliberately cancelled; this is activation coverage, not a claim that every destructive action was executed through the UI. Dedicated unit and browser action tests verify selected confirmed operations.
