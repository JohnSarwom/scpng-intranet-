# Phase 3: Data Linkage and Graph Service

## Purpose

This phase defines the future `StrategyExecutionGraphService`: the central relationship layer for strategy execution.

The service exists to prevent every page, tab, modal, report, and chart from rebuilding the strategy hierarchy in its own way. It should normalize existing SharePoint-backed records into one graph that can answer:

- What work contributes to this strategic goal?
- Which organisational KRA/key deliverable does this objective support?
- Which Performance KRAs, KPIs, and tasks belong under this division or unit?
- Which records are unlinked, orphaned, stale, or incomplete?
- Which progress values should Strategy, Unit, Reports, and Analytics display for the same scope?

## Design Principle

The graph service should be a normalization and relationship service, not a replacement for existing SharePoint services.

Existing services should continue to fetch raw domain records. The graph service should receive those records, normalize relationships, generate diagnostics, and return a graph-shaped output that downstream UI and reporting layers can consume.

## Primary Inputs

The graph service should accept already-fetched records from the existing strategy and operations sources:

| Input | Source Concept | Purpose |
| --- | --- | --- |
| Strategic goals | `Strategic_Goals`, `Strategic_Objectives` | Top-level strategy nodes. |
| Organisational KRAs / key deliverables | `Strategic_KRAs`, deliverables, seeded key deliverables | Strategy-level result areas. |
| Strategic initiatives | `Strategic_Initiatives` | Bridge between organisational KRAs and execution. |
| Unit objectives | `Unit_Objectives` | Division/unit-owned objective layer. |
| Performance KRAs | `Performance_KRAs` | Execution KRAs owned by divisions, units, or staff. |
| KPIs | `Performance_KPIs` | Measurement layer under Performance KRAs. |
| Tasks | `Operations_Tasks` | Execution and evidence layer under KPIs. |
| Divisions | Strategy hierarchy, org hierarchy, user context | Division grouping and progress aggregation. |
| Units | Strategy hierarchy, org hierarchy, user context | Unit grouping and progress aggregation. |
| Report scope | personal, unit, division, corporate, audit | Controls the interpretation of graph totals. |

## Primary Outputs

The graph service should return:

- A strategy-first hierarchy grouped by Strategic Goal.
- A division-first hierarchy grouped by Division and Unit.
- Flat lookup maps for fast modal/report access.
- Diagnostics for missing or broken links.
- Scope metadata.
- Generated timestamp.

The output should support both executive views and operational views.

## Conceptual Interfaces

These interfaces are conceptual and should be adapted to existing project types during implementation.

```ts
type ProgressScope = 'personal' | 'unit' | 'division' | 'corporate' | 'audit';

interface StrategyExecutionGraph {
  generatedAt: string;
  scope: ProgressScope;
  goals: StrategyGoalNode[];
  divisions: DivisionExecutionNode[];
  lookups: StrategyExecutionLookups;
  diagnostics: LinkageDiagnostic[];
}

interface StrategyExecutionLookups {
  goalsById: Record<string, StrategyGoalNode>;
  organisationalKrasById: Record<string, OrganisationalKraNode>;
  objectivesById: Record<string, ObjectiveNode>;
  performanceKrasById: Record<string, PerformanceKraNode>;
  kpisById: Record<string, KpiNode>;
  tasksById: Record<string, TaskNode>;
}

interface StrategyGoalNode {
  id: string;
  title: string;
  sourceList: string;
  ownerName?: string;
  divisionName?: string;
  organisationalKras: OrganisationalKraNode[];
  progress?: number;
}

interface OrganisationalKraNode {
  id: string;
  title: string;
  sourceList: string;
  parentGoalId?: string;
  objectives: ObjectiveNode[];
  progress?: number;
}

interface ObjectiveNode {
  id: string;
  title: string;
  sourceList: string;
  divisionName?: string;
  unitName?: string;
  parentGoalId?: string;
  parentOrganisationalKraId?: string;
  performanceKras: PerformanceKraNode[];
  progress?: number;
}

interface PerformanceKraNode {
  id: string;
  title: string;
  sourceList: string;
  parentObjectiveId?: string;
  kpis: KpiNode[];
  progress?: number;
}

interface KpiNode {
  id: string;
  title: string;
  sourceList: string;
  parentPerformanceKraId?: string;
  calculationType?: 'manual' | 'checklist' | 'task-completion';
  tasks: TaskNode[];
  progress?: number;
}

interface TaskNode {
  id: string;
  title: string;
  sourceList: string;
  parentKpiId?: string;
  parentPerformanceKraId?: string;
  status?: string;
  dueDate?: string;
  evidenceCount?: number;
}
```

## Diagnostic Interface

```ts
interface LinkageDiagnostic {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  type:
    | 'strategic_goal_without_kra'
    | 'organisational_kra_without_objective'
    | 'objective_without_goal'
    | 'objective_without_performance_kra'
    | 'performance_kra_without_objective'
    | 'performance_kra_without_kpi'
    | 'kpi_without_performance_kra'
    | 'task_without_kpi'
    | 'task_without_performance_kra'
    | 'division_without_execution_data'
    | 'unit_without_objectives'
    | 'broken_lookup'
    | 'legacy_text_only_link';
  entityType:
    | 'strategic_goal'
    | 'organisational_kra'
    | 'objective'
    | 'performance_kra'
    | 'kpi'
    | 'task'
    | 'division'
    | 'unit';
  entityId: string;
  entityTitle?: string;
  message: string;
  recommendedAction?: string;
}
```

## Relationship Priority Rules

The graph should resolve relationships in this order:

1. Use explicit SharePoint lookup IDs.
2. Use stable internal IDs from mapped records.
3. Use parent fields such as `parentGoalId`, `objective_id`, `kra_id`, and `kpi_id`.
4. Use normalized seeded bridge fields such as `linkedDeliverable`.
5. Use title matching only as a legacy fallback.
6. If no reliable relationship exists, create a diagnostic instead of forcing a weak link.

The graph must preserve source metadata so diagnostics can explain where a record came from.

## Scope Rules

The graph should support five scope modes:

| Scope | Graph Behavior |
| --- | --- |
| Personal | Uses records already filtered to the current user's created/assigned data. |
| Unit | Uses records for the selected unit or unit staff. |
| Division | Uses records for the selected division. |
| Corporate | Uses all strategy execution records available to the corporate view. |
| Audit | Uses all records plus diagnostics, including broken and orphaned links. |

The graph service should not hide diagnostics just because a UI surface chooses not to show them.

## Required Consumers

The graph should eventually power:

- Strategy page cards.
- Strategy Division/Unit hierarchy.
- Unit page overview.
- Unit KRAs tab grouping.
- Task modal cascade selectors.
- KPI modal parent linkage display.
- Reports tab summaries and traceability reports.
- Divisional analytics cards and charts.
- Future AI strategy summaries.

## Required Graph Views

The service should provide at least two graph views:

### Strategy-first view

```text
Strategic Goal
-> Organisational KRA / Key Deliverable
-> Objective / Initiative
-> Performance KRA
-> KPI
-> Task
```

Use this for Strategy cards, traceability reports, and executive summaries.

### Division-first view

```text
Division
-> Unit
-> Objective / Initiative
-> Performance KRA
-> KPI
-> Task
```

Use this for the lower Strategy page hierarchy, divisional analytics, unit views, and heatmaps.

## Implementation Notes

Recommended future location:

```text
src/services/strategyExecutionGraphService.ts
```

Recommended supporting type location:

```text
src/types/strategyExecution.ts
```

Recommended implementation order:

1. Add conceptual graph types.
2. Build pure graph normalization functions that accept arrays of existing records.
3. Add diagnostics generation.
4. Add strategy-first and division-first view builders.
5. Wire one low-risk read-only consumer first, such as Reports or a debug preview.
6. Then wire Strategy cards, Division/Unit hierarchy, Task modal selectors, and Analytics.

## Acceptance Criteria

- One graph can answer: "What work contributes to this strategic goal?"
- One graph can answer: "Which division or unit is behind?"
- One graph can answer: "Which tasks provide evidence for this KPI?"
- One graph can answer: "Which records are unlinked or orphaned?"
- Strategy, Unit, Reports, and Analytics can consume the same normalized relationships.
- No major page has to rebuild parent/child relationships independently.
- Broken relationships produce diagnostics rather than silent `0%` or hidden rows.
