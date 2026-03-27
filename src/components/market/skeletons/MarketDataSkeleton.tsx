import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";

export const MarketDataSkeleton = () => {
    return (
        <div className="market-data-page">
            <div className="bg-grid"></div>
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-5">
                {/* Top Bar */}
                <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-5 pb-5 border-b border-border gap-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="w-12 h-12 rounded-xl" />
                        <div>
                            <Skeleton className="h-6 w-48 mb-2" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    </div>

                    <Skeleton className="h-10 w-40 rounded-lg" />

                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-10 w-32 rounded-lg" />
                        <Skeleton className="h-10 w-24 rounded-lg" />
                        <Skeleton className="h-10 w-32 rounded-lg" />
                        <Skeleton className="h-10 w-28 rounded-lg" />
                    </div>
                </header>

                {/* KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-card dark:bg-gray-800 border border-border dark:border-white/10 rounded-xl p-4">
                            <Skeleton className="h-4 w-24 mb-3" />
                            <Skeleton className="h-8 w-32 mb-2" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                    ))}
                </div>

                {/* Ticker Strip */}
                <div className="flex gap-2 mb-4 overflow-hidden">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <Skeleton key={i} className="h-10 w-32 rounded-lg flex-shrink-0" />
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                        {/* Main Chart Card */}
                        <div className="bg-card dark:bg-gray-800 border border-border dark:border-white/10 rounded-xl p-5">
                            <div className="flex items-center gap-4 mb-6">
                                <Skeleton className="w-12 h-12 rounded-xl" />
                                <div className="flex-1">
                                    <Skeleton className="h-6 w-40 mb-2" />
                                    <Skeleton className="h-4 w-24 mb-4" />
                                    <div className="flex gap-5">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div key={i}>
                                                <Skeleton className="h-3 w-16 mb-2" />
                                                <Skeleton className="h-5 w-20" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <Skeleton className="w-full h-[300px] rounded-lg" />
                        </div>

                        {/* Market Table */}
                        <div className="bg-card dark:bg-gray-800 border border-border dark:border-white/10 rounded-xl p-5">
                            <div className="flex justify-between items-center pb-4 border-b border-border dark:border-white/10 mb-4">
                                <div>
                                    <Skeleton className="h-5 w-32 mb-1" />
                                    <Skeleton className="h-3 w-48" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <Skeleton key={i} className="h-4 w-20" />
                                    ))}
                                </div>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex justify-between items-center py-2">
                                        <div className="flex items-center gap-3 w-1/6">
                                            <Skeleton className="w-8 h-8 rounded-lg" />
                                            <div>
                                                <Skeleton className="h-4 w-12 mb-1" />
                                                <Skeleton className="h-3 w-20" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-4 w-12" />
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-6 w-20" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Sidebar) */}
                    <div className="flex flex-col gap-4">
                        {/* Live Price */}
                        <div className="bg-card dark:bg-gray-800 border border-border dark:border-white/10 rounded-xl p-5">
                            <div className="pb-4 border-b border-border dark:border-white/10 mb-4">
                                <Skeleton className="h-5 w-24 mb-1" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                            <Skeleton className="h-16 w-full rounded-lg" />
                        </div>

                        {/* Heatmap */}
                        <div className="bg-card dark:bg-gray-800 border border-border dark:border-white/10 rounded-xl p-5">
                            <div className="pb-4 border-b border-border dark:border-white/10 mb-4">
                                <Skeleton className="h-5 w-32 mb-1" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                                    <Skeleton key={i} className="aspect-square rounded-lg" />
                                ))}
                            </div>
                        </div>

                        {/* News Feed */}
                        <div className="bg-card dark:bg-gray-800 border border-border dark:border-white/10 rounded-xl p-5">
                            <div className="flex justify-between items-center pb-4 border-b border-border dark:border-white/10 mb-4">
                                <div>
                                    <Skeleton className="h-5 w-24 mb-1" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                                <Skeleton className="w-8 h-8 rounded-lg" />
                            </div>
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="pb-3 border-b border-border dark:border-white/10 last:border-0 last:pb-0">
                                        <div className="flex justify-between gap-2 mb-2">
                                            <Skeleton className="h-4 w-16 rounded-full" />
                                            <Skeleton className="h-3 w-12" />
                                        </div>
                                        <Skeleton className="h-4 w-full mb-1" />
                                        <Skeleton className="h-4 w-3/4" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Comparison Chart */}
                <div className="bg-card dark:bg-gray-800 border border-border dark:border-white/10 rounded-xl p-5 mt-4">
                    <div className="pb-4 border-b border-border dark:border-white/10 mb-4">
                        <Skeleton className="h-5 w-48 mb-1" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-[250px] w-full rounded-lg" />
                </div>
            </div>
        </div>
    );
};

export default MarketDataSkeleton;
