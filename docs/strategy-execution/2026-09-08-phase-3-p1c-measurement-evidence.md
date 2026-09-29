# Phase 3 P1C — Specialized Measurement Evidence

Date: 2026-09-08
Status: Implemented locally and checked with pure measurement regressions; tenant schema preparation, authenticated evidence entry and consumer migration remain pending.

## Scope completed

- Added explicit KPI measurement definitions for counts, percentages, at-most duration, population coverage, service levels, recurrence, milestones, continuous obligations and as-required work. Definitions retain the original target wording plus only explicitly normalized target, operator, unit, population, frequency, service window, time allowance and milestone window values.
- Added dated measurement evidence with reporting-window boundaries, as-of date, actuals, eligible/compliant populations, required/completed occurrences, duration observations, milestone states and evidence references.
- Graph progress now exposes both target attainment and its underlying measured result. For example, 90% actual against a 95% threshold is kept as 90% actual with 95% rounded target attainment; the two values are not conflated.
- Population and service-level modes use compliant/eligible evidence. At-most duration uses the proportion of observations meeting the allowance. Recurrence uses completed/required occurrences. Milestones support explicit weights and overdue warnings.
- Continuous and as-required modes require a real reporting-window denominator. No demand or no scheduled occurrences returns `no_linked_data`, not a fabricated 100%.
- Specialized measurement is evaluated before explicit KPI status. A completed Task or cached completed status cannot prove population, service-level, recurrence or milestone attainment. Linked Tasks remain visible as supporting records and generate an explanatory warning when present.
- Missing reporting windows, missing denominators, absent targets and impossible evidence values fail closed with graph diagnostics. Invalid/no-evidence nodes are excluded from parent averages instead of becoming false zero contributors.
- Direct specialized evidence on a parent with child records is preserved and diagnosed, while the inherited child rollup remains unchanged.
- Source activation writes a normalized definition to `MeasurementDefinitionJSON` while retaining full work-plan source metadata. `MeasurementEvidenceJSON` is versioned through ordinary KPI reads/updates. Both are multiline fields in the explicit readiness/schema-preparation contract.
- The existing work-plan linkage dialog now allows an operator to confirm a measurement mode, population, frequency/service level, time allowance and milestone window without changing the surrounding screen layout.

## Calculation contract

| Mode | Evidence rule |
|---|---|
| Count | Dated actual divided by an explicit positive target; at-most targets reverse the ratio only when the cap is exceeded. |
| Percentage | Dated actual percentage divided by the explicit target percentage; actual performance remains separately visible. |
| Population / service level | Compliant or covered cases divided by eligible cases, then compared with the explicit percentage target. |
| At-most duration | Percentage of dated observations at or below the explicit allowance; a single aggregate observation is pass/fail rather than an invented proportional penalty. |
| Recurrence | Completed occurrences divided by required occurrences for the reporting window. |
| Milestone | Completed milestone count or explicit positive milestone weights divided by the full milestone denominator. |
| Continuous / as required | Same occurrence evidence rule when demand exists; a zero or missing denominator remains unscored. |

All specialized evidence requires `windowStart`, `windowEnd` and `asOf`. The original raw target is mandatory. Evidence and definitions are additive; legacy `CalculationType`, `TargetValue`, `ActualValue`, status and organizational percentage fields are not overwritten by this graph calculation.

## Local evidence

- Focused Node suites: 73 passed, 0 failed. This is the inherited 62 checks plus eleven P1C regressions covering count, percentage, population/service-level evidence, at-most observations, recurrence, weighted milestones, continuous/as-required zero demand, invalid evidence, direct parent evidence and KPI JSON round trips.
- Production Vite build: passed with the inherited browsers-list, dependency annotation, chunking and unresolved LED font warnings.
- TypeScript application check: 233 diagnostics, matching the inherited diagnostic baseline. No new diagnostic file/message pair was introduced and no diagnostic names the P1C graph, activation, dialog or type files.
- Authored-file diff check: passed; only inherited line-ending conversion warnings were reported.
- Graphify refreshed: 2,801 nodes, 3,240 edges and 635 communities.
- No live SharePoint read/write, schema preparation, evidence entry, migration, activation, deployment or consumer/formula replacement was performed.

## Operational boundary

The graph can now calculate specialized evidence supplied to it, and the SharePoint adapter can preserve that evidence. Existing Strategy, Home, Unit, Division, Reports and Analytics consumers have not been switched to these graph values. Their current percentage behavior therefore remains the compatibility baseline until Phase 4 parity and tenant baseline review.

Schema preparation is an explicit administrator operation. Existing tenants must add and verify `MeasurementDefinitionJSON` and `MeasurementEvidenceJSON` before source-aware activation or evidence writes. This local implementation did not perform that operation.

## Remaining Phase 3 work

- Operator-facing retirement/reassignment with recoverable checkpoints, old/new parent impact previews and preserved Task and measurement evidence.
- Authenticated tenant inventory and browser acceptance for schema, real evidence records, duplicates, orphans, cycles, aliases, permissions and scoped queries.
- Consumer parity work before any production screen, report, export or AI context replaces its current formula with graph results.
