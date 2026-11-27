# Organisation, reporting and task assignment designs

| | |
|---|---|
| **Date** | 2026-11-12 |
| **Status** | In review |
| **Programme step** | [Org & approvals → Step 0](../programmes/org-and-approvals/README.md#step-0--before-any-code) (the agreed target, and how far the app is from it) |
| **Branch / PR / commits** | `feat/workflow-studio`, [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23), commit `0747c64` |
| **Decisions used** | None yet. This change raised D-03 to D-08. |

## Why

The user supplied three drafts of how the organisation and task work should run:
- 01 Reporting Hierarchy;
- 02 Task Assignment Workflow;
- 03 Organisational Structure.

They asked for these to be checked against the app, refined, and made viewable in Workflow Studio.

## What changed for users

Workflow Studio has three new built-ins, each marked **Target design**:
- **Organisational structure:** the units.
- **Reporting hierarchy:** the posts.
- **Task assignment and review:** a flow that can be simulated.

Every box or step is tagged **In app**, **Partly** or **Not yet**. Its details say what the app does today.

The org charts can be searched. Their branches open and close, and the inspector shows each box's reporting line.

## Technical changes

| Area | Change |
|---|---|
| `src/workflows/workflowTypes.ts`, `src/workflows/workflowSchema.ts` | New workflow kind `hierarchy`: boxes of type `org` with a `rank`, top-down layout, and its own validation (one top box, one parent each). New `target` status, `appStatus` and `details.today`. |
| `src/workflows/definitions/organisationalStructure.ts`, `reportingHierarchy.ts`, `taskAssignmentReview.ts` | The three designs. |
| `src/components/workflows/WorkflowCanvas.tsx`, `WorkflowInspector.tsx`, `src/pages/Workflows.tsx` | Chart drawing, status tags and key, find, open and close branches, the reporting-line panel. |
| `src/prompts/workflowBuilderPrompt.ts` | The AI knows about structure charts. It never adds app-status claims. |

## Refinements made to the drafts

- Divisions and Internal Audit report to the CEO, not through the General Counsel.
- The Executive Officer sits under the General Counsel, not in the Secretariat.
- The two org charts are split: one shows units, the other posts.
- The task flow gained accept or query, return for changes, and escalation only when needed.

Details are in the [review](../modules/workflows/2026-11-12-organisation-and-task-flow-review.md).

## Data and SharePoint changes

None were made. The review found two live problems that an admin can fix without code:
- 10 of the 12 `Strategy_Units` rows have the placeholder "Related Division" as their division.
- Only the IT Unit has leave approvers.

## How it was checked

- 253 local tests and 207 on the PR branch passed, including the new `workflowTargetDesigns.test.cjs`. The TypeScript baseline found no new diagnostics, and the build passed.
- A browser check, signed in, covered:
  - the status key and tags;
  - find;
  - closing and opening branches (49 → 12 → 15 → 49 boxes);
  - the inspector's reporting line.
- Live data was read (no names recorded): `Strategy_Divisions`, `Strategy_Units`, the leave approver rows, and directory department and job-title counts.
- **Not checked:** officer profiles' "reports to" fields.

## Follow-ups and open items

- Decisions D-03 to D-08 in the [register](../programmes/org-and-approvals/README.md#decisions-register).
- When the code catches up, update each design's `appStatus` and `details.today` in the same change.

## How to undo it

Revert commit `0747c64`.

## History

- 2026-11-12: built; live data checked.
- 2026-11-13: pushed in PR #23; record written.
