/**
 * Papua New Guinea public holidays.
 *
 * Annual gazetted dates take precedence over the recurring fallback calendar.
 * Keep the annual list current when DPM publishes the next year's circular.
 */

export interface PNGPublicHoliday {
  date: string;
  label: string;
}

const PNG_TIME_ZONE = 'Pacific/Port_Moresby';

/** Official 2026 dates: DPM Circular Instruction No. 12 of 2025, as corrected
 * by Circular Instruction No. 13 of 2026 for the King's Birthday date. */
const GAZETTED_HOLIDAYS: Record<number, PNGPublicHoliday[]> = {
  2026: [
    { date: '2026-01-01', label: "New Year's Day" },
    { date: '2026-02-26', label: 'Sir Michael Somare Remembrance Day' },
    { date: '2026-04-03', label: 'Good Friday' },
    { date: '2026-04-04', label: 'Easter Saturday' },
    { date: '2026-04-05', label: 'Easter Sunday' },
    { date: '2026-04-06', label: 'Easter Monday' },
    { date: '2026-06-17', label: "King's Birthday" },
    { date: '2026-07-23', label: 'National Remembrance Day' },
    { date: '2026-08-26', label: 'National Repentance Day' },
    { date: '2026-09-16', label: 'Independence Day' },
    { date: '2026-12-25', label: 'Christmas Day' },
    { date: '2026-12-26', label: 'Boxing Day' },
  ],
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateToLocalKey(date: Date): string {
  return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Return the calendar date in Papua New Guinea for an instant in time. */
export function getPNGDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PNG_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

// Anonymous Gregorian algorithm.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + (nth - 1) * 7);
}

/**
 * Recurring fallback for years without a captured annual DPM circular.
 * The King's Birthday fallback uses the second Monday of June; annual
 * declarations should replace it as soon as they are published.
 */
function buildRecurringHolidayCalendar(year: number): PNGPublicHoliday[] {
  const easter = easterSunday(year);
  const dates: Array<{ date: Date; label: string }> = [
    { date: new Date(year, 0, 1), label: "New Year's Day" },
    { date: addDays(easter, -2), label: 'Good Friday' },
    { date: addDays(easter, -1), label: 'Easter Saturday' },
    { date: easter, label: 'Easter Sunday' },
    { date: addDays(easter, 1), label: 'Easter Monday' },
    { date: nthWeekdayOfMonth(year, 6, 1, 2), label: "King's Birthday" },
    { date: new Date(year, 6, 23), label: 'National Remembrance Day' },
    { date: new Date(year, 7, 26), label: 'National Repentance Day' },
    { date: new Date(year, 8, 16), label: 'Independence Day' },
    { date: new Date(year, 11, 25), label: 'Christmas Day' },
    { date: new Date(year, 11, 26), label: 'Boxing Day' },
  ];

  return dates
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map(({ date, label }) => ({ date: dateToLocalKey(date), label }));
}

export function listPNGPublicHolidays(year: number): PNGPublicHoliday[] {
  const holidays = GAZETTED_HOLIDAYS[year] ?? buildRecurringHolidayCalendar(year);
  return holidays.map((holiday) => ({ ...holiday }));
}

export function getPNGPublicHolidays(year: number): Date[] {
  return listPNGPublicHolidays(year).map((holiday) => dateFromKey(holiday.date));
}

const holidayCache = new Map<number, Set<string>>();

function getHolidaySet(year: number): Set<string> {
  if (!holidayCache.has(year)) {
    holidayCache.set(year, new Set(listPNGPublicHolidays(year).map((holiday) => holiday.date)));
  }
  return holidayCache.get(year)!;
}

function isHoliday(date: Date): boolean {
  return getHolidaySet(date.getFullYear()).has(dateToLocalKey(date));
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Count business days inclusively, excluding weekends and PNG holidays. */
export function countBusinessDays(start: Date, end: Date): number {
  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);

  while (cursor <= finish) {
    if (!isWeekend(cursor) && !isHoliday(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

export { isHoliday as isPNGPublicHoliday };
