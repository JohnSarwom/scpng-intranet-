import React from 'react';
import DonutChart from '@/components/organization/DonutChart';
import { buildStatusDistributionData } from '@/utils/strategyAnalyticsUtils';

interface StatusDistributionProps {
    objectives: any[];
}

const StatusDistribution: React.FC<StatusDistributionProps> = ({ objectives }) => {
    const data = buildStatusDistributionData(objectives);

    return (
        <DonutChart
            title="Strategic Status Distribution"
            description="Real-time status of Objectives & Executions"
            data={data.length > 0 ? data : [{ name: "No Data", value: 1, color: "#d1d5db" }]}
        />
    );
};

export default StatusDistribution;
