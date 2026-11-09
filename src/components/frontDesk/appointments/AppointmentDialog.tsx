import React, { useEffect, useState } from 'react';
import { Building, Trash2, UserPlus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  validateAppointmentInput,
  type AppointmentAttendee,
  type AppointmentErrors,
  type AppointmentInput,
  type FrontDeskAppointment,
} from '@/services/frontDesk/appointmentRules';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '@/services/frontDesk/frontDeskConfig';
import { isoToPngTime, pngDateKey, pngTimeToIso } from '@/services/frontDesk/pngTime';

interface Staff { name: string; email: string }

const at = (date: string, time: string) => { try { return pngTimeToIso(date, time); } catch { return ''; } };

/**
 * Book or edit an appointment (plan P4.6). Staff attendees come from the directory and are
 * invited in Outlook; external visitors are typed in and appear in the visitor log as Expected.
 */
export const AppointmentDialog: React.FC<{
  open: boolean;
  appointment?: FrontDeskAppointment;
  defaultDate: string;
  staff: Staff[];
  saving: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSubmit: (input: AppointmentInput, sendInvite: boolean) => Promise<boolean>;
  onDelete: (appointment: FrontDeskAppointment) => void;
}> = ({ open, appointment, defaultDate, staff, saving, canDelete, onClose, onSubmit, onDelete }) => {
  const [title, setTitle] = useState('');
  const [hostEmail, setHostEmail] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('Scheduled');
  const [attendees, setAttendees] = useState<AppointmentAttendee[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestCompany, setGuestCompany] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [errors, setErrors] = useState<AppointmentErrors>({});

  useEffect(() => {
    if (!open) return;
    setTitle(appointment?.title ?? '');
    setHostEmail(appointment?.hostEmail ?? '');
    setLocation(appointment?.location ?? '');
    setDate(appointment ? pngDateKey(appointment.startDateTime) : defaultDate);
    setStart(appointment ? isoToPngTime(appointment.startDateTime) : '');
    setEnd(appointment ? isoToPngTime(appointment.endDateTime) : '');
    setDescription(appointment?.description ?? '');
    setStatus(appointment?.status ?? 'Scheduled');
    setAttendees(appointment?.attendees ?? []);
    setGuestName(''); setGuestCompany('');
    // New bookings send an invite by default; an existing invite is always kept in step.
    setSendInvite(!appointment);
    setErrors({});
  }, [open, appointment, defaultDate]);

  const host = staff.find(s => s.email === hostEmail) ?? (appointment && hostEmail === appointment.hostEmail ? { name: appointment.hostName, email: hostEmail } : undefined);
  const staffChoices = staff.filter(s => s.email !== hostEmail && !attendees.some(a => a.email === s.email));

  const addStaff = (email: string) => {
    const person = staff.find(s => s.email === email);
    if (person) setAttendees(list => [...list, { name: person.name, email: person.email, external: false }]);
  };
  const addGuest = () => {
    const name = guestName.trim().replace(/\s+/g, ' ');
    if (!name || attendees.some(a => a.external && a.name.toLowerCase() === name.toLowerCase())) return;
    setAttendees(list => [...list, { name, company: guestCompany.trim() || undefined, external: true }]);
    setGuestName(''); setGuestCompany('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: AppointmentInput = {
      title, hostEmail: host?.email ?? '', hostName: host?.name ?? '', location,
      startDateTime: at(date, start), endDateTime: at(date, end), attendees, status, description,
    };
    const found = validateAppointmentInput(input);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (await onSubmit(input, sendInvite)) onClose();
  };

  const error = (key: keyof AppointmentErrors) => (errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null);
  const guests = attendees.filter(a => a.external).length;

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{appointment ? 'Edit appointment' : 'New appointment'}</DialogTitle>
            <DialogDescription>
              External visitors you add appear in that day’s visitor log as Expected, ready to sign in.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="appt-title">Title*</Label>
              <Input id="appt-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Licence application meeting" className={cn(errors.title && 'border-red-500')} autoFocus />
              {error('title')}
            </div>
            <div className="space-y-1">
              <Label>Host*</Label>
              {/* Radix Select 1.x shows its placeholder only for an undefined value, not ''. */}
              <Select value={hostEmail || undefined} onValueChange={setHostEmail}>
                <SelectTrigger aria-label="Host" className={cn(errors.host && 'border-red-500')}><SelectValue placeholder="Choose the host" /></SelectTrigger>
                <SelectContent>
                  {host && !staff.some(s => s.email === host.email) && <SelectItem value={host.email}>{host.name}</SelectItem>}
                  {staff.map(s => <SelectItem key={s.email} value={s.email}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {error('host')}
            </div>
            <div className="space-y-1">
              <Label htmlFor="appt-location">Location</Label>
              <Input id="appt-location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Boardroom" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="appt-date">Date*</Label>
              <Input id="appt-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={cn(errors.start && 'border-red-500')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="appt-start">Start*</Label>
                <Input id="appt-start" type="time" value={start} onChange={e => setStart(e.target.value)} className={cn(errors.start && 'border-red-500')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="appt-end">End*</Label>
                <Input id="appt-end" type="time" value={end} onChange={e => setEnd(e.target.value)} className={cn(errors.end && 'border-red-500')} />
              </div>
              <div className="col-span-2">{error('start')}{error('end')}</div>
            </div>

            <div className="space-y-2 sm:col-span-2 rounded-md border p-3">
              <Label>Attendees</Label>
              {attendees.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {attendees.map((a, i) => (
                    <Badge key={`${a.email ?? a.name}-${i}`} variant="secondary" className="gap-1 font-normal">
                      {a.external ? <Building className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                      {a.name}{a.company ? ` (${a.company})` : ''}
                      <button type="button" aria-label={`Remove ${a.name}`} className="ml-1 hover:text-red-600" onClick={() => setAttendees(list => list.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Re-keyed after each pick so the picker goes back to its placeholder. */}
                <Select key={attendees.length} value={undefined} onValueChange={addStaff}>
                  <SelectTrigger aria-label="Add a staff attendee"><SelectValue placeholder="Add a staff member" /></SelectTrigger>
                  <SelectContent>
                    {staffChoices.map(s => <SelectItem key={s.email} value={s.email}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input aria-label="Visitor name" placeholder="Visitor's name" value={guestName} onChange={e => setGuestName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }} />
                  <Input aria-label="Visitor company" placeholder="Company" value={guestCompany} onChange={e => setGuestCompany(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }} />
                  <Button type="button" variant="outline" onClick={addGuest}>Add</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {guests ? `${guests} visitor${guests === 1 ? '' : 's'} will be expected at reception.` : 'Add visitors from outside SCPNG so reception expects them.'}
              </p>
            </div>

            {appointment && (
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={value => setStatus(value as AppointmentStatus)}>
                  <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                  <SelectContent>{APPOINTMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="appt-description">Description</Label>
              <Textarea id="appt-description" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className="sm:col-span-2 flex items-start gap-2">
              {appointment?.outlookEventId ? (
                <p className="text-xs text-muted-foreground">
                  The Outlook invite will be updated{status === 'Canceled' ? ', and canceled because the appointment is canceled' : ''}.
                </p>
              ) : (
                <>
                  <Checkbox id="appt-invite" checked={sendInvite} onCheckedChange={checked => setSendInvite(checked === true)} disabled={status !== 'Scheduled'} />
                  <Label htmlFor="appt-invite" className="font-normal leading-snug">
                    Send an Outlook invite to the host and staff attendees from your calendar. External visitors are not invited.
                  </Label>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {appointment && canDelete && (
                <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => onDelete(appointment)}>
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{appointment ? 'Save changes' : 'Book appointment'}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
