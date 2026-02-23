import { calculateKpiProgress, calculateKraProgress } from './src/utils/kpiUtils';

const testCases = [
    {
        name: "KPI Checklist Progress (50%)",
        kpi: {
            calculationType: 'checklist',
            checklist: [
                { id: '1', text: 'Task 1', checked: true },
                { id: '2', text: 'Task 2', checked: false }
            ]
        },
        expected: 50
    },
    {
        name: "KPI Manual Progress (75%)",
        kpi: {
            calculationType: 'manual',
            actual: 75,
            target: 100
        },
        expected: 75
    },
    {
        name: "KPI Manual Overflow (Capped at 100%)",
        kpi: {
            calculationType: 'manual',
            actual: 120,
            target: 100
        },
        expected: 100
    },
    {
        name: "KPI Status Override (Completed = 100%)",
        kpi: {
            status: 'completed',
            actual: 0,
            target: 100
        },
        expected: 100
    },
    {
        name: "KRA Rollup (Average of 50% and 100% = 75%)",
        kra: { id: 'kra1' },
        kpis: [
            { kra_id: 'kra1', calculationType: 'manual', actual: 50, target: 100 },
            { kra_id: 'kra1', status: 'completed' }
        ],
        expected: 75
    }
];

testCases.forEach(tc => {
    const result = tc.kpis
        ? calculateKraProgress(tc.kra, tc.kpis as any)
        : calculateKpiProgress(tc.kpi as any);

    if (result === tc.expected) {
        console.log(`✅ PASS: ${tc.name} [Result: ${result}%]`);
    } else {
        console.error(`❌ FAIL: ${tc.name} [Expected: ${tc.expected}, Got: ${result}]`);
    }
});
