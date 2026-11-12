# Organisation and approvals programme

The goals are:
- one trustworthy model of SCPNG's divisions, units and posts;
- approvals for tasks that follow it;
- progress totals by unit and division that count only approved work.

The agreed target is drawn in Workflow Studio (`/workflows`): **Organisational structure**, **Reporting hierarchy** and **Task assignment and review**. The gap between the app and that target is in the [12 November review](../../modules/workflows/2026-11-12-organisation-and-task-flow-review.md).

Every change in this programme has a [change record](../../changes/README.md). This page is the summary: update it whenever a change starts, merges or goes live.

## Where we are

*Updated 2026-11-13.*

- **Target agreed and drawn.** The three designs are in Workflow Studio, marked against the app. They are in [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23), awaiting review.
- **Step 1 has started.** The [Build one shared org model](../../changes/README.md#index) session is working on branch `claude/clever-lovelace-34f24e`.
- **Decisions D-02 to D-08 are open.** They block steps 3 and 4 and the final names, not step 1.
- **Live data needs two admin fixes:** unit-to-division links, and leave approvers for every unit (see [Data fixes](#data-fixes-no-code)).
- **Not started:** steps 2, 3 and 4.

## Steps

| Step | What | Status | Depends on | Change records |
|---|---|---|---|---|
| 0 | Before any code | In progress | — | [designs](../../changes/2026-11-12-org-reporting-task-designs.md) |
| 1 | One list of divisions and units | In progress | — | [shared org model](../../changes/2026-11-13-shared-org-model.md) *(on its branch)* |
| 2 | One approval process, built from leave | Not started | Step 0 (leave work committed), step 1 | — |
| 3 | Task review on that process | Not started | Step 2, D-07, D-08 | — |
| 4 | Positions, and totals by unit and division | Not started | Steps 1 and 3 | — |

Status values: Not started, In progress, In review, Done (merged), Live (on production and checked).

### Step 0 — Before any code

| Item | Status |
|---|---|
| Merge [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23): the Strategic_Goals link, AI routing, Workflow Studio and the designs | In review |
| Commit the local leave-approval work (the shared CEO approver, in `src/components/hr/WorkflowAdmin.tsx` and `src/services/hrSharePointService.ts`) on its own branch, with a change record. Step 2 builds on it, and today it exists only on one machine. | Not started |
| Admin data fixes (see [Data fixes](#data-fixes-no-code)) | Not started |
| Decisions D-02 to D-08 | Open |

### Step 1 — One list of divisions and units

- **1a.** A shared org module and hook read from `Strategy_Divisions` and `Strategy_Units`, with aliases for spelling variants. They replace the hard-coded copies in Admin → Users, the org chart and `src/data/divisions.ts`. No SharePoint writes. **In progress.**
- **1b.** List changes, made by an admin after a confirmation: the unit's division becomes a real link instead of text, and the lists gain Kind, Head, Active and Aliases. **Not started.**
- **1c.** Match people, approvers and tasks to units by ID, not by name. **Not started.**
- **1d.** Draw the Workflow Studio org charts from the live list, beside the target design. **Not started.**

Done when every screen reads divisions and units from one place, and the live lists have no unlinked units.

### Step 2 — One approval process, built from leave

Generalise the leave routing so it can serve other processes. It already has:
- stages, with approvers per unit;
- delegates and escalation contacts;
- skipping of empty stages;
- no self-approval;
- the executive route.

Existing approver rows count as leave approvers.

Out of scope: a second engine, and Power Automate approvals (because of the premium-licence limits).

Done when leave runs on the shared code with no change in behaviour, and a second process can be added through configuration.

### Step 3 — Task review on that process

1. A `Task_Approvals` list with one row per decision (who, when, outcome, comment), plus the current review stage and approver on each task.
2. The rules are enforced in the service code, not only in the form:
   - only the current approver can move a task from Review to Done;
   - a return goes back to In Progress with a comment;
   - escalation follows D-07.
3. Accept or query on assignment.
4. Rules on who may assign to whom: warn first, enforce later.
5. A pilot on the IT Unit (the only unit with approvers today), switched on unit by unit.

### Step 4 — Positions, and totals by unit and division

- Keep Staff, Manager and Admin as permissions. Work out each person's position (Senior Officer, Manager, Director, CEO) from the units they head, their job title, or their manager in Microsoft 365.
- Only approved completions count towards KPIs.
- Totals by unit and division come next, then the role-based cascade ([spec](../../strategy-execution/PHASE-2-REVISION-role-based-cascade.md)).

## Decisions register

| ID | Decision | Status | Decided |
|---|---|---|---|
| D-01 | `Strategic_Goals` is the official goal list | Decided | User, 2026-11-11 |
| D-02 | What `Strategic_Goals` contains: the four Corporate Plan 2026–2028 goals or the demo goals, and where the seed's goal 5 ("International & Inter-Agency Cooperation") objectives go | Open | |
| D-03 | The licensing division's official name: "Licensing, Investigation & Supervision" or "Licensing, Market & Supervision" | Open | |
| D-04 | Whether the live "Executive Division", headed by the General Counsel, is the Office of the General Counsel; if so, rename it and decide where its Executive Unit goes | Open | |
| D-05 | Where the Secretariat sits and who heads it | Open | |
| D-06 | Whether to add the Internal Audit, Legal Enforcement & Compliance and Investments units, and whether to keep or remove CSD's "Corporate Services Unit" and "Administrative Services" | Open | |
| D-07 | Which tasks need Director or CEO approval (the materiality rule) | Open | |
| D-08 | Whether Senior Officer becomes a position level, so first-level review can be routed to one | Open | |
| D-09 | Saved workflows go in a new `Workflow_Definitions` list, and the AI uses the existing AI configuration | Decided | User, 2026-11-11 |
| D-10 | Approach: steps 1 to 4 in order; no general workflow engine; no Power Automate approvals | Decided | User, 2026-11-13 ("let's proceed with that") |

To record a decision: set its status to Decided, add who decided it and the date, and mention its ID in the change records that use it.

## Data fixes (no code)

| Fix | Who | Status |
|---|---|---|
| In `Strategy_Units`, set each unit's division (10 of 12 point at "Related Division") | Admin | Not started |
| In HR → Workflow admin, set Manager and Director leave approvers for every unit (only IT has them) | HR admin | Not started |
| Create the `StrategicGoal` column and apply goal links (Test Ground → Strategic Goal links), after D-02 | Admin | Not started |
| Create the `Workflow_Definitions` list from `/workflows` | Admin | Not started |
| Tidy staff directory department names to match the unit list | Microsoft 365 admin | Not started |

## Related work outside the programme

| Work | Status | Record |
|---|---|---|
| Work-plan activation writes Strategic Goal links | In progress, branch `claude/optimistic-antonelli-66001c` | [record](../../changes/2026-11-12-work-plan-goal-links.md) *(on its branch)* |
| Task KPI picker scoped, with its goal trail | In progress, branch `claude/laughing-tharp-cb4136` | [record](../../changes/2026-11-12-task-kpi-picker.md) *(on its branch)* |
| Division metrics: alignment, risk and unit scores | In progress, branch `fix/division-headline-metrics` | [record](../../changes/2026-11-12-division-metrics.md) *(on its branch)* |
| Rest of the AI work (AI Hub, chats, gateway worker): uncommitted local changes | Not started | — |

## How to keep this page current

- **When a change starts:** add its row to the [change index](../../changes/README.md#index), and set the step to In progress here.
- **When it merges or goes live:** update the step status, the "Where we are" bullets and the date, and the record's Status and History.
- **When a decision is made:** update the register.
