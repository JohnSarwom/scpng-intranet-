import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Kra } from '@/types';
import { StaffMember } from '@/types/staff';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface KraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (kraData: Partial<Kra>) => void;
  initialData?: Partial<Kra> | null;
  staffMembers: StaffMember[];
}

const KraDialog: React.FC<KraDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  staffMembers,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setOwnerId(initialData.ownerId?.toString());
    } else {
      setTitle('');
      setDescription('');
      setOwnerId(undefined);
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kraData: Partial<Kra> = {
      id: initialData?.id,
      title,
      description,
      ownerId: ownerId ? parseInt(ownerId, 10) : undefined,
    };
    onSubmit(kraData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden dark:bg-gray-900 dark:border-white/10 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-md">
          <DialogTitle className="text-xl font-bold dark:text-gray-100">{initialData ? 'Edit KRA' : 'Create New KRA'}</DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            {initialData ? 'Update the details of the KRA below.' : 'Fill in the details for the new KRA.'}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-6 overflow-y-auto">
          <form onSubmit={handleSubmit} id="kra-dialog-form" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-semibold dark:text-gray-300">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter KRA title..."
              className="dark:bg-gray-800 dark:border-white/10 focus:ring-blue-500/20"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold dark:text-gray-300">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details or context for this KRA..."
              className="dark:bg-gray-800 dark:border-white/10 focus:ring-blue-500/20"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner" className="text-sm font-semibold dark:text-gray-300">Owner</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="dark:bg-gray-800 dark:border-white/10">
                <SelectValue placeholder="Select an owner" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-900 dark:border-white/10">
                {staffMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id.toString()}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </form>
        </div>
        <DialogFooter className="bg-gray-50/50 dark:bg-gray-800/80 p-6 mt-0 border-t dark:border-white/10 backdrop-blur-md">
          <Button type="button" variant="outline" onClick={onClose} className="dark:border-white/10 dark:hover:bg-gray-700">
            Cancel
          </Button>
          <Button type="submit" form="kra-dialog-form" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">
            {initialData ? 'Save Changes' : 'Create KRA'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KraDialog;
