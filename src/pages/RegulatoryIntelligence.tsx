import React from 'react';
import PageLayout from '@/components/layout/PageLayout';
import RegulatoryDashboard from '@/modules/regulatory/components/RegulatoryDashboard';

const RegulatoryIntelligence: React.FC = () => {
    return (
        <PageLayout>
            <div className="bg-gray-50 min-h-screen">
                <RegulatoryDashboard />
            </div>
        </PageLayout>
    );
};

export default RegulatoryIntelligence;
