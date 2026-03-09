import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { RegulatoryCase } from '../types';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import {
    Shield, CheckCircle2, AlertTriangle, XCircle,
    Calendar, User, FileText, Lock, Building, Paperclip
} from 'lucide-react';

interface CaseDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    caseData: RegulatoryCase | null;
}

const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({ open, onOpenChange, caseData }) => {
    if (!caseData) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RECEIVED': return 'bg-blue-100 text-blue-800';
            case 'UNDER_REVIEW': return 'bg-purple-100 text-purple-800';
            case 'INVESTIGATING': return 'bg-indigo-100 text-indigo-800';
            case 'ESCALATED': return 'bg-red-100 text-red-800';
            case 'RESOLVED': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
            case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Badge variant="outline">{caseData.caseId}</Badge>
                        <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {format(new Date(caseData.createdAt), 'MMM dd, yyyy')}
                        </span>
                    </div>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        {caseData.type === 'scam' && <Shield className="h-6 w-6 text-blue-600" />}
                        {caseData.type === 'whistleblower' && <Lock className="h-6 w-6 text-purple-600" />}
                        {caseData.category}
                    </DialogTitle>
                    <DialogDescription>
                        assigned to {caseData.assignedUnit} unit
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Status & Risk Section */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Status</label>
                            <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getStatusColor(caseData.status)}`}>
                                {caseData.status.replace('_', ' ')}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk Level</label>
                            <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border ${getRiskColor(caseData.risk)}`}>
                                {caseData.risk}
                            </div>
                        </div>
                    </div>

                    {/* Case Description */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <FileText className="h-5 w-5 mr-2 text-gray-500" />
                            Case Description
                        </h3>
                        <div className="prose prose-sm text-gray-600 bg-white p-4 border rounded-md">
                            <p>{caseData.description || "No description provided."}</p>
                        </div>
                    </div>

                    {/* Reporter Details */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <User className="h-5 w-5 mr-2 text-gray-500" />
                            Reporter Information
                        </h3>
                        <div className="bg-white p-4 border rounded-md grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-gray-500 block uppercase tracking-wider">Reporter Name</span>
                                <span className="font-medium text-gray-900">
                                    {caseData.anonymous ? "Anonymous Report" : (caseData.reporterName || "N/A")}
                                </span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block uppercase tracking-wider">Contact Details</span>
                                <span className="font-medium text-gray-900">
                                    {caseData.anonymous ? "Hidden" : (caseData.reporterContact || "N/A")}
                                </span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-xs text-gray-500 block uppercase tracking-wider">Date Reported</span>
                                <span className="font-medium text-gray-900">
                                    {format(new Date(caseData.createdAt), 'MMMM dd, yyyy - h:mm a')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Officer & Unit Info */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                            <Building className="h-5 w-5 mr-2 text-gray-500" />
                            Assignment Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-3 border rounded-md">
                                <span className="text-xs text-gray-500 block">Assigned Unit</span>
                                <span className="font-medium text-gray-900">{caseData.assignedUnit}</span>
                            </div>
                            <div className="bg-white p-3 border rounded-md">
                                <span className="text-xs text-gray-500 block">Investigating Officer</span>
                                <span className="font-medium text-gray-900 flex items-center gap-2">
                                    <User className="h-4 w-4 text-gray-400" />
                                    {caseData.assignedOfficer || "Unassigned"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Attachments Section */}
                    {caseData.attachments && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                                <Paperclip className="h-5 w-5 mr-2 text-gray-500" />
                                Attachments
                            </h3>
                            <div className="bg-white p-4 border rounded-md">
                                {caseData.attachments.startsWith('http') ? (
                                    <a
                                        href={caseData.attachments}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center text-blue-600 hover:text-blue-800"
                                    >
                                        <Paperclip className="h-4 w-4 mr-2" />
                                        View Attachment
                                    </a>
                                ) : (
                                    <div className="flex items-center text-gray-700">
                                        <Paperclip className="h-4 w-4 mr-2 text-gray-400" />
                                        <span className="break-all">{caseData.attachments}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Additional Metadata */}
                    {caseData.type === 'whistleblower' && (
                        <div className="p-4 bg-purple-50 border border-purple-100 rounded-md">
                            <h4 className="font-semibold text-purple-900 flex items-center mb-1">
                                <Lock className="h-4 w-4 mr-2" />
                                Secured Report
                            </h4>
                            <p className="text-sm text-purple-700">
                                This report is marked as confidential. Access is logged and restricted.
                            </p>
                        </div>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CaseDetailsModal;
