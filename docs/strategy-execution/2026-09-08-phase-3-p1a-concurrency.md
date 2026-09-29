# Phase 3 P1A — Concurrency and Cache Integrity

Date: 2026-09-08
Status: Implemented locally and checked with mocked Graph regressions; authenticated browser and live-tenant acceptance remain pending.

## Scope completed

- Task, KPI, KRA and Objective records now expose their SharePoint `eTag` as a `revision` value.
- General update paths read the current record, reject a supplied stale revision, and send `If-Match` on the write.
- General delete paths require a successful authoritative pre-read and use conditional deletion. Task deletion no longer continues when the relationship/version read fails.
- Graph `412`, `preconditionFailed` and ETag mismatch responses become explicit reload-and-review errors instead of opaque mutation failures.
- Automatic KPI, KRA and Objective progress writes are conditional. A derived rollup that loses a version race recomputes from current children once; a second conflict remains visible.
- KPI reparenting repairs Task ancestry conditionally. A conflicting Task edit is not silently overwritten.
- The strategic Objective editor and Strategy service carry the displayed revision through their separate update path.
- Task, KPI, KRA and Objective mutation hooks pass cached revisions and invalidate every dependent Task/KPI/KRA/Objective/Strategy query family in a `finally` path, including uncertain failures.
- Strategy-execution query functions now throw read errors to React Query rather than representing them as successful empty arrays.

## Local evidence

- Focused Node suites: 54 passed, 0 failed. Five P1A regressions cover stale-form rejection, conditional headers, clear 412 handling, guarded conditional deletion, one safe derived retry, strategic Objective concurrency and complete cache-family invalidation.
- Production Vite build: passed in 2m 1s with the existing chunk, dependency annotation, browsers-list and unresolved LED font warnings.
- TypeScript app check: 233 diagnostics, matching the inherited Phase 2B/P0 count. The touched operations service still has only its three recorded pre-existing file/message diagnostics.
- No live SharePoint mutation, schema preparation, migration, import, deployment or activation was performed.

## Operational contract

User-authored updates do not auto-merge after a conflict. The caller receives a reload-and-review error so a newer edit is not overwritten. Derived progress writes may retry once because they are recalculated from current child evidence and do not merge user-authored text.

The React Query invalidation runs after both success and failure. This is intentional: a primary SharePoint write can succeed even if a later cascade or network response fails, so every affected view must reconcile before presenting the outcome as current.

## Remaining Phase 3 work

- Graph conservation, orphan/cycle/duplicate diagnostics and real scope enforcement.
- Specialized measurement evidence for non-percentage targets, SLAs, recurrence, milestones and continuous/as-required work.
- Operator-facing retirement/reassignment with recoverable checkpoints and impact previews.
- Authenticated browser and tenant concurrency acceptance, including real ETag behavior and indexing delay.
