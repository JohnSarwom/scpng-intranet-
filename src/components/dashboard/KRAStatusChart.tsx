
import React from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);

interface KRAStatusChartProps {
    data: {
        status: string;
        count: number;
        color: string;
    }[];
}

export const KRAStatusChart: React.FC<KRAStatusChartProps> = ({ data }) => {
    const chartData = {
        labels: data.map(d => d.status),
        datasets: [
            {
                data: data.map(d => d.count),
                backgroundColor: data.map(d => d.color),
                borderColor: data.map(d => d.color),
                borderWidth: 1,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    font: {
                        size: 11
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const percentage = Math.round((value / total) * 100) + '%';
                        return `${label}: ${value} (${percentage})`;
                    }
                }
            }
        },
        cutout: '70%',
    };

    return (
        <div className="w-full h-full flex items-center justify-center">
            <Doughnut data={chartData} options={options} />
        </div>
    );
};
