/**
 * Standalone Verification for KPI/KRA Progress Logic
 */

// --- Logic from kpiUtils.ts (Standalone Copy) ---

const calculateKpiProgress = (kpi) => {
    const status = (kpi.status || '').toLowerCase();
    if (status === 'completed' || status === 'achieved' || status === 'done') return 100;

    if (kpi.calculationType === 'checklist' && kpi.checklist && kpi.checklist.length > 0) {
        const completed = kpi.checklist.filter(item => item.checked).length;
        return Math.round((completed / kpi.checklist.length) * 100);
    }

    if (kpi.target && kpi.target > 0) {
        const actual = kpi.actual || 0;
        const rawProgress = (actual / kpi.target) * 100;
        return Math.min(100, Math.round(rawProgress));
    }
    return 0;
};

const calculateKraProgress = (kra, kpis) => {
    const status = (kra.status || '').toLowerCase();
    if (status === 'completed' || status === 'achieved' || status === 'done') return 100;

    const kraKpis = kpis.filter(kpi =>
        String(kpi.kra_id) === String(kra.id) ||
        String(kpi.kra_id) === String(kra.ID)
    );

    if (!kraKpis || kraKpis.length === 0) return Number(kra.progress) || 0;

    const totalProgress = kraKpis.reduce((sum, kpi) => sum + calculateKpiProgress(kpi), 0);
    return Math.round(totalProgress / kraKpis.length);
};

// --- Test Cases ---

const testCases = [
    {
        name: "KPI Checklist Progress (50%)",
        func: () => calculateKpiProgress({
            calculationType: 'checklist',
            checklist: [{ checked: true }, { checked: false }]
        }),
        expected: 50
    },
    {
        name: "KPI Manual Progress (75%)",
        func: () => calculateKpiProgress({
            calculationType: 'manual',
            actual: 75,
            target: 100
        }),
        expected: 75
    },
    {
        name: "KPI Manual Overflow (100%)",
        func: () => calculateKpiProgress({
            calculationType: 'manual',
            actual: 150,
            target: 100
        }),
        expected: 100
    },
    {
        name: "KRA Rollup Average (75%)",
        func: () => calculateKraProgress(
            { id: '1' },
            [
                { kra_id: '1', calculationType: 'manual', actual: 50, target: 100 },
                { kra_id: '1', status: 'completed' }
            ]
        ),
        expected: 75
    },
    {
        name: "KRA Completed Override (100%)",
        func: () => calculateKraProgress({ status: 'Completed', progress: 0 }, []),
        expected: 100
    }
];

console.log("🚀 Starting Progress Calculation Verification...\n");
let passed = 0;

testCases.forEach(tc => {
    const result = tc.func();
    if (result === tc.expected) {
        console.log(`✅ PASS: ${tc.name} -> ${result}%`);
        passed++;
    } else {
        console.log(`❌ FAIL: ${tc.name} -> Expected ${tc.expected}%, got ${result}%`);
    }
});

console.log(`\n📊 Summary: ${passed}/${testCases.length} tests passed.`);
process.exit(passed === testCases.length ? 0 : 1);
