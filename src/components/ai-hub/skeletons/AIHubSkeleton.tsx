import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const AIHubSkeleton = () => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* AI Assistant Card Skeleton */}
                    <Card className="flex flex-col h-[600px] lg:h-[700px]">
                        <CardHeader className="py-3 px-4 border-b">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <Skeleton className="h-6 w-32" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-8 rounded" />
                                    <Skeleton className="h-8 w-8 rounded" />
                                    <Skeleton className="h-8 w-40 rounded" />
                                    <Skeleton className="h-8 w-8 rounded" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col p-4 bg-gray-50/50">
                            <div className="flex-1 space-y-4 mb-4">
                                {/* Simulated Chat Messages */}
                                <div className="flex justify-start">
                                    <Skeleton className="h-16 w-3/4 rounded-lg" />
                                </div>
                                <div className="flex justify-end">
                                    <Skeleton className="h-10 w-1/2 rounded-lg" />
                                </div>
                                <div className="flex justify-start">
                                    <Skeleton className="h-24 w-4/5 rounded-lg" />
                                </div>
                            </div>
                            {/* Input Area */}
                            <div className="flex gap-2">
                                <Skeleton className="h-12 flex-1 rounded-md" />
                                <Skeleton className="h-12 w-12 rounded-md" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Featured Legislation Skeleton */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                            <Skeleton className="h-6 w-6 rounded" />
                            <Skeleton className="h-6 w-48" />
                        </div>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center p-3 border rounded-lg bg-card">
                                <Skeleton className="h-10 w-10 rounded-lg mr-3" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                                <Skeleton className="h-4 w-4 ml-2" />
                            </div>
                        ))}
                    </div>

                    {/* Uploaded Documents Skeleton */}
                    <div className="space-y-3 mt-8">
                        <Skeleton className="h-7 w-64 mb-3" />
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center p-3 border rounded-lg bg-card">
                                <Skeleton className="h-10 w-10 rounded-lg mr-3" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-3 w-1/4" />
                                </div>
                                <Skeleton className="h-4 w-4 ml-2" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar Column */}
                <div className="lg:col-span-1 h-[700px] sticky top-6">
                    <div className="h-full border rounded-xl bg-card overflow-hidden shadow-sm flex flex-col">
                        <div className="p-4 border-b space-y-3">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-6 w-6 rounded" />
                                <Skeleton className="h-6 w-40" />
                            </div>
                            <Skeleton className="h-8 w-full rounded-lg" />
                            <Skeleton className="h-9 w-full rounded-md" />
                        </div>
                        <div className="p-4 space-y-4 flex-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="border rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-4" />
                                    </div>
                                    <Skeleton className="h-3 w-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIHubSkeleton;
