/**
 * Pure rules for the Front Desk visitor log (plan Phase 3): mapping SharePoint items,
 * PNG dates and times, status changes and validation. No Graph calls, so it is all testable.
 */
import { getPNGDateKey } from '@/utils/pngPublicHolidays';
import { VISITOR_STATUSES, type VisitorStatus } from './frontDeskConfig';
import type { GraphListItem } from './frontDeskGraph';

export const PNG_TIME_ZONE = 'Pacific/Port_Moresby';
/** Papua New Guinea has no daylight saving, so the offset never changes. */
const PNG_OFFSET = '+10:00';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FrontDeskVisitor {
  id: string;
  eTag?: string;
  name: string;
  company: string;
  reason: string;
  /** PNG calendar day of the visit, YYYY-MM-DD. */
  visitDate: string;
  status: VisitorStatus;
  /** ISO instants. */
  expectedStart?: string;
  expectedEnd?: string;
  timeIn?: string;
  timeOut?: string;
  hostEmail?: string;
  hostName?: string;
  phone?: string;
  email?: string;
  badgeNo?: string;
  photoUrl?: string;
  notes?: string;
  groupRef?: string;
  appointmentId?: string;
  loggedByEmail?: string;
  signedOutByEmail?: string;
}

/** What the sign-in bar and the visitor form collect. Times are ISO instants. */
export interface VisitorInput {
  name: string;
  reason: string;
  visitDate: string;
  company?: string;
  expectedStart?: string;
  expectedEnd?: string;
  hostEmail?: string;
  hostName?: string;
  phone?: string;
  email?: string;
  badgeNo?: string;
  notes?: string;
  groupRef?: string;
  timeIn?: string;
  timeOut?: string;
}

export const VISITOR_STATUS_LABELS: Record<VisitorStatus, string> = {
  Expected: 'Expected',
  'On Site': 'On site',
  'Signed Out': 'Signed out',
  'No Show': 'No show',
};

// ─── PNG dates and times ────────────────────────────────────────────────────

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isDateKey = (value: string) => DATE_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** PNG calendar day of an instant (or of now). */
export const pngDateKey = (value: Date | string = new Date()) => getPNGDateKey(typeof value === 'string' ? new Date(value) : value);

/** The date key `days` before or after another (calendar arithmetic, no time zone involved). */
export function shiftDateKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The PNG day as a half-open UTC range, for filtering the indexed VisitDate column. */
export function pngDayRange(dateKey: string): { start: string; end: string } {
  const start = new Date(`${dateKey}T00:00:00${PNG_OFFSET}`);
  return { start: start.toISOString(), end: new Date(start.getTime() + DAY_MS).toISOString() };
}

/**
 * The value written to the date-only VisitDate column. SharePoint stores date-only values as
 * midnight in the site's zone (Port Moresby), so midnight UTC lands on the same calendar day
 * whichever way it converts; reads go back through `pngDateKey`.
 */
export const visitDateValue = (dateKey: string) => `${dateKey}T00:00:00Z`;

/** "14:30" on a PNG day, as an ISO instant. */
export function pngTimeToIso(dateKey: string, timeOfDay: string): string {
  if (!isDateKey(dateKey) || !TIME_OF_DAY.test(timeOfDay)) throw new Error(`Invalid PNG date or time: ${dateKey} ${timeOfDay}`);
  return new Date(`${dateKey}T${timeOfDay}:00${PNG_OFFSET}`).toISOString();
}

const pngParts = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: PNG_TIME_ZONE, ...options }).format(new Date(iso));

/** "14:30" in PNG time, for time inputs. */
export const isoToPngTime = (iso: string) => pngParts(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "2:30 pm" in PNG time, for display. */
export const formatPngTime = (iso?: string) => (iso ? pngParts(iso, { hour: 'numeric', minute: '2-digit', hour12: true }) : '');

/** "Mon 26 Oct 2026" for a date key. */
export const formatDateKey = (dateKey: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${dateKey}T00:00:00Z`));

/** "1h 05m", "45m", or '' when the visitor has not arrived. Open visits count up to `nowIso`. */
export function visitDuration(timeIn?: string, timeOut?: string, nowIso = new Date().toISOString()): string {
  if (!timeIn) return '';
  const minutes = Math.max(0, Math.floor((Date.parse(timeOut || nowIso) - Date.parse(timeIn)) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`;
}

// ─── SharePoint mapping ─────────────────────────────────────────────────────

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const optional = (value: unknown) => text(value) || undefined;
const instant = (value: unknown) => {
  const raw = text(value);
  return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : undefined;
};

/** Tolerates missing optional fields and unknown statuses (read as Expected). */
export function mapVisitor(item: GraphListItem): FrontDeskVisitor {
  const f = item.fields || {};
  const status = (VISITOR_STATUSES as readonly string[]).includes(text(f.Status)) ? text(f.Status) as VisitorStatus : 'Expected';
  const visitDateIso = instant(f.VisitDate);
  return {
    id: String(item.id),
    eTag: item.eTag,
    name: text(f.Title).replace(/\s+/g, ' '),
    company: text(f.Company),
    reason: text(f.Reason),
    visitDate: visitDateIso ? pngDateKey(visitDateIso) : '',
    status,
    expectedStart: instant(f.ExpectedStart),
    expectedEnd: instant(f.ExpectedEnd),
    timeIn: instant(f.TimeIn),
    timeOut: instant(f.TimeOut),
    hostEmail: optional(f.HostEmail)?.toLowerCase(),
    hostName: optional(f.HostName),
    phone: optional(f.Phone),
    email: optional(f.Email),
    badgeNo: optional(f.BadgeNo),
    photoUrl: optional(f.PhotoUrl),
    notes: optional(f.Notes),
    groupRef: optional(f.GroupRef),
    appointmentId: optional(f.AppointmentId),
    loggedByEmail: optional(f.LoggedByEmail),
    signedOutByEmail: optional(f.SignedOutByEmail),
  };
}

const FIELD_NAMES: Record<keyof Omit<VisitorInput, 'name' | 'visitDate'>, string> = {
  reason: 'Reason',
  company: 'Company',
  expectedStart: 'ExpectedStart',
  expectedEnd: 'ExpectedEnd',
  hostEmail: 'HostEmail',
  hostName: 'HostName',
  phone: 'Phone',
  email: 'Email',
  badgeNo: 'BadgeNo',
  notes: 'Notes',
  groupRef: 'GroupRef',
  timeIn: 'TimeIn',
  timeOut: 'TimeOut',
};

/**
 * SharePoint fields for an input. New items leave empty fields out; edits send `null`
 * so a cleared field is cleared in SharePoint too.
 */
export function visitorFields(input: VisitorInput, { forUpdate = false } = {}): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    Title: input.name.trim().replace(/\s+/g, ' '),
    VisitDate: visitDateValue(input.visitDate),
  };
  for (const [key, column] of Object.entries(FIELD_NAMES) as [keyof typeof FIELD_NAMES, string][]) {
    const raw = input[key];
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (value) fields[column] = key === 'hostEmail' ? String(value).toLowerCase() : value;
    else if (forUpdate) fields[column] = null;
  }
  return fields;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type VisitorErrors = Partial<Record<'name' | 'reason' | 'visitDate' | 'expectedEnd' | 'timeOut' | 'email', string>>;

/** Only Name and Reason are required, as on the paper sheet (plan D4). */
export function validateVisitorInput(input: VisitorInput): VisitorErrors {
  const errors: VisitorErrors = {};
  if (!input.name.trim()) errors.name = 'Enter the visitor’s name.';
  if (!input.reason.trim()) errors.reason = 'Enter the reason for the visit.';
  if (!isDateKey(input.visitDate)) errors.visitDate = 'Choose the visit date.';
  if (input.expectedStart && input.expectedEnd && input.expectedEnd < input.expectedStart) {
    errors.expectedEnd = 'The expected end must be after the start.';
  }
  const timeOutError = signOutError(input.timeIn, input.timeOut);
  if (timeOutError) errors.timeOut = timeOutError;
  if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'Check the email address.';
  return errors;
}

/** Time Out may not be earlier than Time In (plan P3.4). */
export function signOutError(timeIn?: string, timeOut?: string): string | undefined {
  if (timeOut && !timeIn) return 'A visitor cannot sign out without a time in.';
  if (timeIn && timeOut && Date.parse(timeOut) < Date.parse(timeIn)) {
    return `Time out cannot be earlier than time in (${formatPngTime(timeIn)}).`;
  }
  return undefined;
}

// ─── Status changes ─────────────────────────────────────────────────────────

export interface StatusChange {
  fields: Record<string, unknown>;
  next: FrontDeskVisitor;
}

/**
 * The fields a status change writes, for the action buttons and board drags alike.
 * Arrival sets TimeIn and leaves ExpectedStart alone (audit B11). Throws for changes that
 * make no sense, such as signing out someone who never arrived.
 */
export function statusChange(visitor: FrontDeskVisitor, target: VisitorStatus, nowIso: string, actorEmail: string): StatusChange {
  const from = visitor.status;
  const change = (fields: Record<string, unknown>, next: Partial<FrontDeskVisitor>): StatusChange =>
    ({ fields: { Status: target, ...fields }, next: { ...visitor, status: target, ...next } });

  if (from === target) return { fields: {}, next: visitor };
  switch (target) {
    case 'On Site':
      if (from === 'Signed Out') return change({ TimeOut: null, SignedOutByEmail: null }, { timeOut: undefined, signedOutByEmail: undefined });
      return change({ TimeIn: visitor.timeIn || nowIso }, { timeIn: visitor.timeIn || nowIso });
    case 'Signed Out': {
      if (from !== 'On Site') throw new Error('Sign the visitor in before signing them out.');
      const error = signOutError(visitor.timeIn, nowIso);
      if (error) throw new Error(error);
      return change({ TimeOut: nowIso, SignedOutByEmail: actorEmail || null },
        { timeOut: nowIso, signedOutByEmail: actorEmail || undefined });
    }
    case 'No Show':
      if (from !== 'Expected') throw new Error('Only an expected visitor can be marked as a no-show.');
      return change({}, {});
    case 'Expected':
      if (from === 'Signed Out') throw new Error('A visitor who has signed out cannot go back to expected.');
      return change(from === 'On Site' ? { TimeIn: null } : {}, from === 'On Site' ? { timeIn: undefined } : {});
  }
}

// ─── The log ────────────────────────────────────────────────────────────────

/** Still On Site from an earlier day: flagged "Not signed out" (audit M1). */
export const isCarriedOver = (visitor: FrontDeskVisitor, todayKey: string) =>
  visitor.status === 'On Site' && !!visitor.visitDate && visitor.visitDate < todayKey;

/**
 * Rows for a day's log. Today's log also shows anyone still on site from earlier days,
 * so reception can sign them out.
 */
export function logRows(day: FrontDeskVisitor[], onSite: FrontDeskVisitor[], dateKey: string, todayKey: string): FrontDeskVisitor[] {
  const rows = [...day];
  if (dateKey === todayKey) {
    const ids = new Set(rows.map(v => v.id));
    rows.push(...onSite.filter(v => !ids.has(v.id) && isCarriedOver(v, todayKey)));
  }
  return sortForLog(rows);
}

/** Paper-sheet order: by day, then arrival (or expected arrival), then name. Visitors with no time go last. */
export function sortForLog(visitors: FrontDeskVisitor[]): FrontDeskVisitor[] {
  // Plain code-unit comparison: localeCompare ranks symbols before digits, which would put "no time" first.
  const key = (v: FrontDeskVisitor) => `${v.visitDate}|${v.timeIn || v.expectedStart || '~'}`;
  const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...visitors].sort((a, b) => order(key(a), key(b)) || a.name.localeCompare(b.name));
}

export function searchVisitors(visitors: FrontDeskVisitor[], query: string): FrontDeskVisitor[] {
  const q = query.trim().toLowerCase();
  if (!q) return visitors;
  return visitors.filter(v => [v.name, v.company, v.reason, v.hostName, v.badgeNo]
    .some(value => value?.toLowerCase().includes(q)));
}

/** Shared by visitors who arrive together (the paper sheet's "same as above"). */
export const newGroupRef = () => `G-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ─── Photos ─────────────────────────────────────────────────────────────────

/** `YYYY/MM` folder and a unique `⟨visitorId⟩-⟨timestamp⟩.⟨ext⟩` name, so uploads never overwrite each other. */
export function photoPath(visitorId: string, originalName: string, now = new Date()): { folder: string; fileName: string } {
  const key = pngDateKey(now);
  const ext = (originalName.match(/\.([a-z0-9]{1,5})$/i)?.[1] || 'jpg').toLowerCase();
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14);
  return { folder: `${key.slice(0, 4)}/${key.slice(5, 7)}`, fileName: `${visitorId}-${stamp}.${ext}` };
}
