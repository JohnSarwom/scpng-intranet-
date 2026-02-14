import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FileText, CheckCircle, Flame } from 'lucide-react';
import { KPIStats } from '../types';

interface KPIBarProps {
    stats: KPIStats;
}

const KPIBar: React.FC<KPIBarProps> = ({ stats }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-l-4 border-l-blue-500 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Total Reports</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.totalReports}</h3>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-full">
                        <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white border-l-4 border-l-yellow-500 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Open Cases</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.openCases}</h3>
                    </div>
                    <div className="p-2 bg-yellow-100 rounded-full">
                        <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white border-l-4 border-l-orange-500 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">High Risk</p>
                        <h3 className="text-2xl font-bold text-gray-800">{stats.highRisk}</h3>
                    </div>
                    <div className="p-2 bg-orange-100 rounded-full">
                        <Flame className="h-6 w-6 text-orange-600" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white border-l-4 border-l-red-600 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Critical Alerts</p>
                        <h3 className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</h3>
                    </div>
                    <div className="p-2 bg-red-100 rounded-full">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default KPIBar;
