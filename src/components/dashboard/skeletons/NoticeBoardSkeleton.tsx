import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const NoticeBoardSkeleton = () => {
    return (
        <Card className="bg-white rounded-xl shadow-sm">
            <CardHeader className="pb-2 space-y-0">
                <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="h-[580px] flex flex-col pt-4">
                {/* Carousel Placeholder */}
                <div className="w-full mb-4">
                    <Skeleton className="h-48 w-full rounded-md" />
                    <div className="flex justify-center mt-2 gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                </div>

                {/* List Placeholder */}
                <div className="space-y-3 flex-1 overflow-hidden pr-2 mt-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-2.5 rounded-lg border border-gray-100 flex items-start gap-3">
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-12 rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-5/6" />
                                <Skeleton className="h-3 w-20 mt-2" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
