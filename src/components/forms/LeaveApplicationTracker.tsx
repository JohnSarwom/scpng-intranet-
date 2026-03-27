import React from 'react';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';
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
    { id: 'Submitted', label: 'Submitted', step: 1 },
    { id: 'Manager Review', label: 'Manager Review', step: 2 },
    { id: 'Director Review', label: 'Director Review', step: 3 },
    { id: 'HR Review', label: 'HR Review', step: 4 },
    { id: 'Approved', label: 'Completed', step: 5 },
];

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
        <div className="w-full py-6">
            <div className="relative flex items-center justify-between w-full">
                {/* Progress Bar Background */}
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 -z-10" />

                {/* Active Progress Bar */}
                <div
                    className={cn(
                        "absolute left-0 top-1/2 transform -translate-y-1/2 h-1 transition-all duration-500 -z-10",
                        isRejected ? "bg-red-200 dark:bg-red-900/50" : "bg-green-500"
                    )}
                    style={{
                        width: `${(Math.max(0, currentStepIndex) / (STAGES.length - 1)) * 100}%`,
                    }}
                />

                {STAGES.map((stage, index) => {
                    const isCompleted = !isRejected && index <= currentStepIndex;
                    const isCurrent = !isRejected && index === currentStepIndex;
                    const isFailed = isRejected && index === currentStepIndex;

                    return (
                        <div key={stage.id} className="flex flex-col items-center bg-white dark:bg-transparent px-2">
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300",
                                    isCompleted ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-gray-800 border-gray-300 dark:border-white/10 text-gray-300 dark:text-gray-500",
                                    isCurrent && "border-blue-500 dark:border-blue-400 text-blue-500 dark:text-blue-400",
                                    isFailed && "bg-red-500 border-red-500 text-white"
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
                            <span
                                className={cn(
                                    "text-xs font-medium mt-2 absolute -bottom-6 w-24 text-center",
                                    isCompleted ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500",
                                    isCurrent && "text-blue-600 dark:text-blue-400 font-bold",
                                    isFailed && "text-red-600 dark:text-red-400 font-bold"
                                )}
                            >
                                {stage.label}
                            </span>
                            {/* Optional: Show dates if available */}
                            {/* {index === 0 && dates.submitted && (
                <span className="text-[10px] text-gray-400 absolute -bottom-10">{dates.submitted}</span>
              )} */}
                        </div>
                    );
                })}
            </div>
            <div className="h-8" /> {/* Spacer for labels */}
        </div>
    );
};
