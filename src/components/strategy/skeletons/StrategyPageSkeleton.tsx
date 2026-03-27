import React from 'react';
import PageLayout from '@/components/layout/PageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Target } from 'lucide-react';

export const StrategyPageSkeleton = () => {
    return (
        <PageLayout>
            <div className="space-y-8 pb-10">
                {/* Hero Section Skeleton */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#400010] to-[#800020] p-8 md:p-12 mb-8 shadow-xl">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-4 w-full md:w-2/3">
                            <Skeleton className="h-6 w-48 bg-white/20 rounded-md" />
                            <Skeleton className="h-12 md:h-16 w-3/4 bg-white/20 rounded-xl" />
                            <Skeleton className="h-6 w-full max-w-2xl bg-white/20 rounded-md" />
                            <Skeleton className="h-6 w-5/6 max-w-xl bg-white/20 rounded-md" />
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="hidden md:block p-4 bg-white/10 rounded-2xl border border-white/20">
                                <Target className="w-12 h-12 text-white/50" />
                            </div>
                            <Skeleton className="h-14 w-40 bg-white/20 rounded-2xl" />
                        </div>
                    </div>
                </div>

                {/* Tabs Area Skeleton */}
                <div className="w-full space-y-6">
                    {/* Tabs List */}
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-10 w-32 rounded-md" />
                        ))}
                    </div>

                    {/* Content Section (Strategy Tab) */}
                    <div className="space-y-10 mt-6">
                        {/* Mission & Vision Cards Skeleton */}
                        <div className="grid grid-cols-1 gap-6">
                            {[1, 2].map((i) => (
                                <Card key={i} className="relative overflow-hidden shadow-sm dark:bg-gray-800 dark:border-white/10">

                                    <CardHeader className="relative z-10 pb-2">
                                        <Skeleton className="h-6 w-32" />
                                    </CardHeader>
                                    <CardContent className="relative z-10 space-y-4">
                                        <Skeleton className="h-5 w-full max-w-2xl" />
                                        <Skeleton className="h-5 w-5/6 max-w-xl" />
                                        <div className="mt-4 border-t pt-4">
                                            <Skeleton className="h-4 w-24 mb-3" />
                                            <Skeleton className="h-4 w-full max-w-lg mb-2" />
                                            <Skeleton className="h-4 w-full max-w-md" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* 4 Pillars Skeleton */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <Card key={i} className="h-full bg-card/80 dark:bg-gray-800/50 dark:border-white/10">

                                        <CardContent className="pt-6 pb-4 flex flex-col items-center gap-3 text-center">
                                            <Skeleton className="w-12 h-12 rounded-full" />
                                            <div className="w-full flex flex-col items-center space-y-2 mt-2">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-3 w-full" />
                                                <Skeleton className="h-3 w-5/6" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>

                        {/* Objectives Skeleton */}
                        <div className="space-y-6">
                            <Skeleton className="h-6 w-64" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Card key={i} className="overflow-hidden dark:bg-gray-800 dark:border-white/10">

                                        <CardContent className="p-5">
                                            <div className="flex justify-between items-start mb-4">
                                                <Skeleton className="w-10 h-10 rounded-xl" />
                                                <Skeleton className="h-5 w-12 rounded-full" />
                                            </div>
                                            <Skeleton className="h-5 w-3/4 mb-3" />
                                            <Skeleton className="h-3 w-full mb-2" />
                                            <Skeleton className="h-3 w-5/6 mb-4" />
                                            <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <Skeleton className="h-3 w-16" />
                                                    <Skeleton className="h-1.5 w-full rounded-full" />
                                                </div>
                                                <div className="pt-3 border-t space-y-3">
                                                    <Skeleton className="h-3 w-32" />
                                                    {[1, 2, 3].map((j) => (
                                                        <Skeleton key={j} className="h-3 w-full" />
                                                    ))}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {/* Featured Project Skeleton */}
                                <Card className="overflow-hidden border-2 border-dashed bg-muted/20 dark:bg-muted/5 dark:border-white/10">

                                    <CardContent className="p-5 h-full flex flex-col">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Skeleton className="w-10 h-10 rounded-xl" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="p-3 rounded-lg border bg-white/50 space-y-2">
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-3 w-5/6" />
                                            </div>
                                            <div className="space-y-3">
                                                <Skeleton className="h-3 w-40" />
                                                {[1, 2].map((j) => (
                                                    <Skeleton key={j} className="h-3 w-full" />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t flex justify-between items-center">
                                            <Skeleton className="h-5 w-24 rounded-full" />
                                            <div className="flex -space-x-2">
                                                {[1, 2, 3].map((j) => (
                                                    <Skeleton key={j} className="w-5 h-5 rounded-full border-2 border-white" />
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Cascading Strategic Goals Header Skeleton */}
                        <div className="space-y-8 pt-4">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-48 mb-2" />
                                    <Skeleton className="h-8 w-72" />
                                    <Skeleton className="h-5 w-96" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-28 rounded-md" />
                                </div>
                            </div>

                            <div className="w-full space-y-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="border rounded-2xl bg-white dark:bg-gray-800 dark:border-white/10 shadow-sm px-6 py-5 flex items-center gap-4">

                                        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-5 w-48" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                        <Skeleton className="h-5 w-24 rounded-full hidden sm:block" />
                                        <Skeleton className="h-4 w-40 hidden md:block" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
};
