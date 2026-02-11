
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

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface ObjectivesProgressChartProps {
    data: {
        title: string;
        progress: number;
    }[];
}

export const ObjectivesProgressChart: React.FC<ObjectivesProgressChartProps> = ({ data }) => {
    const chartData = {
        labels: data.map(d => {
            // Truncate long titles
            return d.title.length > 20 ? d.title.substring(0, 20) + '...' : d.title;
        }),
        datasets: [
            {
                label: 'Progress (%)',
                data: data.map(d => d.progress),
                backgroundColor: data.map(d => {
                    if (d.progress >= 100) return '#34d399'; // Green
                    if (d.progress >= 50) return '#3b82f6'; // Blue
                    if (d.progress >= 25) return '#fbbf24'; // Yellow
                    return '#94a3b8'; // Gray
                }),
                borderRadius: 4,
                borderSkipped: false,
                barThickness: 20,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const, // Horizontal Bar Chart
        scales: {
            x: {
                beginAtZero: true,
                max: 100,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                grid: {
                    display: false,
                },
                ticks: {
                    font: {
                        size: 11
                    }
                }
            },
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => `Progress: ${context.raw}%`
                }
            }
        },
    };

    return <Bar data={chartData} options={options} />;
};
