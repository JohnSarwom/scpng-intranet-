# Strategic_Goals becomes the goal list

| | |
|---|---|
| **Date** | 2026-11-11 |
| **Status** | In review |
| **Programme step** | None (strategy linkage work, before the organisation and approvals programme) |
| **Branch / PR / commits** | `feat/workflow-studio`, [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23), commit `670e49a` |
| **Decisions used** | D-01: `Strategic_Goals` is the official goal list ([register](../programmes/org-and-approvals/README.md#decisions-register)) |

## Why

The audit of the chain from the Task Registry up to the goals found that the app had no single goal list. Objectives pointed at goals in three ways:
- `ParentGoalId`, a lookup to `Strategic_Objectives` that the seed had filled with `Unit_Objectives` IDs;
- `LinkedDeliverable`, a text field;
- stored or sample progress figures.

The result was that goal progress on the Strategy page and the Home overview couldn't be traced back to tasks. See the [audit](../strategy-execution/2026-11-11-task-registry-to-goals-audit.md).

## What changed for users

- Strategy goal cards, the division hierarchy, the Home overview and reports all read goals from `Strategic_Goals`, linked through the new `StrategicGoal` column. Progress is calculated live, with no sample fallbacks.
- Until the links exist on the live site, every objective shows as "Not linked to a Strategic Goal".
- New initiatives on the Unit page must pick a Strategic Goal.
- The Division Linkage tab counts a task as traced only when it reaches an existing Strategic Goal.
- Admins have a new **Strategic Goal links** panel on Test Ground. Reviewing only reads. Creating the column, adding the four Corporate Plan goals and applying links each need a confirmation.

## Technical changes

| Area | Change |
|---|---|
| `src/utils/strategicGoalLink.ts` | New pure helpers: goal matching, crosswalk proposals, the Corporate Plan goals. |
| `src/services/sharePointOpsService.ts` | Reads and writes `StrategicGoalLookupId`. Adds column status and create methods. Excludes retired KRAs from objective progress. |
| `src/services/strategyService.ts`, `src/hooks/useStrategySharePoint.ts` | Goal revision, create and update; legacy objective titles. |
| `src/utils/kpiUtils.ts` | `calculateGoalProgressDetail`: a goal's progress comes only from objectives linked to it. |
| `src/pages/Strategy.tsx`, `src/components/strategy/EditStrategicObjectiveModal.tsx`, `src/components/dashboard/OrganizationalOverview.tsx` | Switched to `Strategic_Goals` and the new link. |
| `src/services/strategyExecutionGraphService.ts`, `src/services/linkageInventoryService.ts`, `src/hooks/useLinkageInventory.ts`, `src/components/division/tabs/DivisionLinkageTab.tsx` | Trace through the new link. |
| `src/pages/Unit.tsx`, `src/components/unit-tabs/KRAsTab.tsx` | The goal picker for new initiatives. |
| `src/services/kraKpiSeedService.ts` | The seed links to matching Strategic_Goals when the column exists. |
| `src/components/strategy/StrategicGoalLinkPanel.tsx` | The new admin panel. |

## Data and SharePoint changes

- New lookup column `StrategicGoal` on `Unit_Objectives`, pointing at `Strategic_Goals`. An admin creates it from Test Ground → Strategic Goal links. **Not yet done on production.**
- The four Corporate Plan goals can be added from the same panel. **This waits on decision D-02.**

## How it was checked

- Strategy test suites passed. `strategicGoalLink.test.cjs` is new, and the linkage, work-plan and graph tests were updated.
- The TypeScript baseline check found no new diagnostics, and the build passed.
- **Not checked:** the Strategy page, Home overview and Linkage tab with real links. That needs the column and the links on the live site.

## Follow-ups and open items

- **Work-plan activation:** it still writes the legacy `ParentGoalId` ([record](2026-11-12-work-plan-goal-links.md)).
- **Strategy page bug:** "Copy JSON" crashes because `toast` is used without an import.
- **Re-measure:** run the Linkage baseline again once the links are applied.

## How to undo it

Revert commit `670e49a`. The `StrategicGoal` column can stay; nothing else reads it.

## History

- 2026-11-11: implemented and committed.
- 2026-11-12: pushed in PR #23.
- 2026-11-13: record written from the session notes and the [decision doc](../strategy-execution/2026-11-11-strategic-goals-canonical.md).
