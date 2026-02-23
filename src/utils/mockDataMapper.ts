/**
 * Mock Data Mapper
 * Maps internal mock data interfaces to SharePoint list item schemas
 */

import { Kra, Kpi, Task } from '@/types';

/**
 * Map KRA to SharePoint Performance_KRAs schema
 */
/**
 * Map KRA to SharePoint Performance_KRAs schema
 */
export function mapKraToSharePoint(kra: Kra, userMap: Record<string, number>): any {
    const responsibleId = kra.owner?.email ? userMap[kra.owner.email.toLowerCase()] : null;

    return {
        fields: {
            Title: kra.title,
            Description: kra.description || '',
            Status: formatStatus(kra.status),
            StartDate: kra.startDate,
            EndDate: kra.targetDate,
            Department: kra.department, // Division
            Progress: 0,

            // Linkage fields (FIXED: Using 'Id' suffix for lookup columns)
            StrategyGoalId: kra.objective_id,
            ResponsibleId: responsibleId,

            // Additional metadata
            IsMockData: true
        }
    };
}

/**
 * Map KPI to SharePoint Performance_KPIs schema
 */
export function mapKpiToSharePoint(kpi: Kpi, kraIdLookup: Record<string, number>): any {
    return {
        fields: {
            Title: kpi.name,
            Description: kpi.description || '',
            Metric: kpi.metric || 'Count',
            TargetValue: kpi.target?.toString(),
            ActualValue: kpi.actual?.toString() || '0',
            Status: formatStatus(kpi.status),
            StartDate: kpi.startDate,
            EndDate: kpi.targetDate,

            // Linkage fields (FIXED: Using 'Id' suffix for lookup columns)
            RelatedKRAId: kraIdLookup[kpi.kra_id as string] || kpi.kra_id,

            // JSON storage for Assignees (Critical for filtering)
            Assignees: JSON.stringify(kpi.assignees || []),

            // ADDED: Missing CostAssociated field
            CostAssociated: kpi.costAssociated || 0,

            // Additional metadata
            IsMockData: true
        }
    };
}

/**
 * Map Task to SharePoint Unit_Tasks schema
 */
export function mapTaskToSharePoint(task: Task, kpiIdLookup: Record<string, number>, userMap: Record<string, number>): any {
    const assignedId = task.assignedTo ? userMap[task.assignedTo.toLowerCase()] : null;

    return {
        fields: {
            Title: task.title,
            Description: task.description || '',
            Status: formatStatus(task.status),
            Priority: formatPriority(task.priority),
            StartDate: task.startDate instanceof Date ? task.startDate.toISOString() : task.startDate,
            DueDate: task.dueDate,

            // Linkage fields (FIXED: Using 'Id' suffix for lookup columns)
            RelatedKPIId: kpiIdLookup[task.kpi_id as string] || task.kpi_id,

            // Assignment (FIXED: Using 'Id' suffix for lookup columns)
            AssignedToId: assignedId,

            // ADDED: Missing Department field
            Department: task.unit_id || '',

            // Additional metadata
            IsMockData: true
        }
    };
}

/**
 * Format status string to Title Case matches SharePoint Choice fields
 */
function formatStatus(status: string | undefined): string {
    if (!status) return 'Not Started';

    const map: Record<string, string> = {
        'todo': 'Not Started',
        'not-started': 'Not Started',
        'open': 'Not Started',
        'to do': 'Not Started',
        'in-progress': 'In Progress',
        'in progress': 'In Progress',
        'on-hold': 'On Hold',
        'on hold': 'On Hold',
        'review': 'In Review',
        'in-review': 'In Review',
        'in review': 'In Review',
        'done': 'Completed',
        'completed': 'Completed',
        'complete': 'Completed',
        'on-track': 'On Track',
        'at-risk': 'At Risk',
        'behind': 'Behind',
        'off-track': 'Off Track'
    };

    return map[status.toLowerCase()] || 'Not Started';
}

/**
 * Format priority string to Title Case matches SharePoint Choice fields
 */
function formatPriority(priority: string | undefined): string {
    if (!priority) return 'Medium';

    const map: Record<string, string> = {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High',
        'urgent': 'Critical'
    };

    return map[priority.toLowerCase()] || 'Medium';
}
