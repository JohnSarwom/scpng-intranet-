# Strategy Execution Roadmap — Implementation Status Checklist

_Verified against the codebase on 2026-07-01. Maps each roadmap phase to concrete
**Done / Partial / Not started** status with file evidence._

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started

> **Headline:** The roadmap is a forward-looking design. The *foundations* it needs
> already exist (cascade shape, a mostly-shared progress util, KRA/KPI creation with
> parent linkage, lookup normalization, KPI parent-move recalc). The *target model*
> — one graph service, unambiguous `0%` states, traceability reporting, diagnostics,
> explicit scope — is largely not built yet. This matches the roadmap's own Phase 1
> claim: "the system is close, but not consistent."

---

## Phase 1 — Current State Audit ✅ Done (as a doc deliverable)

The audit doc exists and accurately describes the code. No code deliverable required.

- ✅ List inventory, relationship map, surface map documented — `01-phase-current-state-audit.md`
- ✅ Strategy/Task Registry surfaces confirmed: `/strategy` → `Strategy.tsx`; `/unit` "Task Registry" → `Unit.tsx` ([navItems.ts:49,58](../../src/config/navItems.ts))

---

## Phase 2 — Target Strategy Execution Model 🟡 Partial (model revised 2026-07-02)

> **Model revision:** the cascade is now **role-recursive** with KRA/KPI duality —
> see [PHASE-2-REVISION-role-based-cascade.md](PHASE-2-REVISION-role-based-cascade.md).
> Decision locked: one record, role-derived label. This supersedes the fixed
> "Level Definitions" below.

Two-level KRA concept exists in data, but the naming standard is **not** applied in the UI.

- 🟡 Two KRA levels exist in data via `goalType` (`org`/`unit`) — `Strategy.tsx:272`, seed service
- ⬜ Naming standard not applied: UI still says generic "KRA", not "Organisational KRA / Key Deliverable" vs "Performance KRA" ([KpiModal.tsx:329](../../src/components/kpi/KpiModal.tsx))
- ⬜ Traceability rules (every KPI→KRA, KRA→Objective, etc.) not enforced or diagnosed
- ⬜ Scope modes (personal/unit/division/corporate/audit) not modeled in code

---

## Phase 3 — Data Linkage and Graph Service 🟡 Partial (role-recursive service built 2026-07-02)

Pure service + hook + tests exist and are **role-recursive** (Phase 2 revision).
Builds the tree by recursing `parentId`, rooted at Strategic Goals, Tasks as leaves.

- ✅ `src/services/strategyExecutionGraphService.ts` — **recursive `parentId` builder**,
  KRA/KPI duality (`performanceLabel`), officer hard-stop diagnostic, weighted rollup,
  status bands, orphan/broken-link diagnostics, division-first view, lookups
- ✅ `legacyToPerformanceRecords()` adapter — maps the current 3 lists into unified
  records (namespaced ids, inferred roles) so nothing breaks pre-migration
- ✅ `src/hooks/useStrategyExecutionGraph.ts` — assembles inputs from existing hooks
- ✅ `src/tests/strategyExecutionGraphService.test.ts` — **12 tests passing, 0 TS errors**
- ✅ Linkage via `parentId` (no `linkedDeliverable` text-fallback)
- ✅ Test Ground read-only debug consumer — `src/components/strategy/StrategyGraphDebugPanel.tsx`
  (wired into `TestGround.tsx`; strategy-first tree, division rollups, diagnostics)
- ⬜ Not yet wired into Strategy page (inline `divisionHierarchy` useMemo still live — [Strategy.tsx:251](../../src/pages/Strategy.tsx))
- ⬜ SharePoint role/parent columns + data migration (records still role-inferred)

---

## Phase 4 — Progress Percentage Engine 🟡 Partial

A shared calc util exists and is reused; the result-object / status-band model does not.

- ✅ Shared progress functions in [kpiUtils.ts:10-111](../../src/utils/kpiUtils.ts): `calculateKpiProgress`, `calculateKraProgress`, `calculateStrategicProgress`
- ✅ Reused across Strategy, KRAsTab, OverviewTab, seed service (one util, not per-component copies)
- ✅ Three KPI calc modes present: manual / checklist / task-completion — `kpiUtils.ts:18-41`
- ✅ Weighted KPI rollup present — `kpiUtils.ts:72-76`
- ⬜ No `ProgressCalculationResult` (value + source + explanation + scope + timestamp)
- ⬜ No status bands; `0%` is ambiguous — returns `0` for both "no data" and "not started" (`kpiUtils.ts:96`)
- ⬜ No `no_linked_data` vs `not_started` vs `broken_linkage` distinction
- ⬜ `src/utils/strategyProgressEngine.ts` — absent

---

## Phase 5 — Backend Hardening 🟡 Partial (more done than the docs assume)

- ✅ **Linkage normalization** — `normalizeLookupId` / `normalizeLookupNumber` / `normalizeLookupString` handle `''`, `none`, `null`, `undefined`, `nan` → `null` ([sharePointLookupUtils.ts](../../src/utils/sharePointLookupUtils.ts)), applied to KRA/KPI/task writes (`sharePointOpsService.ts:623,719,1234,1300`)
- ✅ **KPI parent-move recalc** — updates `RelatedKRALookupId`, resyncs **old and new** parent KRA ([sharePointOpsService.ts:1285-1330](../../src/services/sharePointOpsService.ts))
- 🟡 Status alignment — mappers exist but not consolidated to one-per-domain / reverse-mapper contract
- 🟡 Task-completion mode preserved on save, but no explicit guard test that linking tasks can't flip it to checklist
- ⬜ Guarded delete / archive / reassign — KRA/KPI delete is a plain confirm, no child-impact count or archive/reassign options ([KpiModal.tsx:449](../../src/components/kpi/KpiModal.tsx))
- ⬜ Pagination audit across large-list fetches — not confirmed
- ⬜ Controlled logging — high-traffic `console.log` still present (`Strategy.tsx:257,276,338`)

---

## Phase 6 — Frontend UI and Modal Workflows 🟡 Partial (mostly not started)

- 🟡 **Task modal** — has KRA + KPI selectors and infers parent KRA from KPI ([TaskDialog.tsx:355](../../src/components/unit-tabs/TaskDialog.tsx)), but **no** full cascade (Goal → Org KRA → Objective → Perf KRA → KPI) and **no** read-only breadcrumb before save
- 🟡 **KRA/KPI modal** — objective linkage present (`KpiModal.tsx:256`), but no explicit parent breadcrumb, no required-relationship validation
- ⬜ Strategy card `0%` states (Not Started / No Linked Data / Broken Linkage) — not distinguished
- ⬜ Division/Unit rows: linked KRA/KPI/task counts, linkage-health, overdue counts — not shown
- ⬜ Destructive-action warnings with child impact — not present
- ⬜ Reports UI traceability / heatmap / exception panels — not present
- ⬜ Scope banner (personal/unit/division/corporate/audit) — not present
- ⬜ Distinct empty/loading/broken-link states — not present

---

## Phase 7 — Reporting and Governance ⬜ Not started (precursors exist)

- 🟡 Summary reports + CSV export + scheduling exist as precursors — `ReportsTab.tsx`
- 🟡 `Report_Schedules` list + scheduler backend exist (see memory: Report Scheduler)
- ⬜ Scope is hard-coded `'unit'` — [ReportsTab.tsx:757,924](../../src/components/unit-tabs/ReportsTab.tsx); no 5-mode scope
- ⬜ None of the 8 report types (traceability, division/unit heatmap, KRA/KPI evidence, unlinked records, overdue, owner accountability, progress variance, KPI review governance)
- ⬜ No graph-backed hierarchy rows; export is summary-first, not hierarchy-first
- ⬜ Governance (evidence-required flags, audit trails, review status) — not present

---

## Phase 8 — Testing, Rollout, and Acceptance ⬜ Not started

- 🟡 One calculation test exists — `src/tests/verify-calculation.ts`
- ⬜ Full-cascade acceptance tests (goal → task evidence, UI/report parity) — not present
- ⬜ Rollout / controlled-release checklist not executed

---

## Sprint / backlog docs (09–17) — planning only

`09-implementation-backlog.md` through `17-operational-runbook…md` are execution
schedules, not code. No implementation has been started against them.

---

## Summary table

| Phase | Area | Status |
| --- | --- | --- |
| 1 | Current State Audit | ✅ Done (doc) |
| 2 | Target Model + naming | 🟡 Partial (role-recursive revision locked) |
| 3 | Graph Service | 🟡 Partial (scaffold built; needs role-recursive rework) |
| 4 | Progress Engine | 🟡 Partial |
| 5 | Backend Hardening | 🟡 Partial |
| 6 | Frontend UI / Modals | 🟡 Partial (mostly ⬜) |
| 7 | Reporting & Governance | ⬜ Not started |
| 8 | Testing & Rollout | ⬜ Not started |

## Highest-leverage next steps

1. **Phase 3 graph service** — it unblocks 4, 6, and 7; everything else keeps
   diverging until the cascade is built once, centrally.
2. **Phase 4 status bands** — kill the ambiguous `0%` (add `no_linked_data` /
   `not_started`); cheap, high trust payoff, no backend change.
3. **Phase 6 task-modal cascade + breadcrumb** — the most visible user-facing gap.
4. **Phase 5 guarded deletes** — data-safety risk that grows with usage.
