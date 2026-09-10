# Phase 4F — Offline GitHub quality gate

Date: 10 September 2026
Status: implemented and verified locally; not pushed and not executed by GitHub Actions.

## Result

The project now has a repository-native quality gate for the later GitHub transfer. It performs only local/static operations and does not authenticate to or call SharePoint, Microsoft Graph, an email provider or a deployment service.

The gate runs:

1. all `src/tests/*.test.cjs` suites through a cross-platform Node runner;
2. a TypeScript regression comparison against the preserved Phase 2B baseline;
3. the Vite production build.

The TypeScript comparison does not claim that the application is type-clean. It reads the structured baseline generated from the isolated staged strategy release candidate, permits resolved baseline errors and fails if the current compiler output introduces a new file/code/message combination. It also fails if TypeScript exits unsuccessfully without recognizable diagnostics. The older Phase 2B text evidence remains historical evidence because it was captured from the combined dirty working tree.

## Primary paths

- `.github/workflows/strategy-execution-quality.yml`
- `scripts/run-strategy-tests.mjs`
- `scripts/check-typescript-baseline.mjs`
- `docs/strategy-execution/handoff-evidence/phase4f-release-typecheck.json`

## Local validation

- Strategy/work-plan regression: **121/121 passed** across twelve suites.
- Isolated release-candidate TypeScript gate: **172 baseline / 172 current unique diagnostics; zero added and zero resolved**.
- Isolated release-candidate Vite build: **passed**, 5,502 modules transformed.
- Existing build warnings remain: stale Browserslist data, `next-themes` annotations, runtime LED font resolution, mixed static/dynamic imports and the large main chunk.

## Boundary

The quality gate does not inspect or mutate the production tenant. It does not create lists or columns, activate schedules, send email, deploy flows, import LIS data, push to GitHub or deploy the application. The production tenant-readiness inventory remains a separate release-time gate after the code has been reviewed and transferred.
