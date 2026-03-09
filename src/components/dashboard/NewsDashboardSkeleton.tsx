import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const NewsDashboardSkeleton = () => {
    return (
        <div className="space-y-6 pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Featured Story Skeleton (2 Columns) */}
                <div className="lg:col-span-2">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Skeleton className="h-6 w-40" />
                    </h2>
                    <Card className="overflow-hidden rounded-xl shadow-md flex flex-col relative">
                        <div className="relative h-64 w-full overflow-hidden">
                            <Skeleton className="w-full h-full rounded-none" />
                            <div className="absolute top-4 left-4">
                                <Skeleton className="h-6 w-24 rounded-full" />
                            </div>
                        </div>
                        <CardHeader>
                            <div className="flex justify-between items-center mb-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-32 rounded" />
                            </div>
                            <Skeleton className="h-8 w-full mb-1" />
                            <Skeleton className="h-8 w-3/4" />
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <div className="space-y-2 mb-4">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-11/12" />
                                <Skeleton className="h-4 w-4/5" />
                            </div>
                            <Skeleton className="h-10 w-36 rounded-md" />
                        </CardContent>
                    </Card>
                </div>

                {/* Latest Updates Skeleton (1 Column) */}
                <div className="lg:col-span-1">
                    <h2 className="text-xl font-semibold mb-4">
                        <Skeleton className="h-6 w-40" />
                    </h2>
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="rounded-xl shadow-sm flex items-center overflow-hidden">
                                <div className="w-24 h-24 flex-shrink-0 ml-2 py-2">
                                    <Skeleton className="w-full h-full rounded-md" />
                                </div>
                                <CardContent className="p-3 flex-grow min-w-0">
                                    <div className="flex justify-between items-start mb-1 border-b-0">
                                        <Skeleton className="h-5 w-16" />
                                        <Skeleton className="h-3 w-20 ml-2" />
                                    </div>
                                    <Skeleton className="h-4 w-full mb-1" />
                                    <Skeleton className="h-4 w-3/4 mb-2" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-5/6 mt-1" />
                                </CardContent>
                            </Card>
                        ))}
                        <Skeleton className="h-9 w-full rounded-md mt-2" />
                    </div>
                </div>
            </div>

            {/* Category Highlights Grid */}
            <div>
                <h2 className="text-xl font-semibold mb-4">
                    <Skeleton className="h-6 w-48" />
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Highlight Cards */}
                    {Array.from({ length: 3 }).map((_, colIndex) => (
                        <Card key={colIndex} className="rounded-xl">
                            <CardHeader>
                                <Skeleton className="h-6 w-40" />
                            </CardHeader>
                            <CardContent>
                                {Array.from({ length: 2 }).map((_, idx) => (
                                    <div key={idx} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0 border-gray-100 dark:border-gray-800">
                                        <Skeleton className="h-4 w-full mb-1" />
                                        <Skeleton className="h-4 w-3/4 mb-2" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};
