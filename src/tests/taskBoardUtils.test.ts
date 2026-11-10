import { describe, it, expect } from 'vitest';
import { formatTaskDateRange } from '../utils/taskBoardUtils';

// Local dates keep these checks independent of the machine's time zone.
const day = (month: number, date: number, hour = 9) => new Date(2026, month - 1, date, hour);

describe('formatTaskDateRange', () => {
  it('shows a single day when the task starts and is due on the same day', () => {
    // Task records carry dueDate as a date-only string ("YYYY-MM-DD").
    expect(formatTaskDateRange(day(4, 13), '2026-04-13')).toBe('Apr 13');
    expect(formatTaskDateRange(day(4, 13, 8), day(4, 13, 17))).toBe('Apr 13');
  });

  it('shows the range when the due date is on a later day', () => {
    expect(formatTaskDateRange(day(8, 18), '2026-08-27')).toBe('Aug 18 - Aug 27');
  });

  it('shows only the start when there is no valid end date', () => {
    expect(formatTaskDateRange(day(4, 13), null)).toBe('Apr 13');
    expect(formatTaskDateRange(day(4, 13), '')).toBe('Apr 13');
    expect(formatTaskDateRange(day(4, 13), 'not a date')).toBe('Apr 13');
  });

  it('returns an empty label without a valid start date', () => {
    expect(formatTaskDateRange(null, '2026-04-13')).toBe('');
    expect(formatTaskDateRange('not a date', '2026-04-13')).toBe('');
  });
});
