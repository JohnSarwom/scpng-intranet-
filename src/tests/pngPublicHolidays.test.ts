import { describe, expect, it } from 'vitest';
import {
  countBusinessDays,
  getPNGPublicHolidays,
  isPNGPublicHoliday,
  listPNGPublicHolidays,
} from '@/utils/pngPublicHolidays';

describe('PNG public holidays', () => {
  it('returns all 12 gazetted national holidays for 2026', () => {
    expect(listPNGPublicHolidays(2026)).toEqual([
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
    ]);
  });

  it('keeps Date conversion on the intended local calendar day', () => {
    const dates = getPNGPublicHolidays(2026);
    expect(dates[0].getFullYear()).toBe(2026);
    expect(dates[0].getMonth()).toBe(0);
    expect(dates[0].getDate()).toBe(1);
  });

  it('recognizes gazetted weekday holidays in business-day calculations', () => {
    expect(isPNGPublicHoliday(new Date(2026, 6, 23))).toBe(true);
    expect(countBusinessDays(new Date(2026, 6, 20), new Date(2026, 6, 24))).toBe(4);
  });
});
