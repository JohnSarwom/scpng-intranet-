/**
 * Step engine for simulating a workflow on the canvas. Nothing is saved; the
 * run lives in memory. Generalises the V9 demo's determineNext/sequence:
 *
 * - A decision ('gate') routes by its choice field: 'or' takes the chosen
 *   route, 'and' takes every route, 'andor' takes each chosen route.
 * - A step with several incoming routes (a merge) waits while any other active
 *   branch can still reach it, so it waits only for branches actually started.
 * - A feedback route sends the run back to an earlier step and clears the
 *   steps after it, like V9's "Return for revision".
 *
 * Kept free of runtime imports so the Node test harness can load it directly.
 */

import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from './workflowTypes';

export type RunValues = Record<string, Record<string, string>>;

export interface RunEvent {
  kind: 'started' | 'submitted' | 'automatic' | 'waiting' | 'returned' | 'finished';
  nodeId: string;
  detail: string;
}

export interface RunState {
  /** Steps waiting to be done (one token each). */
  active: string[];
  /** Merge steps that have received a branch and wait for the others. */
  waiting: string[];
  /** Completed steps, in order. */
  completed: string[];
  values: RunValues;
  history: RunEvent[];
  finished: boolean;
}

export interface Transfer {
  from: string;
  to: string;
  kind: 'flow' | 'feedback';
}

export interface AdvanceResult {
  state: RunState;
  transfers: Transfer[];
}

const kindOf = (edge: WorkflowEdge) => edge.kind || 'flow';
const nodeById = (definition: WorkflowDefinition, id: string): WorkflowNode | undefined =>
  definition.nodes.find(node => node.id === id);

function startNodeId(definition: WorkflowDefinition): string | null {
  const starts = definition.nodes.filter(node =>
    (node.track || 'main') === 'main' &&
    !definition.edges.some(edge => edge.to === node.id && kindOf(edge) === 'flow'));
  return starts.length === 1 ? starts[0].id : null;
}

/** Every step reachable from `ids` over flow edges, including the steps themselves. */
export function reachableFrom(definition: WorkflowDefinition, ids: string[]): Set<string> {
  const seen = new Set(ids);
  const queue = [...ids];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of definition.edges) {
      if (edge.from !== current || kindOf(edge) !== 'flow' || seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return seen;
}

export function startRun(definition: WorkflowDefinition): RunState {
  const start = startNodeId(definition);
  if (!start) throw new Error('This workflow has no single starting step.');
  return {
    active: [start],
    waiting: [],
    completed: [],
    values: {},
    history: [{ kind: 'started', nodeId: start, detail: `Started at ${nodeById(definition, start)?.label || start}.` }],
    finished: false,
  };
}

/** Labels of required fields (and a decision's choice) still empty. */
export function missingRequired(definition: WorkflowDefinition, nodeId: string, values: Record<string, string>): string[] {
  const node = nodeById(definition, nodeId);
  if (!node) return [];
  // A decision's choice is required unless every route is taken ('and').
  const choiceKey = node.gate && node.gate.mode !== 'and' ? node.gate.choiceField : undefined;
  return (node.fields || [])
    .filter(field => (field.required || field.key === choiceKey) && !(values[field.key] || '').trim())
    .map(field => field.label);
}

/**
 * For an automatic decision (gate.choiceFrom), the values it submits: its
 * choice field set from the earlier answer. Null when the decision isn't
 * automatic or the earlier answer is missing.
 */
export function derivedChoice(definition: WorkflowDefinition, nodeId: string, values: RunValues): Record<string, string> | null {
  const node = nodeById(definition, nodeId);
  const from = node?.gate?.choiceFrom;
  const field = node?.gate?.choiceField;
  if (!from || !field) return null;
  const [sourceNode, sourceField] = from.split('.');
  const value = values[sourceNode]?.[sourceField];
  return value ? { [field]: value } : null;
}

/** Example values for a step's fields, for "Fill example". */
export function exampleValues(definition: WorkflowDefinition, nodeId: string): Record<string, string> {
  const node = nodeById(definition, nodeId);
  const result: Record<string, string> = {};
  for (const field of node?.fields || []) {
    result[field.key] = field.example ?? field.options?.[0] ?? `Example ${field.label.toLowerCase()}`;
  }
  return result;
}

/** Replaces "{node.field}" placeholders with submitted values. */
export function renderOutcome(template: string, values: RunValues): string {
  return template.replace(/\{([a-z0-9_-]+)\.([a-z0-9_]+)\}/gi, (match, node, field) => values[node]?.[field] || match);
}

/** The routes a completed step takes, given its submitted values. */
export function routesFrom(definition: WorkflowDefinition, nodeId: string, values: Record<string, string>): WorkflowEdge[] {
  const node = nodeById(definition, nodeId);
  const routes = definition.edges.filter(edge => edge.from === nodeId && kindOf(edge) !== 'reads');
  if (!node || node.type !== 'gate' || !node.gate) return routes.filter(edge => kindOf(edge) === 'flow');
  if (node.gate.mode === 'and') return routes.filter(edge => kindOf(edge) === 'flow');
  const raw = values[node.gate.choiceField || ''] || '';
  const chosen = node.gate.mode === 'andor'
    ? raw.split(',').map(item => item.trim()).filter(Boolean)
    : [raw.trim()];
  return routes.filter(edge => edge.when !== undefined && chosen.includes(edge.when));
}

const clone = (state: RunState): RunState => ({
  active: [...state.active],
  waiting: [...state.waiting],
  completed: [...state.completed],
  values: Object.fromEntries(Object.entries(state.values).map(([key, value]) => [key, { ...value }])),
  history: [...state.history],
  finished: state.finished,
});

/** Releases merge steps that no remaining active branch can reach. */
function releaseMerges(definition: WorkflowDefinition, state: RunState): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...state.waiting]) {
      const others = state.active.filter(active => active !== id);
      if (others.length && reachableFrom(definition, others).has(id)) continue;
      state.waiting = state.waiting.filter(item => item !== id);
      if (!state.active.includes(id)) state.active.push(id);
      changed = true;
    }
  }
}

/**
 * Completes an active step with its submitted values and moves the run on.
 * Auto and end steps are completed the same way, with no values. Returns the
 * new state and the transfers to animate. Throws if the step isn't active or
 * a required value is missing.
 */
export function advanceRun(definition: WorkflowDefinition, current: RunState, nodeId: string, submitted: Record<string, string> = {}): AdvanceResult {
  if (!current.active.includes(nodeId)) throw new Error(`"${nodeId}" is not an active step.`);
  const node = nodeById(definition, nodeId);
  if (!node) throw new Error(`Unknown step "${nodeId}".`);
  const missing = missingRequired(definition, nodeId, submitted);
  if (missing.length) throw new Error(`Required: ${missing.join(', ')}.`);

  const state = clone(current);
  state.active = state.active.filter(id => id !== nodeId);
  if (Object.keys(submitted).length) state.values[nodeId] = { ...submitted };
  if (!state.completed.includes(nodeId)) state.completed.push(nodeId);

  const outcome = node.outcome ? renderOutcome(node.outcome, state.values) : '';
  const summary = Object.entries(submitted).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(' · ');
  const automatic = node.type === 'auto' || node.type === 'end' || !!node.gate?.choiceFrom || node.gate?.mode === 'and';
  state.history.push({
    kind: automatic ? 'automatic' : 'submitted',
    nodeId,
    detail: outcome || summary || `${node.label} completed.`,
  });

  const routes = routesFrom(definition, nodeId, submitted);
  const feedback = routes.find(edge => kindOf(edge) === 'feedback');
  if (feedback) {
    // Return to an earlier step: forget everything after it, keep its own values for editing.
    const cleared = reachableFrom(definition, [feedback.to]);
    cleared.delete(feedback.to);
    state.completed = state.completed.filter(id => id !== feedback.to && !cleared.has(id));
    for (const id of cleared) delete state.values[id];
    state.active = [feedback.to];
    state.waiting = [];
    state.finished = false;
    state.history.push({ kind: 'returned', nodeId: feedback.to, detail: `Returned to ${nodeById(definition, feedback.to)?.label || feedback.to}.` });
    return { state, transfers: [{ from: nodeId, to: feedback.to, kind: 'feedback' }] };
  }

  const transfers: Transfer[] = [];
  for (const edge of routes) {
    transfers.push({ from: nodeId, to: edge.to, kind: 'flow' });
    if (state.active.includes(edge.to) || state.waiting.includes(edge.to)) continue;
    const incoming = definition.edges.filter(item => item.to === edge.to && kindOf(item) === 'flow');
    if (incoming.length > 1) {
      state.waiting.push(edge.to);
    } else {
      state.active.push(edge.to);
    }
  }
  releaseMerges(definition, state);
  for (const id of state.waiting) {
    if (!state.history.some(event => event.kind === 'waiting' && event.nodeId === id)) {
      state.history.push({ kind: 'waiting', nodeId: id, detail: `${nodeById(definition, id)?.label || id} is waiting for the other branches.` });
    }
  }

  if (state.active.length === 0 && state.waiting.length === 0) {
    state.finished = true;
    state.history.push({ kind: 'finished', nodeId, detail: 'Workflow finished.' });
  }
  return { state, transfers };
}
