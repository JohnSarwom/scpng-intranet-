/**
 * Pure rules for Front Desk appointments (plan Phase 4B): mapping SharePoint items, periods,
 * validation, the expected visitors an appointment creates, and its Outlook event.
 */
import { APPOINTMENT_STATUSES, type AppointmentStatus } from './frontDeskConfig';
import type { GraphListItem } from './frontDeskGraph';
import { isoToPngTime, pngDateKey, pngDayRange, shiftDateKey } from './pngTime';
import type { FrontDeskVisitor, VisitorInput } from './visitorRules';

export interface AppointmentAttendee {
  name: string;
  /** Staff attendees carry their email; external guests usually have none. */
  email?: string;
  company?: string;
  /** External guests become Expected visitors; staff are invited in Outlook. */
  external: boolean;
}

export interface FrontDeskAppointment {
  id: string;
  eTag?: string;
  title: string;
  hostEmail: string;
  hostName: string;
  location?: string;
  /** ISO instants. */
  startDateTime: string;
  endDateTime: string;
  attendees: AppointmentAttendee[];
  status: AppointmentStatus;
  description?: string;
  createdByEmail?: string;
  outlookEventId?: string;
}

export interface AppointmentInput {
  title: string;
  hostEmail: string;
  hostName: string;
  location?: string;
  startDateTime: string;
  endDateTime: string;
  attendees: AppointmentAttendee[];
  status: AppointmentStatus;
  description?: string;
}

export type AppointmentTab = 'all' | 'upcoming' | 'completed' | 'canceled';

// ─── Dates ──────────────────────────────────────────────────────────────────

/** PNG day of the appointment. */
export const appointmentDateKey = (appointment: Pick<FrontDeskAppointment, 'startDateTime'>) => pngDateKey(appointment.startDateTime);

/** "14:30" PNG start time, for the day view's hour rows. */
export const appointmentStartTime = (appointment: Pick<FrontDeskAppointment, 'startDateTime'>) => isoToPngTime(appointment.startDateTime);

/** The UTC range covering PNG days `fromKey`..`toKey` inclusive, on the indexed StartDateTime. */
export function dayKeysRange(fromKey: string, toKey: string) {
  return { start: pngDayRange(fromKey).start, end: pngDayRange(toKey).end };
}

/** Monday-to-Sunday week containing a PNG day. */
export function weekKeys(dateKey: string): { from: string; to: string } {
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const from = shiftDateKey(dateKey, -((weekday + 6) % 7));
  return { from, to: shiftDateKey(from, 6) };
}

/** First and last day of the month containing a PNG day. */
export function monthKeys(dateKey: string): { from: string; to: string } {
  const [year, month] = dateKey.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

// ─── SharePoint mapping ─────────────────────────────────────────────────────

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const optional = (value: unknown) => text(value) || undefined;
const instant = (value: unknown) => {
  const raw = text(value);
  return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;
};

/** Attendees are stored as JSON text; anything unreadable is dropped rather than breaking the screen. */
export function parseAttendees(value: unknown): AppointmentAttendee[] {
  let parsed: unknown;
  try { parsed = JSON.parse(text(value) || '[]'); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map(a => ({ name: text(a.name), email: optional(a.email)?.toLowerCase(), company: optional(a.company), external: a.external === true }))
    .filter(a => a.name);
}

export function mapAppointment(item: GraphListItem): FrontDeskAppointment {
  const f = item.fields || {};
  const start = instant(f.StartDateTime) ?? new Date(0).toISOString();
  return {
    id: String(item.id),
    eTag: item.eTag,
    title: text(f.Title),
    hostEmail: text(f.HostEmail).toLowerCase(),
    hostName: text(f.HostName),
    location: optional(f.Location),
    startDateTime: start,
    endDateTime: instant(f.EndDateTime) ?? start,
    attendees: parseAttendees(f.Attendees),
    status: (APPOINTMENT_STATUSES as readonly string[]).includes(text(f.Status)) ? text(f.Status) as AppointmentStatus : 'Scheduled',
    description: optional(f.Description),
    createdByEmail: optional(f.CreatedByEmail),
    outlookEventId: optional(f.OutlookEventId),
  };
}

export function appointmentFields(input: AppointmentInput, { forUpdate = false } = {}): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    Title: input.title.trim(),
    HostEmail: input.hostEmail.trim().toLowerCase(),
    HostName: input.hostName.trim(),
    StartDateTime: input.startDateTime,
    EndDateTime: input.endDateTime,
    Status: input.status,
    Attendees: JSON.stringify(input.attendees.map(a => ({
      name: a.name.trim(), ...(a.email ? { email: a.email.toLowerCase() } : {}), ...(a.company?.trim() ? { company: a.company.trim() } : {}), external: a.external,
    }))),
  };
  for (const [key, column] of [['location', 'Location'], ['description', 'Description']] as const) {
    const value = input[key]?.trim();
    if (value) fields[column] = value;
    else if (forUpdate) fields[column] = null;
  }
  return fields;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type AppointmentErrors = Partial<Record<'title' | 'host' | 'start' | 'end', string>>;

/** Date, both times and a host are required, and the end must be after the start (plan P4.6). */
export function validateAppointmentInput(input: AppointmentInput): AppointmentErrors {
  const errors: AppointmentErrors = {};
  if (!input.title.trim()) errors.title = 'Enter a title.';
  if (!input.hostEmail.trim() || !input.hostName.trim()) errors.host = 'Choose the host.';
  const start = Date.parse(input.startDateTime);
  const end = Date.parse(input.endDateTime);
  if (Number.isNaN(start)) errors.start = 'Enter the date and start time.';
  if (Number.isNaN(end)) errors.end = 'Enter the end time.';
  else if (!Number.isNaN(start) && end <= start) errors.end = 'The end must be after the start.';
  return errors;
}

// ─── Views ──────────────────────────────────────────────────────────────────

/** Tabs are views over the appointments, not status values (audit B1). */
export function appointmentsForTab(appointments: FrontDeskAppointment[], tab: AppointmentTab, todayKey: string): FrontDeskAppointment[] {
  if (tab === 'all') return appointments;
  if (tab === 'upcoming') return appointments.filter(a => a.status === 'Scheduled' && appointmentDateKey(a) >= todayKey);
  return appointments.filter(a => a.status === (tab === 'completed' ? 'Completed' : 'Canceled'));
}

export function searchAppointments(appointments: FrontDeskAppointment[], query: string): FrontDeskAppointment[] {
  const q = query.trim().toLowerCase();
  if (!q) return appointments;
  return appointments.filter(a => [a.title, a.hostName, a.location, a.description, ...a.attendees.map(x => `${x.name} ${x.company ?? ''}`)]
    .some(value => value?.toLowerCase().includes(q)));
}

export const sortByStart = (appointments: FrontDeskAppointment[]) =>
  [...appointments].sort((a, b) => (a.startDateTime < b.startDateTime ? -1 : a.startDateTime > b.startDateTime ? 1 : 0));

// ─── Expected visitors (plan P4.8) ──────────────────────────────────────────

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** The visitor record an external attendee should have for this appointment. */
export function expectedVisitorInput(appointment: FrontDeskAppointment, attendee: AppointmentAttendee): VisitorInput {
  return {
    name: attendee.name.trim().replace(/\s+/g, ' '),
    company: attendee.company?.trim() || undefined,
    reason: appointment.title.trim(),
    visitDate: appointmentDateKey(appointment),
    expectedStart: appointment.startDateTime,
    expectedEnd: appointment.endDateTime,
    hostEmail: appointment.hostEmail || undefined,
    hostName: appointment.hostName || undefined,
    appointmentId: appointment.id,
  };
}

const differs = (visitor: FrontDeskVisitor, wanted: VisitorInput) =>
  visitor.visitDate !== wanted.visitDate || visitor.expectedStart !== wanted.expectedStart || visitor.expectedEnd !== wanted.expectedEnd
  || (visitor.company ?? '') !== (wanted.company ?? '') || visitor.reason !== wanted.reason
  || (visitor.hostEmail ?? '') !== (wanted.hostEmail ?? '');

/**
 * Which Expected visitors to create, update or remove so the visitor log matches the
 * appointment's external attendees. Matching is by name, so editing an appointment never
 * duplicates a guest. Visitors who have already arrived (or were marked no-show) are left alone.
 */
export function planExpectedVisitors(appointment: FrontDeskAppointment, linked: FrontDeskVisitor[]) {
  const mine = linked.filter(v => v.appointmentId === appointment.id);
  const stillExpected = mine.filter(v => v.status === 'Expected');
  if (appointment.status !== 'Scheduled') return { create: [] as VisitorInput[], update: [] as { visitor: FrontDeskVisitor; input: VisitorInput }[], remove: stillExpected };

  const guests = new Map<string, AppointmentAttendee>();
  for (const attendee of appointment.attendees) if (attendee.external && attendee.name.trim()) guests.set(nameKey(attendee.name), attendee);

  const create: VisitorInput[] = [];
  const update: { visitor: FrontDeskVisitor; input: VisitorInput }[] = [];
  for (const [key, attendee] of guests) {
    const wanted = expectedVisitorInput(appointment, attendee);
    const existing = mine.find(v => nameKey(v.name) === key);
    if (!existing) create.push(wanted);
    else if (existing.status === 'Expected' && differs(existing, wanted)) update.push({ visitor: existing, input: { ...wanted, groupRef: existing.groupRef, notes: existing.notes, phone: existing.phone, email: existing.email, badgeNo: existing.badgeNo } });
  }
  const remove = stillExpected.filter(v => !guests.has(nameKey(v.name)));
  return { create, update, remove };
}

// ─── Outlook event (plan P4.10) ─────────────────────────────────────────────

/** The host and staff attendees, each once. External guests are never sent an invite. */
export function inviteeEmails(appointment: Pick<FrontDeskAppointment, 'hostEmail' | 'hostName' | 'attendees'>) {
  const people = new Map<string, string>();
  if (appointment.hostEmail) people.set(appointment.hostEmail.toLowerCase(), appointment.hostName);
  for (const a of appointment.attendees) if (!a.external && a.email) people.set(a.email.toLowerCase(), a.name);
  return [...people].map(([address, name]) => ({ address, name }));
}

const graphDateTime = (iso: string) => ({ dateTime: iso.replace(/\.\d{3}Z$|Z$/, ''), timeZone: 'UTC' });

/** The Microsoft Graph event body for an appointment. */
export function appointmentEvent(appointment: FrontDeskAppointment) {
  const guests = appointment.attendees.filter(a => a.external).map(a => (a.company ? `${a.name} (${a.company})` : a.name));
  const lines = [
    appointment.description,
    guests.length ? `Visitors: ${guests.join(', ')}` : '',
    'Booked through the SCPNG front desk.',
  ].filter(Boolean);
  return {
    subject: appointment.title,
    body: { contentType: 'text', content: lines.join('\n\n') },
    start: graphDateTime(appointment.startDateTime),
    end: graphDateTime(appointment.endDateTime),
    ...(appointment.location ? { location: { displayName: appointment.location } } : {}),
    attendees: inviteeEmails(appointment).map(person => ({ emailAddress: person, type: 'required' as const })),
  };
}
