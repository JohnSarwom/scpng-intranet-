import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { collectionErrors, type FrontDeskMailItem, type MailErrors } from '@/services/frontDesk/mailRules';
import { isoToPngTime, pngDateKey, pngTimeToIso } from '@/services/frontDesk/pngTime';

/**
 * Asked when an item is marked Collected (plan P4.3): who collected it (the recipient by
 * default) and when (now by default), never earlier than it arrived.
 */
export const CollectionDialog: React.FC<{
  item: FrontDeskMailItem | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (collection: { collectedBy: string; collectedAt: string }) => void;
}> = ({ item, saving, onClose, onConfirm }) => {
  const [collectedBy, setCollectedBy] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState<MailErrors>({});

  useEffect(() => {
    if (!item) return;
    const now = new Date().toISOString();
    setCollectedBy(item.recipientName);
    setDate(pngDateKey(now));
    setTime(isoToPngTime(now));
    setErrors({});
  }, [item]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    let collectedAt = '';
    try { collectedAt = pngTimeToIso(date, time); } catch { /* reported below */ }
    const found = collectionErrors(item.receivedAt, collectedBy, collectedAt);
    setErrors(found);
    if (!Object.keys(found).length) onConfirm({ collectedBy: collectedBy.trim(), collectedAt });
  };

  return (
    <Dialog open={!!item} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Record collection</DialogTitle>
            <DialogDescription>{item ? `${item.title} for ${item.recipientName}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="collected-by">Collected by*</Label>
            <Input id="collected-by" value={collectedBy} onChange={e => setCollectedBy(e.target.value)} className={cn(errors.collectedBy && 'border-red-500')} autoFocus />
            {errors.collectedBy && <p className="text-xs text-red-600">{errors.collectedBy}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="collected-date">Date*</Label>
              <Input id="collected-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="collected-time">Time*</Label>
              <Input id="collected-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            {errors.collectedAt && <p className="col-span-2 text-xs text-red-600">{errors.collectedAt}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>Mark collected</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
