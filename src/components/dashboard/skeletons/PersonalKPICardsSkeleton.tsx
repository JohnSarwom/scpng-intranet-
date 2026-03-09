import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const PersonalKPICardsSkeleton = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {[1, 2, 3].map((i) => (
                <Card key={i} className="shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                            <div className="flex items-center gap-1">
                                <Skeleton className="h-3 w-3 rounded-full" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
