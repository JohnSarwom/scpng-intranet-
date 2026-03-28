/**
 * EditStrategicObjectiveModal Component
 * Modal for editing Strategic Goals in the Strategy Hub
 */

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Pencil, Loader2, Plus, X, Target, Award, Zap, TrendingUp, Users, Heart, Shield, Lightbulb, ShieldCheck, Building2, GraduationCap, Globe, Rocket, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StrategicItem } from '@/mockData/strategyData';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';

interface EditStrategicObjectiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    objective: StrategicItem | null;
}

const ICON_OPTIONS = [
    { value: 'TrendingUp', label: 'Trending Up', icon: TrendingUp },
    { value: 'ShieldCheck', label: 'Shield Check', icon: ShieldCheck },
    { value: 'Building2', label: 'Building', icon: Building2 },
    { value: 'GraduationCap', label: 'Education', icon: GraduationCap },
    { value: 'Globe', label: 'Globe', icon: Globe },
    { value: 'Target', label: 'Target', icon: Target },
    { value: 'Award', label: 'Award', icon: Award },
    { value: 'Zap', label: 'Zap', icon: Zap },
    { value: 'Users', label: 'Users', icon: Users },
    { value: 'Heart', label: 'Heart', icon: Heart },
    { value: 'Shield', label: 'Shield', icon: Shield },
    { value: 'Lightbulb', label: 'Lightbulb', icon: Lightbulb },
    { value: 'Rocket', label: 'Rocket', icon: Rocket },
    { value: 'Layers', label: 'Layers', icon: Layers },
];

export const EditStrategicObjectiveModal: React.FC<EditStrategicObjectiveModalProps> = ({ isOpen, onClose, onSuccess, objective }) => {
    const { toast } = useToast();
    const { updateObjective } = useStrategySharePoint();

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('on-track');
    const [icon, setIcon] = useState('Target');
    const [kras, setKras] = useState<string[]>([]);
    const [newKra, setNewKra] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit mode state
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState('');

    // Populate form when objective changes
    useEffect(() => {
        if (objective && isOpen) {
            setTitle(objective.title);
            setDescription(objective.description || '');
            setProgress(objective.progress || 0);
            setStatus(objective.status || 'on-track');

            // Handle icon mapping if it comes as a Component or string
            let iconVal = 'Target';
            if (typeof objective.icon === 'string') {
                iconVal = objective.icon;
            } else if ((objective as any).IconName) {
                iconVal = (objective as any).IconName;
            }
            setIcon(iconVal);

            // Handle KRAs
            setKras((objective as any).kras || []);
            setEditingIndex(null); // Reset editing state
        }
    }, [objective, isOpen]);

    const handleAddKra = () => {
        if (newKra.trim()) {
            setKras([...kras, newKra.trim()]);
            setNewKra('');
        }
    };

    const handleRemoveKra = (index: number) => {
        const newKras = [...kras];
        newKras.splice(index, 1);
        setKras(newKras);
        if (editingIndex === index) {
            setEditingIndex(null);
        } else if (editingIndex !== null && editingIndex > index) {
            setEditingIndex(editingIndex - 1);
        }
    };

    const handleStartEdit = (index: number) => {
        setEditingIndex(index);
        setEditText(kras[index]);
    };

    const handleSaveEdit = () => {
        if (editingIndex !== null && editText.trim()) {
            const newKras = [...kras];
            newKras[editingIndex] = editText.trim();
            setKras(newKras);
            setEditingIndex(null);
            setEditText('');
        }
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditText('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!objective || !objective.id) return;
        if (!title.trim()) {
            toast({ title: 'Title is required', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);

        try {
            await updateObjective(objective.id, {
                title,
                description,
                // Progress is now auto-calculated from KRAs/KPIs, don't save manual value
                // progress,
                status: status as any,
                icon,
                // Pass kras as is, service will join them
                kras: kras
            } as any);

            toast({
                title: 'Success',
                description: 'Strategic Objective updated successfully.',
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to update objective:', error);
            // Toast is handled by hook/service usually, but safety net here
            toast({
                title: 'Error',
                description: 'Failed to update objective.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!objective) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && !isSubmitting) onClose();
        }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900 dark:border-white/10">

                <DialogHeader>
                    <DialogTitle className="dark:text-gray-100">Edit Strategic Objective</DialogTitle>
                    <DialogDescription className="dark:text-gray-400">
                        Update the milestones and progress for this strategic initiative.
                    </DialogDescription>
                </DialogHeader>


                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Title */}
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="title">Objective Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isSubmitting}
                                required
                                className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-100"
                            />

                        </div>

                        {/* Icon Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="icon" className="dark:text-gray-300">Icon</Label>
                            <Select value={icon} onValueChange={setIcon} disabled={isSubmitting}>
                                <SelectTrigger className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-100">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px] dark:bg-gray-800 dark:border-white/10">
                                    {ICON_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex items-center gap-2">
                                                <opt.icon className="w-4 h-4" />
                                                <span>{opt.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>


                        {/* Status */}
                        <div className="space-y-2">
                            <Label htmlFor="status" className="dark:text-gray-300">Status</Label>
                            <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
                                <SelectTrigger className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-100">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-gray-800 dark:border-white/10">
                                    <SelectItem value="on-track">On Track</SelectItem>
                                    <SelectItem value="at-risk">At Risk</SelectItem>
                                    <SelectItem value="behind">Behind</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>


                        {/* Description */}
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="description" className="dark:text-gray-300">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                disabled={isSubmitting}
                                className="dark:bg-gray-800 dark:border-white/10 dark:text-gray-100 placeholder:dark:text-gray-500"
                            />
                        </div>

                    </div>

                    {/* Key Deliverables / Goals */}
                    <div className="space-y-3 pt-2 border-t dark:border-white/10">
                        <Label className="dark:text-gray-300">Key Result Areas (KRAs) & Milestones</Label>


                        <div className="space-y-2">
                            {kras.map((kra, index) => (
                                <div key={index} className="flex items-start gap-2 group">
                                    {editingIndex === index ? (
                                        <div className="flex-1 flex gap-2">
                                            <Input
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                className="h-9"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSaveEdit();
                                                    } else if (e.key === 'Escape') {
                                                        handleCancelEdit();
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                onClick={handleSaveEdit}
                                            >
                                                <ShieldCheck className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                                onClick={handleCancelEdit}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 p-2 rounded-md bg-muted/50 dark:bg-gray-800/50 text-sm dark:text-gray-300 border dark:border-white/5">
                                                {kra}
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleStartEdit(index)}
                                                disabled={isSubmitting}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity dark:hover:bg-red-950/30"
                                                onClick={() => handleRemoveKra(index)}
                                                disabled={isSubmitting}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>

                                        </>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-2">
                            <Input
                                value={newKra}
                                onChange={(e) => setNewKra(e.target.value)}
                                placeholder="Add a new KRA..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddKra();
                                    }
                                }}
                                disabled={isSubmitting}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleAddKra}
                                disabled={isSubmitting || !newKra.trim()}
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 dark:border-t dark:border-white/10 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="dark:border-white/10 dark:hover:bg-gray-800 dark:text-gray-300"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-[#800020] hover:bg-[#600018] text-white">
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </DialogFooter>

                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EditStrategicObjectiveModal;
