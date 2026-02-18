
import { Kpi, ChecklistItem } from '@/types';

/**
 * Calculates the progress of a KPI based on its calculation type.
 * 
 * @param kpi The KPI object to calculate progress for.
 * @returns The calculated progress as a percentage (0-100).
 */
export const calculateKpiProgress = (kpi: Partial<Kpi>): number => {
    // Priority 1: If Status is explicitly 'Completed', force 100%
    if (kpi.status === 'Completed' || kpi.status === 'Achieved' || kpi.status === 'Done' || kpi.status === 'completed') {
        return 100;
    }

    // Otherwise return 0 - no partial progress allowed
    return 0;
};

/**
 * Calculates the progress of a KRA by averaging the progress of its KPIs.
 * 
 * @param kra The KRA object
 * @param kpis Array of KPIs belonging to this KRA
 * @returns The calculated progress as a percentage (0-100)
 */
export const calculateKraProgress = (kra: any, kpis: Partial<Kpi>[]): number => {
    // Priority 1: If Status is explicitly 'Completed', force 100%
    if (kra.status === 'completed' || kra.status === 'achieved' || kra.status === 'done' || kra.status === 'Completed') {
        return 100;
    }

    // Filter KPIs that belong to this KRA
    // Handle both string and number IDs safely
    const kraKpis = kpis.filter(kpi =>
        String(kpi.kra_id) === String(kra.id) ||
        String(kpi.kra_id) === String(kra.ID) // Handle case sensitivity in SharePoint objects
    );

    if (!kraKpis || kraKpis.length === 0) {
        // No KPIs, fall back to stored progress
        return kra.progress || 0;
    }

    // Calculate average progress of all KPIs
    const totalProgress = kraKpis.reduce((sum, kpi) => {
        return sum + calculateKpiProgress(kpi);
    }, 0);

    return Math.round(totalProgress / kraKpis.length);
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
        return objective.status || 'Not Started';
    }

    // 2. Collect all KPIs from these KRAs
    let allKpis: any[] = [];
    linkedKras.forEach(kra => {
        if (kra.unitKpis && kra.unitKpis.length > 0) {
            allKpis = [...allKpis, ...kra.unitKpis];
        }
    });

    // 3. If there are no KPIs defined yet, we can't auto-complete
    if (allKpis.length === 0) {
        return objective.status || 'Not Started';
    }

    // 4. Check if ALL KPIs are completed
    const allCompleted = allKpis.every(kpi =>
        kpi.status === 'Completed' ||
        kpi.status === 'Achieved' ||
        kpi.status === 'Done' ||
        kpi.status === 'completed'
    );

    if (allCompleted) {
        return 'Completed';
    }

    // Default to original status
    return objective.status || 'Not Started';
};
