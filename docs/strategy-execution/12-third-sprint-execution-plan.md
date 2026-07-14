# Third Sprint Execution Plan

## Purpose

This file defines the third implementation sprint for the strategy execution program. Sprint 1 hardens backend writes and shared contracts. Sprint 2 builds the graph service, diagnostics, and progress calculation foundation. Sprint 3 starts wiring those outputs into visible user interfaces.

The goal is not a full redesign. The goal is to make the existing Strategy page, Division/Unit hierarchy, Unit KRA/KPI workspace, analytics, and first report preview surfaces consume the same graph and progress truth.

## Sprint Objective

Integrate the shared graph and progress engine into the first user-facing surfaces by:

- replacing local progress/count calculations where the shared model is ready,
- making `0% Not Started`, `0% No Linked Data`, and `Broken Linkage` visible,
- adding consistent status bands and scope labels,
- showing linked KRA/KPI/task counts,
- preserving the current UI layout where possible,
- and documenting any parity differences before report/export rewiring.

## Target Backlog Items

| Backlog ID | Priority | Sprint Treatment |
| --- | --- | --- |
| SE-401 | P1 | Wire Strategy cards to graph and progress engine |
| SE-402 | P1 | Make Strategy card KRAs clickable and traceable |
| SE-403 | P1 | Wire Division/Unit hierarchy rows to shared progress engine |
| SE-404 | P1 | Add linked KRA/KPI/task counts to Division and Unit rows |
| SE-405 | P1 | Add clear visual states for not started, no linked data, broken linkage, in progress, on track, and complete |
| SE-408 | P1 | Make KRA/KPI modal parent relationships explicit where low-risk |
| SE-501 | P1 | Begin graph-backed traceability report preview, without full report redesign |
| SE-502 | P1 | Begin Division/Unit heatmap parity checks against UI rows |
| SE-603 | P1 | Add browser/UI validation scenarios for Strategy cards, hierarchy rows, and KRA/KPI rows |
| SE-604 | P1 | Add first report validation scenarios for graph-backed previews |

## Primary Code Areas

| Area | Sprint Purpose |
| --- | --- |
| `src/pages/Strategy.tsx` | First executive consumer of graph/progress values for Strategic Goal cards and Division/Unit hierarchy |
| `src/components/strategy/StrategyAnalytics.tsx` | First analytics consumer of graph/progress values where safe |
| `src/components/strategy/analytics/DivisionalComparison.tsx` | Validate divisional chart values against shared Division progress |
| `src/components/unit-tabs/KRAsTab.tsx` | First Unit execution consumer for parent linkage visibility and progress consistency |
| `src/components/unit-tabs/ReportsTab.tsx` | First report preview parity consumer; full report rebuild comes later |
| `src/utils/strategyProgressUi.ts` | Suggested new helper for progress labels, colors, tooltips, and `0%` state mapping |
| `src/services/strategyExecutionGraphService.ts` | Source of graph projections and diagnostics from Sprint 2 |
| `src/utils/strategyProgressUtils.ts` | Source of progress calculation results from Sprint 2 |

## Integration Principles

### 1. Replace Calculations Gradually

Do not rewrite every surface in one sweep. Start with read-only display values:

- Strategic Goal card progress.
- Strategic Goal card counts.
- Division row progress.
- Unit row progress.
- KRA/KPI row progress where graph mapping is stable.
- Report preview totals used only for parity checks.

Acceptance:

- Each replaced value can be traced to a graph/progress result.
- Any value still using legacy logic is clearly marked in code or parity notes.

### 2. Keep Layout Stable

Sprint 3 should improve trust without destabilizing the whole frontend.

Acceptance:

- Existing Strategy page layout remains recognizable.
- Existing Division/Unit hierarchy remains in place.
- Existing KRA/KPI workflow still works.
- New labels, badges, counts, and warnings fit within current layout constraints.

### 3. Make Progress Explainable

Every progress-heavy surface should expose at least a short explanation.

Minimum explanation signals:

- percentage,
- status band,
- calculation source,
- linked child count,
- diagnostic/warning count where applicable.

Acceptance:

- Users can tell why a value is `0%`.
- Users can tell whether a value is calculated, cached, fallback, or missing data.

### 4. Keep Scope Visible

Scope must be shown wherever progress totals appear.

Recommended scope labels:

```text
Personal
Unit
Division
Corporate
Audit
```

Acceptance:

- Corporate views are not confused with role-filtered views.
- Report previews and analytics cards state their active scope.

### 5. Surface Diagnostics Without Overwhelming Users

Diagnostics should guide action, not flood the interface.

Recommended UI pattern:

- no diagnostics: quiet healthy state,
- info diagnostics: subtle indicator,
- warning diagnostics: visible warning badge,
- error diagnostics: clear warning with detail drawer or link.

Acceptance:

- Broken linkage is visible.
- Healthy records are not visually noisy.
- Diagnostic details are available when a user needs them.

## Proposed Implementation Order

### Step 1: Add Shared Progress UI Helper

Suggested location:

```text
src/utils/strategyProgressUi.ts
```

Suggested responsibilities:

- map `ProgressStatusBand` to display label,
- map status band to badge/progress-bar styling token,
- create short explanation text,
- map diagnostics to severity summary,
- distinguish `not_started`, `no_linked_data`, and `broken_linkage`.

Acceptance:

- Strategy, Reports, Analytics, and KRA/KPI screens can use the same display labels.
- No page invents its own status-band text.

### Step 2: Wire Strategy Cards To Shared Results

Target:

```text
src/pages/Strategy.tsx
```

Minimum display improvements:

- progress percentage from shared result,
- status band,
- KRA count,
- objective/initiative count,
- Performance KRA count,
- KPI count,
- task count,
- evidence/diagnostic health indicator,
- `0%` distinction.

Acceptance:

- Strategic Goal cards no longer show a plain unexplained `0%` when data is missing.
- Card counts match graph lookups.
- Existing card interactions continue to work.

### Step 3: Add Clickable KRA Trace Entry

Target:

```text
src/pages/Strategy.tsx
```

Initial behavior can be modest:

- clicking an Organisational KRA / Key Deliverable opens an existing detail area, drawer, modal, or expanded panel,
- the detail view shows the hierarchy path and linked counts,
- full evidence drawer can be deferred.

Acceptance:

- A user can inspect what sits underneath a Strategic Goal KRA.
- The visible hierarchy uses official naming.

### Step 4: Wire Division/Unit Rows

Target:

```text
src/pages/Strategy.tsx
```

Minimum display improvements:

- Division progress from shared progress result,
- Unit progress from shared progress result,
- status band,
- Unit count,
- objective count,
- Performance KRA count,
- KPI count,
- linked task count,
- overdue task count where available,
- diagnostics count.

Acceptance:

- Division and Unit progress values match graph/progress outputs.
- `0% Not Started` and `0% No Linked Data` are visibly distinct.
- Expanded rows still fit cleanly across desktop and smaller viewports.

### Step 5: Add KRA/KPI Row Consistency

Target:

```text
src/components/unit-tabs/KRAsTab.tsx
```

Minimum display improvements:

- parent objective shown for each Performance KRA where available,
- parent Performance KRA shown for each KPI where available,
- progress band labels match shared UI helper,
- task-completion KPIs show linked task count,
- missing parent links show diagnostics.

Acceptance:

- Unit users can see where each KRA/KPI belongs.
- KPI progress label matches Strategy and Report previews.
- Missing parent linkage is visible before reporting.

### Step 6: Add First Report Preview Parity

Target:

```text
src/components/unit-tabs/ReportsTab.tsx
```

Minimum report preview additions:

- scope banner,
- graph-calculated progress summary,
- diagnostic count,
- hierarchy row sample or compact traceability section,
- parity note when legacy report totals differ from graph totals.

Acceptance:

- Report preview can show the same progress values as Strategy page for the same scope/date.
- Full CSV/export rebuild is deferred to a later sprint.

### Step 7: Add Analytics Parity Checks

Targets:

```text
src/components/strategy/StrategyAnalytics.tsx
src/components/strategy/analytics/DivisionalComparison.tsx
```

Minimum analytics changes:

- compare chart values to shared progress results,
- avoid rendering missing data as normal zero-value bars,
- show scope/calculation source in tooltip or supporting text where appropriate.

Acceptance:

- Divisional comparison agrees with Division/Unit hierarchy.
- No-linked-data divisions are visually distinct from low-progress divisions.

### Step 8: Add UI Validation

Minimum scenarios:

- Strategy card with linked data and no progress shows `0% Not Started`.
- Strategy card with no child data shows `0% No Linked Data`.
- Strategy card with broken child link shows warning/diagnostic state.
- Division and Unit rows match report preview progress.
- KRA/KPI rows show parent linkage.
- Scope labels appear on progress-heavy surfaces.

Verification commands:

```bash
npm run test
npm run lint
npm run build
```

Use browser validation for the key Strategy and Unit screens after implementation.

## UI Copy Standards

Use consistent labels:

| Concept | Label |
| --- | --- |
| Strategy-level KRA | Organisational KRA / Key Deliverable |
| Unit execution KRA | Performance KRA |
| Valid zero progress | Not Started |
| Missing child data | No Linked Data |
| Invalid relationship | Broken Linkage |
| Progress from stored fallback | Cached/Fallback |
| Progress from shared engine | Calculated |

Do not shorten these labels in core workflow areas unless space is extremely constrained. Tooltips can explain the labels when space is tight.

## First UI Acceptance Scenario

Use this scenario as the minimum visible integration proof:

```text
Strategic Goal A
-> Organisational KRA A1
-> Unit Objective A1.1
-> Performance KRA A1.1.1
-> KPI A1.1.1.1
-> Task A1.1.1.1.a
```

Expected result:

- Strategy card for Goal A shows calculated progress and linked counts.
- The Organisational KRA row is clickable or expandable.
- Division/Unit row shows the same progress contribution.
- KRA/KPI row shows parent relationship and linked task count.
- Report preview summary matches the Strategy page progress for the same scope.
- Analytics do not disagree with the Division/Unit hierarchy.
- If the task is unlinked, the UI shows `No Linked Data` or `Broken Linkage` instead of an unexplained `0%`.

## Sprint 3 Acceptance Criteria

The sprint is complete when:

- Strategy cards consume graph/progress results for display values where available.
- Division/Unit hierarchy consumes graph/progress results for progress and counts.
- KRA/KPI rows show parent linkage and shared progress labels.
- Report preview has a graph-backed progress summary and diagnostics count.
- Analytics parity checks are documented or wired where safe.
- `0% Not Started`, `0% No Linked Data`, and `Broken Linkage` are distinct in UI.
- Scope labels appear on progress-heavy surfaces.
- Existing create/edit workflows are not broken.
- `npm run test`, `npm run lint`, and `npm run build` pass or documented failures are triaged.
- Browser validation confirms the key Strategy and Unit views render cleanly.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| UI receives incomplete graph data | Add fallback states and diagnostic indicators instead of hiding data |
| Existing page calculations still disagree | Keep parity notes and replace calculations incrementally |
| Too many warnings make executive cards noisy | Show summary warning badges with drill-down details |
| Progress labels do not fit compact rows | Use short label plus tooltip while preserving semantic meaning |
| Scope is unclear to users | Put scope labels near report/card headers, not buried in tooltips |
| Changes accidentally alter create/edit behavior | Keep Sprint 3 primarily read-only display integration |

## Out Of Scope For Sprint 3

- Full task modal cascade selector implementation.
- Full KRA/KPI modal redesign.
- Full traceability report export.
- Scheduled report lifecycle redesign.
- Admin/audit governance dashboard.
- Production data migration or cleanup.
- Major visual restyling unrelated to graph/progress integration.

## Handoff Notes For Sprint 4

Sprint 4 should move from display integration into workflow integration:

- Task modal cascade selectors,
- strategic breadcrumb before task save,
- KRA/KPI modal parent validation,
- destructive action warnings,
- and stronger save-time prevention of orphaned strategy execution records.

Sprint 4 should use Sprint 3's UI helpers and graph outputs rather than creating new local selector/filter logic.
