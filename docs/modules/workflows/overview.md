# Workflow Studio

Route: `/workflows` (sidebar: **Workflows**, next to Strategy). Added 11 November 2026. It replaces the standalone `SCPNG_Canvas_First_Workflow_V9.html` demo, which is kept only as a reference.

The page lists the workflows in the system, draws the selected one on a canvas, and can simulate it step by step. Its AI builder drafts new workflows.

## What's on the page

| Area | What it does |
|---|---|
| Library (left) | **Built in** workflows, then any **Unsaved draft**, then **Saved** workflows from SharePoint. Searchable. |
| Canvas (centre) | Pan by dragging the background; zoom with the scroll wheel or the buttons; **Fit** shows the whole workflow. **Simulate** walks a sample record through the steps, with an animated data packet on each connection. **Edit layout** lets you drag steps, and **Tidy** re-lays them out. |
| Inspector (right) | Four tabs:<br>**Steps**: the active step's form, **Submit & cascade**, and **Fill example**.<br>**Details**: where the step happens, what it writes, its rules, and the source files.<br>**Live data**: what has been submitted.<br>**Changes**: the history. |
| AI builder (right) | Chat to draft or change a workflow. A valid answer appears on the canvas as an unsaved draft. |
| Full screen and panels | **Full screen** makes the studio fill the window (and hides the browser's own toolbar where allowed); **Exit full screen** or Esc leaves it. The two panel buttons in the canvas toolbar turn the workflow list (left) and the inspector/AI panel (right) on or off; the choice is remembered in the browser. Hidden panels keep their state (the AI conversation, the simulation). If a simulation step needs input while the right panel is off, a **Fill in "…"** button opens it. |

Simulations run in the browser only. Nothing in a simulation is saved or sent to SharePoint.

## Built-in workflows

These are written in code, so they always describe what the app does: [builtInWorkflows.ts](../../../src/workflows/builtInWorkflows.ts).

**Task Registry → Strategic Goal** ([definition](../../../src/workflows/definitions/taskRegistryToStrategicGoal.ts)) shows how a task reaches an organisational goal:
1. Create or edit the task.
2. Strategy alignment: link a KPI, or mark the task operational.
3. Choose the KPI.
4. The KRA is set from the KPI.
5. Save, with a version check.
6. KPI reconciliation, by the KPI's calculation type.
7. KRA rollup.
8. Unit Objective rollup.
9. Strategic Goal (`Strategic_Goals`, calculated live).
10. Where the results appear.

The diagram also shows two side tracks (Corporate Plan KRAs, and the admin goal-link review) and the manager triage loop in the Division Linkage tab.

When this behaviour changes in code, update the definition in the same change. A test checks that every source file cited in `details.code` exists.

To add a built-in workflow:
1. Add a file under `src/workflows/definitions/`.
2. Add it to `builtInWorkflows.ts`.
3. Run the tests.

## Definition format

The types are in [workflowTypes.ts](../../../src/workflows/workflowTypes.ts); validation is in [workflowSchema.ts](../../../src/workflows/workflowSchema.ts).

- **Steps** (`nodes`) have a type:
  - `input`: a person fills in fields.
  - `auto`: the system does it.
  - `gate`: a decision. Mode `or` takes one route, `and` takes all routes, `andor` takes the chosen routes.
  - `end`: the flow stops.

  Steps can carry `fields`, an `outcome` text with `{step.field}` placeholders, and `details` (screen, route, writes, rules, code).
- **Connections** (`edges`):
  - `flow` moves the work on.
  - `feedback` sends it back to an earlier step and clears the steps after it.
  - `reads` shows that a step uses information from a side step.

  A decision's routes carry `when`, set to one of its options. `gate.choiceFrom` makes a decision automatic from an earlier answer.
- **Checks**:
  - one starting step;
  - every main step reachable from the start and leading on;
  - decisions route every option;
  - at most 40 steps and 80 connections, and 60,000 characters of JSON.

  Positions are optional; missing ones are laid out bottom-up.

The simulation engine is [workflowRun.ts](../../../src/workflows/workflowRun.ts). A merge step waits only for branches that were actually started.

## Saved workflows: `Workflow_Definitions` list

Service: [workflowDefinitionsService.ts](../../../src/services/workflowDefinitionsService.ts). Hooks: [useWorkflowDefinitions.ts](../../../src/hooks/useWorkflowDefinitions.ts).

| Column | Type | Notes |
|---|---|---|
| Title | text | Workflow title |
| WorkflowKey | text, indexed, unique | The definition's `id`; never changes |
| Summary | multi-line text | |
| Area | text | |
| Status | text | `draft` or `published` |
| Source | text | `ai` or `manual` |
| SchemaVersion | number | 1 |
| DefinitionJSON | multi-line plain text | The full definition |

- The list is not created automatically. An administrator clicks **Create list** on the page and confirms. The same button repairs missing columns.
- Every definition is validated when it is saved and when it is read. An item that fails is listed as "can't be opened" and never drawn.
- Updates and deletes send the version that was loaded (`If-Match`). If someone else changed the workflow meanwhile, the save is refused.
- Built-in workflows can't be saved. **Duplicate as draft** copies one into a new draft.

## Permissions

- **Viewing** the page uses the existing `strategy` read permission.
- **Saving, publishing and deleting** need admin rights or the `strategy` extra action **Create and edit workflows (Workflow Studio)** (`manage_workflows`), set in Admin → Role Management.
- Anyone who can view the page can draft with AI and export JSON.

## AI builder

Component: [WorkflowAIBuilder.tsx](../../../src/components/workflows/WorkflowAIBuilder.tsx). Prompt: [workflowBuilderPrompt.ts](../../../src/prompts/workflowBuilderPrompt.ts).

- It uses the app's existing AI configuration through `useAiService('strategy')`: the preferred provider and model from Admin → API & Integrations, automatic fallback, and the secure gateway. It runs under the gateway's existing `strategy` feature, so no gateway change is needed.
- The AI must answer with a short explanation and the complete JSON inside `<workflow>…</workflow>`.
  - The reply is parsed and validated. AI drafts are always `draft` / `ai`, whatever the reply claims.
  - If the reply is invalid, the problems are listed with a one-click "fix these problems" follow-up.
- A checkbox controls whether a request builds on the workflow on the canvas. It is on for drafts and saved workflows (refining keeps the ID) and off for built-in ones; the starter suggestions always draft a new workflow. When it is on, the workflow is sent in compact form, without positions or source files. A built-in workflow is used only as the starting point for a new draft.
- Requests stay within the app's 32,000-character AI request limit. Older workflow JSON is removed from the chat history.
- The prompt asks for roles rather than named people, and no personal data.

## Tests

`node scripts/run-strategy-tests.mjs` runs these suites:
- `src/tests/workflowSchema.test.cjs`: validation, layout, AI parsing, and that the built-in workflow is valid and its cited files exist.
- `src/tests/workflowRun.test.cjs`: or/and/andor routing, merges, feedback, and the Task Registry run through the KPI and operational branches.
- `src/tests/workflowDefinitionsService.test.cjs`: list preparation, paging, round-trips, invalid items, and version conflicts against a fake Graph client.

The menu entry is covered in `src/config/navItems.test.ts` (Vitest).

## Not included yet

- Tracing a real task's live path.
- Running or enforcing saved workflows. Workflows are documentation and simulation.
- An approval step for publishing.
