import React from 'react';
import KPIBar from './KPIBar';
import FilterPanel from './FilterPanel';
import CaseTable from './CaseTable';
import { MOCK_CASES, MOCK_KPI_STATS } from '../constants';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaseType } from '../types';
import RegulatoryAnalytics from './RegulatoryAnalytics';
import RegulatoryAIChat from './RegulatoryAIChat';
import { useRegulatoryCases } from '@/hooks/useRegulatoryCases';

const RegulatoryDashboard: React.FC = () => {
    const { cases, stats, loading, error } = useRegulatoryCases();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 min-h-[500px]">
                <Loader2 className="h-12 w-12 animate-spin text-[#400010] mb-4" />
                <p className="text-gray-500 font-medium tracking-tight">Syncing Live Regulatory Data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-20 min-h-[500px]">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-gray-800 font-semibold mb-2">Secure Connection Failed</p>
                <p className="text-gray-500 max-w-md text-center text-sm">
                    Unable to retrieve regulatory cases from SharePoint. Verify permissions or API limits.
                </p>
            </div>
        );
    }

    const getFilteredCases = (type: CaseType) => cases.filter(c => c.type === type);

    const tabs: { id: string; label: string; type?: CaseType }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'scam', label: 'Scams', type: 'scam' },
        { id: 'whistleblower', label: 'Whistleblower', type: 'whistleblower' },
        { id: 'compliance', label: 'Compliance', type: 'compliance' },
        { id: 'enquiry', label: 'Enquiries', type: 'enquiry' },
        { id: 'investigation', label: 'Investigations', type: 'investigation' },
    ];

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Shield className="h-8 w-8 text-[#400010]" />
                        Regulatory Intelligence
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Monitor compliance, track investigations, and manage external reports.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right text-sm text-gray-500">
                        <p>Last Sync: Today, 09:41 AM</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <div className="flex items-center justify-between mb-6">
                    <TabsList>
                        {tabs.map(tab => (
                            <TabsTrigger key={tab.id} value={tab.id}>
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value="overview">
                    <KPIBar stats={stats} />
                    <RegulatoryAnalytics cases={cases} />
                    <FilterPanel />
                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-800">Recent Cases & Reports</h2>
                            <span className="text-sm text-gray-500">Showing {Math.min(cases.length, 5)} recent records</span>
                        </div>
                        <CaseTable data={cases.slice(0, 5)} />
                    </div>
                    {/* AI Chat Integration */}
                    <RegulatoryAIChat cases={cases} stats={stats} />
                </TabsContent>

                {tabs.filter(t => t.id !== 'overview').map(tab => (
                    <TabsContent key={tab.id} value={tab.id}>
                        <div className="mt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-800">{tab.label}</h2>
                                <span className="text-sm text-gray-500">Showing {getFilteredCases(tab.type!).length} records</span>
                            </div>
                            <CaseTable data={getFilteredCases(tab.type!)} />
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

export default RegulatoryDashboard;
