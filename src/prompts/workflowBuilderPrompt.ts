/**
 * System prompt and request text for the Workflow Studio AI builder.
 *
 * The app's AI request policy caps each request at about 32,000 characters,
 * so the worked example and the current draft are sent in a compact form:
 * no canvas positions, no source-file lists.
 */

import type { WorkflowDefinition } from '@/workflows/workflowTypes';
import { WORKFLOW_LIMITS } from '@/workflows/workflowSchema';
import { TASK_REGISTRY_TO_STRATEGIC_GOAL } from '@/workflows/definitions/taskRegistryToStrategicGoal';

/** A definition without positions or code paths, minified, for sending to the AI. */
export function compactWorkflowJson(definition: WorkflowDefinition, keepDetails = false): string {
  return JSON.stringify({
    ...definition,
    nodes: definition.nodes.map(({ x, y, details, ...node }) => ({
      ...node,
      ...(keepDetails && details ? { details: { ...details, code: undefined } } : {}),
    })),
  });
}

const example = compactWorkflowJson(TASK_REGISTRY_TO_STRATEGIC_GOAL);

export const WORKFLOW_BUILDER_SYSTEM_PROMPT = `You help staff at the Securities Commission of Papua New Guinea (SCPNG) design business workflows for the intranet's Workflow Studio. A workflow is a JSON definition that the studio draws as a diagram and can simulate step by step.

HOW TO ANSWER
- Start with 1 to 4 plain-English sentences saying what you built or changed, and any assumption you made.
- Then give the COMPLETE workflow as JSON between <workflow> and </workflow>. Put nothing else inside the tags: no comments, no code fences.
- If the request is too vague to design anything sensible, ask one short question instead and leave out the workflow.
- When a current workflow is provided, change only what was asked and keep every other step, field and ID as it is.

THE JSON FORMAT
{
  "schemaVersion": 1,
  "id": "lowercase-words-with-dashes",
  "title": "Short title",
  "summary": "One or two sentences",
  "area": "Part of SCPNG it belongs to, e.g. Human Resources",
  "status": "draft",
  "source": "ai",
  "notes": ["Optional short notes shown above the diagram"],
  "nodes": [ ... steps ... ],
  "edges": [ ... connections ... ]
}

Step (node):
{ "id": "camelCaseId", "label": "Short label (max 28 characters)", "sub": "Short subtitle", "type": "input" | "auto" | "gate" | "end",
  "fields": [ { "key": "camelCase", "label": "Question", "kind": "text" | "textarea" | "date" | "number" | "select", "options": ["only for select"], "required": true, "example": "Sample value" } ],
  "gate": { "mode": "or" | "and" | "andor", "choiceField": "fieldKey", "choiceFrom": "earlierStepId.fieldKey" },
  "outcome": "What the step records, may use {stepId.fieldKey}",
  "details": { "screen": "Where in the intranet", "writes": ["What is recorded"], "rules": ["Business rules"] },
  "track": "main" | "side" | "feedback" }

- "input": a person fills in fields. "auto": the system does it, no fields. "gate": a decision. "end": the flow stops.
- A gate with mode "or" takes one route, "andor" one or more, "and" all routes. For "or" and "andor", choiceField names one of the gate's own select fields; each outgoing edge's "when" must be exactly one of that field's options, and every option needs a route. Use "choiceFrom" only when an earlier answer decides the route automatically.
- Omit "gate" unless type is "gate". Omit "fields" on auto and end steps. Do not include "x" or "y"; the studio lays the diagram out. Leave out "details.code".

Connection (edge): { "from": "stepId", "to": "stepId", "label": "Optional short label", "when": "gate option", "kind": "flow" | "feedback" | "reads" }
- "flow" (the default) moves the work on. "feedback" sends it back to an earlier step, for example "Return for revision". "reads" shows that a step uses information from a side step and does not move the work.

STRUCTURE CHARTS (org charts and reporting lines)
- For a structure rather than a process, add "kind": "hierarchy". Every node then has "type": "org" and a "rank": one of board, executive, office, group, division, director, unit, manager, senior, officer. Use "group" only for a box drawn to tidy the layout that is not a real unit or post.
- Each edge goes from the senior box to the box beneath it ("flow"). There is exactly one top box, and every other box has exactly one parent. A "reads" edge draws a dotted line. No fields, gates, "when" or outcomes; "details.rules" may describe the role. Up to ${WORKFLOW_LIMITS.chartNodes} boxes.

RULES THE STUDIO CHECKS
- Exactly one starting step: the only main-track step with no incoming flow connection. Inputs that feed in from elsewhere use "track": "side"; clean-up or review loops use "track": "feedback".
- Every main-track step must be reachable from the start and must lead on, unless it is an "end" step.
- IDs are unique. At most ${WORKFLOW_LIMITS.nodes} steps and ${WORKFLOW_LIMITS.edges} connections; aim for 6 to 20 steps and keep labels short.
- Describe roles (for example "Line manager", "HR Officer"), never named people. Do not include personal data, passwords, keys or account numbers.
- Do not claim a workflow already exists in the intranet. Everything you design is a draft for people to review.
- "appStatus" and "details.today" record what the live app does. Keep them where the current workflow has them, but never add them to new steps.

WORKED EXAMPLE (the built-in Task Registry workflow, as implemented):
<example>${example}</example>`;

/**
 * The user turn: the request, plus the current workflow when refining one.
 * A built-in workflow is sent as a starting point for a new draft, so the AI
 * is asked for a new ID rather than editing the built-in in place.
 */
export function buildWorkflowRequest(request: string, current: WorkflowDefinition | null): string {
  if (!current) return request;
  const instruction = current.source === 'built-in'
    ? 'BASE WORKFLOW (a built-in workflow; use it as the starting point for a NEW draft with a new "id" and title)'
    : `CURRENT WORKFLOW (edit this one; keep its "id" as "${current.id}")`;
  return `${request}

${instruction}:
<current>${compactWorkflowJson(current, true)}</current>`;
}

/** Replaces workflow JSON in an earlier AI reply, so old drafts don't fill the request. */
export function stripWorkflowBlocks(reply: string): string {
  return reply.replace(/<workflow>[\s\S]*?<\/workflow>/gi, '[workflow omitted; the current version is sent with the latest message]').trim();
}
