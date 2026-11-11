# Strategic_Goals as the official goal list

Date: 11 November 2026. Follows the [task-to-goals audit](2026-11-11-task-registry-to-goals-audit.md) (findings F01, F02, F04, N01, N02, N04, N06).

## Decision

`Strategic_Goals` is the one official list of organisational goals. A Unit Objective belongs to a goal only through a new lookup column, **`StrategicGoal`** on `Unit_Objectives` → `Strategic_Goals` (Graph field `StrategicGoalLookupId`).

The older fields are no longer read as goal links:
- `ParentGoalId` looks up `Strategic_Objectives`, and the framework seed wrote `Unit_Objectives` row IDs into it.
- `LinkedDeliverable` is free text.

Both are kept untouched, and the migration tool uses them only as evidence when proposing links.

## What changed in the code

| Area | Change | Files |
|---|---|---|
| Link field | `Objective.strategicGoalId` is read and written. It is only sent when set, so lists without the column keep working. | [types/index.ts](../../src/types/index.ts), [sharePointOpsService.ts](../../src/services/sharePointOpsService.ts) |
| Schema | `getStrategicGoalColumnStatus()` is read-only. `createStrategicGoalColumn()` runs only from the admin panel, after confirmation. Columns are never created automatically on start-up. | [sharePointOpsService.ts](../../src/services/sharePointOpsService.ts) |
| Goal progress | `calculateGoalProgressDetail` matches children by `strategicGoalId`, reports `hasLinkedData`, and no longer returns 0 just because there are no Unit Objectives. | [kpiUtils.ts](../../src/utils/kpiUtils.ts) |
| Strategy page | Goal cards, the breakdown, the report table and analytics read `Strategic_Goals`. There is no fallback to stored or mock progress, and an empty list shows as empty. The hierarchy groups by the goal link; unlinked objectives are grouped as "Not linked to a Strategic Goal". Featured project cards remain `Strategic_Objectives`. Goal edits save to `Strategic_Goals`; their KRAs are read-only (they come from `Strategic_KRAs`). | [Strategy.tsx](../../src/pages/Strategy.tsx), [EditStrategicObjectiveModal.tsx](../../src/components/strategy/EditStrategicObjectiveModal.tsx) |
| Home | The Organisational Overview uses the same goals and calculation as the Strategy page, including the Corporate Plan track. | [OrganizationalOverview.tsx](../../src/components/dashboard/OrganizationalOverview.tsx) |
| Reports (graph) | An objective sits under a goal only through `strategicGoalId`. There are no title guesses. | [strategyExecutionGraphService.ts](../../src/services/strategyExecutionGraphService.ts) |
| Linkage tab | "Traced" now means Task → KPI → KRA → Objective → an existing Strategic Goal. New issues: `objective_no_goal`, `objective_broken_goal`. | [linkageInventoryService.ts](../../src/services/linkageInventoryService.ts), [useLinkageInventory.ts](../../src/hooks/useLinkageInventory.ts), [DivisionLinkageTab.tsx](../../src/components/division/tabs/DivisionLinkageTab.tsx) |
| Unit initiative form | The goal list comes from `Strategic_Goals`, and the "Organizational KRAs" choices come from that goal's Strategic KRAs. New initiatives must pick a goal. Existing ones can still be saved, or cleared, while unlinked. | [Unit.tsx](../../src/pages/Unit.tsx), [KRAsTab.tsx](../../src/components/unit-tabs/KRAsTab.tsx) |
| Seed | Links seeded objectives to the `Strategic_Goals` item with the matching title when the column exists. | [kraKpiSeedService.ts](../../src/services/kraKpiSeedService.ts) |
| Objective sync | Stored objective progress no longer counts retired KRAs (N06). | [sharePointOpsService.ts](../../src/services/sharePointOpsService.ts) |
| AI context | Describes goals as `Strategic_Goals` and sends each objective's Strategic Goal ID. | [strategyAnalyticsUtils.ts](../../src/utils/strategyAnalyticsUtils.ts), [strategyCalculationLogic.txt](../../src/prompts/strategyCalculationLogic.txt) |
| Crosswalk logic | Pure and tested: title matching, proposals, conflicts, inheritance, and the change list. | [strategicGoalLink.ts](../../src/utils/strategicGoalLink.ts), [strategicGoalLink.test.cjs](../../src/tests/strategicGoalLink.test.cjs) |
| Admin tool | "Strategic Goal links" panel on Test Ground (admin only). | [StrategicGoalLinkPanel.tsx](../../src/components/strategy/StrategicGoalLinkPanel.tsx), [TestGround.tsx](../../src/pages/TestGround.tsx) |

## What the goal list should contain (open)

The [Corporate Plan 2026–2028 v1.0](../../pdf_output.txt) has **four** Strategic Goals:
1. Policy Development
2. Enforcement and Compliance
3. Education & Awareness
4. Enhance Institutional Performance

Two other goal sets exist in the code:
- The framework seed creates **five** goals. The fifth, "International & Inter-Agency Cooperation", with KRAs 5.1–5.3, is not in the plan.
- The old Corporate Plan migration ([strategyMigrationService.ts](../../src/services/strategyMigrationService.ts)) put **four different demo goals** into `Strategic_Goals` by keyword matching: Markets & Connectivity, Regulatory Reform, Digitisation, and Administrative Fundamentals & Cooperation.

The live contents of `Strategic_Goals` were not read for this change. The admin panel shows them, lists any of the four plan goals that are missing, and can add them after confirmation. It never removes or renames existing goals. Seeded goal 5 objectives will show as "Needs a choice" and must be placed by hand.

## Runbook (admin account required)

The steps are in order. Steps 2–4 write to the production site, one confirmation each.

1. Open Test Ground → **Strategic Goal links** → **Review links**. This step only reads.
2. **Create column** (a schema change to `Unit_Objectives`). The deployed app ignores the new column until this code ships, so this can run before deployment.
3. If the plan goals are missing, **Add goals**. Decide separately what to do with any demo goals; the tool leaves them alone.
4. Review every proposed row, choose goals for rows marked "Conflict" or "Needs a choice", then **Apply**. Each write uses the version loaded in the review, so a record edited in the meantime is skipped and reported.
5. Deploy this code. Until step 4 is done, every objective on the Strategy hierarchy shows as "Not linked to a Strategic Goal", and goal cards show "No objectives or KRAs linked".
6. Re-open the Linkage tab to get the new task → goal baseline.

## Not changed (follow-ups)

- **Work-plan activation** still writes the legacy `ParentGoalId` and refuses `Strategic_Goals` references without a crosswalk ([workPlanIdentity.ts](../../src/utils/workPlanIdentity.ts)). Objectives it creates arrive unlinked and appear in the review panel. Making it write `StrategicGoal` directly is a separate change.
- **Fresh-tenant provisioning** ([sharePointListSetupService.ts](../../src/services/sharePointListSetupService.ts)) does not add the column; the admin panel does.
- **Other progress engines**: KRA progress rules (F03) and the Division metrics (N07) are unchanged.

## Verification

- Strategy regression suite: **218/218 passed** (`node scripts/run-strategy-tests.mjs`), including 7 new crosswalk tests and new Linkage and goal-progress cases.
- TypeScript baseline gate: no new diagnostics in the changed files. The 3 the gate reports are in files with unrelated uncommitted changes (`LeaveApplicationPage.tsx`, `MarketData.backup.tsx`, `TestGround.tsx` `createEmployeeProfilesList`).
- Production build (`vite build`): passed.
- Not verified in a browser: the app requires a Microsoft sign-in, and no live SharePoint data was read or written.
