import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Logger } from '@/utils/logger';

interface AddGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (group: { title: string; description: string; iconName: string; color: string }) => Promise<void>;
}

export const AddGroupDialog: React.FC<AddGroupDialogProps> = ({ open, onOpenChange, onAdd }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [iconName, setIconName] = useState('FileText');
    const [color, setColor] = useState('#3B82F6');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onAdd({ title, description, iconName, color });
            onOpenChange(false);
            setTitle('');
            setDescription('');
            setIconName('FileText');
            setColor('#3B82F6');
        } catch (error) {
            Logger.error('Failed to add group', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Group</DialogTitle>
                    <DialogDescription>
                        Create a new category to organize your forms.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Group Name</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Human Resources"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Briefly describe what this group is for"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="icon">Icon Name (Lucide)</Label>
                            <Input
                                id="icon"
                                value={iconName}
                                onChange={(e) => setIconName(e.target.value)}
                                placeholder="Users, FileText, etc."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="color">Theme Color</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="color"
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="w-12 p-1"
                                />
                                <Input
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Adding...' : 'Add Group'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
