/**
 * Validation, normalisation, layout and AI-response parsing for workflow
 * definitions. Every definition that reaches the canvas or SharePoint passes
 * through validateWorkflow, whatever its source.
 *
 * Kept free of runtime imports so the Node test harness can load it directly.
 */

import type {
  AppStatus,
  OrgRank,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowField,
  WorkflowNode,
} from './workflowTypes';

export const WORKFLOW_SCHEMA_VERSION = 1;
export const WORKFLOW_LIMITS = {
  nodes: 40,
  edges: 80,
  /** Structure charts have one box per unit or post, so they may be larger. */
  chartNodes: 80,
  chartEdges: 120,
  fieldsPerNode: 12,
  optionsPerField: 20,
  jsonChars: 60000,
} as const;

const NODE_TYPES = ['input', 'auto', 'gate', 'end'];
const CHART_NODE_TYPE = 'org';
const GATE_MODES = ['or', 'and', 'andor'];
const FIELD_KINDS = ['text', 'textarea', 'date', 'number', 'select'];
const EDGE_KINDS = ['flow', 'feedback', 'reads'];
const CHART_EDGE_KINDS = ['flow', 'reads'];
const STATUSES = ['implemented', 'target', 'draft', 'published'];
const SOURCES = ['built-in', 'ai', 'manual'];
const TRACKS = ['main', 'side', 'feedback'];
const KINDS = ['process', 'hierarchy'];
export const ORG_RANKS: OrgRank[] = ['board', 'executive', 'office', 'group', 'division', 'director', 'unit', 'manager', 'senior', 'officer'];
export const APP_STATUSES: AppStatus[] = ['built', 'partial', 'missing'];

/** True for structure charts (org charts, reporting lines). */
export const isHierarchy = (definition: Pick<WorkflowDefinition, 'kind'>): boolean => definition.kind === 'hierarchy';

const WORKFLOW_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const NODE_ID = /^[a-z][a-z0-9_-]{0,39}$/i;
const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/i;

/** Layout spacing, matching the V9 canvas proportions. */
export const LAYOUT = { columnGap: 310, rowGap: 135, centreX: 570, baseY: 1150 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const optionalText = (value: unknown): string | undefined => {
  const result = text(value);
  return result ? result : undefined;
};
const textList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(text).filter(Boolean);
  return items.length ? items : undefined;
};
const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;

/** Lowercase slug for workflow IDs, e.g. "Leave approval (HR)" → "leave-approval-hr". */
export function slugifyWorkflowId(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);
  return slug.length >= 2 ? slug : `workflow-${slug || 'new'}`;
}

export const edgeKind = (edge: WorkflowEdge): WorkflowEdgeKind => edge.kind || 'flow';
export const flowEdgesFrom = (definition: WorkflowDefinition, id: string): WorkflowEdge[] =>
  definition.edges.filter(edge => edge.from === id && edgeKind(edge) === 'flow');
export const flowEdgesTo = (definition: WorkflowDefinition, id: string): WorkflowEdge[] =>
  definition.edges.filter(edge => edge.to === id && edgeKind(edge) === 'flow');

/** The single main-track node with no incoming flow edge, or null. */
export function findStartNode(definition: WorkflowDefinition): WorkflowNode | null {
  const starts = startCandidates(definition);
  return starts.length === 1 ? starts[0] : null;
}

function startCandidates(definition: WorkflowDefinition): WorkflowNode[] {
  return definition.nodes.filter(node =>
    (node.track || 'main') === 'main' && flowEdgesTo(definition, node.id).length === 0);
}

function normaliseField(raw: unknown): WorkflowField {
  const field = isRecord(raw) ? raw : {};
  const kind = text(field.kind) as WorkflowField['kind'];
  return {
    key: text(field.key),
    label: text(field.label) || text(field.key),
    kind: (FIELD_KINDS.includes(kind) ? kind : 'text') as WorkflowField['kind'],
    ...(textList(field.options) ? { options: textList(field.options) } : {}),
    ...(field.required === true ? { required: true } : {}),
    ...(optionalText(field.example) ? { example: optionalText(field.example) } : {}),
  };
}

function normaliseNode(raw: unknown): WorkflowNode {
  const node = isRecord(raw) ? raw : {};
  const details = isRecord(node.details) ? node.details : undefined;
  const gate = isRecord(node.gate) ? node.gate : undefined;
  const result: WorkflowNode = {
    id: text(node.id),
    label: text(node.label) || text(node.id),
    type: text(node.type) as WorkflowNode['type'],
  };
  if (optionalText(node.sub)) result.sub = optionalText(node.sub);
  if (finite(node.x) !== undefined && finite(node.y) !== undefined) {
    result.x = finite(node.x);
    result.y = finite(node.y);
  }
  if (Array.isArray(node.fields) && node.fields.length) result.fields = node.fields.map(normaliseField);
  if (gate) {
    result.gate = { mode: text(gate.mode) as any };
    if (optionalText(gate.choiceField)) result.gate.choiceField = optionalText(gate.choiceField);
    if (optionalText(gate.choiceFrom)) result.gate.choiceFrom = optionalText(gate.choiceFrom);
  }
  if (optionalText(node.outcome)) result.outcome = optionalText(node.outcome);
  if (details) {
    const cleaned = {
      ...(optionalText(details.screen) ? { screen: optionalText(details.screen) } : {}),
      ...(optionalText(details.route) ? { route: optionalText(details.route) } : {}),
      ...(textList(details.writes) ? { writes: textList(details.writes) } : {}),
      ...(textList(details.rules) ? { rules: textList(details.rules) } : {}),
      ...(textList(details.code) ? { code: textList(details.code) } : {}),
      ...(optionalText(details.today) ? { today: optionalText(details.today) } : {}),
    };
    if (Object.keys(cleaned).length) result.details = cleaned;
  }
  const track = text(node.track);
  if (track && track !== 'main') result.track = track as WorkflowNode['track'];
  if (optionalText(node.rank)) result.rank = optionalText(node.rank) as OrgRank;
  if (optionalText(node.appStatus)) result.appStatus = optionalText(node.appStatus) as AppStatus;
  return result;
}

function normaliseEdge(raw: unknown): WorkflowEdge {
  const edge = isRecord(raw) ? raw : {};
  const result: WorkflowEdge = { from: text(edge.from), to: text(edge.to) };
  if (optionalText(edge.label)) result.label = optionalText(edge.label);
  if (optionalText(edge.when)) result.when = optionalText(edge.when);
  const kind = text(edge.kind);
  if (kind && kind !== 'flow') result.kind = kind as WorkflowEdgeKind;
  return result;
}

/**
 * Cleans an untrusted definition into the canonical shape: trimmed strings,
 * defaults filled in, unknown properties dropped, and positions laid out when
 * any node is missing them. Does not validate; call validateWorkflow after.
 */
export function normaliseWorkflow(raw: unknown, overrides: Partial<Pick<WorkflowDefinition, 'status' | 'source' | 'id'>> = {}): WorkflowDefinition {
  const source = isRecord(raw) ? raw : {};
  const title = text(source.title) || 'Untitled workflow';
  const definition: WorkflowDefinition = {
    schemaVersion: typeof source.schemaVersion === 'number' ? source.schemaVersion : WORKFLOW_SCHEMA_VERSION,
    id: overrides.id || text(source.id) || slugifyWorkflowId(title),
    title,
    status: (overrides.status || text(source.status) || 'draft') as WorkflowDefinition['status'],
    source: (overrides.source || text(source.source) || 'manual') as WorkflowDefinition['source'],
    nodes: Array.isArray(source.nodes) ? source.nodes.map(normaliseNode) : [],
    edges: Array.isArray(source.edges) ? source.edges.map(normaliseEdge) : [],
  };
  const kind = text(source.kind);
  if (kind && kind !== 'process') definition.kind = kind as WorkflowDefinition['kind'];
  if (optionalText(source.summary)) definition.summary = optionalText(source.summary);
  if (optionalText(source.area)) definition.area = optionalText(source.area);
  if (textList(source.notes)) definition.notes = textList(source.notes);
  return definition.nodes.some(node => node.x === undefined || node.y === undefined)
    ? autoLayout(definition)
    : definition;
}

/** Problems that make a definition unusable, in plain words. Empty when valid. */
export function validateWorkflow(definition: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const add = (message: string) => { if (errors.length < 25) errors.push(message); };

  if (definition.schemaVersion !== WORKFLOW_SCHEMA_VERSION) add(`Schema version must be ${WORKFLOW_SCHEMA_VERSION}.`);
  if (!WORKFLOW_ID.test(definition.id || '')) add('The workflow ID must be 2–64 lowercase letters, numbers or dashes.');
  if (!definition.title || definition.title.length > 120) add('The workflow needs a title of at most 120 characters.');
  if (!STATUSES.includes(definition.status)) add(`Status must be one of: ${STATUSES.join(', ')}.`);
  if (!SOURCES.includes(definition.source)) add(`Source must be one of: ${SOURCES.join(', ')}.`);
  if ((definition.summary || '').length > 600) add('The summary must be at most 600 characters.');
  if (definition.kind !== undefined && !KINDS.includes(definition.kind)) add(`Kind must be one of: ${KINDS.join(', ')}.`);

  const chart = isHierarchy(definition);
  const nodeLimit = chart ? WORKFLOW_LIMITS.chartNodes : WORKFLOW_LIMITS.nodes;
  const edgeLimit = chart ? WORKFLOW_LIMITS.chartEdges : WORKFLOW_LIMITS.edges;
  const nodes = definition.nodes || [];
  const edges = definition.edges || [];
  if (nodes.length === 0) add('The workflow has no steps.');
  if (nodes.length > nodeLimit) add(`At most ${nodeLimit} ${chart ? 'boxes' : 'steps'} are allowed (found ${nodes.length}).`);
  if (edges.length > edgeLimit) add(`At most ${edgeLimit} connections are allowed (found ${edges.length}).`);

  const ids = new Set<string>();
  for (const node of nodes) {
    const name = node.label || node.id || '(unnamed step)';
    if (!NODE_ID.test(node.id || '')) add(`Step "${name}" needs an ID of letters, numbers, "_" or "-" starting with a letter.`);
    else if (ids.has(node.id)) add(`Step ID "${node.id}" is used more than once.`);
    ids.add(node.id);
    if (!node.label || node.label.length > 80) add(`Step "${node.id}" needs a label of at most 80 characters.`);
    if ((node.sub || '').length > 120) add(`Step "${name}" has a subtitle longer than 120 characters.`);
    if (chart) {
      if (node.type !== CHART_NODE_TYPE) add(`Box "${name}" in a structure chart needs type "${CHART_NODE_TYPE}".`);
      if (!node.rank || !ORG_RANKS.includes(node.rank)) add(`Box "${name}" needs a rank: one of ${ORG_RANKS.join(', ')}.`);
      if (node.fields?.length || node.gate) add(`Box "${name}" is in a structure chart, which has no fields or decisions.`);
    } else {
      if (!NODE_TYPES.includes(node.type)) add(`Step "${name}" has type "${node.type}"; use one of: ${NODE_TYPES.join(', ')}.`);
      if (node.rank) add(`Step "${name}" has a rank, which only boxes in a structure chart use.`);
    }
    if (node.appStatus && !APP_STATUSES.includes(node.appStatus)) add(`"${name}" has appStatus "${node.appStatus}"; use one of: ${APP_STATUSES.join(', ')}.`);
    if ((node.details?.today || '').length > 600) add(`"${name}" has a "today" note longer than 600 characters.`);
    if (node.track && !TRACKS.includes(node.track)) add(`Step "${name}" has an unknown track "${node.track}".`);
    if ((node.outcome || '').length > 300) add(`Step "${name}" has an outcome longer than 300 characters.`);

    const fields = node.fields || [];
    if (fields.length > WORKFLOW_LIMITS.fieldsPerNode) add(`Step "${name}" has more than ${WORKFLOW_LIMITS.fieldsPerNode} fields.`);
    const keys = new Set<string>();
    for (const field of fields) {
      if (!FIELD_KEY.test(field.key || '')) add(`A field on "${name}" needs a key of letters, numbers or "_".`);
      else if (keys.has(field.key)) add(`Field "${field.key}" appears twice on "${name}".`);
      keys.add(field.key);
      if (!FIELD_KINDS.includes(field.kind)) add(`Field "${field.key}" on "${name}" has an unknown kind.`);
      if (field.kind === 'select' && !(field.options && field.options.length)) add(`Select field "${field.key}" on "${name}" has no options.`);
      if ((field.options || []).length > WORKFLOW_LIMITS.optionsPerField) add(`Field "${field.key}" on "${name}" has too many options.`);
    }
  }

  const edgeKeys = new Set<string>();
  for (const edge of edges) {
    const kind = edgeKind(edge);
    if (chart && !CHART_EDGE_KINDS.includes(kind)) add(`Connection ${edge.from} → ${edge.to} in a structure chart must be "flow" (reports to) or "reads" (dotted line).`);
    else if (!EDGE_KINDS.includes(kind)) add(`Connection ${edge.from} → ${edge.to} has an unknown kind "${kind}".`);
    if (chart && edge.when) add(`Connection ${edge.from} → ${edge.to} has "when", which structure charts don't use.`);
    if (!ids.has(edge.from)) add(`A connection starts at "${edge.from}", which is not a step.`);
    if (!ids.has(edge.to)) add(`A connection ends at "${edge.to}", which is not a step.`);
    if (edge.from === edge.to) add(`Step "${edge.from}" connects to itself.`);
    const key = `${edge.from}>${edge.to}>${kind}>${edge.when || ''}`;
    if (edgeKeys.has(key)) add(`The connection ${edge.from} → ${edge.to} is listed twice.`);
    edgeKeys.add(key);
  }
  if (errors.length) return errors;

  if (chart) {
    validateHierarchyShape(definition, add);
    if (!errors.length && workflowToJson(definition).length > WORKFLOW_LIMITS.jsonChars) {
      add(`The chart is too large to save (over ${WORKFLOW_LIMITS.jsonChars.toLocaleString()} characters).`);
    }
    return errors;
  }

  // Structure: one start, gates that can route, no dead ends, everything reachable.
  const starts = startCandidates(definition);
  if (starts.length === 0) add('No starting step: every main step has an incoming connection.');
  if (starts.length > 1) add(`There must be one starting step; found ${starts.length} (${starts.map(node => node.id).join(', ')}). Mark side inputs with track "side".`);

  for (const node of nodes) {
    const outgoing = flowEdgesFrom(definition, node.id);
    const name = node.label;
    if (node.type === 'end' && outgoing.length) add(`End step "${name}" has outgoing flow connections.`);
    if (node.type !== 'end' && (node.track || 'main') === 'main' && outgoing.length === 0 &&
      !definition.edges.some(edge => edge.from === node.id && edgeKind(edge) === 'feedback')) {
      add(`Step "${name}" leads nowhere. Connect it onward or make it an end step.`);
    }
    if (node.type === 'gate') {
      if (!node.gate || !GATE_MODES.includes(node.gate.mode)) {
        add(`Decision "${name}" needs gate.mode: or, and, or andor.`);
        continue;
      }
      // A route may continue the flow or send the run back (feedback).
      const routes = definition.edges.filter(edge => edge.from === node.id && edgeKind(edge) !== 'reads');
      if (routes.length < 1) add(`Decision "${name}" has no routes.`);
      if (node.gate.mode !== 'and') {
        const field = (node.fields || []).find(item => item.key === node.gate!.choiceField);
        if (!field || field.kind !== 'select' || !field.options?.length) {
          add(`Decision "${name}" needs gate.choiceField naming one of its select fields.`);
          continue;
        }
        for (const edge of routes) {
          if (!edge.when || !field.options.includes(edge.when)) {
            add(`Route ${edge.from} → ${edge.to} needs "when" set to one of: ${field.options.join(', ')}.`);
          }
        }
        for (const option of field.options) {
          if (!routes.some(edge => edge.when === option)) add(`Option "${option}" on "${name}" has no route.`);
        }
        if (node.gate.choiceFrom) {
          const [sourceNode, sourceField] = node.gate.choiceFrom.split('.');
          const source = nodes.find(item => item.id === sourceNode);
          if (!source || !(source.fields || []).some(item => item.key === sourceField)) {
            add(`Decision "${name}" takes its choice from "${node.gate.choiceFrom}", which is not a field on an earlier step.`);
          }
        }
      }
    } else if (outgoing.some(edge => edge.when)) {
      add(`Only decision steps can have routes with "when" (found on "${name}").`);
    }
  }

  if (starts.length === 1) {
    const reached = new Set<string>([starts[0].id]);
    const queue = [starts[0].id];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of definition.edges) {
        if (edge.from !== current || edgeKind(edge) === 'reads' || reached.has(edge.to)) continue;
        reached.add(edge.to);
        queue.push(edge.to);
      }
    }
    for (const node of nodes) {
      if ((node.track || 'main') === 'main' && !reached.has(node.id)) add(`Step "${node.label}" can't be reached from the start.`);
    }
  }

  if (!errors.length && workflowToJson(definition).length > WORKFLOW_LIMITS.jsonChars) {
    add(`The workflow is too large to save (over ${WORKFLOW_LIMITS.jsonChars.toLocaleString()} characters).`);
  }
  return errors;
}

// --- Structure charts ---------------------------------------------------------

/** Spacing for structure charts, drawn top-down like an org chart. */
export const CHART_LAYOUT = { columnGap: 250, rowGap: 130 } as const;

/** Each box's parent ("reports to"), from flow connections. */
export function hierarchyParents(definition: WorkflowDefinition): Map<string, string> {
  const parents = new Map<string, string>();
  for (const edge of definition.edges) {
    if (edgeKind(edge) === 'flow' && !parents.has(edge.to)) parents.set(edge.to, edge.from);
  }
  return parents;
}

/** The boxes directly beneath one box, in the order their connections are listed. */
export function hierarchyChildren(definition: WorkflowDefinition, id: string): WorkflowNode[] {
  return definition.edges
    .filter(edge => edge.from === id && edgeKind(edge) === 'flow')
    .map(edge => definition.nodes.find(node => node.id === edge.to))
    .filter((node): node is WorkflowNode => !!node);
}

/** The line from the top box down to `id`, inclusive. Stops on a loop. */
export function reportingChain(definition: WorkflowDefinition, id: string): WorkflowNode[] {
  const parents = hierarchyParents(definition);
  const chain: WorkflowNode[] = [];
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = definition.nodes.find(item => item.id === current);
    if (!node) break;
    chain.unshift(node);
    current = parents.get(current);
  }
  return chain;
}

function validateHierarchyShape(definition: WorkflowDefinition, add: (message: string) => void): void {
  const incoming = new Map<string, number>();
  for (const edge of definition.edges) {
    if (edgeKind(edge) === 'flow') incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
  }
  const roots = definition.nodes.filter(node => !incoming.get(node.id));
  if (roots.length !== 1) {
    add(`A structure chart needs exactly one top box; found ${roots.length}${roots.length ? ` (${roots.map(node => node.id).join(', ')})` : ''}.`);
    return;
  }
  for (const node of definition.nodes) {
    if ((incoming.get(node.id) || 0) > 1) add(`"${node.label}" reports to more than one box. Use a "reads" connection for a dotted line.`);
  }
  const reached = new Set([roots[0].id]);
  const queue = [roots[0].id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of hierarchyChildren(definition, current)) {
      if (reached.has(child.id)) continue;
      reached.add(child.id);
      queue.push(child.id);
    }
  }
  for (const node of definition.nodes) {
    if (!reached.has(node.id)) add(`"${node.label}" is not connected to the top of the chart.`);
  }
}

export interface ChartLayout {
  /** Visible boxes with positions; boxes under a collapsed box are left out. */
  nodes: WorkflowNode[];
  /** Connections between visible boxes. */
  edges: WorkflowEdge[];
  /** Number of boxes directly beneath each box, collapsed or not. */
  childCounts: Record<string, number>;
}

/**
 * Lays a structure chart out top-down: each box sits centred over the boxes
 * beneath it, and leaves are spaced evenly. Boxes in `collapsed` keep their
 * place but hide everything beneath them. Copes with invalid charts (loops,
 * several tops) so a draft can still be drawn while it is being fixed.
 */
export function layoutHierarchy(definition: WorkflowDefinition, collapsed: ReadonlySet<string> = new Set()): ChartLayout {
  const parents = hierarchyParents(definition);
  const childCounts: Record<string, number> = {};
  for (const node of definition.nodes) childCounts[node.id] = hierarchyChildren(definition, node.id).length;

  const positions = new Map<string, { x: number; y: number }>();
  let leaf = 0;
  const place = (id: string, depth: number): number => {
    positions.set(id, { x: 0, y: 0 });
    const children = collapsed.has(id) ? [] : hierarchyChildren(definition, id).filter(child => !positions.has(child.id));
    let x: number;
    if (!children.length) {
      x = leaf * CHART_LAYOUT.columnGap;
      leaf += 1;
    } else {
      const xs = children.map(child => place(child.id, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
    }
    positions.set(id, { x, y: depth * CHART_LAYOUT.rowGap });
    return x;
  };
  for (const node of definition.nodes) {
    if (!parents.has(node.id) && !positions.has(node.id)) place(node.id, 0);
  }

  const visible = new Set(positions.keys());
  // Boxes caught in a loop have no top; draw them in a row below the rest.
  const stray = definition.nodes.filter(node => !visible.has(node.id) && !isUnderCollapsed(node.id, parents, collapsed));
  const bottom = Math.max(0, ...[...positions.values()].map(position => position.y)) + CHART_LAYOUT.rowGap;
  stray.forEach((node, index) => {
    positions.set(node.id, { x: index * CHART_LAYOUT.columnGap, y: bottom });
    visible.add(node.id);
  });

  return {
    nodes: definition.nodes.filter(node => visible.has(node.id)).map(node => ({ ...node, ...positions.get(node.id)! })),
    edges: definition.edges.filter(edge => visible.has(edge.from) && visible.has(edge.to)),
    childCounts,
  };
}

function isUnderCollapsed(id: string, parents: Map<string, string>, collapsed: ReadonlySet<string>): boolean {
  const seen = new Set<string>();
  let current = parents.get(id);
  while (current && !seen.has(current)) {
    if (collapsed.has(current)) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}

/** How many steps or boxes are built, partly built or missing in the app. */
export function appStatusCounts(definition: WorkflowDefinition): Record<AppStatus, number> | null {
  const counts: Record<AppStatus, number> = { built: 0, partial: 0, missing: 0 };
  let any = false;
  for (const node of definition.nodes) {
    if (!node.appStatus || node.rank === 'group') continue;
    counts[node.appStatus] += 1;
    any = true;
  }
  return any ? counts : null;
}

/**
 * Lays nodes out bottom-up in layers by their longest flow distance from the
 * start, like the V9 canvas. Side and feedback steps sit beside the step they
 * connect to. Nodes that already have positions keep them unless `force`.
 * Structure charts are laid out top-down instead (see layoutHierarchy).
 */
export function autoLayout(definition: WorkflowDefinition, force = false): WorkflowDefinition {
  if (isHierarchy(definition)) {
    const laidOut = new Map(layoutHierarchy(definition).nodes.map(node => [node.id, node]));
    return {
      ...definition,
      nodes: definition.nodes.map(node =>
        !force && node.x !== undefined && node.y !== undefined ? node : { ...node, x: laidOut.get(node.id)?.x ?? 0, y: laidOut.get(node.id)?.y ?? 0 }),
    };
  }
  const start = startCandidates(definition)[0];
  const depth = new Map<string, number>();
  if (start) {
    depth.set(start.id, 0);
    // Longest path over flow edges, bounded so a cycle can't loop forever.
    for (let round = 0; round < definition.nodes.length; round += 1) {
      let changed = false;
      for (const edge of definition.edges) {
        if (edgeKind(edge) !== 'flow' || !depth.has(edge.from)) continue;
        const next = depth.get(edge.from)! + 1;
        if ((depth.get(edge.to) ?? -1) < next) { depth.set(edge.to, next); changed = true; }
      }
      if (!changed) break;
    }
  }
  for (const node of definition.nodes) {
    if (depth.has(node.id)) continue;
    const link = definition.edges.find(edge => (edge.from === node.id && depth.has(edge.to)) || (edge.to === node.id && depth.has(edge.from)));
    depth.set(node.id, link ? depth.get(link.from === node.id ? link.to : link.from)! : 0);
  }

  const mainByLayer = new Map<number, WorkflowNode[]>();
  const offTrack: WorkflowNode[] = [];
  for (const node of definition.nodes) {
    if ((node.track || 'main') === 'main') {
      const layer = depth.get(node.id)!;
      mainByLayer.set(layer, [...(mainByLayer.get(layer) || []), node]);
    } else {
      offTrack.push(node);
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [layer, layerNodes] of mainByLayer) {
    layerNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: LAYOUT.centreX + (index - (layerNodes.length - 1) / 2) * LAYOUT.columnGap,
        y: LAYOUT.baseY - layer * LAYOUT.rowGap,
      });
    });
  }
  const rightEdge = Math.max(LAYOUT.centreX, ...[...positions.values()].map(position => position.x));
  const leftEdge = Math.min(LAYOUT.centreX, ...[...positions.values()].map(position => position.x));
  const usedSlots = new Set<string>();
  for (const node of offTrack) {
    const layer = depth.get(node.id)!;
    const x = node.track === 'feedback' ? leftEdge - LAYOUT.columnGap : rightEdge + LAYOUT.columnGap;
    let y = LAYOUT.baseY - layer * LAYOUT.rowGap;
    while (usedSlots.has(`${x}:${y}`)) y -= LAYOUT.rowGap / 2;
    usedSlots.add(`${x}:${y}`);
    positions.set(node.id, { x, y });
  }

  return {
    ...definition,
    nodes: definition.nodes.map(node =>
      !force && node.x !== undefined && node.y !== undefined ? node : { ...node, ...positions.get(node.id)! }),
  };
}

/** Stable JSON for storage and export (2-space indent). */
export function workflowToJson(definition: WorkflowDefinition): string {
  return JSON.stringify(definition, null, 2);
}

export interface ParsedAiWorkflow {
  /** The explanation the AI gave outside the workflow block. */
  message: string;
  definition: WorkflowDefinition | null;
  /** Why no usable definition came back; empty when definition is set. */
  errors: string[];
}

/**
 * Reads an AI reply that should contain `<workflow>{json}</workflow>`. A
 * fenced ```json block is accepted as a fallback. The result is normalised as
 * an AI draft and validated; nothing here trusts the AI's own status/source.
 */
export function parseAiWorkflow(reply: string, options: { keepId?: string } = {}): ParsedAiWorkflow {
  const tagged = reply.match(/<workflow>([\s\S]*?)<\/workflow>/i);
  const fenced = tagged ? null : reply.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/i);
  const block = tagged?.[1] ?? fenced?.[1];
  const message = (tagged ? reply.replace(tagged[0], '') : fenced ? reply.replace(fenced[0], '') : reply).trim();

  if (!block) {
    return { message, definition: null, errors: ['The reply did not include a workflow in <workflow>…</workflow> tags.'] };
  }
  if (block.length > WORKFLOW_LIMITS.jsonChars) {
    return { message, definition: null, errors: ['The workflow in the reply is too large.'] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(block.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch (error) {
    return { message, definition: null, errors: [`The workflow is not valid JSON (${error instanceof Error ? error.message : 'parse error'}).`] };
  }
  const definition = normaliseWorkflow(raw, { status: 'draft', source: 'ai', ...(options.keepId ? { id: options.keepId } : {}) });
  const errors = validateWorkflow(definition);
  return errors.length ? { message, definition: null, errors } : { message, definition, errors: [] };
}
