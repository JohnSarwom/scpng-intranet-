import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const KRADataGridSkeleton = () => {
    return (
        <div className="overflow-hidden border rounded-md">
            <Table className="min-w-full table-fixed md:table-auto">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px] min-w-[150px]">Objective</TableHead>
                        <TableHead className="w-[200px] min-w-[200px]">KRA</TableHead>
                        <TableHead className="w-[20%] min-w-[200px]">KPI</TableHead>
                        <TableHead className="min-w-[100px]">Start Date</TableHead>
                        <TableHead className="min-w-[100px]">Target Date</TableHead>
                        <TableHead className="min-w-[80px]">Quarter</TableHead>
                        <TableHead className="min-w-[80px]">Target</TableHead>
                        <TableHead className="min-w-[80px]">Actual</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Cost</TableHead>
                        <TableHead className="min-w-[120px]">Assignees</TableHead>
                        <TableHead className="min-w-[150px]">Comments</TableHead>
                        <TableHead>Linked Tasks</TableHead>
                        <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[180px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-[70px]" /></TableCell>
                            <TableCell>
                                <div className="flex -space-x-2">
                                    <Skeleton className="h-6 w-6 rounded-full" />
                                    <Skeleton className="h-6 w-6 rounded-full" />
                                </div>
                            </TableCell>
                            <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-[30px]" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-[20px] ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
