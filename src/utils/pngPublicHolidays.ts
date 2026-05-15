/**
 * Papua New Guinea Public Holidays
 *
 * Static holidays are fixed to a calendar date each year.
 * Moveable holidays (Easter group, Repentance Day, King's Birthday) are
 * computed dynamically per year.
 *
 * Sources: PNG Public Holidays Act (Chapter 321) and annual gazetted dates.
 */

// ---------------------------------------------------------------------------
// Easter calculation (Anonymous Gregorian algorithm)
// ---------------------------------------------------------------------------
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** nth occurrence of a given weekday (0=Sun…6=Sat) in a month */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + (nth - 1) * 7);
}

// ---------------------------------------------------------------------------
// Public holiday list for a given year
// ---------------------------------------------------------------------------
export function getPNGPublicHolidays(year: number): Date[] {
  const easter = easterSunday(year);

  const holidays: Date[] = [
    // Fixed
    new Date(year, 0, 1),    // New Year's Day — 1 Jan
    new Date(year, 6, 23),   // Remembrance Day — 23 Jul
    new Date(year, 8, 16),   // Independence Day — 16 Sep
    new Date(year, 11, 25),  // Christmas Day — 25 Dec
    new Date(year, 11, 26),  // Boxing Day — 26 Dec

    // Easter group (moveable)
    addDays(easter, -2),     // Good Friday
    addDays(easter, -1),     // Holy Saturday
    addDays(easter, 1),      // Easter Monday

    // King's/Queen's Birthday — 2nd Monday of June
    nthWeekdayOfMonth(year, 6, 1, 2),

    // Repentance Day — 3rd Sunday of August (observed Monday when falls on Sunday)
    // Gazetted as a Monday public holiday
    nthWeekdayOfMonth(year, 8, 1, 3),
  ];

  // When a fixed holiday falls on a Sunday, the following Monday is observed
  const withSubstitutes: Date[] = [];
  for (const h of holidays) {
    withSubstitutes.push(h);
    if (h.getDay() === 0) {
      // Substitute Monday
      withSubstitutes.push(addDays(h, 1));
    }
  }

  return withSubstitutes;
}

// ---------------------------------------------------------------------------
// Holiday lookup set (ISO date strings for O(1) lookup)
// ---------------------------------------------------------------------------
const holidayCache = new Map<number, Set<string>>();

function getHolidaySet(year: number): Set<string> {
  if (!holidayCache.has(year)) {
    const set = new Set(
      getPNGPublicHolidays(year).map(d => d.toISOString().split('T')[0])
    );
    holidayCache.set(year, set);
  }
  return holidayCache.get(year)!;
}

function isHoliday(date: Date): boolean {
  const iso = date.toISOString().split('T')[0];
  return getHolidaySet(date.getFullYear()).has(iso);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Count business days between two dates (inclusive of both endpoints),
 * excluding weekends and PNG public holidays.
 *
 * Drop-in replacement for date-fns `differenceInBusinessDays(end, start) + 1`.
 */
export function countBusinessDays(start: Date, end: Date): number {
  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);

  while (cursor <= finish) {
    if (!isWeekend(cursor) && !isHoliday(cursor)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/**
 * Returns true if a given date is a PNG public holiday.
 */
export { isHoliday as isPNGPublicHoliday };

/**
 * Human-readable list of PNG public holidays for a given year,
 * sorted chronologically. Useful for displaying a holiday calendar.
 */
export function listPNGPublicHolidays(year: number): { date: string; label: string }[] {
  const easter = easterSunday(year);

  const named: { date: Date; label: string }[] = [
    { date: new Date(year, 0, 1),       label: "New Year's Day" },
    { date: addDays(easter, -2),        label: 'Good Friday' },
    { date: addDays(easter, -1),        label: 'Holy Saturday' },
    { date: addDays(easter, 1),         label: 'Easter Monday' },
    { date: nthWeekdayOfMonth(year, 6, 1, 2), label: "King's Birthday" },
    { date: new Date(year, 6, 23),      label: 'Remembrance Day' },
    { date: nthWeekdayOfMonth(year, 8, 1, 3), label: 'Repentance Day' },
    { date: new Date(year, 8, 16),      label: 'Independence Day' },
    { date: new Date(year, 11, 25),     label: 'Christmas Day' },
    { date: new Date(year, 11, 26),     label: 'Boxing Day' },
  ];

  return named
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ date, label }) => ({
      date: date.toISOString().split('T')[0],
      label,
    }));
}
