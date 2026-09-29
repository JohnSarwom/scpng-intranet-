# Phase 4C — Retirement governance history

Date: 9 September 2026
Status: implemented and verified locally; read-only tenant UAT remains a release gate.

## Result

The Division Work Plans screen now provides an authorized, read-only retirement governance history. It projects the durable `RetirementJSON` journal already stored with each Division work plan and does not migrate, provision, recover, reverse or mutate any record while loading or displaying history.

The view exposes completed retirements and reassignments together with running or failed operations. Each event includes the work plan and source identity, action and status, approved reason, recorded actor when available, target identity, affected Objective/KRA/KPI/Task counts, conserved evidence counts, reviewed progress impacts, durable checkpoints, warnings, errors and same-intent recovery guidance.

Legacy history remains visible even where older records did not capture an actor. New activity, KRA and goal retirement operations now copy the authoritative signed-in actor into the operation journal and the completed history record. This is audit metadata only; the existing retirement authorization, ETag, lease, scope, ancestry and evidence-conservation safeguards remain unchanged.

## Security and integrity boundary

- Administrators can read governance history across Divisions.
- Managers and directors can read only an exact normalized match to their authoritative Division.
- Staff, missing identities, cross-Division access and failed authoritative role lookup are denied.
- The SharePoint adapter resolves `/me` and `UserRoles` before the scoped list read and revalidates every returned row against both Division ID and name.
- Unsupported envelopes, malformed timestamps, incomplete records, duplicate operation IDs and an operation appearing as both active and completed fail closed.
- The returned history is recursively cloned and frozen before UI consumption.
- The UI has no retire, reassign, recover, delete or reverse action. Reversal is explicitly unavailable until an approved governance policy defines authority, evidence treatment and rollback semantics.

Primary implementation paths:

- `src/services/workPlanGovernanceService.ts`
- `src/hooks/useWorkPlanGovernanceHistory.ts`
- `src/components/division/workplan/WorkPlanGovernanceHistoryDialog.tsx`
- `src/components/division/tabs/DivisionWorkPlansTab.tsx`
- `src/services/sharePointOpsService.ts`
- `src/services/workPlanActivationService.ts`
- `src/types/division.types.ts`
- `src/tests/workPlanGovernance.test.cjs`

## Validation

- Governance/access/retirement focused gate: **42/42 passed**.
- Full strategy/work-plan suite: **108/108 passed** across ten `.cjs` suites.
- Production build: **passed**, 5,507 modules transformed.
- TypeScript app check: the inherited **233 diagnostic lines / 165 normalized file-message-pair baseline** remains. No diagnostic names the new governance service, hook or dialog, and the existing three `sharePointOpsService.ts` diagnostics are unchanged.
- No live SharePoint record, schema, recovery, reversal, report delivery, deployment, import, commit or pull request was created.

## Remaining policy decision

This phase deliberately does not implement reversal. Resume-only recovery already exists for interrupted operations. A future reversal feature requires explicit approval of who may reverse, how retained evidence is represented, whether completed operations can be reopened, which parent progress states are restored, and what immutable audit record must be appended. Until those decisions are approved, the governance surface remains read-only.
