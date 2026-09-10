# Handoff evidence — through 10 September 2026

These are preserved local validation outputs from the completed implementation phases. They are copied from ignored workspace logs into this documentation folder so they travel with the handoff. They are not fresh tenant checks, deployment logs or source-document import results.

| File | Evidence |
|---|---|
| [Phase 2B tests](phase2b-tests.txt) | 37 focused Node tests passed; mocked Graph/method harnesses |
| [Phase 2B production build](phase2b-build.txt) | Successful Vite production build, with recorded warnings |
| [Phase 1 TypeScript baseline](phase1-typecheck.txt) | 233 existing app diagnostics at the Phase 1 checkpoint |
| [Phase 2B TypeScript result](phase2b-typecheck.txt) | 233 diagnostics; same normalized file/message set as Phase 1 |
| [Phase 4F isolated release baseline](phase4f-release-typecheck.json) | Structured primary TypeScript diagnostic baseline from the staged strategy-only candidate |
| [Phase 5 production scheduler readiness](phase5-production-scheduler-readiness.json) | Authenticated GET-only production list/column/ETag inventory and fail-closed findings |
| [File manifest](file-manifest.json) | Repository-relative paths, classification, byte sizes and SHA-256 fingerprints |

At packaging, both type-check logs contained 233 diagnostic lines and 165 distinct normalized file/message pairs. Comparing those sets after removing line/column coordinates found **zero added and zero removed pairs**. This establishes the recorded comparison, not a clean TypeScript project or a claim that every diagnostic is unique.

The original file manifest includes new/modified remediation files, the mixed-history App.tsx file, the unchanged calculation reference, current graph report, primary handoff/audit documents and the pre-transfer validation outputs. It deliberately excludes unrelated dirty files, credentials and generated build bundles. The Phase 5 readiness JSON is later evidence containing production list identity, URL, column metadata and Boolean ETag availability only; it contains no access token or list-item field values. Neither evidence file is a backup or complete inventory of the repository.

To verify an individual file after transfer, run from the received repository root in PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'src/services/workPlanActivationService.ts'
```

Compare the result to that file's entry in the manifest (hexadecimal letter case is immaterial). A mismatch can mean later legitimate development; inspect it before assuming the checkpoint is reproduced. New/untracked source files must be included in the transfer. Cloning the recorded HEAD alone omits the remediation.

The main handoff describes source-DOCX provenance, runtime requirements, known limits and continuation steps. The original DOCX and machine-local extracted JSON are not bundled here. No credentials or live browser data were copied into this evidence folder.
