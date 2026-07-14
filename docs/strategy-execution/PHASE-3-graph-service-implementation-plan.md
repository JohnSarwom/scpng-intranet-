# Phase 3 — `StrategyExecutionGraphService` Implementation Plan

_Concrete build plan grounded in the current codebase (2026-07-01). Planning only —
no service code written yet. Companion to `03-phase-data-linkage-and-graph-service.md`._

---

## 0. Status recap — what already exists

The roadmap treats Phase 3 as greenfield. It is not:

- ✅ **All types are already written** — `src/types/strategyExecution.ts` contains
  `StrategyExecutionGraph`, every `*Node`, `StrategyExecutionLookups`,
  `LinkageDiagnostic`, `ProgressCalculationResult`, status bands, and the report
  interfaces. **We build the service against these as-is.**
- ✅ **Progress math exists** — `src/utils/kpiUtils.ts`
  (`calculateKpiProgress`, `calculateKraProgress`, `calculateStrategicProgress`,
  `calculateGoalProgressFromChildren`). We wrap, not rewrite, these.
- ✅ **Cascade logic exists but is trapped inline** — the `divisionHierarchy`
  useMemo in `Strategy.tsx:251-340` (division→unit→linkedDeliverable→objective,
  division remap, dynamic progress). This is the reference implementation to
  extract and generalize.
- ⬜ **The service file itself is absent** — `src/services/strategyExecutionGraphService.ts`.

So Phase 3 is really: **write one pure service that consumes the existing types and
existing fetched arrays, and produces the graph** — then point consumers at it.

---

## 1. Objective

Create one normalization + relationship service so Strategy, Unit, Reports, and
Analytics stop each rebuilding the cascade. It takes already-fetched records
(pure function, no fetching inside) and returns a `StrategyExecutionGraph`.

Design principle (from roadmap, kept): **the service does not fetch.** Existing
hooks fetch; the service normalizes.

---

## 2. Files

| File | Action | Purpose |
| --- | --- | --- |
| `src/services/strategyExecutionGraphService.ts` | **create** | Pure builder: `buildStrategyExecutionGraph(input)` + view selectors. |
| `src/types/strategyExecution.ts` | reuse | Already complete. Add small `GraphInput` type here or in the service. |
| `src/utils/kpiUtils.ts` | reuse (later wrap) | Progress source; wrapped into `ProgressCalculationResult`. |
| `src/hooks/useStrategyExecutionGraph.ts` | **create (step 2)** | Thin hook: pulls existing hooks' data, memoizes `buildStrategyExecutionGraph`. |
| `src/services/__tests__/strategyExecutionGraphService.test.ts` | **create** | Unit tests for the pure builder. |

---

## 3. Exact inputs (real hooks, real fields)

The service accepts one `GraphInput` object assembled from data these hooks
**already** return (see `Strategy.tsx:210-226`):

```ts
interface GraphInput {
  scope: ProgressScope;                 // caller declares scope; default 'corporate'
  // First-class strategy track (Strategic_* lists) via useStrategySharePoint()
  strategicGoals: StrategicGoal[];      // strategyData.objectives / goals
  strategicKras: StrategicKRA[];        // strategyData.strategicKRAs
  strategicInitiatives: StrategicInitiative[]; // strategyData.strategicInitiatives
  // Operational + seeded track
  unitObjectives: Objective[];          // useSharePointObjectives()  -> allUnitObjectives
  performanceKras: Kra[];               // useSharePointKRAs()         -> allKras
  kpis: Kpi[];                          // useSharePointKPIs()         -> allKpis
  tasks: Task[];                        // useSharePointOps task fetch (Operations_Tasks)
  // Structure
  divisionStructure: Record<string, string[]>; // strategyData.hierarchy || DEFAULT_ORG_STRUCTURE
}
```

Real linkage fields to resolve against (verified in `src/types/index.ts`):

| Node | Real field(s) used for parent link |
| --- | --- |
| `Objective` | `parentGoalId`, `parentGoalTitle`, `goalType` (`org`/`unit`/`strategic`/`board`), `linkedDeliverable`, `division`, `unit` |
| `Kra` (Performance) | `objective_id`, `unit`, `unitId`, `owner` |
| `Kpi` | `kra_id`, `initiative_id`, `weight`, `calculationType`, `checklist`, `reviewStatus` |
| `Task` | `kpi_id`, `kra_id`, `initiative_id`, `status`, `dueDate`, `completedAt`/`completionDate`, `attachments` |
| `StrategicKRA` | `goalId` |
| `StrategicInitiative` | `kraId`, `division`, `unit` |

---

## 4. The one hard problem: two-track top-of-cascade

There are **two representations** of Goal → Org KRA and they must be reconciled
(this is the roadmap's "duplicate KRA meanings"):

- **Track A (first-class lists):** `Strategic_Goals` → `Strategic_KRAs` (`goalId`)
  → `Strategic_Initiatives` (`kraId`).
- **Track B (seeded into `Unit_Objectives`):** objectives with `goalType='org'`
  act as goals; objectives with `goalType='unit'` + `linkedDeliverable` = goal
  title act as the bridge (per project memory / seed service).

**Decision needed from you (see §10):** which track is authoritative for the
Organisational KRA layer? Recommended default: **prefer Track A first-class
records when present; fall back to Track B seeded objectives; emit a
`legacy_text_only_link` diagnostic when only `linkedDeliverable` text connects a
node.** The service must not silently pick one and hide the other.

---

## 5. Build steps (bottom-up, pure functions)

Each is a small exported pure function so it is independently testable.

1. **Normalizers** — reuse `normalizeLookupId`/`normalizeLookupString` from
   `src/utils/sharePointLookupUtils.ts` for every id compare (already handles
   `none`/`null`/`nan`/empty). Add a `norm(id) => string|null` string-key helper
   for map lookups.
2. **Division/unit remap** — extract the `Executive Division → Office of the
   Chairman` / `Secretariat Unit` remap from `Strategy.tsx:284-295` into a shared
   `remapDivisionUnit()` so the graph and the page agree.
3. **Index maps** — build `Record<string, T[]>` children indexes once:
   kpisByKraId, tasksByKpiId, tasksByKraId, krasByObjectiveId,
   objectivesByGoalId, objectivesByDeliverableTitle (lowercased), initiativesByKraId.
4. **Leaf builders** — `buildTaskNode(task)`, then `buildKpiNode(kpi, tasks)`:
   set `calculationType`, attach task nodes, compute `evidenceCount`
   (attachments + completion + comments per Phase 7 evidence rules).
5. **Parent builders (bottom-up):** `buildPerformanceKraNode` (attach KPIs) →
   `buildObjectiveNode` (attach Performance KRAs) → `buildOrganisationalKraNode`
   → `buildStrategyGoalNode`. Each resolves children via the index maps using
   the priority rules in §6.
6. **Diagnostics generation** — while building, push `LinkageDiagnostic` for every
   orphan/broken/legacy case (types already enumerated in the roadmap's diagnostic
   union). Never force a weak link — record a diagnostic instead.
7. **Two views:**
   - `goals: StrategyGoalNode[]` — strategy-first (Goal→OrgKRA→Objective→KRA→KPI→Task).
   - `divisions: DivisionExecutionNode[]` — division-first, reusing the same node
     objects (Division→Unit→Objective→KRA→KPI→Task).
8. **Lookups** — flatten every node into `StrategyExecutionLookups.*ById` for O(1)
   modal/report access.
9. **Assemble** `StrategyExecutionGraph { generatedAt, scope, goals, divisions,
   lookups, diagnostics }`.

Public surface:

```ts
export function buildStrategyExecutionGraph(input: GraphInput): StrategyExecutionGraph;
export function selectStrategyFirst(graph): StrategyGoalNode[];
export function selectDivisionFirst(graph): DivisionExecutionNode[];
export function selectDiagnostics(graph, minSeverity?): LinkageDiagnostic[];
```

---

## 6. Relationship resolution priority (mapped to real fields)

Apply in order per link; first hit wins, else diagnostic:

1. **Explicit lookup id** — `norm(kpi.kra_id)`, `norm(kra.objective_id)`,
   `norm(task.kpi_id)`, `norm(objective.parentGoalId)`, `strategicKra.goalId`,
   `strategicInitiative.kraId`.
2. **Secondary id** — `task.kra_id` when `kpi_id` missing; `kpi.initiative_id`.
3. **Seeded bridge text** — `objective.linkedDeliverable` ↔ goal/OrgKRA title
   (lowercased, trimmed) — **flag as `legacy_text_only_link` (warning).**
4. **`parentGoalTitle`** text match — also `legacy_text_only_link`.
5. **No reliable link** → `LinkageDiagnostic` (`*_without_*`), node still emitted
   under an "Unlinked" bucket so it is visible, never silently dropped.

---

## 7. Progress integration (thin wrapper now, full engine = Phase 4)

To keep Phase 3 shippable without waiting on Phase 4, wrap existing math:

- `KpiNode.progress` ← `calculateKpiProgress(kpi, tasks)` boxed into a
  `ProgressCalculationResult` (set `source` from `calculationType`, `scope`,
  `hasLinkedData`, `childCount`, `calculatedAt`).
- `PerformanceKraNode.progress` ← `calculateKraProgress(kra, kpis)`.
- Objective/OrgKRA/Goal ← `calculateStrategicProgress` /
  `calculateGoalProgressFromChildren`.
- **Status band** helper here (cheap): `bandFor(value, hasLinkedData)` →
  `no_linked_data` (0 + no children) vs `not_started` (0 + children) vs
  `behind_or_early`/`in_progress`/`on_track`/`completed`. This alone kills the
  ambiguous-`0%` problem and is the seam Phase 4 later replaces wholesale.

Leave a `// Phase 4: replace with strategyProgressEngine` marker at the wrap points.

---

## 8. Wiring order (lowest risk first)

1. **Service + tests only** — no UI change. Verify against seeded data shape.
2. **`useStrategyExecutionGraph` hook** — assembles inputs from existing hooks.
3. **Read-only debug consumer first** — render `graph.diagnostics` + counts in
   Test Ground (`/test-ground`) to validate against real SharePoint data before
   touching user-facing pages.
4. **Strategy page** — replace the inline `divisionHierarchy` useMemo
   (`Strategy.tsx:251`) with `selectDivisionFirst(graph)`; keep the visual output
   identical first, then add counts/`0%` states (Phase 6).
5. **Reports** — feed `graph` into traceability rows (Phase 7).
6. **Analytics / Unit** — last, once parity is proven.

Do **not** rip out the inline logic until the debug consumer confirms the graph
reproduces the same hierarchy on live data.

---

## 9. Testing

Pure builder = easy to test. Cover:

- Full happy-path cascade (Goal→…→Task with evidence).
- Two-track reconciliation (Track A wins over Track B; diagnostic when only text).
- Orphans at each level → correct diagnostic type + node still surfaced.
- `none`/`null`/`NaN` lookup ids normalized (no crashes, no false links).
- Division remap (`Executive Division`→`Office of the Chairman`).
- `0% no_linked_data` vs `0% not_started` banding.
- Lookups contain every node exactly once.

---

## 10. Decisions I need from you

1. **Authoritative Org-KRA track** — prefer first-class `Strategic_*` lists, or
   the seeded `Unit_Objectives`? (Recommended: first-class, fallback to seeded.)
2. **Unlinked records** — surface under an explicit "Unlinked" bucket in the UI,
   or diagnostics-only? (Recommended: both — bucket + diagnostic.)
3. **Task hook** — confirm which hook the Strategy page will use to pass
   `tasks` (currently tasks are fetched on the Unit page via `useSharePointOps`);
   the graph needs the org-wide task set for corporate scope.

---

## 11. Acceptance criteria (from roadmap, restated as checks)

- [ ] `buildStrategyExecutionGraph` answers "what contributes to this goal?"
- [ ] Answers "which division/unit is behind?" (division-first view)
- [ ] Answers "which tasks are evidence for this KPI?" (KpiNode.tasks)
- [ ] Answers "which records are unlinked?" (diagnostics + Unlinked bucket)
- [ ] Strategy page consumes the graph instead of its own useMemo
- [ ] No consumer rebuilds parent/child relationships independently
- [ ] Broken links produce diagnostics, not silent `0%` / hidden rows

---

## 12. Effort estimate

| Chunk | Rough size |
| --- | --- |
| Service + normalizers + node builders + views | ~1–1.5 days |
| Diagnostics + two-track reconciliation | ~0.5 day |
| Progress wrapper + status bands | ~0.5 day |
| Tests | ~0.5 day |
| Hook + Test Ground debug consumer | ~0.5 day |
| Swap Strategy page to graph (parity) | ~0.5–1 day |

Foundation (service + tests + debug consumer) is ~2.5–3 days before any
user-facing page changes — deliberately front-loaded so the risky UI swap happens
against a proven graph.
