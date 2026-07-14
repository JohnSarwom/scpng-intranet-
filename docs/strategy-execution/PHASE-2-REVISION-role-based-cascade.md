# Phase 2 (Revision) — Role-Based Cascade & KRA/KPI Duality

_Authoritative model revision agreed 2026-07-02. This **supersedes the fixed
"Level Definitions" in `02-phase-target-strategy-execution-model.md`** for how KRAs
and KPIs relate. Everything else in Phase 2 (naming, scope modes, traceability
rules) still stands. The Phase 3 graph service adapts to this model._

---

## 0. Why this revision

The original Phase 2 defined a **fixed named cascade**:

```text
Strategic Goal -> Org KRA -> Division/Unit Objective -> Performance KRA -> KPI -> Task
```

The real SCPNG governance model is **role-recursive**: the same "assign a KRA, it
becomes their KPI" step repeats by role until it reaches the Unit Officer, who only
executes. The named middle levels collapse into this recursion.

---

## Quick reference — role cascade & KRA/KPI duality

| Role | Receives from above | Their KPI (measured on) | Creates / assigns down | Creates tasks? | Rolls up into |
| --- | --- | --- | --- | --- | --- |
| **Board / CEO (Executive)** | — (defines Strategic Goals) | Strategic Goal achievement | **Organisational KRAs** → to Directors | No | Strategic Goal |
| **Divisional Director** | Org KRA (from Board) | The Org KRA *(= Director KPI)* | **KRAs** → to Unit Managers | No | Organisational KRA |
| **Unit Manager** | KRA (from Director) | That KRA *(= Manager KPI)* | **KRAs** → to Unit Officers | No | Director's KRA/KPI |
| **Unit Officer** | KRA (from Manager) | That KRA *(= Officer KPI)* | — *(hard stop — none)* | **Yes** (against own KPI) | Manager's KRA/KPI |
| **Task / Action item** | — | — (execution unit) | — | (is the task) | Officer's KPI |

Every "KRA → assigned to X" **is** X's KPI in the next row: one objective, relabeled
by who is looking. Full mechanics, data model, permissions, and rollup below.

---

## 1. Two core mechanics

### Mechanic A — KRA/KPI duality (one objective, two labels)

The objective my manager assigns *down* to me is, **from their side, a KRA they
own**, and **from my side, my KPI**. It is the *same objective*, relabeled by role.

> "The KRA my manager sets for me **is** my KPI."

### Mechanic B — Hard stop at the Unit Officer

Unit Officers have no direct reports, so they **never create KRAs**. They create
only **Tasks / action items** against the KPIs handed to them, update progress, and
upload evidence. The cascade terminates in execution.

---

## 2. The role cascade

```text
BOARD / CEO (Executive)
  • Defines Strategic Goals
  • Creates Organisational KRAs                    ── assigned to Directors
        │  (Org KRA  ≡  Director's KPI)
        ▼
DIVISIONAL DIRECTOR
  • Is measured on the Org KRA (= their KPI)
  • Decomposes it into KRAs                          ── assigned to Unit Managers
        │  (Director-set KRA  ≡  Manager's KPI)
        ▼
UNIT MANAGER
  • Is measured on that KRA (= their KPI)
  • Decomposes it into KRAs                          ── assigned to Unit Officers
        │  (Manager-set KRA  ≡  Officer's KPI)
        ▼
UNIT OFFICER
  • Is measured on that KRA (= their KPI)
  • Creates TASKS only (no KRAs) ── executes, updates progress, uploads evidence
```

Progress flows back up the same chain:

```text
Task completion
 -> Officer KPI progress
 -> Manager KRA/KPI progress
 -> Director KRA/KPI progress
 -> Organisational KRA progress
 -> Strategic Goal achievement
```

### Worked example

- **Board Org KRA:** "Improve Regulatory Compliance" → this is the **Director's KPI**.
- **Director** sets KRA: "Complete Quarterly Compliance Audits" → **Manager's KPI**.
- **Manager** sets KRA: "Conduct Monthly Compliance Inspections" → **Officer's KPI**.
- **Officer** creates tasks: schedule inspection, review records, field inspection,
  complete checklist, upload report, submit findings, close inspection.
- Each task completed → officer KPI ↑ → manager KRA ↑ → director KPI ↑ → org KRA ↑.

---

## 3. Data model — ONE record, role-derived label (decision)

A **single performance record** represents each rung. It is **its owner's KPI** and,
**to the owner's manager, a KRA they assigned**. No duplicate KRA/KPI rows.

### Record shape (conceptual)

```ts
interface PerformanceRecord {
  id: string;
  title: string;
  // WHO is measured on it (the assignee / subordinate)
  ownerEmail: string;
  ownerName?: string;
  ownerRole: 'director' | 'manager' | 'officer';
  // WHERE it sits in the chain
  parentId?: string;              // the record above (its parent owner's KPI). null at the top.
  parentStrategicGoalId?: string; // set only for top-level Org KRAs
  assignedByEmail?: string;       // creator = parent record's owner (audit)
  division?: string;
  unit?: string;
  // Measurement (mainly for leaf/officer records met by tasks)
  calculationType?: 'manual' | 'checklist' | 'task-completion';
  target?: number; actual?: number; weight?: number;
  status?: string;
  progress?: number;              // cached; source of truth is graph rollup
}
```

### The label-derivation rule (single source of the duality)

Given a viewer `V` looking at record `R` (whose parent `P` is owned by `M`):

| Viewer | Sees `R` as | Because |
| --- | --- | --- |
| `V === R.ownerEmail` | **"My KPI"** | It is the objective they are measured on. |
| `V === M` (parent's owner / the assigner) | **"A KRA I assigned to {owner}"** | They created/own the rung above. |
| Higher-up / audit | **"{Role} KRA/KPI — {owner}"** | Read-only traceability view. |

The label is **never stored** — it is derived from `ownerEmail` vs the viewer.
This is the whole duality, implemented once.

### Mapping onto existing SharePoint lists

- **`Performance_KRAs`** becomes the home of the single `PerformanceRecord`
  (reuses the list you already have + its seeded data). Add/confirm columns:
  `OwnerEmail`, `OwnerRole`/`Level`, `ParentId` (self-lookup),
  `ParentStrategicGoalId`, `AssignedByEmail`. Note: `Kpi` already has a
  `level: 'director' | 'manager' | 'staff'` field — reuse that vocabulary
  (map `staff` → `officer`).
- **`Operations_Tasks`** unchanged — tasks link to the **officer-owned leaf
  record** (`kra_id` / `kpi_id` both point at that same record id).
- **`Strategic_Goals`** unchanged — the root the top Org KRAs hang from.
- **`Unit_Objectives`** — the "objective" middle layer is no longer a distinct
  rung; existing seeded objectives map to Director/Manager-level performance
  records during migration (see §7).

---

## 4. Progress rollup (unchanged engine)

The Phase 3/4 bottom-up rollup already handles arbitrary depth, so no new math:

- **Leaf (officer) record:** progress from linked Tasks (task-completion), or
  checklist / manual target-actual.
- **Non-leaf record:** weighted average of child records' progress (weights when
  present, else simple average).
- **Org KRA → Strategic Goal:** average of the goal's Org KRAs.
- **`0%` bands** (`no_linked_data` vs `not_started`) apply per rung as already built.

---

## 5. Permission model (role-gated creation)

| Role | Create Strategic Goal | Create/Assign KRA (owned by role below) | Create Tasks |
| --- | --- | --- | --- |
| CEO / Executive / Board | ✅ | ✅ → Director-owned Org KRAs | ❌ |
| Divisional Director | ❌ | ✅ → Manager-owned KRAs | ❌ |
| Unit Manager | ❌ | ✅ → Officer-owned KRAs | ❌ |
| Unit Officer | ❌ | ❌ | ✅ (against own KPIs) |

Rules:
- A role may only create a record whose `ownerRole` is exactly the level **directly
  below** them, and whose `parentId` is one of **their own** records.
- Officers are restricted to `Operations_Tasks` linked to records they own.
- The role source is the existing `UserRoles` list (`Role`, `Division`, `Unit`).

**Enforcement points:**
1. **UI gating** — `KpiModal` / `KRAsTab` show "Assign KRA" only to Director/Manager;
   `TaskDialog` is the only creation path for Officers.
2. **Backend validation** — `sharePointOpsService` create paths reject a record
   whose `ownerRole`/`parentId` violates the caller's role (defence in depth).

---

## 6. Impact on the Phase 3 graph service

Reusable as-is: bottom-up rollup, progress wrapping + status bands, diagnostics,
orphan buckets, division-first view, lookups, tests.

Needs rework:
- Replace the fixed `OrgKRA → Objective → PerformanceKRA → KPI` builders with **one
  recursive performance-node builder** keyed by `parentId`, tagging each node with
  `ownerRole` and the derived KRA/KPI label.
- Linkage resolution becomes `parentId` (self-lookup) instead of
  `objective_id` / `linkedDeliverable` text matching → **removes the fragile
  text-fallback** flagged in Phase 1.
- Add a recursive `PerformanceNode` type to `src/types/strategyExecution.ts`
  (or repurpose the existing node interfaces).
- Strategic Goal stays the root; Tasks stay the leaf evidence.

The already-built `strategyExecutionGraphService.ts` is a valid scaffold — the
rollup/diagnostic/progress helpers carry over; only the tree-shape builders change.

---

## 7. Migration & compatibility

- Existing `Performance_KRAs` / `Performance_KPIs` / `Unit_Objectives` seeded data
  must be assigned `ownerRole` + `parentId` during a one-off migration.
- Interim: the graph service can infer `ownerRole` from the existing `Kpi.level`
  field and `parentId` from current `kra_id` / `objective_id` links, so nothing
  breaks before the migration runs.
- Old records without role/parent surface in the existing **Unlinked bucket +
  diagnostics** rather than crashing.

---

## 8. Open decisions still needed

1. **Fate of `Performance_KPIs` list.** With one-record duality, a separate KPI
   list is largely redundant (a record already *is* the owner's KPI).
   _Recommendation:_ keep it short-term for backward-compat and officer-leaf
   measurement, deprecate after migration. **Confirm before migration.**
2. **Can a role add self-KPIs** (a record they own that isn't a subordinate's KRA,
   e.g. a Director's own divisional KPI not decomposed downward)?
   _Recommendation:_ allow, as an owner==self leaf record. Confirm.
3. **Role vocabulary** — reuse `director | manager | officer`; confirm the mapping
   from current `UserRoles.Role` values.

---

## 9. Acceptance criteria

- Viewing a record shows "My KPI" to its owner and "KRA I assigned" to the assigner,
  from one stored record.
- An Officer cannot create a KRA anywhere in the UI or via the service.
- Creating a KRA is only possible for the level directly below the creator, under
  the creator's own record.
- Task completion rolls up through officer → manager → director → org KRA →
  strategic goal.
- Linkage uses `parentId`, not title/text matching.
- Records missing role/parent appear as diagnostics, not silent failures.
