import React, { useRef, useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutSegment {
    value: number;
    color: string;
    label?: string;
}

interface TaskCompletionDonutProps {
    segments: DonutSegment[];
    centerLabel?: string;
    centerSubtext?: string;
    size?: number;
    thickness?: number;
    className?: string; // Add className prop
}

export const TaskCompletionDonut: React.FC<TaskCompletionDonutProps> = ({
    segments,
    centerLabel,
    centerSubtext,
    size = 200,
    thickness = 20,
    className
}) => {
    const chartRef = useRef<any>(null);
    // Track hidden segments for UI feedback
    const [hiddenIndices, setHiddenIndices] = useState<number[]>([]);

    const data = {
        labels: segments.map(s => s.label),
        datasets: [
            {
                data: segments.map(s => s.value),
                backgroundColor: segments.map(s => s.color),
                borderColor: segments.map(s => s.color),
                borderWidth: 1,
                cutout: '85%',
                borderRadius: 10,
            },
        ],
    };

    // Plugin to draw center text on the canvas (behind tooltips)
    const centerText = {
        id: 'centerText',
        beforeDraw(chart: any) {
            const { ctx, width, height } = chart;
            ctx.restore();

            // Calculate Dynamic Percentage based on visibility
            let visibleTotal = 0;
            let doneValue = 0;

            chart.data.datasets[0].data.forEach((value: number, index: number) => {
                // In chart.js v3+, chart.getDataVisibility(index) returns boolean (true = visible)
                // Use built-in check if available, otherwise check hiddenIndices or meta
                const isVisible = chart.getDataVisibility ? chart.getDataVisibility(index) : true;

                if (isVisible) {
                    visibleTotal += value;
                    const label = chart.data.labels[index];
                    // Standard matching for "Completed"
                    if (label === 'Completed') {
                        doneValue += value;
                    }
                }
            });

            // If no segments visible, 0%. Avoid NaN.
            const percentage = visibleTotal > 0 ? Math.round((doneValue / visibleTotal) * 100) : 0;
            // Use calculated label if segments exist, otherwise fallback or 0%
            const textToDraw = `${percentage}%`;

            // Draw Center Label
            // Font size relative to height (approx 2.5em/ size 200)
            ctx.font = `bold ${2.5}em sans-serif`;
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#334155"; // slate-700

            const text = textToDraw;
            const textX = Math.round((width - ctx.measureText(text).width) / 2);
            const textY = height / 2;

            ctx.fillText(text, textX, textY - 10);

            // Draw Subtext
            if (centerSubtext) {
                ctx.font = `bold ${0.875}em sans-serif`;
                ctx.fillStyle = "#94a3b8"; // slate-400
                const subtext = centerSubtext;
                const subtextX = Math.round((width - ctx.measureText(subtext).width) / 2);
                const subtextY = height / 2 + 20;
                ctx.fillText(subtext, subtextX, subtextY);
            }
            ctx.save();
        }
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                enabled: true,
                callbacks: {
                    label: function (context: any) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        return `${label}: ${value}`;
                    }
                }
            },
        },
        cutout: '85%',
        animation: {
            animateScale: true,
            animateRotate: true
        }
    };

    const toggleSegment = (index: number) => {
        if (chartRef.current) {
            chartRef.current.toggleDataVisibility(index);
            chartRef.current.update();

            // Update local state for visual feedback
            setHiddenIndices(prev => {
                if (prev.includes(index)) {
                    return prev.filter(i => i !== index);
                } else {
                    return [...prev, index];
                }
            });
        }
    };

    return (
        <div className={cn("flex flex-col items-center gap-6", className)}>
            <div className="relative" style={{ width: size, height: size }}>
                <Doughnut ref={chartRef} data={data} options={options} plugins={[centerText]} />
            </div>

            {/* Interactive Legend */}
            <div className="flex flex-wrap justify-center gap-4 text-xs w-full px-4">
                {segments.map((segment, index) => {
                    const isHidden = hiddenIndices.includes(index);
                    return (
                        <div
                            key={index}
                            className={cn(
                                "flex items-center gap-1.5 cursor-pointer transition-all select-none",
                                isHidden ? "opacity-40 grayscale line-through" : "hover:opacity-80"
                            )}
                            onClick={() => toggleSegment(index)}
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: isHidden ? '#cbd5e1' : segment.color }}
                            />
                            <span className="text-muted-foreground whitespace-nowrap">
                                {segment.label}: {segment.value}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
