import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormGroup } from '@/services/formsSharePointService';
import { defaultFormTemplates } from '@/config/formTemplates';
import { Logger } from '@/utils/logger';

interface AddFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groups: FormGroup[];
    onAdd: (form: { title: string; description: string; templateId: string; groupId: string; status: 'active' }) => Promise<void>;
}

export const AddFormDialog: React.FC<AddFormDialogProps> = ({ open, onOpenChange, groups, onAdd }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [groupId, setGroupId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!templateId || !groupId) return;

        setIsSubmitting(true);
        try {
            await onAdd({
                title,
                description,
                templateId,
                groupId,
                status: 'active'
            });
            onOpenChange(false);
            setTitle('');
            setDescription('');
            setTemplateId('');
            setGroupId('');
        } catch (error) {
            Logger.error('Failed to register form', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Form</DialogTitle>
                    <DialogDescription>
                        Register a form template into a group.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="group">Select Group</Label>
                        <Select value={groupId} onValueChange={setGroupId} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a group" />
                            </SelectTrigger>
                            <SelectContent>
                                {groups.map(group => (
                                    <SelectItem key={group.id} value={group.id}>
                                        {group.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="template">Select Template</Label>
                        <Select value={templateId} onValueChange={setTemplateId} required>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(defaultFormTemplates).map(([id, template]) => (
                                    <SelectItem key={id} value={id}>
                                        {template.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="form-title">Display Title</Label>
                        <Input
                            id="form-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Extended Leave Application"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="form-description">Display Description</Label>
                        <Textarea
                            id="form-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Help text for the form"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting || !templateId || !groupId}>
                            {isSubmitting ? 'Registering...' : 'Add Form'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
