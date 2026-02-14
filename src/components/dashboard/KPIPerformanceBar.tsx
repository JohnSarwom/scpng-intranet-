
import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface KPIStatusData {
    name: string;
    value: number;
    color: string;
}

interface KPIPerformanceBarProps {
    data: KPIStatusData[];
    className?: string;
    height?: number;
}

export const KPIPerformanceBar: React.FC<KPIPerformanceBarProps> = ({
    data,
    className,
    height = 300
}) => {
    const chartData = {
        labels: data.map(d => d.name),
        datasets: [
            {
                label: 'KPIs',
                data: data.map(d => d.value),
                backgroundColor: data.map(d => d.color),
                borderRadius: 10,
                barThickness: 40,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: false,
            },
            tooltip: {
                enabled: true,
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                },
                ticks: {
                    stepSize: 1,
                    precision: 0
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
    };

    return (
        <div className={cn("w-full relative", className)} style={{ height }}>
            <Bar options={options} data={chartData} />
        </div>
    );
};
