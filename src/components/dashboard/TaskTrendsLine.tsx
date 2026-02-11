
import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface TaskTrendData {
    name: string;
    completed: number;
    added: number;
}

interface TaskTrendsLineProps {
    data: TaskTrendData[];
    className?: string;
    height?: number;
}

export const TaskTrendsLine: React.FC<TaskTrendsLineProps> = ({
    data,
    className,
    height = 300
}) => {
    const chartData = {
        labels: data.map(d => d.name),
        datasets: [
            {
                label: 'Completed Tasks',
                data: data.map(d => d.completed),
                borderColor: '#34d399',
                backgroundColor: '#34d399',
                tension: 0.3, // Monotone curve equivalent
                pointRadius: 4,
                pointHoverRadius: 6,
            },
            {
                label: 'New Tasks',
                data: data.map(d => d.added),
                borderColor: '#3b82f6',
                backgroundColor: '#3b82f6',
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                align: 'end' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 8
                }
            },
            title: {
                display: false,
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false
        }
    };

    return (
        <div className={cn("w-full relative", className)} style={{ height }}>
            <Line options={options} data={chartData} />
        </div>
    );
};
