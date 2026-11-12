/**
 * Built-in workflow: the agreed task assignment, review and reporting process,
 * from "02 — Task Assignment Workflow" (12 November 2026), refined against the
 * app. It is a target design: each step's appStatus and details.today say how
 * much of it the app does today. "Task Registry → Strategic Goal" describes the
 * part that is built in detail.
 *
 * Every `details.code` path is checked by a test. Positions are left out; the
 * canvas lays the steps out bottom-up.
 */

import type { WorkflowDefinition } from '../workflowTypes';

const TASK_FORM = 'src/components/unit-tabs/TaskDialog.tsx';
const OPS_SERVICE = 'src/services/sharePointOpsService.ts';

/** Who holds each review stage, by the assignee's reporting branch. */
const ROUTES = [
  'Divisions: Senior Officer → Manager → Director (only when escalated).',
  'Internal Audit: Senior Officer → Manager Internal Audit → CEO (only when escalated).',
  'Office of the General Counsel: the General Counsel approves; the CEO when escalated.',
  'Secretariat Unit: the CEO approves.',
];
const SKIP_RULE = 'A stage with nobody in it for the assignee’s branch is skipped, and nobody approves their own task (leave approvals already work this way).';

export const TASK_ASSIGNMENT_REVIEW: WorkflowDefinition = {
  schemaVersion: 1,
  id: 'task-assignment-review',
  title: 'Task assignment and review',
  summary:
    'The agreed process for a task: create and classify it, assign it, have it accepted, done, reviewed and approved, then measured and reported up to the CEO and the Board. Each step says how much of it the app does today.',
  area: 'Task Registry',
  status: 'target',
  source: 'built-in',
  notes: [
    'Target design: open a step to see what the app does today. Approval routing should be configurable; not every task needs a Director or the CEO.',
    'Verified completion is not the same as KPI achievement, and operational tasks never raise a strategic KPI.',
  ],
  nodes: [
    {
      id: 'create',
      label: 'Create task',
      sub: 'Title, deliverables, due date, priority',
      type: 'input',
      appStatus: 'built',
      fields: [
        { key: 'title', label: 'Task title', kind: 'text', required: true, example: 'Review and complete assigned deliverable' },
        { key: 'deliverables', label: 'Deliverables', kind: 'textarea', example: 'Licence review memo with findings' },
        { key: 'dueDate', label: 'Due date', kind: 'date', required: true, example: '2026-12-15' },
        { key: 'priority', label: 'Priority', kind: 'select', options: ['Low', 'Medium', 'High', 'Urgent'], required: true, example: 'Medium' },
      ],
      outcome: 'Task "{create.title}" created, due {create.dueDate} ({create.priority}).',
      details: {
        screen: 'Task Registry → Tasks → Add task',
        route: '/unit',
        writes: ['Operations_Tasks: Title, Description, Priority, StartDate, DueDate, Status, Assignees, RelatedTaskGroup'],
        today: 'Built. The task form records title, description, priority (low to urgent), start and due dates, status, assignees and task group. There is no separate deliverables field; deliverables go in the description.',
        code: [TASK_FORM, 'src/components/unit-tabs/TasksTab.tsx'],
      },
    },
    {
      id: 'classify',
      label: 'Classify task',
      sub: 'Approved KPI, or operational',
      type: 'gate',
      appStatus: 'built',
      gate: { mode: 'or', choiceField: 'type' },
      fields: [
        { key: 'type', label: 'What kind of task is it?', kind: 'select', options: ['KPI-linked task', 'Operational task'], required: true, example: 'KPI-linked task' },
      ],
      details: {
        screen: 'Task form → “Link to KPI”',
        route: '/unit',
        rules: ['Every new task is either linked to an approved KPI or marked operational.'],
        today: 'Built. New tasks must pick a KPI or “Operational work”. The form enforces it; the SharePoint service does not.',
        code: ['src/utils/taskAlignment.ts', TASK_FORM],
      },
    },
    {
      id: 'kpi',
      label: 'Link approved KPI',
      sub: 'Its KRA follows from the KPI',
      type: 'input',
      track: 'side',
      appStatus: 'built',
      fields: [
        { key: 'kpi', label: 'KPI', kind: 'text', required: true, example: 'Licence applications processed within 5 days' },
      ],
      outcome: 'Linked to KPI "{kpi.kpi}".',
      details: {
        screen: 'Task form → “Link to KPI”',
        route: '/unit',
        writes: ['Operations_Tasks.RelatedKPI, RelatedKRA (taken from the KPI)'],
        today: 'Built. Managers and admins can pick any KPI; staff only the KPIs assigned to them. The KRA is taken from the KPI, and a conflicting KRA is refused.',
        code: [TASK_FORM, OPS_SERVICE],
      },
    },
    {
      id: 'assign',
      label: 'Assign or delegate',
      sub: 'Authorised staff or a manager',
      type: 'input',
      appStatus: 'partial',
      fields: [
        { key: 'assignee', label: 'Assigned to (role)', kind: 'select', options: ['Officer', 'Senior Officer', 'Manager', 'Executive Officer'], required: true, example: 'Officer' },
        { key: 'assignedBy', label: 'Assigned by (role)', kind: 'select', options: ['Senior Officer', 'Manager', 'Director', 'General Counsel', 'CEO'], required: true, example: 'Manager' },
      ],
      outcome: 'Assigned to {assign.assignee} by {assign.assignedBy}.',
      details: {
        screen: 'Task form → Assignees',
        route: '/unit',
        writes: ['Operations_Tasks.Assignees', 'Notification to each assignee (in-app and email)'],
        rules: [
          'Work is assigned by someone above the assignee in the reporting line, or by their named delegate.',
          'The assignee is told straight away.',
        ],
        today: 'Partly built. Anyone can assign a task to anyone in the staff directory; the app doesn’t check who may assign to whom. Assignees get an in-app and email notification (not for self-assignment), and the task appears in their “Assigned to Me” group.',
        code: ['src/components/common/GlobalAssigneeSelector.tsx', OPS_SERVICE, 'src/utils/taskBoardUtils.ts'],
      },
    },
    {
      id: 'accept',
      label: 'Accept & plan',
      sub: 'Assignee confirms scope and timing',
      type: 'gate',
      appStatus: 'missing',
      gate: { mode: 'or', choiceField: 'decision' },
      fields: [
        { key: 'decision', label: 'Assignee’s answer', kind: 'select', options: ['Accept', 'Query or decline'], required: true, example: 'Accept' },
      ],
      details: {
        rules: ['The assignee confirms ownership, scope and timing, or queries the task before work starts.'],
        today: 'Not built. A task is live as soon as it is assigned; there is no accept or decline.',
        code: [TASK_FORM],
      },
    },
    {
      id: 'work',
      label: 'Perform task',
      sub: 'Progress, evidence, submit',
      type: 'input',
      appStatus: 'built',
      fields: [
        { key: 'progress', label: 'Progress update', kind: 'textarea', required: true, example: 'Draft complete; evidence attached' },
        { key: 'evidence', label: 'Evidence', kind: 'text', example: 'review-memo.pdf' },
      ],
      outcome: 'Submitted for review: {work.progress}',
      details: {
        screen: 'Task Registry → Tasks → open the task',
        route: '/unit',
        writes: ['Operations_Tasks.Status (In Progress, then Review)', 'Files in Task_Registry_Attachements', 'Operations_Tasks.CommentsJSON'],
        today: 'Built: assignees update the status, comment and attach files. Moving a task to “In Review” only changes its status; nobody is asked to review it.',
        code: [TASK_FORM, 'src/hooks/useSharePointUpload.ts'],
      },
    },
    {
      id: 'review',
      label: 'First-level review',
      sub: 'Senior Officer or supervisor verifies',
      type: 'gate',
      appStatus: 'missing',
      gate: { mode: 'or', choiceField: 'decision' },
      fields: [
        { key: 'decision', label: 'Review result', kind: 'select', options: ['Verified', 'Return for changes'], required: true, example: 'Verified' },
      ],
      details: {
        rules: [...ROUTES, SKIP_RULE],
        today: 'Not built. Tasks have no reviewer, and anyone who can open a task can mark it Done.',
        code: [TASK_FORM],
      },
    },
    {
      id: 'manager',
      label: 'Manager approval',
      sub: 'Approve, return or escalate',
      type: 'gate',
      appStatus: 'missing',
      gate: { mode: 'or', choiceField: 'decision' },
      fields: [
        { key: 'decision', label: 'Manager’s decision', kind: 'select', options: ['Approve', 'Return for changes', 'Escalate'], required: true, example: 'Approve' },
      ],
      details: {
        rules: [...ROUTES, 'Escalate only when approval rules or materiality require it.'],
        today: 'Not built for tasks. Managers approve only leave (the “Manager Review” stage).',
        code: ['src/services/hrSharePointService.ts'],
      },
    },
    {
      id: 'escalation',
      label: 'Director / CEO review',
      sub: 'Only when rules or materiality require',
      type: 'gate',
      track: 'side',
      appStatus: 'missing',
      gate: { mode: 'or', choiceField: 'decision' },
      fields: [
        { key: 'decision', label: 'Decision', kind: 'select', options: ['Approve', 'Return for changes'], required: true, example: 'Approve' },
      ],
      details: {
        rules: [
          'Divisions: the Director. Internal Audit and the Office of the General Counsel: the CEO.',
          'Not every task needs this stage.',
        ],
        today: 'Not built for tasks. Directors approve only leave (“Director Review”, which a unit can skip), and the CEO only executive leave.',
        code: ['src/services/hrSharePointService.ts', 'src/components/hr/WorkflowAdmin.tsx'],
      },
    },
    {
      id: 'verified',
      label: 'Verified completion',
      sub: 'Status, approver and evidence recorded',
      type: 'auto',
      appStatus: 'partial',
      outcome: 'Completed and verified, with evidence on file.',
      details: {
        writes: ['Operations_Tasks.Status = Done, CompletionDate'],
        rules: ['The final status is recorded with who approved it and the evidence.'],
        today: 'Partly built. Moving a task to Done sets its CompletionDate (cleared if it leaves Done). Who approved it isn’t recorded, and some summaries still use the last-edit time as the completion date.',
        code: [OPS_SERVICE],
      },
    },
    {
      id: 'measure',
      label: 'KPI or operational?',
      sub: 'Decided by the classification',
      type: 'gate',
      appStatus: 'built',
      gate: { mode: 'or', choiceField: 'type', choiceFrom: 'classify.type' },
      fields: [
        { key: 'type', label: 'Task kind', kind: 'select', options: ['KPI-linked task', 'Operational task'] },
      ],
      details: {
        rules: ['Uses the classification from step 2; nobody chooses again.'],
        today: 'Built: a task’s KPI link or operational tag decides how it is counted.',
        code: ['src/utils/taskAlignment.ts'],
      },
    },
    {
      id: 'kpi-result',
      label: 'Apply KPI measurement',
      sub: 'By the KPI’s calculation type',
      type: 'auto',
      appStatus: 'built',
      outcome: 'KPI updated by its approved measurement rule.',
      details: {
        rules: ['Measured by the KPI’s approved rule and evidence, not by task count alone.'],
        today: 'Built. Manual KPIs are unchanged; checklist KPIs mirror the task as a checklist item; task-completion KPIs take their status from their linked tasks.',
        code: [OPS_SERVICE],
      },
    },
    {
      id: 'operational-result',
      label: 'Track operational work',
      sub: 'Workload and service levels',
      type: 'auto',
      appStatus: 'partial',
      outcome: 'Counted as operational workload.',
      details: {
        rules: ['Tracks assignment, completion, service levels and workload. Never raises a strategic KPI.'],
        today: 'Partly built. Operational tasks are counted separately in the Division Linkage tab. There is no service-level or workload tracking yet.',
        code: ['src/services/linkageInventoryService.ts'],
      },
    },
    {
      id: 'rollup',
      label: 'Performance aggregation',
      sub: 'Staff → unit → division → organisation',
      type: 'auto',
      appStatus: 'partial',
      outcome: 'Results rolled up to unit, division and organisation.',
      details: {
        rules: ['Uses approved weights, measures and evidence. Units that report to the CEO roll up to the CEO directly.'],
        today: 'Partly built. The app rolls up KPI → KRA → Unit Objective → Strategic Goal (a KRA is the share of its KPIs completed; an objective is the average of its KRAs). It does not roll up by person, unit or division along the reporting line: the role-based cascade (Officer KPI → Manager KRA → Director KRA) is specified but not built.',
        code: ['src/utils/kpiUtils.ts', 'src/services/strategyExecutionGraphService.ts', 'docs/strategy-execution/PHASE-2-REVISION-role-based-cascade.md'],
      },
    },
    {
      id: 'ceo-dashboard',
      label: 'CEO dashboard',
      sub: 'Outcomes and exceptions',
      type: 'auto',
      appStatus: 'partial',
      outcome: 'Shown on the CEO dashboard.',
      details: {
        route: '/strategy',
        rules: ['Strategic outcomes, exception reporting and executive oversight.'],
        today: 'Partly built. Strategic Goal progress shows on the Strategy page and the Home overview. There is no CEO view or exception report.',
        code: ['src/pages/Strategy.tsx', 'src/components/dashboard/OrganizationalOverview.tsx'],
      },
    },
    {
      id: 'board',
      label: 'Board oversight',
      sub: 'Governance, not routine approval',
      type: 'end',
      appStatus: 'partial',
      outcome: 'Included in strategic reporting to the Board.',
      details: {
        rules: ['Board-level governance above the CEO. Tasks are escalated through executive management, not to the Board.'],
        today: 'Partly built. Strategy reports can be generated, frozen in the report archive and scheduled. There is no Board role in the app.',
        code: ['src/services/strategyReportArchiveService.ts', 'src/services/strategyReportSchedulerService.ts'],
      },
    },
  ],
  edges: [
    { from: 'create', to: 'classify' },
    { from: 'classify', to: 'kpi', when: 'KPI-linked task', label: 'KPI-linked' },
    { from: 'classify', to: 'assign', when: 'Operational task', label: 'Operational' },
    { from: 'kpi', to: 'assign' },
    { from: 'assign', to: 'accept' },
    { from: 'accept', to: 'work', when: 'Accept' },
    { from: 'accept', to: 'assign', when: 'Query or decline', label: 'Query', kind: 'feedback' },
    { from: 'work', to: 'review' },
    { from: 'review', to: 'manager', when: 'Verified' },
    { from: 'review', to: 'work', when: 'Return for changes', label: 'Return', kind: 'feedback' },
    { from: 'manager', to: 'verified', when: 'Approve' },
    { from: 'manager', to: 'work', when: 'Return for changes', label: 'Return', kind: 'feedback' },
    { from: 'manager', to: 'escalation', when: 'Escalate', label: 'Escalate' },
    { from: 'escalation', to: 'verified', when: 'Approve' },
    { from: 'escalation', to: 'work', when: 'Return for changes', label: 'Return', kind: 'feedback' },
    { from: 'verified', to: 'measure' },
    { from: 'measure', to: 'kpi-result', when: 'KPI-linked task' },
    { from: 'measure', to: 'operational-result', when: 'Operational task' },
    { from: 'kpi-result', to: 'rollup' },
    { from: 'operational-result', to: 'rollup' },
    { from: 'rollup', to: 'ceo-dashboard' },
    { from: 'ceo-dashboard', to: 'board' },
  ],
};
