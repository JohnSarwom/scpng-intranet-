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
        const fallbackStr = item.modifiedAt || item.updatedAt || item.createdAt;

        try {
            const toDate = (v: any): Date | null => {
                if (!v) return null;
                return typeof v === 'string' ? parseISO(v) : new Date(v);
            };

            const start = toDate(startStr);
            const end = toDate(endStr);

            // Include if the item's date range overlaps with the filter range
            if (start && end) return start <= range.to && end >= range.from;
            if (start) return start >= range.from && start <= range.to;
            if (end) return end >= range.from && end <= range.to;

            // Fallback: use last-modified / created timestamp
            const fallback = toDate(fallbackStr);
            if (fallback) return fallback >= range.from && fallback <= range.to;

            return true; // No dates at all = always included
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
    objectives: any[],
    period: TimePeriod = 'all'
): Array<{ name: string; objectives: number; executions: number; planned: number }> {
    const now = new Date();

    // Helper: average progress of objectives that are "active" at a given reference date
    const avgProgressOf = (objs: any[]) => {
        if (objs.length === 0) return 0;
        return Math.round(objs.reduce((s: number, o: any) => {
            let p = o.progress || 0;
            const status = (o.status || '').toLowerCase();
            if (p === 0 && (status === 'completed' || status === 'achieved')) p = 100;
            return s + p;
        }, 0) / objs.length);
    };

    // Helper: average planned (expected) progress based on elapsed time vs objective lifespan
    const avgPlannedOf = (objs: any[], refDate: Date) => {
        const withDates = objs.filter(o => o.startDate && o.endDate);
        if (withDates.length === 0) return null; // null = no reference line
        const totalPlanned = withDates.reduce((sum: number, o: any) => {
            const start = new Date(o.startDate);
            const end = new Date(o.endDate);
            const totalMs = end.getTime() - start.getTime();
            if (totalMs <= 0) return sum;
            const elapsedMs = Math.min(Math.max(refDate.getTime() - start.getTime(), 0), totalMs);
            return sum + (elapsedMs / totalMs) * 100;
        }, 0);
        return Math.round(totalPlanned / withDates.length);
    };

    // Helper: filter objectives that are active at a given reference date
    const activeAt = (objs: any[], refDate: Date) =>
        objs.filter(obj => {
            const start = obj.startDate ? new Date(obj.startDate) : null;
            const end = obj.endDate ? new Date(obj.endDate) : null;
            if (start && end) return refDate >= start && refDate <= end;
            return true; // No dates = always active
        });

    const buildPoint = (label: string, refDate: Date) => {
        const active = activeAt(objectives, refDate);
        const execs = active.filter((o: any) => o.isFeatured);
        const planned = avgPlannedOf(active, refDate);
        return {
            name: label,
            objectives: avgProgressOf(active),
            executions: avgProgressOf(execs),
            planned: planned ?? 0,
        };
    };

    if (period === 'weekly') {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + idx);
            return buildPoint(day, d);
        });
    }

    if (period === 'monthly') {
        const mStart = startOfMonth(now);
        return ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((label, idx) => {
            const d = new Date(mStart);
            d.setDate(mStart.getDate() + idx * 7);
            return buildPoint(label, d);
        });
    }

    if (period === 'quarterly') {
        const qStart = startOfQuarter(now);
        return [0, 1, 2].map(idx => {
            const d = new Date(qStart.getFullYear(), qStart.getMonth() + idx, 15);
            const label = d.toLocaleString('default', { month: 'short' });
            return buildPoint(label, d);
        });
    }

    // yearly / all — show all 12 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, idx) => {
        const refDate = new Date(now.getFullYear(), idx, 15);
        return buildPoint(month, refDate);
    });
}

export function buildDivisionalComparisonData(
    objectives: any[], // kept for API compatibility — not used for chart data
    kras: any[],
    unitObjectives: any[] = [],
    kpis: any[] = [],
    orgHierarchy: any[] = []
): Array<{ name: string; fullName: string; objectiveProgress: number; kraProgress: number; objCount: number; kraCount: number }> {

    // --- Dynamic division extraction from orgHierarchy ---
    type DivisionEntry = { abbr: string; full: string; aliases: string[] };

    const buildDivisionsFromHierarchy = (): DivisionEntry[] => {
        // Group by division name, collect associated units as aliases
        const divMap = new Map<string, Set<string>>();
        orgHierarchy.forEach((h: any) => {
            const div = (h.division || '').trim();
            if (!div) return;
            if (!divMap.has(div)) divMap.set(div, new Set());
            const unit = (h.unit || '').trim();
            if (unit) divMap.get(div)!.add(unit.toLowerCase());
        });
        return Array.from(divMap.entries()).map(([div, unitSet]) => {
            // Build abbreviation from first letters of each word
            const abbr = div.split(/\s+/).map(w => w[0]?.toUpperCase() || '').join('');
            return {
                abbr,
                full: div,
                aliases: [div.toLowerCase(), ...Array.from(unitSet)],
            };
        });
    };

    // Fallback hardcoded divisions (when orgHierarchy is empty)
    const FALLBACK_DIVISIONS: DivisionEntry[] = [
        { abbr: 'LSD', full: 'Legal Services', aliases: ['legal services division', 'legal advisory'] },
        { abbr: 'LISD', full: 'Licensing', aliases: ['licensing, market & supervision division', 'licensing division', 'licensing unit', 'supervision unit', 'market data unit', 'investigations unit'] },
        { abbr: 'RPD', full: 'Research', aliases: ['research & publication division', 'research division', 'publication unit'] },
        { abbr: 'CSD', full: 'Corporate Services', aliases: ['corporate services division', 'finance unit', 'it unit', 'human resource unit'] },
        { abbr: 'OC', full: 'Office of the Chairman', aliases: ['office of the chairman', 'executive division', 'secretariat unit'] },
    ];

    const divisions = orgHierarchy.length > 0 ? buildDivisionsFromHierarchy() : FALLBACK_DIVISIONS;

    const COMPLETED_STATUSES = ['completed', 'achieved', 'done'];

    // Calculate KRA progress purely from KPI completion status
    const getKraProgressFromKpis = (kra: any): number => {
        const kraId = String(kra.id || kra.ID || '');
        if (!kraId) return 0;
        const kraKpis = kpis.filter(kpi => String(kpi.kra_id || '') === kraId);
        if (kraKpis.length === 0) return 0;
        const completedCount = kraKpis.filter(kpi =>
            COMPLETED_STATUSES.includes((kpi.status || '').toLowerCase())
        ).length;
        return Math.round((completedCount / kraKpis.length) * 100);
    };

    return divisions.map(({ abbr, full, aliases }) => {
        // Match function: checks if a division/unit string matches this division
        const matchesDivision = (divStr: string) => {
            const lower = (divStr || '').toLowerCase().trim();
            if (!lower) return false;
            return lower.includes(abbr.toLowerCase()) ||
                lower.includes(full.toLowerCase()) ||
                aliases.some(alias => lower.includes(alias) || alias.includes(lower));
        };

        // Only use true unit-level objectives — exclude org/strategic/board types
        const trueUnitObjs = unitObjectives.filter(o => {
            const type = (o.goalType || '').toLowerCase();
            return type !== 'org' && type !== 'strategic' && type !== 'board';
        });

        // Filter to objectives belonging to this division/unit
        const divUnitObjs = trueUnitObjs.filter(o =>
            matchesDivision(o.division || '') || matchesDivision(o.unit || '')
        );

        // Calculate objective progress from unit objectives only
        const avgObjProgress = divUnitObjs.length > 0
            ? Math.round(divUnitObjs.reduce((s: number, o: any) => {
                // Priority: Calculate from linked KRAs if they exist (Dynamic)
                const linkedKras = kras.filter(k =>
                    String(k.objective_id || k.objectiveId) === String(o.id)
                );

                if (linkedKras.length > 0) {
                    const kraAvgProgress = linkedKras.reduce((sum, kra) => sum + getKraProgressFromKpis(kra), 0) / linkedKras.length;
                    return s + kraAvgProgress;
                }

                // Fallback: Manual progress or status-based override
                let p = o.progress || 0;
                const status = (o.status || '').toLowerCase();
                if (p === 0 && (status === 'completed' || status === 'achieved')) p = 100;
                return s + p;
            }, 0) / divUnitObjs.length)
            : 0;

        // Find KRAs linked directly to unit objectives in this division
        const divUnitObjIds = new Set(divUnitObjs.map(o => String(o.id)));
        const divKras = kras.filter(k =>
            divUnitObjIds.has(String(k.objective_id)) || divUnitObjIds.has(String(k.objectiveId))
        );

        // KRA progress = % of KPIs within each KRA that are "completed" (by status)
        const avgKraProgress = divKras.length > 0
            ? Math.round(divKras.reduce((s: number, k: any) => s + getKraProgressFromKpis(k), 0) / divKras.length)
            : 0;

        return {
            name: abbr,
            fullName: full,
            objectiveProgress: avgObjProgress,
            kraProgress: avgKraProgress,
            objCount: divUnitObjs.length,
            kraCount: divKras.length,
        };
    });
}


export function serializeStrategyContext(
    objectives: any[],
    kras: any[],
    kpis: any[],
    milestones: any[],
    unitObjectives: any[] = [],
    orgHierarchy: any[] = [],
    divisions: any[] = [],
    units: any[] = [],
    officerProfiles: any[] = []
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
        `- Strategy Divisions (from Strategy_Divisions list): ${divisions.length}`,
        `- Strategy Units (from Strategy_Units list): ${units.length}`,
        `- Staff Profiles (from Strategy_Officer_Profiles list): ${officerProfiles.length}`,
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

    const divisionsSummary = divisions.length > 0
        ? divisions.map((d: any, i: number) =>
            `${i + 1}. "${d.divisionName || 'N/A'}" — Branch: ${d.branch || 'N/A'}, Director: ${d.director?.name || 'N/A'}${d.location ? `, Location: ${d.location}` : ''}${d.missionStatement ? `, Mission: ${d.missionStatement}` : ''}${d.primaryContact?.email ? `, Contact: ${d.primaryContact.email}` : ''}${d.subDepartments?.length ? `, Sub-departments: ${d.subDepartments.map((s: any) => s.name || s).join(', ')}` : ''}`
        ).join('\n')
        : '(No divisions data available)';

    const unitsSummary = units.length > 0
        ? units.map((u: any, i: number) =>
            `${i + 1}. "${u.unitName || 'N/A'}" — Parent Division: ${u.parentDivision || 'N/A'}, Manager: ${u.manager?.name || 'N/A'}${u.location ? `, Location: ${u.location}` : ''}${u.missionStatement ? `, Mission: ${u.missionStatement}` : ''}${u.primaryContact?.email ? `, Contact: ${u.primaryContact.email}` : ''}${u.coreFunctions?.length ? `, Core Functions: ${u.coreFunctions.map((f: any) => f.name || f).join(', ')}` : ''}`
        ).join('\n')
        : '(No units data available)';

    const profilesSummary = officerProfiles.length > 0
        ? officerProfiles.map((p: any, i: number) =>
            `${i + 1}. "${p.name || 'N/A'}" — Title: ${p.jobTitle || 'N/A'}, Division: ${p.division || 'N/A'}, Unit: ${p.unit || 'N/A'}, Email: ${p.email || 'N/A'}${p.employeeId ? `, Employee ID: ${p.employeeId}` : ''}${p.reportsTo?.name ? `, Reports To: ${p.reportsTo.name}` : ''}${p.directReports ? `, Direct Reports: ${p.directReports}` : ''}${p.skills?.length ? `, Skills: ${p.skills.join(', ')}` : ''}${p.statutoryDuty ? `, Statutory Duty: ${p.statutoryDuty}` : ''}`
        ).join('\n')
        : '(No staff profiles data available)';

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
        '',
        `STRATEGY DIVISIONS (${divisions.length} items) — from Strategy_Divisions SharePoint list:`,
        `Detailed division profiles including directors, mission statements, sub-departments, and achievements.`,
        divisionsSummary,
        '',
        `STRATEGY UNITS (${units.length} items) — from Strategy_Units SharePoint list:`,
        `Detailed unit profiles including managers, core functions, and mission statements.`,
        unitsSummary,
        '',
        `STAFF PROFILES (${officerProfiles.length} items) — from Strategy_Officer_Profiles SharePoint list:`,
        `Officer profiles with job titles, divisions, units, skills, reporting lines, and statutory duties.`,
        profilesSummary,
    ].join('\n');
}
