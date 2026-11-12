# Change records and the programme tracker

| | |
|---|---|
| **Date** | 2026-11-13 |
| **Status** | In review |
| **Programme step** | None (supports every programme) |
| **Branch / PR / commits** | `feat/workflow-studio`, [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23) |
| **Decisions used** | D-10, the approach this tracker follows |

## Why

The user asked for every change to be documented well, so that anyone can always look up what changed and where things stand. Until now, changes were described in scattered handover files, PR descriptions and session notes, with no single index and no running status.

## What changed for users

Nothing in the app. For the team:
- A [change records](README.md) folder: one record per change, with an index, newest first.
- An [Organisation and approvals tracker](../programmes/org-and-approvals/README.md):
  - "Where we are";
  - step status;
  - the decisions register;
  - the data fixes.

## Technical changes

| Area | Change |
|---|---|
| `docs/changes/_TEMPLATE.md`, `docs/changes/README.md` | The record template, the rules and the index. |
| `docs/changes/2026-11-11-*.md`, `docs/changes/2026-11-12-org-reporting-task-designs.md` | Records written for the work already in PR #23. |
| `docs/programmes/org-and-approvals/README.md` | The programme tracker. |
| `CLAUDE.md` | A required "Change documentation" rule, read by every Claude Code session in this repository. |
| `.github/pull_request_template.md` | A PR checklist: change record, tracker, module doc, Workflow Studio designs, data changes, checks. |
| `docs/README.md` | Links to the change records and the tracker. |

## Data and SharePoint changes

None.

## How it was checked

- Every relative link in the new docs was checked. The only missing targets are the four records being written on other branches (the shared org model, the work-plan goal links, the KPI picker and the Division metrics). They resolve once those branches merge.
- No code changed, so no tests were run for this record.

## Follow-ups and open items

- Add the four side-branch records to this branch's index once they merge, or correct their rows if their file names change.
- The rest of the AI work, which is uncommitted, needs its own record when it gets a branch.

## How to undo it

Revert the commit. Nothing depends on these files.

## History

- 2026-11-13: set up, and added to PR #23.
