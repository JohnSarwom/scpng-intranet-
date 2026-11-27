# Organisation, reporting and task flow: drafts checked against the app

12 November 2026. Sources: the three layered HTML drafts "01 Reporting Hierarchy", "02 Task Assignment Workflow" and "03 Organisational Structure". They are now built-in **Target design** workflows in Workflow Studio (`/workflows`); see [overview.md](overview.md#target-designs-added-12-november-2026).

The check covered the code: division and unit names, user roles, the leave approval routing, the task form and services, and the strategy rollups. It also read live data in a signed-in session:
- the `Strategy_Divisions` and `Strategy_Units` lists;
- the leave approver set-up (division, unit and stage only);
- department and job-title counts from the staff directory (no names).

Officer profiles' "reports to" fields were not read.

## Changes made to the drafts

1. **Structure and reporting are now two different charts.** Drafts 01 and 03 drew the same tree. "Organisational structure" now shows units (Board → CEO → three units and four divisions → their units). "Reporting hierarchy" shows posts (Officer → Senior Officer → Manager → Director → CEO → Board).
2. **Divisions don't report through the General Counsel.** Draft 02's branch picker said "Director → General Counsel → CEO" and "Manager Internal Audit → General Counsel → CEO". That contradicts drafts 01 and 03, which say both report straight to the CEO. The charts follow 01 and 03.
3. **The Executive Officer belongs to the General Counsel's office, not the Secretariat.** Draft 02 had "Secretariat: Executive Officer → General Counsel → CEO". In draft 03 the Executive Officer sits under the General Counsel, and the Secretariat Unit has no posts and reports to the CEO. The charts now show:
   - Office of the General Counsel: Executive Officer → General Counsel → CEO.
   - Secretariat Unit → CEO. This also matches the app, which sends Secretariat leave to the CEO.
4. **The "Four Main Divisions" box is marked as layout only.** It keeps the divisions on one row, but it is left out of reporting lines and totals.
5. **The task flow got explicit routes:**
   - Only KPI-linked tasks pass through "Link approved KPI".
   - At "Accept & plan", the assignee can query or decline, which returns the task to the assigner.
   - "Return for changes" at either review sends the task back to "Perform task".
   - Director/CEO review is a side step that a task reaches only when it is escalated.
   - Measurement splits by the earlier classification: KPI-linked tasks follow the KPI's rule, operational tasks are tracked as workload. Both feed aggregation.
6. **Escalation from Internal Audit and the General Counsel's office goes to the CEO**, since neither has a Director.
7. **Two rules are reused from leave approvals:**
   - A stage with nobody in it for the assignee's branch is skipped.
   - Nobody approves their own task.

## How the app compares

| Design | In the app | Partly built | Not built yet |
|---|---|---|---|
| Organisational structure (21 units, plus the layout box) | 2 | 15 | 4 |
| Reporting hierarchy (48 posts, plus the layout box) | 11 | 16 | 21 |
| Task assignment and review (16 steps) | 6 | 6 | 4 |

"In the app" means it works today with live data, not just that the code supports it. For example, a unit whose live record isn't linked to its division counts as partly built.

### Live data (12 November 2026)

**`Strategy_Divisions`** has six divisions:
- **Office of the Chairman**, headed by the CEO.
- **Corporate Services Division.**
- **Licensing, Market & Supervision Division.**
- **Legal Services Division.** Its head is recorded as a Legal Manager, not a Director.
- **Research & Publication Division.**
- **Executive Division**, headed by the General Counsel. It is probably the design's Office of the General Counsel under another name.

**`Strategy_Units` has 12 units, and 10 aren't linked to their division.**
- Linked: Secretariat Unit (to Office of the Chairman) and Licensing Unit (to Licensing, Market & Supervision).
- Not linked: the other 10, whose division is the placeholder "Related Division". "Executive Division" also appears here as a unit.
- The names are "Human Resource Unit" and "Publication Unit".

**Leave approvers** are set up only for the IT Unit (Manager, Director and HR Review), plus one CEO Review approver. No other unit has approvers.

**Staff directory** (34 accounts with a department or job title):
- **Departments are mostly unit names, with variants:** "Research & Publication", "Research and Publication", "Information Technology", and trailing spaces.
- **The design's licensing division name is already in use:** one department reads "Licensing Investigation and Supervision Division".
- **Job titles:**
  - 9 include "Senior", so the Senior Officer level exists in practice.
  - 5 include "Manager" and 2 "Director".
  - One each for "General Counsel" and "Executive Officer".
  - None for Internal Audit or Investments.

### Names and units

The app spells and places divisions and units differently in different places. The places are:
- the strategy seed (`kraKpiSeedService.ts`) and the strategy org chart (`OrgChart.tsx`);
- Admin → Users (`UserManagement.tsx`);
- `src/data/divisions.ts`.

| Design | In the app |
|---|---|
| Licensing, Investigation & Supervision Division (LISD) | "Licensing, Market & Supervision Division", or "Licensing Market & Supervision Division" (LMSD) |
| Office of the CEO | "Office of the Chairman" (strategy) or "Executive Division" with an Executive Unit (Admin → Users) |
| Secretariat Unit | Placed in three ways: under "Office of the Chairman", under "Executive Division", or as a division of its own. The Strategy page shows its head as "General Counsel / Manager Audit". |
| Human Resource Unit | Admin → Users alone spells it "Human Resources Unit" |
| Media & Publication Unit | "Publication Unit" in the live list, the directory, the seed and the org chart; "Media & Publication Unit" only in Admin → Users |
| Office of the General Counsel | Probably the live "Executive Division", which the General Counsel heads |
| Internal Audit Unit, Legal Enforcement & Compliance Unit, Investments Unit | Not in any list |
| (not in the design) | Admin → Users also offers "Corporate Services Unit" and "Administrative Services" under CSD |

Approvers and division scope match units by name, so the different spellings and placements stop them matching each other.

### Roles and approvals

- **User roles** are Staff Member, Manager, Admin and Super Admin. There is no Director, Senior Officer, CEO or Board role. KPIs carry a level of director, manager or staff.
- **Only leave has approval routing:**
  - The standard route is Manager Review → Director Review → HR Review. A unit can skip Director Review.
  - The executive route, CEO Review → HR Review, is used by the Office of the Chairman, the Executive Division, the Secretariat and anyone whose profile reports to the CEO.
  - Approvers are set per division, unit and stage, with delegates and escalation contacts.
  - Empty stages are skipped, and nobody approves their own request.
- **Tasks have no routing:**
  - Anyone can assign anyone. Assignees get an in-app and email notification.
  - There is no accept step.
  - "In Review" has no reviewer, and anyone who can open a task can mark it Done.
  - Done records a completion date but not who approved the task.
- **Rollups follow the strategy chain:** KPI → KRA → Unit Objective → Strategic Goal. They do not roll up along the reporting line. The role-based cascade is specified in `docs/strategy-execution/PHASE-2-REVISION-role-based-cascade.md` but not built.

## Decisions needed

1. **The licensing division's official name:** Investigation or Market. The staff directory already uses "Investigation" for one person.
2. **Whether the live "Executive Division" is the Office of the General Counsel.** If so, rename it, and decide where its Executive Unit goes.
3. **Where the Secretariat sits and who heads it.** The live list puts it under the Office of the Chairman, as the design does. The Strategy page heading says "General Counsel / Manager Audit".
4. **Whether to add the missing units:** the Internal Audit Unit, the Legal Enforcement & Compliance Unit and the Investments Unit. Also whether to keep or remove CSD's extra "Corporate Services Unit" and "Administrative Services" in Admin → Users.
5. **Which tasks need Director or CEO approval** (the materiality rule).
6. **Whether Senior Officer becomes a role**, so first-level review can be routed to one.

## Data fixes that need no code

An administrator can make these fixes now:
- In `Strategy_Units`, set each unit's division (10 units point at "Related Division").
- In HR → Workflow admin, set Manager and Director approvers for every unit, not just IT.
- In the directory, tidy the department names so they match the unit list.

## Suggested build order, once the decisions are made

1. **One list of divisions and units.** Admin → Users, the org chart, the strategy seed and leave approvers should all read from it.
2. **Task review on the leave approval engine.** Approvers are already set per division, unit and stage, and empty stages are already skipped. Moving a task to In Review should go to the reviewer, then the manager, then escalation when needed. The approver and the verified date should be recorded.
3. **Accept or query on assignment.**
4. **Assignment rights.** Only someone above the assignee in the reporting line, or their named delegate, can assign work to them.
