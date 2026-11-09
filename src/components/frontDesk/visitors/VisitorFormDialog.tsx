import React, { useEffect, useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  isoToPngTime,
  pngDateKey,
  pngTimeToIso,
  validateVisitorInput,
  type FrontDeskVisitor,
  type VisitorErrors,
  type VisitorInput,
} from '@/services/frontDesk/visitorRules';

const NO_HOST = '__none';
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

interface Staff { name: string; email: string }

interface FormState {
  name: string; company: string; reason: string; visitDate: string;
  expectedStart: string; expectedEnd: string; hostEmail: string;
  phone: string; email: string; badgeNo: string; notes: string;
  timeIn: string; timeOut: string;
}

const toForm = (visitor: FrontDeskVisitor | undefined, dateKey: string): FormState => ({
  name: visitor?.name ?? '',
  company: visitor?.company ?? '',
  reason: visitor?.reason ?? '',
  visitDate: visitor?.visitDate || dateKey,
  expectedStart: visitor?.expectedStart ? isoToPngTime(visitor.expectedStart) : '',
  expectedEnd: visitor?.expectedEnd ? isoToPngTime(visitor.expectedEnd) : '',
  hostEmail: visitor?.hostEmail || NO_HOST,
  phone: visitor?.phone ?? '',
  email: visitor?.email ?? '',
  badgeNo: visitor?.badgeNo ?? '',
  notes: visitor?.notes ?? '',
  timeIn: visitor?.timeIn ? isoToPngTime(visitor.timeIn) : '',
  timeOut: visitor?.timeOut ? isoToPngTime(visitor.timeOut) : '',
});

/** A clock time on the visit day, or on the visitor's sign-in day for corrections. */
const at = (dateKey: string, time: string) => (time ? pngTimeToIso(dateKey, time) : undefined);

/**
 * Pre-book a visitor (saved as Expected) or edit one (plan P3.6). Only Name and Reason are
 * required (D4). Time In / Time Out appear only once they exist, for corrections (P3.4).
 */
export const VisitorFormDialog: React.FC<{
  open: boolean;
  visitor?: FrontDeskVisitor;
  defaultDate: string;
  staff: Staff[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: VisitorInput, photo?: File) => Promise<boolean>;
}> = ({ open, visitor, defaultDate, staff, saving, onClose, onSubmit }) => {
  const [form, setForm] = useState<FormState>(() => toForm(visitor, defaultDate));
  const [errors, setErrors] = useState<VisitorErrors & { photo?: string }>({});
  const [photo, setPhoto] = useState<File | undefined>();

  useEffect(() => {
    if (open) { setForm(toForm(visitor, defaultDate)); setErrors({}); setPhoto(undefined); }
  }, [open, visitor, defaultDate]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const host = staff.find(s => s.email === form.hostEmail);
    // A corrected time stays on the day it was recorded, even for a visit that ran overnight.
    const timeInDay = visitor?.timeIn ? pngDateKey(visitor.timeIn) : form.visitDate;
    const timeOutDay = visitor?.timeOut ? pngDateKey(visitor.timeOut) : timeInDay;
    const input: VisitorInput = {
      name: form.name, company: form.company, reason: form.reason, visitDate: form.visitDate,
      expectedStart: at(form.visitDate, form.expectedStart), expectedEnd: at(form.visitDate, form.expectedEnd),
      hostEmail: host?.email, hostName: host?.name,
      phone: form.phone, email: form.email, badgeNo: form.badgeNo, notes: form.notes,
      groupRef: visitor?.groupRef,
      appointmentId: visitor?.appointmentId,
      timeIn: at(timeInDay, form.timeIn), timeOut: at(timeOutDay, form.timeOut),
    };
    const found = validateVisitorInput(input);
    if (photo && photo.size > MAX_PHOTO_BYTES) (found as { photo?: string }).photo = 'Choose a photo under 4 MB.';
    setErrors(found);
    if (Object.keys(found).length) return;
    if (await onSubmit(input, photo)) onClose();
  };

  const error = (key: keyof (VisitorErrors & { photo?: string })) =>
    errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{visitor ? 'Edit visitor' : 'Pre-book a visitor'}</DialogTitle>
            <DialogDescription>
              {visitor ? 'Change the visitor’s details.' : 'The visitor appears in that day’s log as Expected and can be signed in on arrival.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="visitor-name">Visitor's name*</Label>
              <Input id="visitor-name" value={form.name} onChange={set('name')} className={cn(errors.name && 'border-red-500')} autoFocus />
              {error('name')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="visitor-company">Company</Label>
              <Input id="visitor-company" value={form.company} onChange={set('company')} />
            </div>
            <div className="space-y-1">
              <Label>Host</Label>
              <Select value={form.hostEmail} onValueChange={value => setForm(f => ({ ...f, hostEmail: value }))}>
                <SelectTrigger aria-label="Host"><SelectValue placeholder="Choose a host" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_HOST}>No host</SelectItem>
                  {staff.map(s => <SelectItem key={s.email} value={s.email}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="visitor-reason">Reason for visit*</Label>
              <Input id="visitor-reason" value={form.reason} onChange={set('reason')} className={cn(errors.reason && 'border-red-500')} />
              {error('reason')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="visitor-date">Visit date*</Label>
              <Input id="visitor-date" type="date" value={form.visitDate} onChange={set('visitDate')} className={cn(errors.visitDate && 'border-red-500')} />
              {error('visitDate')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="visitor-expected-start">Expected from</Label>
                <Input id="visitor-expected-start" type="time" value={form.expectedStart} onChange={set('expectedStart')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="visitor-expected-end">to</Label>
                <Input id="visitor-expected-end" type="time" value={form.expectedEnd} onChange={set('expectedEnd')} className={cn(errors.expectedEnd && 'border-red-500')} />
              </div>
              <div className="col-span-2">{error('expectedEnd')}</div>
            </div>

            {visitor?.timeIn && (
              <div className="grid grid-cols-2 gap-2 sm:col-span-2 rounded-md border border-dashed p-3">
                <p className="col-span-2 text-xs text-muted-foreground">Correct the recorded times if they were entered wrongly.</p>
                <div className="space-y-1">
                  <Label htmlFor="visitor-time-in">Time in</Label>
                  <Input id="visitor-time-in" type="time" value={form.timeIn} onChange={set('timeIn')} />
                </div>
                {visitor.timeOut && (
                  <div className="space-y-1">
                    <Label htmlFor="visitor-time-out">Time out</Label>
                    <Input id="visitor-time-out" type="time" value={form.timeOut} onChange={set('timeOut')} className={cn(errors.timeOut && 'border-red-500')} />
                  </div>
                )}
                <div className="col-span-2">{error('timeOut')}</div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="visitor-phone">Phone</Label>
              <Input id="visitor-phone" type="tel" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visitor-email">Email</Label>
              <Input id="visitor-email" type="email" value={form.email} onChange={set('email')} className={cn(errors.email && 'border-red-500')} />
              {error('email')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="visitor-badge">Badge No</Label>
              <Input id="visitor-badge" value={form.badgeNo} onChange={set('badgeNo')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="visitor-photo">Photo (optional)</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="visitor-photo" className="inline-flex items-center rounded-md border px-3 h-9 text-sm cursor-pointer hover:bg-muted">
                  <Upload className="mr-2 h-4 w-4" />{photo ? 'Change' : 'Choose'}
                </Label>
                <input id="visitor-photo" type="file" accept="image/*" className="sr-only" onChange={e => setPhoto(e.target.files?.[0])} />
                <span className="text-xs text-muted-foreground truncate">
                  {photo?.name || (visitor?.photoUrl ? (
                    <a href={visitor.photoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center hover:underline">
                      <ImageIcon className="mr-1 h-3.5 w-3.5" />Current photo
                    </a>
                  ) : 'No photo')}
                </span>
              </div>
              {error('photo')}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="visitor-notes">Notes</Label>
              <Textarea id="visitor-notes" rows={2} value={form.notes} onChange={set('notes')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{visitor ? 'Save changes' : 'Pre-book visitor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
