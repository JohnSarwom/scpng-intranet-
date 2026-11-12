# Workflow Studio

| | |
|---|---|
| **Date** | 2026-11-11 (full screen added 2026-11-12) |
| **Status** | In review |
| **Programme step** | None (the tool the programme uses to draw its designs) |
| **Branch / PR / commits** | `feat/workflow-studio`, [PR #23](https://github.com/JohnSarwom/scpng-intranet-/pull/23), commits `0a4e97e` (studio) and `8f3c7a6` (full screen and panels) |
| **Decisions used** | Saved workflows go in a new `Workflow_Definitions` list. The AI uses the existing AI configuration (user, 2026-11-11). |

## Why

The user wanted to see how work moves through the intranet, starting with the Task Registry, inside the app and in its branding. They also wanted to draft new workflows with AI. This replaces the standalone V9 canvas HTML, which is kept only as a reference.

## What changed for users

- A new **Workflows** item in the sidebar, next to Strategy, opens `/workflows`.
- The built-in workflow "Task Registry → Strategic Goal" shows the code as it works today, with a step-by-step simulation.
- An **AI builder** drafts or changes workflows.
- Saved workflows go in SharePoint. Saving needs admin rights or the new "Create and edit workflows" permission.
- **Full screen**, and buttons to hide the workflow list and the inspector panel. The panel choice is remembered.

## Technical changes

| Area | Change |
|---|---|
| `src/workflows/` | The workflow types, validation, layout, AI-reply parsing, the run engine and the built-in definition. |
| `src/components/workflows/` | The canvas (pan, zoom, simulation), the inspector and the AI builder. |
| `src/pages/Workflows.tsx` | The page, including full screen. |
| `src/services/workflowDefinitionsService.ts`, `src/hooks/useWorkflowDefinitions.ts` | The `Workflow_Definitions` list: prepare, list, create, update and delete, with version checks. |
| `src/prompts/workflowBuilderPrompt.ts` | The AI prompt. |
| `src/config/navItems.ts`, `src/App.tsx`, `src/components/admin/RoleManagement.tsx` | The menu item, the route and the `strategy:manage_workflows` permission. |

## Data and SharePoint changes

- New list `Workflow_Definitions`: WorkflowKey (unique), Summary, Area, Status, Source, SchemaVersion and DefinitionJSON.
- An admin creates it from the page after a confirmation. **Not yet created on production.**

## How it was checked

- `workflowSchema`, `workflowRun` and `workflowDefinitionsService` tests passed, as did the navigation test. The TypeScript baseline and the build passed.
- A local browser check covered:
  - the simulation through the KPI branch;
  - an AI draft answered by Gemini;
  - full screen and both panel buttons at desktop and phone widths;
  - dark mode.
- **Not checked:** saving, publishing and deleting against the real list. Only mocked tests cover them.

## Follow-ups and open items

- Trace a real task's path.
- An approval step before publishing.
- Grant the "Create and edit workflows" permission to the right roles.

## How to undo it

Revert `8f3c7a6` and `0a4e97e`, or remove the menu item. The list, if created, can stay.

## History

- 2026-11-11: built and committed.
- 2026-11-12: full screen added; pushed in PR #23.
- 2026-11-13: record written. Module doc: [modules/workflows/overview.md](../modules/workflows/overview.md).
