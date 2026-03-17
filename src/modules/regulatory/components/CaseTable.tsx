import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Lock, ShieldAlert, Edit2, Trash2, Paperclip } from 'lucide-react';
import { RegulatoryCase, CaseRisk, CaseStatus, CaseType } from '../types';
import { format } from 'date-fns';
import CaseDetailsModal from './CaseDetailsModal';
import CaseEditModal from './CaseEditModal';
import { toast } from '@/components/ui/use-toast';

interface CaseTableProps {
    data: RegulatoryCase[];
    onUpdateCase?: (caseId: string, updates: Partial<RegulatoryCase>) => Promise<any>;
    isUpdating?: boolean;
}

const getRiskBadgeVariant = (risk: CaseRisk) => {
    switch (risk) {
        case 'CRITICAL': return 'destructive'; // Red
        case 'HIGH': return 'destructive'; // Red/Orange usually, but destructive works for high
        case 'MEDIUM': return 'secondary'; // Yellow-ish or grey
        case 'LOW': return 'outline'; // Green or outline
        default: return 'outline';
    }
};

const getRiskColor = (risk: CaseRisk) => {
    switch (risk) {
        case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
        case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const getStatusColor = (status: CaseStatus) => {
    switch (status) {
        case 'RECEIVED': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'UNDER_REVIEW': return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'INVESTIGATING': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'ESCALATED': return 'bg-red-50 text-red-700 border-red-200';
        case 'RESOLVED': return 'bg-green-50 text-green-700 border-green-200';
        case 'CLOSED': return 'bg-gray-50 text-gray-700 border-gray-200';
        default: return 'bg-gray-50 text-gray-700';
    }
};

const getTypeIcon = (type: CaseType) => {
    switch (type) {
        case 'whistleblower': return <Lock className="h-3 w-3 mr-1" />;
        case 'scam': return <ShieldAlert className="h-3 w-3 mr-1" />;
        default: return null;
    }
}

const CaseTable: React.FC<CaseTableProps> = ({ data, onUpdateCase, isUpdating }) => {
    const [selectedCase, setSelectedCase] = useState<RegulatoryCase | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editCase, setEditCase] = useState<RegulatoryCase | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const handleViewCase = (caseItem: RegulatoryCase) => {
        setSelectedCase(caseItem);
        setIsModalOpen(true);
    };

    const handleEditCase = (caseItem: RegulatoryCase) => {
        setEditCase(caseItem);
        setIsEditOpen(true);
    };

    const handleSaveCase = async (caseId: string, updates: Partial<RegulatoryCase>) => {
        if (!onUpdateCase) return;
        try {
            await onUpdateCase(caseId, updates);
            toast({ title: "Case Updated", description: `Case ${caseId} has been updated successfully.` });
        } catch (err: any) {
            toast({ title: "Update Failed", description: err.message || "Failed to update case.", variant: "destructive" });
            throw err;
        }
    };

    return (
        <>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50">
                        <TableRow>
                            <TableHead className="w-[150px]">Case ID</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Risk</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assigned Unit</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Attachments</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((item) => (
                            <TableRow
                                key={item.caseId}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleViewCase(item)}
                            >
                                <TableCell className="font-medium text-gray-900">
                                    {item.caseId}
                                    {item.type === 'whistleblower' && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                            <Lock className="h-3 w-3 mr-1" /> Secure
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="capitalize flex items-center">
                                    {getTypeIcon(item.type)} {item.type}
                                </TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell>
                                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskColor(item.risk)}`}>
                                        {item.risk}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                                        {item.status.replace('_', ' ')}
                                    </div>
                                </TableCell>
                                <TableCell>{item.assignedUnit}</TableCell>
                                <TableCell className="text-gray-500 text-sm">
                                    {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>
                                    {item.attachments ? (
                                        item.attachments.startsWith('http') ? (
                                            <a
                                                href={item.attachments}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                                                onClick={(e) => { e.stopPropagation(); }}
                                            >
                                                <Paperclip className="h-4 w-4 mr-1" /> View
                                            </a>
                                        ) : (
                                            <span className="text-sm text-gray-600 truncate max-w-[150px] inline-block" title={item.attachments}>
                                                <Paperclip className="h-4 w-4 mr-1 inline" />
                                                {item.attachments}
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-gray-400 text-sm">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4 text-gray-500" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewCase(item); }}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditCase(item); }}>
                                                    <Edit2 className="mr-2 h-4 w-4" />
                                                    Edit Case
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toast({ title: "Delete", description: "Delete functionality coming soon." });
                                                    }}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Case
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <CaseDetailsModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                caseData={selectedCase}
            />

            <CaseEditModal
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                caseData={editCase}
                onSave={handleSaveCase}
                isSaving={isUpdating}
            />
        </>
    );
};

export default CaseTable;
