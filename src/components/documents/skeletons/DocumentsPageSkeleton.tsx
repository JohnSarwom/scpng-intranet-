import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const DocumentsPageSkeleton = () => {
    return (
        <div className="w-full animate-in fade-in duration-500">
            {/* Container echoing the TabsContent wrapping */}
            <div className="space-y-8 border border-gray-200 dark:border-white/10 rounded-lg p-6 w-full">


                {/* Category View Header Area Skeleton */}
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <Skeleton className="h-7 w-64 mb-2" />
                            <Skeleton className="h-4 w-96" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-10 w-36 rounded-md" /> {/* e.g., Add Category button */}
                            <Skeleton className="h-10 w-36 rounded-md" /> {/* e.g., Add Document button */}
                        </div>
                    </div>

            {/* Grid Layout Skeleton (Folders / Documents) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-white/10 shadow-sm">

                                <CardContent className="p-6">
                                    {/* Card Header (Icon and Title) */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-shrink-0 mr-4">
                                            <Skeleton className="h-12 w-12 rounded-lg" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <Skeleton className="h-5 w-3/4 mb-2" />
                                            <Skeleton className="h-4 w-1/2" />
                                        </div>
                                    </div>

                                    {/* Document Stats / Meta Footer */}
                                    <div className="space-y-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-4 rounded-full" />
                                            <Skeleton className="h-3 w-20" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-4 rounded-full" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>

                                        {/* Shared With Avatars Simulation */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                            <Skeleton className="h-3 w-20" />
                                            <div className="flex -space-x-2">
                                                <Skeleton className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-950" />
                                                <Skeleton className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-950" />
                                                <Skeleton className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-950" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DocumentsPageSkeleton;
