import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const AppGridSkeleton = ({ count = 8 }: { count?: number }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5"
                >
                    {/* Icon Skeleton */}
                    <div className="flex-shrink-0">
                        <Skeleton className="w-12 h-12 rounded" />
                    </div>

                    {/* Text Content Skeleton */}
                    <div className="flex-1 min-w-0 pr-6 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <div className="space-y-1 mt-1">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-4/5" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
