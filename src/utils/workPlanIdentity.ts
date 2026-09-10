import type { WorkPlan } from '../types/division.types';

/** Fail before any cascade write if a legacy ID's list identity is unproven. */
export function assertWorkPlanExecutionIdentity(plan: WorkPlan): void {
  for (const goal of plan.goals) {
    if (!goal.linkedObjectiveId && (!goal.organizationalGoalRef || !/^[1-9]\d*$/.test(goal.organizationalGoalRef.id))) {
      throw new Error(`Goal "${goal.title}" needs an explicit organizational parent before activation.`);
    }
    if (goal.executionObjectiveRef && goal.executionObjectiveRef.id !== goal.linkedObjectiveId) {
      throw new Error(`Goal "${goal.title}" has inconsistent execution objective references.`);
    }
    if (goal.linkedObjectiveId && (
      goal.executionObjectiveRef?.list !== 'Unit_Objectives' ||
      goal.executionObjectiveRef.id !== goal.linkedObjectiveId
    )) {
      throw new Error(`Goal "${goal.title}" has an unverified legacy objective link. Verify its Unit_Objectives mapping before activation or synchronization.`);
    }
    if (goal.organizationalGoalRef?.list === 'Strategic_Goals') {
      throw new Error(`Goal "${goal.title}" requires a verified corporate-to-legacy goal crosswalk before using the current objective lookup.`);
    }
    if (goal.kras?.length || goal.source || goal.activities.some(activity => activity.source || activity.sourceKraId || activity.annualTarget)) {
      throw new Error('Source-based work plans require the source-aware activation engine. Save this plan as a draft until that engine is available.');
    }
  }
}
