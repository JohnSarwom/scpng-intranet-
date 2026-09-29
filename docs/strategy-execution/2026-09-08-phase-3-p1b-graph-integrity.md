# Phase 3 P1B — Strategy Graph Integrity

Date: 2026-09-08
Status: Implemented locally and checked with pure graph regressions; authenticated tenant inventory and consumer parity acceptance remain pending.

## Scope completed

- The graph now conserves every included Performance record and Task. It returns explicit input, included, filtered, represented and conservation counts instead of relying on reachability as proof of completeness.
- Unmatched Performance records and Tasks remain available through flat exception collections. Orphan Tasks also remain in `tasksById`; they no longer disappear merely because their KPI/KRA link cannot be resolved.
- Missing and duplicate Goal, Performance-record and Task IDs receive collision-safe graph IDs and diagnostics. Duplicate source IDs cannot silently overwrite lookup entries.
- Parent cycles are detected before recursive construction. One deterministic edge is quarantined for rendering, every cycle member is diagnosed, and the original parent ID remains available for repair.
- Broken and duplicate parent links, ambiguous Task targets, and Tasks resolving through both KPI and KRA links are visible diagnostics. A dual-linked Task contributes once to the preferred KPI path rather than being duplicated.
- Personal, unit and division scopes require an explicit owner/unit/division context and fail closed when it is missing. Scoped graphs retain matching records plus only the ancestors needed to show traceability; filtered records are counted separately from omissions.
- The graph hook now sends the corresponding SharePoint filter scope/context, passes the same context into the pure graph builder and exposes upstream query errors.
- The legacy adapter retains KRA/KPI owner email, assignment provenance, division/unit metadata and KPI checklist evidence. Task assignee identity is no longer represented by creator email; creator provenance is stored separately.
- Role adjacency, assignment-owner disagreement and unit/division structure mismatch produce diagnostics for operator review.
- Checklist evidence is calculated at leaves. Direct Task/checklist evidence on a parent is retained and diagnosed without changing the existing child-rollup formula. No-data children no longer become false zero contributors in parent, unit, division or Goal averages.

## Local evidence

- Focused Node suites: 62 passed, 0 failed. This is the inherited 54 Phase 2B/P0/P1A checks plus eight P1B regressions covering orphan Tasks, cycles, duplicate Performance IDs, duplicate Task IDs, dual links, real unit scope, fail-closed missing scope and checklist/direct evidence.
- Production Vite build: passed with the existing chunk, dependency annotation, browsers-list and unresolved LED font warnings.
- TypeScript application check: 233 diagnostics, exactly matching the inherited baseline. No diagnostic names the P1B production files; the existing missing `vitest` module diagnostic still names the pre-existing TypeScript graph test.
- Authored-file diff check: passed; only line-ending conversion warnings were reported.
- Graphify refreshed through the documented Python 3.11 interpreter: 2,798 nodes, 3,233 edges and 635 communities.
- No live SharePoint read/write, schema preparation, migration, import, activation, deployment or formula-wide consumer replacement was performed.

## Operational contract

The graph distinguishes three outcomes: represented on a canonical path, represented in the exception collection with a diagnostic, or intentionally filtered by the requested scope. `integrity.isConserved` is true only when every included Performance record and Task has a graph representation.

Duplicate IDs and cycles are not auto-repaired. The graph creates collision-safe diagnostic representations and preserves source IDs so an operator can resolve the underlying records deliberately. Scoped views never fall back to corporate data when their required context is absent.

Direct evidence on a node that also has child records remains visible but does not silently change the inherited rollup formula. The specialized-measurement phase must decide how that evidence participates before any global formula replacement.

## Remaining Phase 3 work

- Specialized measurement evidence for counts, percentages, at-most time, populations/SLAs, recurrence, milestones and continuous/as-required work.
- Operator-facing retirement/reassignment with recoverable checkpoints, old/new parent impact previews and preserved Task evidence.
- Authenticated tenant inventory and browser acceptance for actual duplicates, orphans, cycles, canonical unit aliases, permissions and scoped query behavior.
- Consumer parity work before Strategy, Unit, Reports or Analytics replace their current formulas with the graph result.
