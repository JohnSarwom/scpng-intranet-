import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStaffMembers } from '@/hooks/useStaffMembers';
import type { InquiryData } from './GeneralInquiries';
import {
  inquiryCategories,
  inquiryPriorities,
  inquiryStatuses,
  toAssignee,
  type InquiryPriority,
  type InquiryStatus,
} from './inquiryOptions';

const UNASSIGNED = '__unassigned__';
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : format(date, "yyyy-MM-dd'T'HH:mm");
};

interface InquiryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (inquiry: InquiryData) => void;
  initialData?: InquiryData | null;
}

const InquiryDialog: React.FC<InquiryDialogProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const { staffMembers } = useStaffMembers();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(inquiryCategories[0]);
  const [priority, setPriority] = useState<InquiryPriority>('Medium');
  const [status, setStatus] = useState<InquiryStatus>('Open');
  const [assigneeEmail, setAssigneeEmail] = useState(UNASSIGNED);
  const [reportedBy, setReportedBy] = useState('');
  const [reportedAt, setReportedAt] = useState('');
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialData?.title || '');
    setDescription(initialData?.description || '');
    setCategory(initialData?.category || inquiryCategories[0]);
    setPriority(initialData?.priority || 'Medium');
    setStatus(initialData?.status || 'Open');
    setAssigneeEmail(initialData?.assignee?.email || UNASSIGNED);
    setReportedBy(initialData?.reportedBy || '');
    setReportedAt(toLocalInput(initialData?.reportedAt || new Date().toISOString()));
    setTitleError('');
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Title is required');
      return;
    }
    const staff = staffMembers.find(member => member.email === assigneeEmail);
    // Keep an assignee who is no longer in the roster rather than silently unassigning them.
    const keptAssignee = initialData?.assignee?.email === assigneeEmail ? initialData.assignee : undefined;
    const parsedReportedAt = reportedAt ? new Date(reportedAt) : new Date();
    onSubmit({
      id: initialData?.id || `INQ-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      status,
      assignee: staff ? toAssignee(staff) : keptAssignee,
      reportedBy: reportedBy.trim(),
      reportedAt: (Number.isNaN(parsedReportedAt.getTime()) ? new Date() : parsedReportedAt).toISOString(),
      completed: status === 'Resolved',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700/50 flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold">{initialData ? 'Edit Inquiry' : 'Log New Inquiry'}</DialogTitle>
          <DialogDescription>
            {initialData ? 'Update the details of this inquiry.' : 'Record an inquiry received at the front desk.'}
          </DialogDescription>
        </DialogHeader>

        <form id="inquiry-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto px-6 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 pb-4">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="inquiry-title">Title*</Label>
              <Input
                id="inquiry-title"
                placeholder="e.g., Projector in Boardroom A not working"
                value={title}
                onChange={e => { setTitle(e.target.value); if (titleError) setTitleError(''); }}
                className={cn('py-3 px-4 rounded-lg', titleError && 'border-red-500')}
              />
              {titleError && <p className="text-red-500 text-xs">{titleError}</p>}
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="inquiry-description">Description</Label>
              <Textarea
                id="inquiry-description"
                rows={3}
                placeholder="What was asked or reported?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="py-3 px-4 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inquiry-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="inquiry-category" className="py-3 px-4 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {inquiryCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inquiry-priority">Priority</Label>
              <Select value={priority} onValueChange={value => setPriority(value as InquiryPriority)}>
                <SelectTrigger id="inquiry-priority" className="py-3 px-4 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {inquiryPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inquiry-status">Status</Label>
              <Select value={status} onValueChange={value => setStatus(value as InquiryStatus)}>
                <SelectTrigger id="inquiry-status" className="py-3 px-4 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {inquiryStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inquiry-assignee">Assigned To</Label>
              <Select value={assigneeEmail} onValueChange={setAssigneeEmail}>
                <SelectTrigger id="inquiry-assignee" className="py-3 px-4 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {initialData?.assignee?.email && !staffMembers.some(s => s.email === initialData.assignee?.email) && (
                    <SelectItem value={initialData.assignee.email}>{initialData.assignee.name}</SelectItem>
                  )}
                  {staffMembers.map(staff => <SelectItem key={staff.email} value={staff.email}>{staff.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inquiry-reported-by">Reported by</Label>
              <Input
                id="inquiry-reported-by"
                placeholder="Name of the person or team"
                value={reportedBy}
                onChange={e => setReportedBy(e.target.value)}
                className="py-3 px-4 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inquiry-reported-at">Reported at</Label>
              <Input
                id="inquiry-reported-at"
                type="datetime-local"
                value={reportedAt}
                onChange={e => setReportedAt(e.target.value)}
                className="py-3 px-4 rounded-lg"
              />
            </div>
          </div>
        </form>

        <DialogFooter className="px-6 py-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose} className="px-6 py-2 rounded-lg">Cancel</Button>
          <Button type="submit" form="inquiry-form" className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg">
            {initialData ? 'Save Changes' : 'Log Inquiry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InquiryDialog;
