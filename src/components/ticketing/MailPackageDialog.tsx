import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { MAIL_ITEM_TYPES, type MailItemType, type MailStatus } from '@/services/frontDesk/frontDeskConfig';
import {
  MAIL_STATUS_LABELS,
  OUTSTANDING_STATUSES,
  validateMailInput,
  type FrontDeskMailItem,
  type MailErrors,
  type MailInput,
} from '@/services/frontDesk/mailRules';
import { isoToPngTime, pngDateKey, pngTimeToIso } from '@/services/frontDesk/pngTime';

/** "Other (not in directory)": the recipient is typed in, with no email. */
const OTHER = '__other';

interface Staff { name: string; email: string; unit: string }

interface FormState {
  itemType: MailItemType; title: string; sender: string; carrier: string; tracking: string;
  recipientEmail: string; otherName: string; otherUnit: string;
  receivedDate: string; receivedTime: string; status: MailStatus; notes: string;
  collectedBy: string; collectedDate: string; collectedTime: string;
}

function toForm(item: FrontDeskMailItem | null, staff: Staff[]): FormState {
  const now = new Date().toISOString();
  const received = item?.receivedAt ?? now;
  const inDirectory = !!item?.recipientEmail && staff.some(s => s.email === item.recipientEmail);
  return {
    itemType: item?.itemType ?? 'Mail',
    title: item?.title ?? '',
    sender: item?.sender ?? '',
    carrier: item?.carrier ?? '',
    tracking: item?.tracking ?? '',
    recipientEmail: item ? (inDirectory ? item.recipientEmail! : OTHER) : '',
    otherName: item && !inDirectory ? item.recipientName : '',
    otherUnit: item && !inDirectory ? item.recipientUnit ?? '' : '',
    receivedDate: pngDateKey(received),
    receivedTime: isoToPngTime(received),
    status: item?.status ?? 'Received',
    notes: item?.notes ?? '',
    collectedBy: item?.collectedBy ?? '',
    collectedDate: item?.collectedAt ? pngDateKey(item.collectedAt) : '',
    collectedTime: item?.collectedAt ? isoToPngTime(item.collectedAt) : '',
  };
}

const at = (date: string, time: string) => { try { return pngTimeToIso(date, time); } catch { return ''; } };

/**
 * Log or edit a mail item or parcel (plan P4.1–P4.3). The recipient comes from the staff
 * directory, which also fills their unit; "Other" keeps free text for anyone not in it.
 * Status changes after logging go through the register's status menu.
 */
const MailPackageDialog: React.FC<{
  open: boolean;
  item: FrontDeskMailItem | null;
  staff: Staff[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: MailInput) => Promise<boolean>;
}> = ({ open, item, staff, saving, onClose, onSubmit }) => {
  const [form, setForm] = useState<FormState>(() => toForm(item, staff));
  const [errors, setErrors] = useState<MailErrors>({});

  useEffect(() => {
    if (open) { setForm(toForm(item, staff)); setErrors({}); }
    // Staff loading in later must not wipe what the receptionist has typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));
  const recipient = useMemo(() => staff.find(s => s.email === form.recipientEmail), [staff, form.recipientEmail]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const other = form.recipientEmail === OTHER || !recipient;
    const input: MailInput = {
      itemType: form.itemType, title: form.title, sender: form.sender, carrier: form.carrier, tracking: form.tracking,
      recipientEmail: other ? undefined : recipient!.email,
      recipientName: other ? form.otherName : recipient!.name,
      recipientUnit: other ? form.otherUnit : recipient!.unit,
      receivedAt: at(form.receivedDate, form.receivedTime),
      status: form.status, notes: form.notes,
      collectedBy: form.collectedBy, collectedAt: at(form.collectedDate, form.collectedTime),
    };
    const found = validateMailInput(input);
    if (form.recipientEmail === '' && !found.recipientName) found.recipientName = 'Choose the recipient.';
    setErrors(found);
    if (Object.keys(found).length) return;
    if (await onSubmit(input)) onClose();
  };

  const error = (key: keyof MailErrors) => (errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null);
  const isMail = form.itemType === 'Mail';

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{item ? 'Edit item' : 'Log mail or a parcel'}</DialogTitle>
            <DialogDescription>{item ? 'Change the item’s details.' : 'Record an item that has arrived at reception.'}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Type*</Label>
              <Select value={form.itemType} onValueChange={value => setForm(f => ({ ...f, itemType: value as MailItemType }))}>
                <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAIL_ITEM_TYPES.map(type => <SelectItem key={type} value={type}>{type === 'Package' ? 'Parcel' : type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!item && (
              <div className="space-y-1">
                <Label>Status*</Label>
                <Select value={form.status} onValueChange={value => setForm(f => ({ ...f, status: value as MailStatus }))}>
                  <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTSTANDING_STATUSES.map(status => <SelectItem key={status} value={status}>{MAIL_STATUS_LABELS[status]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="mail-title">{isMail ? 'Subject*' : 'Description*'}</Label>
              <Input id="mail-title" value={form.title} onChange={set('title')} placeholder={isMail ? 'e.g. Letter from IPA' : 'e.g. Box of printer toner'} className={cn(errors.title && 'border-red-500')} autoFocus />
              {error('title')}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label>Recipient*</Label>
              {/* Radix Select 1.x shows its placeholder only for an undefined value, not ''. */}
              <Select value={form.recipientEmail || undefined} onValueChange={value => setForm(f => ({ ...f, recipientEmail: value }))}>
                <SelectTrigger aria-label="Recipient" className={cn(errors.recipientName && 'border-red-500')}>
                  <SelectValue placeholder="Choose a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map(s => <SelectItem key={s.email} value={s.email}>{s.name}{s.unit ? ` — ${s.unit}` : ''}</SelectItem>)}
                  <SelectItem value={OTHER}>Other (not in directory)</SelectItem>
                </SelectContent>
              </Select>
              {form.recipientEmail === OTHER && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Input aria-label="Recipient name" placeholder="Recipient's name*" value={form.otherName} onChange={set('otherName')} />
                  <Input aria-label="Recipient unit" placeholder="Unit or company" value={form.otherUnit} onChange={set('otherUnit')} />
                </div>
              )}
              {recipient?.unit && <p className="text-xs text-muted-foreground">{recipient.unit}</p>}
              {error('recipientName')}
            </div>

            <div className="space-y-1">
              <Label htmlFor="mail-sender">Sender</Label>
              <Input id="mail-sender" value={form.sender} onChange={set('sender')} placeholder="Who sent it" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-carrier">Carrier</Label>
              <Input id="mail-carrier" value={form.carrier} onChange={set('carrier')} placeholder="e.g. Post PNG, DHL, hand delivered" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mail-tracking">Tracking No</Label>
              <Input id="mail-tracking" value={form.tracking} onChange={set('tracking')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="mail-received-date">Received*</Label>
                <Input id="mail-received-date" type="date" value={form.receivedDate} onChange={set('receivedDate')} className={cn(errors.receivedAt && 'border-red-500')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mail-received-time">at</Label>
                <Input id="mail-received-time" type="time" value={form.receivedTime} onChange={set('receivedTime')} className={cn(errors.receivedAt && 'border-red-500')} />
              </div>
              <div className="col-span-2">{error('receivedAt')}</div>
            </div>

            {item?.status === 'Delivered' && (
              <div className="grid grid-cols-3 gap-2 sm:col-span-2 rounded-md border border-dashed p-3">
                <p className="col-span-3 text-xs text-muted-foreground">Correct the collection record if it was entered wrongly.</p>
                <div className="space-y-1">
                  <Label htmlFor="mail-collected-by">Collected by*</Label>
                  <Input id="mail-collected-by" value={form.collectedBy} onChange={set('collectedBy')} className={cn(errors.collectedBy && 'border-red-500')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mail-collected-date">Date*</Label>
                  <Input id="mail-collected-date" type="date" value={form.collectedDate} onChange={set('collectedDate')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mail-collected-time">Time*</Label>
                  <Input id="mail-collected-time" type="time" value={form.collectedTime} onChange={set('collectedTime')} />
                </div>
                <div className="col-span-3">{error('collectedBy')}{error('collectedAt')}</div>
              </div>
            )}

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="mail-notes">Notes</Label>
              <Textarea id="mail-notes" rows={2} value={form.notes} onChange={set('notes')} placeholder="e.g. fragile, perishable" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{item ? 'Save changes' : 'Log item'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MailPackageDialog;
