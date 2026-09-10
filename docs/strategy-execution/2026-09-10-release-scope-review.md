# Strategy execution release-scope review

Date: 10 September 2026
Branch: `feat/ai-text-improver`
Base: `9f77716`
Remote: `origin` (`JohnSarwom/scpng-intranet-`)
Status: explicit strategy paths validated and preserved in an isolated local commit; nothing pushed or deployed.

## Decision

The working tree cannot be bulk-staged. It contains the strategy remediation, a separate asset-management workstream, local Claude/worktree metadata and Graphify outputs generated from both workstreams.

The strategy release must use explicit path staging. `src/App.tsx` additionally requires hunk-level staging because its diff contains both an asset-access change and the strategy security change that restricts `/test-ground` to administrators.

## Strategy-owned tracked modifications

- `docs/strategy-execution/README.md`
- `src/components/division/analytics/DivisionAIChat.tsx`
- `src/components/division/tabs/DivisionReportsTab.tsx`
- `src/components/division/tabs/DivisionWorkPlansTab.tsx`
- `src/components/division/workplan/WorkPlanBuilder.tsx`
- `src/components/kpi/KraFormSection.tsx`
- `src/components/strategy/EditStrategicObjectiveModal.tsx`
- `src/components/strategy/analytics/StrategyAIChat.tsx`
- `src/components/unit-tabs/KRAsTab.tsx`
- `src/components/unit-tabs/ReportsTab.tsx`
- `src/components/unit-tabs/TaskDialog.tsx`
- `src/hooks/useDivisionData.ts`
- `src/hooks/useSharePointOps.ts`
- `src/hooks/useStrategyExecutionGraph.ts`
- `src/hooks/useStrategySharePoint.ts`
- `src/hooks/useWorkPlans.ts`
- `src/mockData/strategyData.ts`
- `src/pages/Strategy.tsx`
- `src/pages/TestGround.tsx`
- `src/pages/WorkPlanBuilderPage.tsx`
- `src/services/powerAutomateService.ts`
- `src/services/sharePointOpsService.ts`
- `src/services/strategyExecutionGraphService.ts`
- `src/services/strategyService.ts`
- `src/tests/strategyExecutionGraphService.test.ts`
- `src/types/division.types.ts`
- `src/types/index.ts`
- `src/types/strategyExecution.ts`

## Strategy-owned new paths

- `.github/workflows/strategy-execution-quality.yml`
- `scripts/check-typescript-baseline.mjs`
- `scripts/run-strategy-tests.mjs`
- the new dated documents and `handoff-evidence` files under `docs/strategy-execution/`
- `src/components/division/workplan/WorkPlanGovernanceHistoryDialog.tsx`
- `src/components/division/workplan/WorkPlanLinkageDialog.tsx`
- `src/components/division/workplan/WorkPlanRetirementDialog.tsx`
- `src/components/division/workplan/WorkPlanStructureRetirementDialog.tsx`
- `src/components/reports/StrategyGovernanceSections.tsx`
- `src/data/strategyDemoOverlay.ts`
- `src/hooks/useArchivedStrategyAI.ts`
- `src/hooks/useStrategyDemoMode.ts`
- `src/hooks/useWorkPlanGovernanceHistory.ts`
- `src/services/strategyReportAIService.ts`
- `src/services/strategyReportArchiveService.ts`
- `src/services/strategyReportSchedulerReadinessService.ts`
- `src/services/strategyReportSchedulerService.ts`
- `src/services/strategyReportingService.ts`
- `src/services/workPlanActivationService.ts`
- `src/services/workPlanGovernanceService.ts`
- `src/services/workPlanStorageService.ts`
- all twelve new `src/tests/*.test.cjs` strategy/work-plan suites
- `src/utils/workPlanAccess.ts`
- `src/utils/workPlanEditor.ts`
- `src/utils/workPlanIdentity.ts`

## Mixed file requiring hunk-level staging

`src/App.tsx` contains two independent changes:

- include: the `/test-ground` route change from general authentication to `admin`/`super_admin` authorization;
- exclude: the asset-workspace permission import and `AssetsPageRoute` access calculation.

Staging the full file would silently mix asset-management work into the strategy release.

## Explicit exclusions

- `.claude/settings.local.json` and `.claude/worktrees/*`
- `src/components/assets/**`
- `src/components/unit-tabs/modals/EditAssetModal.tsx`
- `src/hooks/useAssetSubSharePoint.ts`
- `src/hooks/useAssetsSharePoint.ts`
- `src/lib/assetAccessPolicy*`
- `src/lib/assetMaintenancePolicy*`
- `src/lib/assetPermissionPolicy*`
- `src/pages/AdminAssetsPage.tsx`
- `src/pages/AssetManagementNew.tsx`
- `src/pages/DecommissionedAssets.tsx`
- `src/services/assetSubSharePointService.ts`
- `src/services/assetsSharePointService.ts`
- `src/services/sharePointListSetupService.ts` (its current diff is asset-maintenance schema only)
- `graphify-out/cache/**`
- `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json` in this commit, because they currently describe the combined dirty tree rather than an isolated strategy checkout

## Commit gate

Before committing:

1. stage only the explicit strategy paths;
2. stage only the strategy hunk from `src/App.tsx`;
3. inspect `git diff --cached --check`, the cached name list and cached diff summary;
4. rerun the strategy test, TypeScript-baseline and production-build gates against the same working content;
5. commit locally only after the cached review shows no excluded path;
6. push later as a separately authorized external step.

The LIS document remains a planning guide. No LIS importer, source migration or LIS data file belongs in the release.

## Staged-candidate validation

- `git diff --cached --check`: clean.
- Excluded-path scan: no asset, Claude/worktree, Graphify or list-setup path staged.
- `src/App.tsx`: only the administrator-only `/test-ground` route hunk is staged; both asset-permission hunks remain unstaged.
- Strategy/work-plan regression from an index-only temporary checkout: **121/121 passed**.
- TypeScript release gate from the same checkout: **172 baseline / 172 current unique diagnostics; zero added**.
- Production build from the same checkout: **passed**, 5,502 modules transformed.
