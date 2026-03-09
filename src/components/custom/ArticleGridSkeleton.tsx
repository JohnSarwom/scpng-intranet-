import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const ArticleGridSkeleton = ({ count = 6 }: { count?: number }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} className="overflow-hidden flex flex-col justify-between">
                    <Skeleton className="w-full h-48 rounded-none" />
                    <div>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start mb-1">
                                <Skeleton className="h-5 w-20" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <Skeleton className="h-6 w-full mt-2" />
                            <Skeleton className="h-6 w-3/4 mt-1" />
                            <Skeleton className="h-3 w-32 mt-2" />
                        </CardHeader>
                        <CardContent className="pt-0 pb-3 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-11/12" />
                            <Skeleton className="h-4 w-4/5" />
                        </CardContent>
                    </div>
                    <div className="px-6 pb-4 pt-2">
                        <Skeleton className="h-4 w-24" />
                    </div>
                </Card>
            ))}
        </div>
    );
};
