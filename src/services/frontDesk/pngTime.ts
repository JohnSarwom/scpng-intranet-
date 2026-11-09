/** Papua New Guinea dates and times for the Front Desk: every list stores UTC, every screen shows PNG time. */
import { getPNGDateKey } from '@/utils/pngPublicHolidays';

export const PNG_TIME_ZONE = 'Pacific/Port_Moresby';
/** Papua New Guinea has no daylight saving, so the offset never changes. */
const PNG_OFFSET = '+10:00';
export const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isDateKey = (value: string) => DATE_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** PNG calendar day of an instant (or of now). */
export const pngDateKey = (value: Date | string = new Date()) => getPNGDateKey(typeof value === 'string' ? new Date(value) : value);

/** The date key `days` before or after another (calendar arithmetic, no time zone involved). */
export function shiftDateKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The PNG day as a half-open UTC range, for filtering an indexed date column. */
export function pngDayRange(dateKey: string): { start: string; end: string } {
  const start = new Date(`${dateKey}T00:00:00${PNG_OFFSET}`);
  return { start: start.toISOString(), end: new Date(start.getTime() + DAY_MS).toISOString() };
}

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

/** "26 Oct 2026, 2:30 pm" in PNG time. */
export const formatPngDateTime = (iso?: string) =>
  (iso ? `${pngParts(iso, { day: 'numeric', month: 'short', year: 'numeric' })}, ${formatPngTime(iso)}` : '');
