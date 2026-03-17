import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RegulatoryCase, CaseRisk, CaseStatus } from '../types';
import { Loader2 } from 'lucide-react';

interface CaseEditModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    caseData: RegulatoryCase | null;
    onSave: (caseId: string, updates: Partial<RegulatoryCase>) => Promise<any>;
    isSaving?: boolean;
}

const RISK_OPTIONS: CaseRisk[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_OPTIONS: CaseStatus[] = ['RECEIVED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED', 'RESOLVED', 'CLOSED'];
const UNIT_OPTIONS = [
    'Unassigned',
    'Legal & Investigations',
    'Licensing & Supervision',
    'Corporate Services',
    'Research & Publication',
    'Executive Division',
    'Secretariat Unit',
];

const CaseEditModal: React.FC<CaseEditModalProps> = ({ open, onOpenChange, caseData, onSave, isSaving }) => {
    const [form, setForm] = useState({
        category: '',
        risk: '' as CaseRisk,
        status: '' as CaseStatus,
        assignedUnit: '',
        assignedOfficer: '',
        description: '',
        summary: '',
        reporterName: '',
        reporterContact: '',
        source: '',
    });

    useEffect(() => {
        if (caseData) {
            setForm({
                category: caseData.category || '',
                risk: caseData.risk,
                status: caseData.status,
                assignedUnit: caseData.assignedUnit || '',
                assignedOfficer: caseData.assignedOfficer || '',
                description: caseData.description || '',
                summary: caseData.summary || '',
                reporterName: caseData.reporterName || '',
                reporterContact: caseData.reporterContact || '',
                source: caseData.source || '',
            });
        }
    }, [caseData]);

    if (!caseData) return null;

    const handleSave = async () => {
        await onSave(caseData.caseId, {
            category: form.category,
            risk: form.risk,
            status: form.status,
            assignedUnit: form.assignedUnit,
            assignedOfficer: form.assignedOfficer,
            description: form.description,
            summary: form.summary,
            reporterName: form.reporterName,
            reporterContact: form.reporterContact,
            source: form.source,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Edit Case</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {caseData.caseId} &middot; {caseData.type}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Category */}
                    <div className="space-y-1.5">
                        <Label htmlFor="category">Category</Label>
                        <Input
                            id="category"
                            value={form.category}
                            onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                        />
                    </div>

                    {/* Risk & Status row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Risk Level</Label>
                            <Select value={form.risk} onValueChange={(v) => setForm(prev => ({ ...prev, risk: v as CaseRisk }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select risk" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RISK_OPTIONS.map(r => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm(prev => ({ ...prev, status: v as CaseStatus }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(s => (
                                        <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Assigned Unit & Officer row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Assigned Unit</Label>
                            <Select value={form.assignedUnit} onValueChange={(v) => setForm(prev => ({ ...prev, assignedUnit: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                                <SelectContent>
                                    {UNIT_OPTIONS.map(u => (
                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="officer">Assigned Officer</Label>
                            <Input
                                id="officer"
                                value={form.assignedOfficer}
                                onChange={(e) => setForm(prev => ({ ...prev, assignedOfficer: e.target.value }))}
                                placeholder="Officer name"
                            />
                        </div>
                    </div>

                    {/* Source */}
                    <div className="space-y-1.5">
                        <Label htmlFor="source">Source</Label>
                        <Input
                            id="source"
                            value={form.source}
                            onChange={(e) => setForm(prev => ({ ...prev, source: e.target.value }))}
                            placeholder="e.g. Email, Phone, Walk-in"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={form.description}
                            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                        />
                    </div>

                    {/* Summary */}
                    <div className="space-y-1.5">
                        <Label htmlFor="summary">Summary</Label>
                        <Textarea
                            id="summary"
                            value={form.summary}
                            onChange={(e) => setForm(prev => ({ ...prev, summary: e.target.value }))}
                            rows={2}
                        />
                    </div>

                    {/* Reporter Info (hidden for anonymous whistleblower) */}
                    {!(caseData.type === 'whistleblower' && caseData.anonymous) && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="reporterName">Reporter Name</Label>
                                <Input
                                    id="reporterName"
                                    value={form.reporterName}
                                    onChange={(e) => setForm(prev => ({ ...prev, reporterName: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="reporterContact">Reporter Contact</Label>
                                <Input
                                    id="reporterContact"
                                    value={form.reporterContact}
                                    onChange={(e) => setForm(prev => ({ ...prev, reporterContact: e.target.value }))}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CaseEditModal;
