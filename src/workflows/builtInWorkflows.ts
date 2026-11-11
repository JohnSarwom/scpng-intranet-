/**
 * Workflows described in code. They always reflect the current build and are
 * never stored in SharePoint; "Duplicate as draft" copies one into an editable
 * saved workflow.
 */

import type { WorkflowDefinition } from './workflowTypes';
import { autoLayout, validateWorkflow } from './workflowSchema';
import { TASK_REGISTRY_TO_STRATEGIC_GOAL } from './definitions/taskRegistryToStrategicGoal';

const definitions: WorkflowDefinition[] = [TASK_REGISTRY_TO_STRATEGIC_GOAL];

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
