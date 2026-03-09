import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const OrganizationalOverviewSkeleton = () => {
    return (
        <Card className="bg-gradient-to-br from-card to-muted/80 shadow-sm rounded-xl flex-1 h-full">
            <CardHeader className="pb-2">
                <Skeleton className="h-6 w-56" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column (Mission/Vision/Pillars) */}
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <Skeleton className="h-4 w-32 mb-2" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-5/6" />
                                </div>
                            </div>
                            <div>
                                <Skeleton className="h-4 w-32 mb-2" />
                                <div className="space-y-1">
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-4/5" />
                                </div>
                            </div>
                        </div>
                        {/* 2x2 Pillars Grid */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="p-3 rounded-xl border border-gray-100 flex flex-col gap-2">
                                    <Skeleton className="h-7 w-7 rounded-lg" />
                                    <div>
                                        <Skeleton className="h-3 w-16 mb-1" />
                                        <Skeleton className="h-2 w-20" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column (Objectives/Donut) */}
                    <div className="flex flex-col h-full space-y-6">
                        <div className="flex flex-col flex-1">
                            <Skeleton className="h-4 w-40 mb-3" />
                            <div className="flex flex-col justify-between flex-1 gap-4 min-h-[280px]">
                                {/* Donut Placeholder */}
                                <div className="flex justify-center items-center py-4">
                                    <Skeleton className="h-[180px] w-[180px] rounded-full" />
                                </div>
                                {/* Progress Bars List */}
                                <div className="space-y-3 pt-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex justify-between">
                                                <Skeleton className="h-3 w-3/4" />
                                                <Skeleton className="h-3 w-8" />
                                            </div>
                                            <Skeleton className="h-1.5 w-full rounded-full" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
