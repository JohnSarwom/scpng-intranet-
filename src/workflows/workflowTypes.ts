/**
 * Workflow definitions shown in Workflow Studio.
 *
 * A workflow is plain data: built-in workflows are written in code and always
 * describe the code as it is; drafts from the AI builder and saved workflows
 * use the same shape and are stored as JSON in the Workflow_Definitions list.
 */

export type WorkflowNodeType =
  /** A person enters information. */
  | 'input'
  /** The system does something with no input. */
  | 'auto'
  /** The flow splits; see WorkflowGate. */
  | 'gate'
  /** The flow ends here. */
  | 'end'
  /** A unit or post in a structure chart. Only used when the workflow's kind is 'hierarchy'. */
  | 'org';

/**
 * 'process' (the default) is a flow of steps that can be simulated.
 * 'hierarchy' is a structure chart: one top box, every other box has exactly
 * one parent, drawn top-down. It has no fields, decisions or simulation.
 */
export type WorkflowKind = 'process' | 'hierarchy';

/** Level of a box in a structure chart; sets its colour and caption. */
export type OrgRank =
  | 'board'
  | 'executive'
  /** A unit or post reporting straight to the executive (e.g. Secretariat, Internal Audit). */
  | 'office'
  /** A grouping drawn for layout only; not a unit or post. */
  | 'group'
  | 'division'
  | 'director'
  | 'unit'
  | 'manager'
  | 'senior'
  | 'officer';

/** How much of a step, unit or post the app supports today. */
export type AppStatus = 'built' | 'partial' | 'missing';

export type WorkflowGateMode =
  /** Exactly one route is taken: the chosen option. */
  | 'or'
  /** Every route is taken. */
  | 'and'
  /** One or more chosen routes are taken. */
  | 'andor';

export type WorkflowFieldKind = 'text' | 'textarea' | 'date' | 'number' | 'select';

export interface WorkflowField {
  /** Slug, unique within the node. */
  key: string;
  label: string;
  kind: WorkflowFieldKind;
  /** Choices for a select field, and for a gate's choice field. */
  options?: string[];
  required?: boolean;
  /** Example value used by "Fill example". */
  example?: string;
}

export interface WorkflowGate {
  mode: WorkflowGateMode;
  /**
   * Key of the field on this node whose value picks the route(s). Its options
   * must match the `when` values on the node's outgoing flow edges. Not used
   * for 'and'. For 'andor' the value is a comma-separated list of options.
   */
  choiceField?: string;
  /**
   * Makes the decision automatic: "node.field" whose submitted value is used
   * as this decision's choice (e.g. "kpi.calculationType").
   */
  choiceFrom?: string;
}

export interface WorkflowNodeDetails {
  /** Where this happens, in words ("Task Registry → Tasks → Add task"). */
  screen?: string;
  /** App route for a link, e.g. "/unit". */
  route?: string;
  /** Lists and columns written. */
  writes?: string[];
  /** Business rules that apply at this step. */
  rules?: string[];
  /** Source files (repository paths) that implement the step. */
  code?: string[];
  /** How the app handles this step today, for target designs. */
  today?: string;
}

export interface WorkflowNode {
  /** Slug, unique within the workflow. */
  id: string;
  label: string;
  /** Short subtitle shown under the label. */
  sub?: string;
  type: WorkflowNodeType;
  /** Canvas position. Filled in by auto-layout when missing. */
  x?: number;
  y?: number;
  fields?: WorkflowField[];
  gate?: WorkflowGate;
  /**
   * Text recorded when the step completes. "{node.field}" placeholders are
   * replaced with submitted values, e.g. "KRA taken from {kpi.kpi}".
   */
  outcome?: string;
  details?: WorkflowNodeDetails;
  /** Main path, a side track feeding in, or a feedback loop. Display only. */
  track?: 'main' | 'side' | 'feedback';
  /** Structure charts only: the box's level. */
  rank?: OrgRank;
  /** Target designs: whether the app does this today (see details.today). */
  appStatus?: AppStatus;
}

export type WorkflowEdgeKind =
  /** Normal flow; carries the run. */
  | 'flow'
  /** Sends the run back to an earlier step. */
  | 'feedback'
  /** Shows that a step reads from another; does not carry the run. */
  | 'reads';

export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
  /** For edges leaving a gate: the option that takes this route. */
  when?: string;
  kind?: WorkflowEdgeKind;
}

export type WorkflowStatus =
  /** Built in: describes what the code does today. */
  | 'implemented'
  /** Built in: the agreed design. Each step's appStatus says how much the app does today. */
  | 'target'
  | 'draft'
  | 'published';

export type WorkflowSource = 'built-in' | 'ai' | 'manual';

export interface WorkflowDefinition {
  schemaVersion: number;
  /** Slug, unique across workflows. */
  id: string;
  title: string;
  summary?: string;
  /** Part of the organisation or app the workflow belongs to. */
  area?: string;
  status: WorkflowStatus;
  source: WorkflowSource;
  /** 'process' when left out. */
  kind?: WorkflowKind;
  /** Short notes shown above the canvas, e.g. "A task link does not mean KPI achievement." */
  notes?: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/** A workflow saved in the Workflow_Definitions list. */
export interface SavedWorkflow {
  /** SharePoint item ID. */
  itemId: string;
  revision: string;
  definition: WorkflowDefinition;
  createdBy?: string;
  modifiedBy?: string;
  modifiedAt?: string;
}
