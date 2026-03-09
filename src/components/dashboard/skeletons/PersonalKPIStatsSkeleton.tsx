import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const PersonalKPIStatsSkeleton = () => {
    return (
        <Card className="shadow-sm mb-6 rounded-xl">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent className="h-80 flex flex-col pt-4">
                {/* Tabs List Placeholder */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                </div>

                {/* Chart Area Placeholder */}
                <div className="flex-1 w-full flex items-end justify-around pb-6 pt-4 border-b border-l border-gray-100 dark:border-gray-800 relative">
                    {/* Y-Axis lines mocked */}
                    <div className="absolute left-0 right-0 top-1/4 h-px bg-gray-100 dark:bg-gray-800"></div>
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-100 dark:bg-gray-800"></div>
                    <div className="absolute left-0 right-0 top-3/4 h-px bg-gray-100 dark:bg-gray-800"></div>

                    {/* Bars */}
                    {[1, 2, 3, 4].map((q) => (
                        <div key={q} className="flex gap-1 h-full items-end z-10 w-1/6">
                            <Skeleton className={`w-1/3 rounded-t-md ${q % 2 === 0 ? 'h-3/4' : 'h-1/2'}`} />
                            <Skeleton className={`w-1/3 rounded-t-md ${q % 3 === 0 ? 'h-5/6' : 'h-2/3'}`} />
                            <Skeleton className={`w-1/3 rounded-t-md ${q % 2 !== 0 ? 'h-2/5' : 'h-3/5'}`} />
                        </div>
                    ))}
                </div>
                {/* X-Axis labels placeholder */}
                <div className="flex justify-around mt-2">
                    <Skeleton className="h-3 w-6" />
                    <Skeleton className="h-3 w-6" />
                    <Skeleton className="h-3 w-6" />
                    <Skeleton className="h-3 w-6" />
                </div>
            </CardContent>
        </Card>
    );
};
