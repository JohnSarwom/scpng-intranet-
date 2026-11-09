import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  INQUIRY_CATEGORIES,
  INQUIRY_STATUSES,
  PRIORITIES,
  type InquiryCategory,
  type InquiryStatus,
  type Priority,
} from '@/services/frontDesk/frontDeskConfig';
import { validateInquiryInput, type FrontDeskInquiry, type InquiryErrors, type InquiryInput } from '@/services/frontDesk/inquiryRules';
import { isoToPngTime, pngDateKey, pngTimeToIso } from '@/services/frontDesk/pngTime';
import type { StaffOption } from './inquiryDisplay';

const UNASSIGNED = '__unassigned';

interface FormState {
  title: string; description: string; category: InquiryCategory; priority: Priority; status: InquiryStatus;
  assigneeEmail: string; reportedBy: string; reportedDate: string; reportedTime: string;
}

function toForm(inquiry: FrontDeskInquiry | null): FormState {
  const reported = inquiry?.reportedAt ?? new Date().toISOString();
  return {
    title: inquiry?.title ?? '',
    description: inquiry?.description ?? '',
    category: inquiry?.category ?? 'General',
    priority: inquiry?.priority ?? 'Medium',
    status: inquiry?.status ?? 'Open',
    assigneeEmail: inquiry?.assigneeEmail || UNASSIGNED,
    reportedBy: inquiry?.reportedBy ?? '',
    reportedDate: pngDateKey(reported),
    reportedTime: isoToPngTime(reported),
  };
}

const at = (date: string, time: string) => { try { return pngTimeToIso(date, time); } catch { return ''; } };

/**
 * Log or edit a general inquiry (plan P1.4, saved by P5.1). The assignee comes from the staff
 * directory; one who has since left it is kept rather than silently unassigned.
 */
const InquiryDialog: React.FC<{
  open: boolean;
  inquiry: FrontDeskInquiry | null;
  staff: StaffOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: InquiryInput) => Promise<boolean>;
}> = ({ open, inquiry, staff, saving, onClose, onSubmit }) => {
  const [form, setForm] = useState<FormState>(() => toForm(inquiry));
  const [errors, setErrors] = useState<InquiryErrors>({});

  useEffect(() => {
    if (open) { setForm(toForm(inquiry)); setErrors({}); }
  }, [open, inquiry]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    const errorKey = key === 'reportedDate' || key === 'reportedTime' ? 'reportedAt' : key;
    setErrors(({ [errorKey as keyof InquiryErrors]: _cleared, ...rest }) => rest);
  };
  const pick = <K extends keyof FormState>(key: K) => (value: string) => setForm(f => ({ ...f, [key]: value as FormState[K] }));

  const keptAssignee = inquiry?.assigneeEmail && !staff.some(s => s.email === inquiry.assigneeEmail)
    ? { email: inquiry.assigneeEmail, name: inquiry.assigneeName || inquiry.assigneeEmail }
    : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const assigneeEmail = form.assigneeEmail === UNASSIGNED ? undefined : form.assigneeEmail;
    const assignee = staff.find(s => s.email === assigneeEmail) ?? (keptAssignee?.email === assigneeEmail ? keptAssignee : undefined);
    const input: InquiryInput = {
      title: form.title, description: form.description, category: form.category, priority: form.priority, status: form.status,
      assigneeEmail: assignee?.email, assigneeName: assignee?.name,
      reportedBy: form.reportedBy, reportedAt: at(form.reportedDate, form.reportedTime),
    };
    const found = validateInquiryInput(input);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (await onSubmit(input)) onClose();
  };

  const error = (key: keyof InquiryErrors) => (errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null);

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{inquiry ? 'Edit inquiry' : 'Log an inquiry'}</DialogTitle>
            <DialogDescription>{inquiry ? 'Change the inquiry’s details.' : 'Record a request or problem reported at the front desk.'}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="inquiry-title">Title*</Label>
              <Input id="inquiry-title" value={form.title} onChange={set('title')} placeholder="e.g. Projector in the boardroom not working" className={cn(errors.title && 'border-red-500')} autoFocus />
              {error('title')}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="inquiry-description">Description</Label>
              <Textarea id="inquiry-description" rows={3} value={form.description} onChange={set('description')} placeholder="What was asked or reported?" />
            </div>
            <div className="space-y-1">
              <Label>Category*</Label>
              <Select value={form.category} onValueChange={pick('category')}>
                <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                <SelectContent>{INQUIRY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority*</Label>
              <Select value={form.priority} onValueChange={pick('priority')}>
                <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status*</Label>
              <Select value={form.status} onValueChange={pick('status')}>
                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>{INQUIRY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Assigned to</Label>
              <Select value={form.assigneeEmail} onValueChange={pick('assigneeEmail')}>
                <SelectTrigger aria-label="Assigned to"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {keptAssignee && <SelectItem value={keptAssignee.email}>{keptAssignee.name}</SelectItem>}
                  {staff.map(s => <SelectItem key={s.email} value={s.email}>{s.name}{s.unit ? ` — ${s.unit}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inquiry-reported-by">Reported by</Label>
              <Input id="inquiry-reported-by" value={form.reportedBy} onChange={set('reportedBy')} placeholder="Name of the person or team" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="inquiry-reported-date">Reported*</Label>
                <Input id="inquiry-reported-date" type="date" value={form.reportedDate} onChange={set('reportedDate')} className={cn(errors.reportedAt && 'border-red-500')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="inquiry-reported-time">at</Label>
                <Input id="inquiry-reported-time" type="time" value={form.reportedTime} onChange={set('reportedTime')} className={cn(errors.reportedAt && 'border-red-500')} />
              </div>
              <div className="col-span-2">{error('reportedAt')}</div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{inquiry ? 'Save changes' : 'Log inquiry'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InquiryDialog;
