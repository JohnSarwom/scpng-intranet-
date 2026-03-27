import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const FormsPageSkeleton = () => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Search and Filters Skeleton */}
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto mt-4">
                <Skeleton className="h-10 w-full sm:w-[300px]" />
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-full sm:w-[200px]" />
                    <Skeleton className="h-10 w-10" />
                </div>
            </div>

            {/* Tabs List Skeleton */}
            <Skeleton className="h-10 w-full" />

            {/* Main Content Skeleton */}
            <div className="space-y-8 mt-6">
                {Array.from({ length: 2 }).map((_, sectionIndex) => (
                    <div key={sectionIndex} className="space-y-4">
                        {/* Category Header */}
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-6 w-6 rounded-full" />
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-5 w-8 rounded-full" />
                        </div>

                        {/* Form Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 3 }).map((_, cardIndex) => (
                                <Card key={cardIndex} className="shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-white/10">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <Skeleton className="h-6 w-3/4 mb-2" />
                                                <Skeleton className="h-4 w-full" />
                                            </div>
                                            <Skeleton className="h-5 w-16 ml-2 rounded-full" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <div className="flex items-center justify-between mb-4">
                                            <Skeleton className="h-3 w-20" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>

                                        <div className="mb-4">
                                            <Skeleton className="h-3 w-32 mb-2" />
                                            <div className="flex gap-1">
                                                <Skeleton className="h-5 w-20 rounded-full" />
                                                <Skeleton className="h-5 w-20 rounded-full" />
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Skeleton className="h-9 flex-1" />
                                            <Skeleton className="h-9 w-10" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FormsPageSkeleton;
