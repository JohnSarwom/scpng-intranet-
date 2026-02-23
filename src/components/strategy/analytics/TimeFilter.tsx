import React from 'react';
import { TimePeriod } from '@/utils/strategyAnalyticsUtils';

interface TimeFilterProps {
    value: TimePeriod;
    onChange: (period: TimePeriod) => void;
}

const periods: { value: TimePeriod; label: string }[] = [
    { value: 'weekly', label: 'Week' },
    { value: 'monthly', label: 'Month' },
    { value: 'quarterly', label: 'Quarter' },
    { value: 'yearly', label: 'Year' },
    { value: 'all', label: 'All Time' },
];

const TimeFilter: React.FC<TimeFilterProps> = ({ value, onChange }) => {
    return (
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
            {periods.map(p => (
                <button
                    key={p.value}
                    onClick={() => onChange(p.value)}
                    className={`text-xs py-1.5 px-4 rounded-md transition-all font-medium ${
                        value === p.value
                            ? 'bg-white dark:bg-gray-700 shadow-sm text-intranet-primary font-bold'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
};

export default TimeFilter;
