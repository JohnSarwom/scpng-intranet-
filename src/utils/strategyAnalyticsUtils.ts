import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfDay, isWithinInterval, parseISO } from 'date-fns';

export type TimePeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all';

export function computeDateRange(period: TimePeriod): { from: Date; to: Date } | null {
    const now = new Date();
    const to = endOfDay(now);
    switch (period) {
        case 'weekly': return { from: startOfWeek(now, { weekStartsOn: 1 }), to };
        case 'monthly': return { from: startOfMonth(now), to };
        case 'quarterly': return { from: startOfQuarter(now), to };
        case 'yearly': return { from: startOfYear(now), to };
        case 'all': return null;
    }
}

export function filterByTimePeriod<T extends Record<string, any>>(
    items: T[],
    period: TimePeriod
): T[] {
    if (period === 'all') return items;
    const range = computeDateRange(period);
    if (!range) return items;

    return items.filter(item => {
        const startStr = item.startDate || item.date;
        const endStr = item.endDate;

        try {
            const start = startStr ? (typeof startStr === 'string' ? parseISO(startStr) : new Date(startStr)) : null;
            const end = endStr ? (typeof endStr === 'string' ? parseISO(endStr) : new Date(endStr)) : null;

            // Include if the item's date range overlaps with the filter range
            if (start && end) return start <= range.to && end >= range.from;
            if (start) return start >= range.from && start <= range.to;
            if (end) return end >= range.from && end <= range.to;
            return true; // No dates = always included
        } catch {
            return true;
        }
    });
}

export function buildStatusDistributionData(objectives: any[]): Array<{ name: string; value: number; color: string }> {
    let onTrack = 0, needsAttention = 0, atRisk = 0, completed = 0;
    objectives.forEach(obj => {
        const progress = obj.progress || 0;
        const status = (obj.status || '').toLowerCase();
        if (status === 'completed' || status === 'achieved' || progress >= 100) completed++;
        else if (status === 'at-risk' || status === 'behind' || progress < 25) atRisk++;
        else if (status === 'on-track' || progress >= 50) onTrack++;
        else needsAttention++;
    });
    return [
        { name: "Completed", value: completed, color: "#16a34a" },
        { name: "On Track", value: onTrack, color: "#2563eb" },
        { name: "Needs Attention", value: needsAttention, color: "#f59e0b" },
        { name: "At Risk", value: atRisk, color: "#ef4444" },
    ].filter(d => d.value > 0);
}

export function buildProgressTrendData(
    objectives: any[]
): Array<{ name: string; objectives: number; executions: number }> {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, idx) => {
        const activeObjs = objectives.filter(obj => {
            const startMonth = obj.startDate ? new Date(obj.startDate).getMonth() : 0;
            const endMonth = obj.endDate ? new Date(obj.endDate).getMonth() : 11;
            return idx >= startMonth && idx <= endMonth;
        });
        const avgProgress = activeObjs.length > 0
            ? Math.round(activeObjs.reduce((s: number, o: any) => s + (o.progress || 0), 0) / activeObjs.length)
            : 0;
        const execObjs = activeObjs.filter((o: any) => o.isFeatured);
        const execProgress = execObjs.length > 0
            ? Math.round(execObjs.reduce((s: number, o: any) => s + (o.progress || 0), 0) / execObjs.length)
            : 0;
        return { name: month, objectives: avgProgress, executions: execProgress };
    });
}

export function buildDivisionalComparisonData(
    objectives: any[],
    kras: any[]
): Array<{ name: string; fullName: string; objectiveProgress: number; kraProgress: number }> {
    const divisions = [
        { abbr: 'LSD', full: 'Legal Services' },
        { abbr: 'LISD', full: 'Licensing' },
        { abbr: 'RPD', full: 'Research' },
        { abbr: 'CSD', full: 'Corporate Services' },
        { abbr: 'OC', full: 'Office of the Chairman' },
    ];
    return divisions.map(({ abbr, full }) => {
        const divObjs = objectives.filter(o => {
            const div = (o.division || '').toLowerCase();
            return div.includes(abbr.toLowerCase()) || div.includes(full.toLowerCase());
        });
        const avgObjProgress = divObjs.length > 0
            ? Math.round(divObjs.reduce((s: number, o: any) => s + (o.progress || 0), 0) / divObjs.length)
            : 0;
        const divKras = kras.filter(k => divObjs.some(o => String(k.objective_id) === String(o.id)));
        const avgKraProgress = divKras.length > 0
            ? Math.round(divKras.reduce((s: number, k: any) => s + (k.progress || 0), 0) / divKras.length)
            : 0;
        return { name: abbr, fullName: full, objectiveProgress: avgObjProgress, kraProgress: avgKraProgress };
    });
}

export function serializeStrategyContext(
    objectives: any[],
    kras: any[],
    kpis: any[],
    milestones: any[],
    unitObjectives: any[] = [],
    orgHierarchy: any[] = []
): string {
    // Compute aggregate stats
    const totalObjs = objectives.length;
    const avgProgress = totalObjs > 0
        ? Math.round(objectives.reduce((s, o) => s + (o.progress || 0), 0) / totalObjs)
        : 0;
    const featured = objectives.filter(o => o.isFeatured);
    const featuredAvg = featured.length > 0
        ? Math.round(featured.reduce((s, o) => s + (o.progress || 0), 0) / featured.length)
        : 0;
    const atRisk = objectives.filter(o => (o.status || '').toLowerCase() === 'at-risk' || (o.progress || 0) < 25).length;
    const onTrack = objectives.filter(o => (o.status || '').toLowerCase() === 'on-track' || (o.progress || 0) >= 50).length;
    const completed = objectives.filter(o => (o.status || '').toLowerCase() === 'completed' || (o.progress || 0) >= 100).length;

    // Unit objectives stats
    const totalUnitObjs = unitObjectives.length;
    const unitAvgProgress = totalUnitObjs > 0
        ? Math.round(unitObjectives.reduce((s: number, o: any) => s + (o.progress || 0), 0) / totalUnitObjs)
        : 0;

    // Org hierarchy stats
    const uniqueDivisions = [...new Set(orgHierarchy.map((h: any) => h.division).filter(Boolean))];
    const uniqueUnits = [...new Set(orgHierarchy.map((h: any) => h.unit).filter(Boolean))];

    const summary = [
        `DATA SUMMARY:`,
        `- Total Strategic Objectives: ${totalObjs}`,
        `- Average Strategic Objective Progress: ${avgProgress}%`,
        `- Featured Executions: ${featured.length} (avg ${featuredAvg}% progress)`,
        `- Status Breakdown: ${completed} Completed, ${onTrack} On Track, ${atRisk} At Risk`,
        `- Total Unit-Level Objectives (from Unit_Objectives list): ${totalUnitObjs}`,
        `- Average Unit Objective Progress: ${unitAvgProgress}%`,
        `- Total KRAs: ${kras.length}`,
        `- Total KPIs: ${kpis.length}`,
        `- Total Milestones: ${milestones.length}`,
        `- Org Hierarchy: ${uniqueDivisions.length} Divisions, ${uniqueUnits.length} Units (${orgHierarchy.length} entries from Org_Hierarchy list)`,
    ].join('\n');

    const objSummary = objectives.map((o, i) =>
        `${i + 1}. "${o.title}" — Progress: ${o.progress || 0}%, Status: ${o.status || 'N/A'}, Division: ${o.division || 'N/A'}, Unit: ${o.unit || 'N/A'}, Featured Execution: ${o.isFeatured ? 'Yes' : 'No'}${o.description ? `, Description: ${o.description}` : ''}`
    ).join('\n');

    const unitObjSummary = unitObjectives.map((o: any, i: number) =>
        `${i + 1}. "${o.title}" — Progress: ${o.progress || 0}%, Status: ${o.status || 'N/A'}, Division: ${o.division || 'N/A'}, Unit: ${o.unit || 'N/A'}, Goal Type: ${o.goalType || 'N/A'}, Parent Objective ID: ${o.parentGoalId || 'N/A'}, Key Deliverable: ${o.linkedDeliverable || 'N/A'}${o.owner ? `, Owner: ${o.owner}` : ''}${o.description ? `, Description: ${o.description}` : ''}`
    ).join('\n');

    const kraSummary = kras.map((k, i) =>
        `${i + 1}. "${k.title || k.name}" — Status: ${k.status || 'N/A'}, Progress: ${k.progress || 0}%, Unit: ${k.unit || k.department || 'N/A'}, Linked Objective ID: ${k.objective_id || k.objectiveId || 'N/A'}${k.owner?.name ? `, Owner: ${k.owner.name}` : ''}`
    ).join('\n');

    const kpiSummary = kpis.map((k, i) =>
        `${i + 1}. "${k.name}" — Target: ${k.target || 'N/A'}, Actual: ${k.actual || 'N/A'}, Status: ${k.status || 'N/A'}, Progress: ${k.progress || 0}%`
    ).join('\n');

    const milestoneSummary = milestones.map((m, i) =>
        `${i + 1}. "${m.title}" — Date: ${m.date || 'N/A'}, Status: ${m.status || 'N/A'}${m.context ? `, Context: ${m.context}` : ''}`
    ).join('\n');

    const hierarchySummary = orgHierarchy.length > 0
        ? orgHierarchy.map((h: any, i: number) =>
            `${i + 1}. Division: "${h.division || 'N/A'}" — Unit: "${h.unit || 'N/A'}"${h.head ? `, Head: ${h.head}` : ''}${h.role ? `, Role: ${h.role}` : ''}${h.email ? `, Email: ${h.email}` : ''}${h.description ? `, Description: ${h.description}` : ''}`
          ).join('\n')
        : '(No org hierarchy data available)';

    return [
        summary,
        '',
        `STRATEGIC OBJECTIVES (${totalObjs} items) — from Strategic_Objectives SharePoint list:`,
        objSummary || '(No strategic objectives data available)',
        '',
        `UNIT-LEVEL OBJECTIVES (${totalUnitObjs} items) — from Unit_Objectives SharePoint list:`,
        `These are division/unit-level objectives that cascade from strategic objectives. Each has a parentGoalId linking it to a strategic objective, a division, a unit, and a Key Deliverable.`,
        unitObjSummary || '(No unit objectives data available)',
        '',
        `KEY RESULT AREAS - KRAs (${kras.length} items) — from Performance_KRAs SharePoint list:`,
        kraSummary || '(No KRA data available)',
        '',
        `KEY PERFORMANCE INDICATORS - KPIs (${kpis.length} items) — from Performance_KPIs SharePoint list:`,
        kpiSummary || '(No KPI data available)',
        '',
        `MILESTONES (${milestones.length} items) — from Strategy_Milestones SharePoint list:`,
        milestoneSummary || '(No milestone data available)',
        '',
        `ORGANIZATIONAL HIERARCHY (${orgHierarchy.length} entries, ${uniqueDivisions.length} Divisions, ${uniqueUnits.length} Units) — from Org_Hierarchy SharePoint list:`,
        `This data represents the official SCPNG organizational structure with divisions, units, and their heads.`,
        hierarchySummary,
    ].join('\n');
}
