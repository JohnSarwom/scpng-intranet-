import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    LineChart, Line
} from 'recharts';
import { RegulatoryCase } from '../types';

interface RegulatoryAnalyticsProps {
    cases: RegulatoryCase[];
}

// Colors for charts
const COLORS = {
    RISK: {
        LOW: '#22c55e',      // Green-500
        MEDIUM: '#eab308',   // Yellow-500
        HIGH: '#f97316',     // Orange-500
        CRITICAL: '#ef4444'  // Red-500
    },
    TYPE: {
        scam: '#3b82f6',         // Blue-500
        whistleblower: '#8b5cf6', // Violet-500
        compliance: '#10b981',    // Emerald-500
        enquiry: '#64748b',       // Slate-500
        investigation: '#f43f5e'  // Rose-500
    }
};

const RegulatoryAnalytics: React.FC<RegulatoryAnalyticsProps> = ({ cases }) => {

    // 1. Prepare Risk Distribution Data
    const riskData = [
        { name: 'Low', value: cases.filter(c => c.risk === 'LOW').length, color: COLORS.RISK.LOW },
        { name: 'Medium', value: cases.filter(c => c.risk === 'MEDIUM').length, color: COLORS.RISK.MEDIUM },
        { name: 'High', value: cases.filter(c => c.risk === 'HIGH').length, color: COLORS.RISK.HIGH },
        { name: 'Critical', value: cases.filter(c => c.risk === 'CRITICAL').length, color: COLORS.RISK.CRITICAL },
    ].filter(item => item.value > 0);

    // 2. Prepare Case Type Data
    const typeCounts: Record<string, number> = {};
    cases.forEach(c => {
        typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    });

    const typeData = Object.entries(typeCounts).map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value: value,
        fill: COLORS.TYPE[key as keyof typeof COLORS.TYPE] || '#94a3b8'
    }));

    // 3. Mock Trend Data (Since we don't have enough historical mock data)
    // In a real app, this would be aggregated from the backend
    const trendData = [
        { name: 'Jan', received: 12, resolved: 10 },
        { name: 'Feb', received: 19, resolved: 15 },
        { name: 'Mar', received: 15, resolved: 18 },
        { name: 'Apr', received: 22, resolved: 14 },
        { name: 'May', received: 28, resolved: 20 },
        { name: 'Jun', received: 25, resolved: 22 },
    ];

    return (
        <div className="space-y-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Risk Distribution Chart */}
                <Card className="shadow-sm border-gray-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-800">Risk Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={riskData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {riskData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Case Type Breakdown */}
                <Card className="shadow-sm border-gray-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-gray-800">Cases by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={typeData} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                        {typeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Volume Trend */}
            <Card className="shadow-sm border-gray-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-gray-800">6-Month Volume Trend</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="received" name="Received" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default RegulatoryAnalytics;
