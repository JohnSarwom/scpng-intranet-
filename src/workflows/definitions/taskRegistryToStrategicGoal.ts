/**
 * Built-in workflow: how a Task Registry task reaches an organisational goal,
 * as the code does it today (11 November 2026).
 *
 * Every step's `details.code` names the files that implement it; a test checks
 * those files exist, so this definition is reviewed whenever they move. When
 * the behaviour changes, update this file in the same change.
 *
 * Positions are left out; the canvas lays the steps out bottom-up.
 */

import type { WorkflowDefinition } from '../workflowTypes';

export const TASK_REGISTRY_TO_STRATEGIC_GOAL: WorkflowDefinition = {
  schemaVersion: 1,
  id: 'task-registry-to-strategic-goal',
  title: 'Task Registry → Strategic Goal',
  summary:
    'How a task created in the Task Registry is linked to a KPI, rolls up through its KRA and Unit Objective, and reaches a Strategic Goal in the Strategic_Goals list. Tasks can instead be marked as operational work.',
  area: 'Task Registry',
  status: 'implemented',
  source: 'built-in',
  notes: [
    'Linking a task to a KPI records alignment. It does not mean the KPI is achieved.',
    'Rollups after the save run automatically in the app; nothing on this page writes to SharePoint.',
  ],
  nodes: [
    {
      id: 'task',
      label: 'Create or edit task',
      sub: 'Task Registry → Tasks',
      type: 'input',
      fields: [
        { key: 'title', label: 'Task title', kind: 'text', required: true, example: 'Prepare quarterly licensing report' },
        { key: 'description', label: 'Description', kind: 'textarea', example: 'Compile licence application figures for Q4' },
        { key: 'assignees', label: 'Assigned to (role)', kind: 'text', example: 'Licensing Officer' },
        { key: 'dueDate', label: 'Due date', kind: 'date', example: '2026-12-15' },
        { key: 'status', label: 'Status', kind: 'select', options: ['To do', 'In progress', 'Review', 'Done'], required: true, example: 'In progress' },
      ],
      outcome: 'Task "{task.title}" entered with status {task.status}.',
      details: {
        screen: 'Task Registry → Tasks → Add task (or open a task)',
        route: '/unit',
        writes: [
          'Operations_Tasks: Title, Description, Status, Priority, StartDate, DueDate, Assignees, Department, RelatedTaskGroup, Tags',
          'CompletionDate is set when an existing task is moved to Done and cleared when it leaves Done',
        ],
        rules: [
          'A title is required.',
          'Only the task fields are saved here; the strategy link is chosen in the next step of the same form.',
        ],
        code: [
          'src/components/unit-tabs/TaskDialog.tsx',
          'src/components/unit-tabs/TasksTab.tsx',
          'src/hooks/useSharePointOps.ts',
        ],
      },
    },
    {
      id: 'alignment',
      label: 'Strategy alignment',
      sub: 'Link a KPI, or mark operational',
      type: 'gate',
      gate: { mode: 'or', choiceField: 'choice' },
      fields: [
        { key: 'choice', label: 'How does this task relate to strategy?', kind: 'select', options: ['Link to a KPI', 'Operational work'], required: true, example: 'Link to a KPI' },
      ],
      details: {
        screen: 'Task form → "Link to KPI" list',
        route: '/unit',
        rules: [
          'New tasks must either pick a KPI or be marked as operational work.',
          'Existing tasks can be saved while still undecided.',
          'The rule is enforced by the task form, not by the SharePoint service.',
        ],
        code: ['src/utils/taskAlignment.ts', 'src/components/unit-tabs/TaskDialog.tsx'],
      },
    },
    {
      id: 'operational',
      label: 'Operational work',
      sub: 'Not linked to strategy',
      type: 'end',
      outcome: 'Tagged strategy:operational; any KPI and KRA links cleared.',
      details: {
        screen: 'Task form → "Operational work (not linked to strategy)"',
        route: '/unit',
        writes: ['Operations_Tasks.Tags: adds strategy:operational', 'Operations_Tasks.RelatedKPI and RelatedKRA: cleared'],
        rules: [
          'Counted separately in the Division Linkage tab and left out of the traced share.',
          'The task stays on the board and works as normal.',
        ],
        code: ['src/utils/taskAlignment.ts', 'src/services/linkageInventoryService.ts'],
      },
    },
    {
      id: 'kpi',
      label: 'Choose KPI',
      sub: 'Performance indicator',
      type: 'input',
      fields: [
        { key: 'kpi', label: 'KPI', kind: 'text', required: true, example: 'Licence applications processed within 5 days' },
        {
          key: 'calculationType',
          label: "KPI's calculation type",
          kind: 'select',
          options: ['manual', 'checklist', 'task-completion'],
          required: true,
          example: 'checklist',
        },
      ],
      outcome: 'Linked to KPI "{kpi.kpi}" ({kpi.calculationType}).',
      details: {
        screen: 'Task form → "Link to KPI" list',
        route: '/unit',
        writes: ['Operations_Tasks.RelatedKPI'],
        rules: [
          'Managers and admins can pick any KPI in the organisation.',
          'Staff can pick only the KPIs they are assigned to.',
          'The list shows KPI names only, without their KRA or goal.',
        ],
        code: ['src/components/unit-tabs/TaskDialog.tsx', 'src/hooks/useSharePointOps.ts'],
      },
    },
    {
      id: 'kra',
      label: 'KRA set from KPI',
      sub: 'Derived, never chosen',
      type: 'auto',
      outcome: 'KRA taken from KPI "{kpi.kpi}".',
      details: {
        writes: ['Operations_Tasks.RelatedKRA'],
        rules: [
          "The task's KRA always comes from its KPI.",
          'A save that sends a different KRA is refused.',
          'When a KPI moves to another KRA, its tasks are moved with it.',
        ],
        code: ['src/services/sharePointOpsService.ts'],
      },
    },
    {
      id: 'save',
      label: 'Save with version check',
      sub: 'Operations_Tasks',
      type: 'auto',
      outcome: 'Task saved against the version the form opened.',
      details: {
        writes: ['Operations_Tasks item (If-Match on its version)'],
        rules: [
          'Refused if someone else changed the task after it was opened.',
          'Follow-up saves use the latest saved version.',
        ],
        code: ['src/services/sharePointOpsService.ts', 'src/utils/latestRevision.ts'],
      },
    },
    {
      id: 'reconcile',
      label: 'KPI reconciliation',
      sub: "By the KPI's calculation type",
      type: 'gate',
      gate: { mode: 'or', choiceField: 'calculationType', choiceFrom: 'kpi.calculationType' },
      fields: [
        { key: 'calculationType', label: 'Calculation type', kind: 'select', options: ['manual', 'checklist', 'task-completion'], required: true },
      ],
      details: {
        rules: [
          'Runs after every create, update or delete of a task linked to a KPI, including the KPI it was moved from.',
          'Reads every page of tasks, so links on later pages are not dropped.',
          'Writes with the KPI version and retries once if another save got there first.',
        ],
        code: ['src/services/sharePointOpsService.ts'],
      },
    },
    {
      id: 'kpiManual',
      label: 'Manual KPI unchanged',
      sub: 'Task is supporting evidence',
      type: 'auto',
      outcome: 'Manual KPI: target, actual and status are left as entered.',
      details: {
        rules: ['Linking a task never changes how a manual KPI is measured.'],
        code: ['src/services/sharePointOpsService.ts'],
      },
    },
    {
      id: 'kpiChecklist',
      label: 'Checklist item updated',
      sub: 'Task mirrored on the KPI',
      type: 'auto',
      outcome: 'Task mirrored as a checklist item; KPI status set from the checklist.',
      details: {
        writes: ['Performance_KPIs: ChecklistJSON, Status (Completed / In Progress / Not Started)'],
        rules: ['Checklist items not tied to a task are kept.', 'Items for unlinked or deleted tasks are removed.'],
        code: ['src/services/sharePointOpsService.ts'],
      },
    },
    {
      id: 'kpiTaskCompletion',
      label: 'Status from linked tasks',
      sub: 'Task-completion KPI',
      type: 'auto',
      outcome: 'KPI status set from all its linked tasks.',
      details: {
        writes: ['Performance_KPIs.Status'],
        rules: ['Completed when every linked task is Done; In Progress once any has started.'],
        code: ['src/services/sharePointOpsService.ts'],
      },
    },
    {
      id: 'kraRollup',
      label: 'KRA rollup',
      sub: 'Performance_KRAs',
      type: 'auto',
      outcome: 'KRA progress set to the share of its KPIs that are Completed.',
      details: {
        writes: ['Performance_KRAs: Progress, Status (Closed at 100%, otherwise Open)'],
        rules: [
          'Retired KPIs are left out.',
          'The Strategy page recalculates on view and weights KPIs when weights are set, so its figure can differ from the stored one.',
        ],
        code: ['src/services/sharePointOpsService.ts', 'src/utils/kpiUtils.ts'],
      },
    },
    {
      id: 'objective',
      label: 'Unit Objective rollup',
      sub: 'Unit_Objectives',
      type: 'auto',
      outcome: 'Objective progress set to the average of its active KRAs.',
      details: {
        writes: ['Unit_Objectives: Progress, Status'],
        rules: [
          'Retired KRAs are left out.',
          'A KRA without an Objective stops the chain here.',
        ],
        code: ['src/services/sharePointOpsService.ts'],
      },
    },
    {
      id: 'goal',
      label: 'Strategic Goal',
      sub: 'Strategic_Goals, calculated live',
      type: 'auto',
      outcome: 'Goal progress recalculated from its linked objectives and Corporate Plan KRAs.',
      details: {
        screen: 'Strategy → goal cards',
        route: '/strategy',
        writes: ['Nothing stored: calculated each time the page is viewed'],
        rules: [
          "An objective counts toward a goal only through its Strategic Goal link (the StrategicGoal column).",
          'Objectives without the link are shown as "Not linked to a Strategic Goal".',
          'A goal with nothing linked shows no data rather than 0% progress.',
        ],
        code: ['src/utils/kpiUtils.ts', 'src/utils/strategicGoalLink.ts', 'src/pages/Strategy.tsx'],
      },
    },
    {
      id: 'shows',
      label: 'Where it shows',
      sub: 'Strategy, Home, Linkage tab, reports',
      type: 'end',
      outcome: 'Visible on the Strategy page, Home overview, Division Linkage tab and frozen reports.',
      details: {
        screen: 'Strategy page; Home → Organizational Overview; Division → Linkage; Unit and Division reports',
        route: '/strategy',
        rules: [
          'The Linkage tab counts a task as traced only when every link reaches an existing Strategic Goal.',
          'Reports freeze a snapshot of the chain when they are generated.',
        ],
        code: [
          'src/pages/Strategy.tsx',
          'src/components/dashboard/OrganizationalOverview.tsx',
          'src/components/division/tabs/DivisionLinkageTab.tsx',
          'src/services/strategyReportingService.ts',
        ],
      },
    },
    {
      id: 'corporate',
      label: 'Corporate Plan KRAs',
      sub: 'Strategic_KRAs and Initiatives',
      type: 'auto',
      track: 'side',
      details: {
        writes: ['Read only here'],
        rules: [
          'Strategic_KRAs belong to a goal; Strategic_Initiatives belong to a Strategic KRA.',
          'When a goal has both linked objectives and Strategic KRAs, the two are averaged equally.',
        ],
        code: ['src/services/strategyService.ts', 'src/utils/kpiUtils.ts'],
      },
    },
    {
      id: 'goalLinks',
      label: 'Goal link review',
      sub: 'Admin sets objective → goal links',
      type: 'input',
      track: 'side',
      fields: [
        { key: 'goal', label: 'Strategic Goal for the objective', kind: 'text', example: 'Policy Development' },
      ],
      details: {
        screen: 'Test Ground → Strategic Goal links (admin)',
        route: '/test-ground',
        writes: ['Unit_Objectives.StrategicGoal (after confirmation)'],
        rules: [
          'Reviewing only reads; creating the column, adding goals and applying links each ask for confirmation.',
          'New initiatives on the Unit page must choose a Strategic Goal.',
        ],
        code: ['src/components/strategy/StrategicGoalLinkPanel.tsx', 'src/components/unit-tabs/KRAsTab.tsx'],
      },
    },
    {
      id: 'triage',
      label: 'Manager triage',
      sub: 'Division → Linkage tab',
      type: 'input',
      track: 'feedback',
      fields: [
        { key: 'action', label: 'Clean-up action', kind: 'select', options: ['Link to a KPI', 'Mark operational'], example: 'Link to a KPI' },
      ],
      details: {
        screen: 'Division → Linkage tab → select unlinked tasks',
        route: '/division',
        writes: ['Operations_Tasks: RelatedKPI and RelatedKRA, or the strategy:operational tag'],
        rules: [
          "Available to the division's managers and directors, and to admins.",
          'Each task is saved with the version that was loaded; failures are reported per task.',
        ],
        code: ['src/components/division/tabs/DivisionLinkageTab.tsx', 'src/hooks/useLinkageInventory.ts'],
      },
    },
  ],
  edges: [
    { from: 'task', to: 'alignment' },
    { from: 'alignment', to: 'kpi', when: 'Link to a KPI', label: 'KPI' },
    { from: 'alignment', to: 'operational', when: 'Operational work', label: 'Operational' },
    { from: 'kpi', to: 'kra' },
    { from: 'kra', to: 'save' },
    { from: 'save', to: 'reconcile' },
    { from: 'reconcile', to: 'kpiManual', when: 'manual', label: 'manual' },
    { from: 'reconcile', to: 'kpiChecklist', when: 'checklist', label: 'checklist' },
    { from: 'reconcile', to: 'kpiTaskCompletion', when: 'task-completion', label: 'task-completion' },
    { from: 'kpiManual', to: 'kraRollup' },
    { from: 'kpiChecklist', to: 'kraRollup' },
    { from: 'kpiTaskCompletion', to: 'kraRollup' },
    { from: 'kraRollup', to: 'objective' },
    { from: 'objective', to: 'goal' },
    { from: 'goal', to: 'shows' },
    { from: 'corporate', to: 'goal', kind: 'reads', label: 'feeds' },
    { from: 'goalLinks', to: 'goal', kind: 'reads', label: 'sets links' },
    { from: 'triage', to: 'alignment', kind: 'feedback', label: 'cleans up' },
  ],
};
