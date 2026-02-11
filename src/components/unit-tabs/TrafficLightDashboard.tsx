
import React from 'react';
import { motion } from 'framer-motion';
import { TrafficLightCard, TrafficLightCardProps } from '@/components/dashboard/TrafficLightCard';

// Mock data for the dashboard
const dashboardMetrics: TrafficLightCardProps[] = [
    {
        category: "Strategic Alignment",
        status: "good", // good, warning, critical
        score: 85,
        trend: "up",
        items: [
            { label: "Goal Coverage", value: "92%", status: "good" },
            { label: "Obj. Completion", value: "78%", status: "warning" },
        ]
    },
    {
        category: "Operational Health",
        status: "warning",
        score: 72,
        trend: "flat",
        items: [
            { label: "Task Velocity", value: "14/week", status: "good" },
            { label: "Overdue Items", value: "5", status: "critical" },
        ]
    },
    {
        category: "Projects",
        status: "good",
        score: 95,
        trend: "up",
        items: [
            { label: "Active Projects", value: "8", status: "good" },
            { label: "On Track", value: "88%", status: "good" },
        ]
    }
];

const TrafficLightDashboard = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {dashboardMetrics.map((metric, index) => (
                <motion.div
                    key={metric.category}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                >
                    <TrafficLightCard {...metric} />
                </motion.div>
            ))}
        </div>
    );
};

export default TrafficLightDashboard;
