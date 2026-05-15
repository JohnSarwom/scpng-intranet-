import React from 'react';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeaveApplicationTrackerProps {
    currentStage: string;
    status: string;
    dates: {
        submitted?: string;
        managerAction?: string;
        directorAction?: string;
        hrAction?: string;
    };
}

const STAGES = [
    { id: 'Submitted',       label: 'Submitted',        step: 1, dateKey: 'submitted'      },
    { id: 'Manager Review',  label: 'Manager Review',   step: 2, dateKey: 'managerAction'  },
    { id: 'Director Review', label: 'Director Review',  step: 3, dateKey: 'directorAction' },
    { id: 'HR Review',       label: 'HR Review',        step: 4, dateKey: 'hrAction'       },
    { id: 'Approved',        label: 'Completed',        step: 5, dateKey: 'hrAction'       },
] as const;

type DateKey = typeof STAGES[number]['dateKey'];

function formatStageDate(dateStr?: string): string | null {
    if (!dateStr) return null;
    try {
        return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
        return null;
    }
}

export const LeaveApplicationTracker: React.FC<LeaveApplicationTrackerProps> = ({
    currentStage,
    status,
    dates,
}) => {
    const getCurrentStepIndex = () => {
        if (status === 'Rejected' || status === 'Declined') return -1;
        const index = STAGES.findIndex((s) => s.id === currentStage);
        return index === -1 ? 0 : index;
    };

    const currentStepIndex = getCurrentStepIndex();
    const isRejected = status === 'Rejected' || status === 'Declined';

    return (
        // Extra bottom padding gives room for the two-line label + date below each node
        <div className="w-full py-6 pb-14">
            <div className="relative flex items-start justify-between w-full">
                {/* Progress bar background */}
                <div className="absolute left-0 top-4 transform -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 -z-10" />

                {/* Active progress bar */}
                <div
                    className={cn(
                        'absolute left-0 top-4 transform -translate-y-1/2 h-1 transition-all duration-500 -z-10',
                        isRejected ? 'bg-red-200 dark:bg-red-900/50' : 'bg-green-500'
                    )}
                    style={{
                        width: `${(Math.max(0, currentStepIndex) / (STAGES.length - 1)) * 100}%`,
                    }}
                />

                {STAGES.map((stage, index) => {
                    const isCompleted = !isRejected && index <= currentStepIndex;
                    const isCurrent  = !isRejected && index === currentStepIndex;
                    const isFailed   = isRejected  && index === currentStepIndex;
                    const stageDate  = formatStageDate(dates[stage.dateKey as DateKey]);

                    return (
                        <div key={stage.id} className="flex flex-col items-center flex-1">
                            {/* Node icon */}
                            <div
                                className={cn(
                                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300',
                                    isCompleted && 'bg-green-500 border-green-500 text-white',
                                    !isCompleted && !isCurrent && !isFailed &&
                                        'bg-white dark:bg-gray-800 border-gray-300 dark:border-white/10 text-gray-300 dark:text-gray-500',
                                    isCurrent && !isFailed &&
                                        'bg-white dark:bg-gray-800 border-blue-500 dark:border-blue-400 text-blue-500 dark:text-blue-400',
                                    isFailed && 'bg-red-500 border-red-500 text-white'
                                )}
                            >
                                {isCompleted ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : isFailed ? (
                                    <XCircle className="w-5 h-5" />
                                ) : isCurrent ? (
                                    <Clock className="w-5 h-5 animate-pulse" />
                                ) : (
                                    <Circle className="w-5 h-5" />
                                )}
                            </div>

                            {/* Stage label */}
                            <span
                                className={cn(
                                    'text-xs font-medium mt-2 text-center leading-tight',
                                    isCompleted && 'text-green-600 dark:text-green-400',
                                    !isCompleted && !isCurrent && !isFailed &&
                                        'text-gray-400 dark:text-gray-500',
                                    isCurrent && !isFailed &&
                                        'text-blue-600 dark:text-blue-400 font-bold',
                                    isFailed && 'text-red-600 dark:text-red-400 font-bold'
                                )}
                            >
                                {stage.label}
                            </span>

                            {/* Timestamp — only shown when the stage has been reached */}
                            {stageDate && isCompleted && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 text-center">
                                    {stageDate}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
