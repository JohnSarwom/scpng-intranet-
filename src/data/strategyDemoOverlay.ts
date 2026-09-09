/**
 * Strategy Demo Overlay
 *
 * Generates in-memory demo KRAs and KPIs for the Strategy page so that progress
 * bars, division/unit rollups and officer analytics show realistic movement
 * during demonstrations.
 *
 * Nothing here is written to SharePoint. The overlay is layered on top of the
 * live query results inside Strategy.tsx and disappears the moment demo mode is
 * turned off, so reverting is instant and cannot corrupt real data.
 */

import { Kra, Kpi, Objective } from '@/types';
import { SCPNG_STAFF_DATA, StaffMember } from '@/data/mockPerformanceDataGenerator';

export const DEMO_ID_PREFIX = 'DEMO_';

/** True for any record produced by this overlay. */
export const isDemoRecord = (record: { id?: string | number } | null | undefined): boolean =>
    String(record?.id ?? '').startsWith(DEMO_ID_PREFIX);

/**
 * Deterministic hash so a given objective always produces the same figures.
 * Demo numbers must not reshuffle on every re-render or the page looks unstable
 * while someone is presenting from it.
 */
function hash(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

/** Pseudo-random integer in [min, max] derived from a seed string. */
function seededInt(seed: string, min: number, max: number): number {
    return min + (hash(seed) % (max - min + 1));
}

function normalize(value: string | undefined | null): string {
    return (value || '').toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Pick the officers who plausibly own work under an objective.
 * Falls back progressively: unit match -> division match -> whole org.
 */
function officersFor(objective: Objective): StaffMember[] {
    const div = normalize(objective.division);
    const unit = normalize(objective.unit);

    const unitMatch = SCPNG_STAFF_DATA.filter(
        s => unit && normalize(s.department).includes(unit)
    );
    if (unitMatch.length > 0) return unitMatch;

    const divMatch = SCPNG_STAFF_DATA.filter(
        s => div && (normalize(s.officeLocation).includes(div) || div.includes(normalize(s.officeLocation)))
    );
    if (divMatch.length > 0) return divMatch;

    return SCPNG_STAFF_DATA;
}

// Generic but plausible KRA framings applied to whatever objective they hang off.
const KRA_FRAMES = [
    { suffix: 'Delivery & Implementation', desc: 'Execute the planned activities and milestones that deliver this objective within the current planning year.' },
    { suffix: 'Monitoring, Reporting & Assurance', desc: 'Track performance against target, report progress to management, and address gaps identified during review.' },
];

const KPI_FRAMES = [
    { name: 'Milestones Delivered On Schedule', metric: '%', target: 100 },
    { name: 'Planned Activities Completed', metric: '%', target: 90 },
    { name: 'Progress Reports Submitted On Time', metric: '%', target: 100 },
    { name: 'Outstanding Actions Closed', metric: '%', target: 85 },
];

const KRA_STATUSES = ['on-track', 'on-track', 'at-risk', 'completed', 'on-track', 'behind'];
const KPI_STATUSES = ['in-progress', 'on-track', 'completed', 'at-risk', 'on-track', 'in-progress'];

export interface StrategyDemoData {
    kras: Kra[];
    kpis: Kpi[];
    summary: {
        objectives: number;
        kras: number;
        kpis: number;
        officers: number;
    };
}

/**
 * Build demo KRAs/KPIs for every unit-level objective supplied.
 *
 * KPIs carry an explicit `weight` so that calculateKraProgress() takes its
 * weighted-average branch (actual/target) rather than the completed-status
 * branch — that is what produces varied percentages instead of 0% / 100%.
 */
export function generateStrategyDemoData(objectives: Objective[]): StrategyDemoData {
    const kras: Kra[] = [];
    const kpis: Kpi[] = [];
    const officersUsed = new Set<string>();

    const unitObjectives = (objectives || []).filter(obj => {
        const type = (obj.goalType || '').toLowerCase();
        return type !== 'org' && type !== 'strategic' && type !== 'board';
    });

    unitObjectives.forEach(objective => {
        const officers = officersFor(objective);

        KRA_FRAMES.forEach((frame, kraIndex) => {
            const kraSeed = `${objective.id}:${kraIndex}`;
            const officer = officers[hash(kraSeed) % officers.length];
            officersUsed.add(officer.id);

            const kraId = `${DEMO_ID_PREFIX}KRA_${objective.id}_${kraIndex}`;

            kras.push({
                id: kraId,
                title: `${objective.title} — ${frame.suffix}`,
                description: frame.desc,
                objective_id: objective.id,
                department: objective.division || officer.officeLocation,
                unit: objective.unit || officer.department,
                unitId: null,
                startDate: '2026-01-05',
                start_date: '2026-01-05',
                targetDate: '2026-12-31',
                target_date: '2026-12-31',
                status: KRA_STATUSES[hash(kraSeed) % KRA_STATUSES.length] as Kra['status'],
                owner: { id: officer.id, name: officer.displayName, email: officer.mail },
                ownerId: officer.id,
                unitKpis: [],
                unitObjectives: { title: objective.title },
            } as Kra);

            // 2 KPIs per KRA, drawn from the frame pool so each KRA differs.
            for (let k = 0; k < 2; k++) {
                const kpiFrame = KPI_FRAMES[(kraIndex * 2 + k) % KPI_FRAMES.length];
                const kpiSeed = `${kraSeed}:${k}`;
                // Spread actuals across 35%-100% of target for a believable mix.
                const attainment = seededInt(kpiSeed, 35, 100) / 100;
                const actual = Math.max(1, Math.round(kpiFrame.target * attainment));

                kpis.push({
                    id: `${DEMO_ID_PREFIX}KPI_${objective.id}_${kraIndex}_${k}`,
                    kra_id: kraId,
                    name: kpiFrame.name,
                    description: `Demonstration KPI tracking ${kpiFrame.name.toLowerCase()} for ${objective.title}.`,
                    target: kpiFrame.target,
                    actual,
                    metric: kpiFrame.metric,
                    unit: kpiFrame.metric,
                    weight: 1,
                    progress: Math.min(100, Math.round((actual / kpiFrame.target) * 100)),
                    status: KPI_STATUSES[hash(kpiSeed) % KPI_STATUSES.length],
                    startDate: '2026-01-05',
                    start_date: '2026-01-05',
                    targetDate: '2026-12-31',
                    target_date: '2026-12-31',
                    assignees: [{ id: officer.id, name: officer.displayName, email: officer.mail }],
                    comments: '',
                    costAssociated: 0,
                } as Kpi);
            }
        });
    });

    return {
        kras,
        kpis,
        summary: {
            objectives: unitObjectives.length,
            kras: kras.length,
            kpis: kpis.length,
            officers: officersUsed.size,
        },
    };
}
