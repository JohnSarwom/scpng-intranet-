/**
 * Workflows described in code. They always reflect the current build and are
 * never stored in SharePoint; "Duplicate as draft" copies one into an editable
 * saved workflow.
 *
 * "Implemented" workflows describe what the code does. "Target" workflows are
 * agreed designs; each step or box says how much of it the app does today.
 */

import type { WorkflowDefinition } from './workflowTypes';
import { autoLayout, validateWorkflow } from './workflowSchema';
import { TASK_REGISTRY_TO_STRATEGIC_GOAL } from './definitions/taskRegistryToStrategicGoal';
import { TASK_ASSIGNMENT_REVIEW } from './definitions/taskAssignmentReview';
import { REPORTING_HIERARCHY } from './definitions/reportingHierarchy';
import { ORGANISATIONAL_STRUCTURE } from './definitions/organisationalStructure';

const definitions: WorkflowDefinition[] = [
  TASK_REGISTRY_TO_STRATEGIC_GOAL,
  TASK_ASSIGNMENT_REVIEW,
  REPORTING_HIERARCHY,
  ORGANISATIONAL_STRUCTURE,
];

export const BUILT_IN_WORKFLOWS: WorkflowDefinition[] = definitions.map(definition => {
  const laidOut = autoLayout(definition);
  const errors = validateWorkflow(laidOut);
  if (errors.length) {
    // A broken built-in is a coding error; show it loudly in development.
    console.error(`[Workflows] Built-in workflow "${definition.id}" is invalid:`, errors);
  }
  return laidOut;
});

export const findBuiltInWorkflow = (id: string): WorkflowDefinition | undefined =>
  BUILT_IN_WORKFLOWS.find(definition => definition.id === id);
