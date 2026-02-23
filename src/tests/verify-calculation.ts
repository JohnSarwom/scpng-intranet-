
import { calculateKraProgress, calculateStrategicProgress } from '../utils/kpiUtils';

const testCalculateLogic = () => {
    console.log("🧪 Starting KRA/Objective Logic Verification...");

    // Test 1: KRA marked as 'completed' should be 100% even with no KPIs
    const kraCompletedNoKpis = { id: 'kra1', status: 'completed' };
    const progress1 = calculateKraProgress(kraCompletedNoKpis, []);
    console.log(`Test 1 (Completed KRA, No KPIs): ${progress1 === 100 ? '✅ 100%' : '❌ ' + progress1 + '%'}`);

    // Test 2: KRA marked as 'closed' should be 100% 
    const kraClosedWithKPIs = { id: 'kra2', status: 'closed' };
    const kpis2 = [
        { id: 'kpi1', kra_id: 'kra2', status: 'on-track' } // Not completed KPI
    ];
    const progress2 = calculateKraProgress(kraClosedWithKPIs, kpis2 as any);
    console.log(`Test 2 (Closed KRA, unfinished KPIs): ${progress2 === 100 ? '✅ 100% (Override works)' : '❌ ' + progress2 + '%'}`);

    // Test 3: KRA in progress should average KPI completion
    const kraInProgress = { id: 'kra3', status: 'in-progress' };
    const kpis3 = [
        { id: 'kpi2', kra_id: 'kra3', status: 'completed' },
        { id: 'kpi3', kra_id: 'kra3', status: 'on-track' }
    ];
    const progress3 = calculateKraProgress(kraInProgress, kpis3 as any);
    console.log(`Test 3 (In-progress KRA, 1/2 KPIs done): ${progress3 === 50 ? '✅ 50%' : '❌ ' + progress3 + '%'}`);

    // Test 4: Objective progress should average KRA progress
    const kras = [
        { id: 'kra1', status: 'completed' }, // 100%
        { id: 'kra3', status: 'in-progress' }  // 50%
    ];
    // We pass both KRAs and the relevant KPIs to calculateStrategicProgress
    const allKpis = [...kpis3];
    const objectiveProgress = calculateStrategicProgress(kras, allKpis as any);
    console.log(`Test 4 (Objective with 100% and 50% KRAs): ${objectiveProgress === 75 ? '✅ 75%' : '❌ ' + objectiveProgress + '%'}`);

    console.log("\n🧪 Verification Complete.");
};

testCalculateLogic();
