
import { Kpi, Task, ChecklistItem, StrategicKRA, StrategicInitiative } from '@/types';

/**
 * Calculates the progress of a KPI based on its calculation type.
 * 
 * @param kpi The KPI object to calculate progress for.
 * @returns The calculated progress as a percentage (0-100).
 */
export const calculateKpiProgress = (kpi: Partial<Kpi>, tasks?: Partial<Task>[]): number => {
    // Priority 1: If Status is explicitly 'Completed', force 100%
    const status = (kpi.status || '').toLowerCase();
    if (status === 'completed' || status === 'achieved' || status === 'done') {
        return 100;
    }

    // Priority 2: Checklist-based calculation
    if (kpi.calculationType === 'checklist' && kpi.checklist && kpi.checklist.length > 0) {
        const completed = kpi.checklist.filter(item => item.checked).length;
        return Math.round((completed / kpi.checklist.length) * 100);
    }

    // Priority 3: Task-completion — count linked tasks that are done
    if (kpi.calculationType === 'task-completion' && tasks && tasks.length > 0) {
        const linked = tasks.filter(t => String(t.kpi_id) === String(kpi.id));
        if (linked.length > 0) {
            const done = linked.filter(t =>
                t.completed === true ||
                ['completed', 'done'].includes((t.status || '').toLowerCase())
            ).length;
            return Math.round((done / linked.length) * 100);
        }
        return 0;
    }

    // Priority 4: Manual target/actual calculation
    if (kpi.target && kpi.target > 0) {
        const actual = kpi.actual || 0;
        const rawProgress = (actual / kpi.target) * 100;
        return Math.min(100, Math.round(rawProgress));
    }

    return 0;
};

/**
 * Calculates the progress of a KRA by averaging the progress of its KPIs.
 * 
 * @param kra The KRA object
 * @param kpis Array of KPIs belonging to this KRA
 * @returns The calculated progress as a percentage (0-100)
 */
export const calculateKraProgress = (kra: any, kpis: Partial<Kpi>[] = []): number => {
    const kraId = kra.id ? String(kra.id) : (kra.ID ? String(kra.ID) : '');
    if (!kraId) return 0;

    // Priority: If KRA is marked Completed/Closed, force 100%
    const status = (kra.status || '').toLowerCase();
    if (['completed', 'closed', 'done'].includes(status)) {
        return 100;
    }

    // Filter KPIs that belong to this KRA
    const kraKpis = kpis.filter(kpi => String(kpi.kra_id || '') === kraId);

    if (!kraKpis || kraKpis.length === 0) {
        // Fallback to stored progress if no KPIs available and NOT completed
        return kra.progress || 0;
    }

    // Use weighted average when weights are defined on KPIs
    const totalWeight = kraKpis.reduce((sum, kpi) => sum + (kpi.weight || 0), 0);
    if (totalWeight > 0) {
        const weightedSum = kraKpis.reduce((sum, kpi) => sum + calculateKpiProgress(kpi) * (kpi.weight || 0), 0);
        return Math.round(weightedSum / totalWeight);
    }

    // Fallback: % of KPIs that have a "completed" status
    const COMPLETED_STATUSES = ['completed', 'achieved', 'done'];
    const completedCount = kraKpis.filter(kpi =>
        COMPLETED_STATUSES.includes((kpi.status || '').toLowerCase())
    ).length;

    return Math.round((completedCount / kraKpis.length) * 100);
};


/**
 * Calculates the progress of a Strategic Objective by aggregating its linked KRAs.
 * 
 * @param kras Array of KRAs linked to the objective.
 * @param kpis Optional array of all KPIs to calculate dynamic KRA progress.
 * @returns The average progress of the KRAs as a percentage.
 */
export const calculateStrategicProgress = (kras: any[], kpis: Partial<Kpi>[] = []): number => {
    if (!kras || kras.length === 0) return 0;

    // Simple average of KRA progress
    const totalProgress = kras.reduce((sum, kra) => {
        // Calculate dynamic progress from KPIs if available
        // If KPIs are provided, we calculate the KRA's real-time progress
        // Otherwise we fall back to the KRA's stored progress field
        const kraProgress = kpis.length > 0
            ? calculateKraProgress(kra, kpis)
            : (kra.progress || 0);

        return sum + kraProgress;
    }, 0);

    return Math.round(totalProgress / kras.length);
};

/**
 * Calculates the progress of a Strategic Objective by aggregating its linked Unit Objectives (Children).
 * 
 * @param goalId The ID of the Strategic Goal
 * @param childObjectives Array of all Unit Objectives
 * @param allKras Array of all KRAs (optional, for dynamic child progress)
 * @param allKpis Array of all KPIs (optional, for dynamic child progress)
 * @returns The average progress of the linked Unit Objectives as a percentage.
 */
export const calculateGoalProgressFromChildren = (
    goalId: string | number,
    childObjectives: any[],
    allKras: any[] = [],
    allKpis: any[] = [],
    strategicKRAs: StrategicKRA[] = [],
    strategicInitiatives: StrategicInitiative[] = []
): number => {
    if (!childObjectives || childObjectives.length === 0) return 0;

    // Operational track: Unit Objectives linked via parentGoalId
    const linkedChildren = childObjectives.filter(child =>
        String(child.parentGoalId) === String(goalId)
    );

    let operationalProgress = 0;
    let hasOperational = false;

    if (linkedChildren.length > 0) {
        hasOperational = true;
        const total = linkedChildren.reduce((sum, child) => {
            let p = child.progress || 0;
            if (allKras.length > 0) {
                const linkedKras = allKras.filter(k =>
                    String(k.objective_id) === String(child.id) ||
                    String(k.objectiveId) === String(child.id)
                );
                if (linkedKras.length > 0) {
                    p = calculateStrategicProgress(linkedKras, allKpis);
                }
            }
            return sum + p;
        }, 0);
        operationalProgress = Math.round(total / linkedChildren.length);
    }

    // Corporate Plan track: Strategic KRAs → Initiatives linked via goalId
    let corpProgress = 0;
    let hasCorp = false;

    if (strategicKRAs.length > 0 && strategicInitiatives.length > 0) {
        const corpKras = strategicKRAs.filter(k => String(k.goalId) === String(goalId));
        if (corpKras.length > 0) {
            hasCorp = true;
            const total = corpKras.reduce((sum, kra) => {
                return sum + calculateCorporateKraProgress(kra, strategicInitiatives, allKpis);
            }, 0);
            corpProgress = Math.round(total / corpKras.length);
        }
    }

    if (hasOperational && hasCorp) {
        // Blend both tracks with equal weight (tunable)
        return Math.round((operationalProgress + corpProgress) / 2);
    }
    if (hasCorp) return corpProgress;
    if (hasOperational) return operationalProgress;

    return 0;
};

/**
 * Calculates the status of an Objective based on its linked KPIs.
 * If ALL linked KPIs are completed, the objective is considered 'Completed'.
 * Otherwise, it returns the original status.
 * 
 * @param objective The objective to check
 * @param kras Array of all KRAs (to find those linked to the objective)
 * @returns 'Completed' if all KPIs are done, otherwise the original status
 */
export const calculateObjectiveStatus = (objective: any, kras: any[]): string => {
    // 1. Find all KRAs linked to this objective
    const linkedKras = kras.filter(kra =>
        String(kra.objective_id) === String(objective.id) ||
        String(kra.objectiveId) === String(objective.id)
    );

    if (!linkedKras || linkedKras.length === 0) {
        return 'Not Started';
    }

    // 2. Collect all KPIs from these KRAs
    let allKpis: any[] = [];
    linkedKras.forEach(kra => {
        if (kra.unitKpis && kra.unitKpis.length > 0) {
            allKpis = [...allKpis, ...kra.unitKpis];
        }
    });

    // 3. Calculate dynamic mathematical progress 
    const progress = calculateStrategicProgress(linkedKras, allKpis);

    if (progress === 100) return 'Completed';
    if (progress > 0) return 'In Progress';
    return 'Not Started';
};

// ==========================================
// CORPORATE PLAN 2026-2028: NEW RESTRUCTURED PROGRESS LOGIC
// ==========================================

/**
 * Calculates the progress of a Strategic Initiative by averaging the progress of its KPIs.
 */
export const calculateInitiativeProgress = (initiative: any, kpis: Partial<Kpi>[] = []): number => {
    const initId = initiative.id ? String(initiative.id) : '';
    if (!initId) return 0;

    // Priority: If Initiative is marked Completed, force 100%
    const status = (initiative.status || '').toLowerCase();
    if (['completed', 'closed', 'done'].includes(status)) {
        return 100;
    }

    // Filter KPIs that belong to this Initiative
    const initKpis = kpis.filter(kpi => String(kpi.initiative_id || '') === initId);

    if (!initKpis || initKpis.length === 0) {
        // Fallback to stored progress if no KPIs available
        return initiative.progress || 0;
    }

    // Use weighted average when weights are defined on KPIs
    const totalWeight = initKpis.reduce((sum, kpi) => sum + (kpi.weight || 0), 0);
    if (totalWeight > 0) {
        const weightedSum = initKpis.reduce((sum, kpi) => sum + calculateKpiProgress(kpi) * (kpi.weight || 0), 0);
        return Math.round(weightedSum / totalWeight);
    }

    // Fallback: simple average
    const totalProgress = initKpis.reduce((sum, kpi) => sum + calculateKpiProgress(kpi), 0);
    return Math.round(totalProgress / initKpis.length);
};

/**
 * Calculates the progress of a Strategic KRA by averaging the progress of its Initiatives.
 */
export const calculateCorporateKraProgress = (kra: any, initiatives: any[] = [], kpis: Partial<Kpi>[] = []): number => {
    const kraId = kra.id ? String(kra.id) : '';
    if (!kraId) return 0;

    // Priority: If KRA is marked Completed, force 100%
    const status = (kra.status || '').toLowerCase();
    if (['completed', 'closed', 'done'].includes(status)) {
        return 100;
    }

    // Filter Initiatives that belong to this KRA
    const kraInitiatives = initiatives.filter(init => String(init.kraId || '') === kraId);

    if (!kraInitiatives || kraInitiatives.length === 0) {
        // Fallback to stored progress
        return kra.progress || 0;
    }

    const totalProgress = kraInitiatives.reduce((sum, init) => {
        return sum + calculateInitiativeProgress(init, kpis);
    }, 0);

    return Math.round(totalProgress / kraInitiatives.length);
};

/**
 * Calculates the progress of a Strategic Goal by averaging the progress of its KRAs.
 */
export const calculateCorporateGoalProgress = (goal: any, kras: any[] = [], initiatives: any[] = [], kpis: Partial<Kpi>[] = []): number => {
    const goalId = goal.id ? String(goal.id) : '';
    if (!goalId) return 0;

    // Priority: If Goal is marked Completed, force 100%
    const status = (goal.status || '').toLowerCase();
    if (['completed', 'closed', 'done'].includes(status)) {
        return 100;
    }

    // Filter KRAs that belong to this Goal
    const goalKras = kras.filter(kra => String(kra.goalId || '') === goalId);

    if (!goalKras || goalKras.length === 0) {
        // Fallback to stored progress
        return goal.progress || 0;
    }

    const totalProgress = goalKras.reduce((sum, kra) => {
        return sum + calculateCorporateKraProgress(kra, initiatives, kpis);
    }, 0);

    return Math.round(totalProgress / goalKras.length);
};
