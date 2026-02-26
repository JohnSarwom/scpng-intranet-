
import { Kpi, ChecklistItem } from '@/types';

/**
 * Calculates the progress of a KPI based on its calculation type.
 * 
 * @param kpi The KPI object to calculate progress for.
 * @returns The calculated progress as a percentage (0-100).
 */
export const calculateKpiProgress = (kpi: Partial<Kpi>): number => {
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

    // Priority 3: Manual target/actual calculation
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

    // KRA progress = % of KPIs that have a "completed" status
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
    allKpis: any[] = []
): number => {
    if (!childObjectives || childObjectives.length === 0) return 0;

    // Find all Unit Objectives linked to this goal
    const linkedChildren = childObjectives.filter(child =>
        String(child.parentGoalId) === String(goalId)
    );

    if (linkedChildren.length === 0) return 0;

    const totalProgress = linkedChildren.reduce((sum, child) => {
        let p = child.progress || 0;

        // Try to get dynamic progress calculated from KRAs/KPIs
        if (allKras.length > 0) {
            const linkedKras = allKras.filter(k =>
                String(k.objective_id) === String(child.id) ||
                String(k.objectiveId) === String(child.id)
            );
            if (linkedKras.length > 0) {
                p = calculateStrategicProgress(linkedKras, allKpis);
            }
        }

        // The Unit Objectives table (KRAsTab.tsx) strictly displays the dynamic numerical progress,
        // so we must NOT force p=100 just because the status string is 'completed', 
        // to maintain consistency with the visual numbers the user sees visually (e.g. 0% + 50% = 25%).

        console.log(`[kpiUtils] Goal ${goalId} -> Child ${child.id} (${child.title}): dynamic_p=${p}`);
        return sum + p;
    }, 0);

    const avg = Math.round(totalProgress / linkedChildren.length);
    console.log(`[kpiUtils] Goal ${goalId} -> Total children: ${linkedChildren.length}, Avg Progress: ${avg}%`);
    return avg;
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
