import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const DivisionHierarchySkeleton = () => {
    return (
        <div className="w-full space-y-4">
            {/* Render 5 generic division accordions as placeholders */}
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border rounded-2xl bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden px-0">
                    <div className="px-6 py-5 flex items-center gap-4 w-full">
                        {/* Icon */}
                        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />

                        {/* Title & Subtitle */}
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-48 sm:w-64" />
                            <Skeleton className="h-3 w-32 sm:w-40" />
                        </div>

                        {/* Badge */}
                        <Skeleton className="h-5 w-28 rounded-full hidden sm:block" />

                        {/* Progress Bar Placeholder */}
                        <div className="flex-1 max-w-[300px] ml-auto mr-4 hidden md:flex items-center gap-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-10" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
