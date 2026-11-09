import { describe, expect, it } from 'vitest';
import { formatPngDateTime, shiftMonthKey } from './pngTime';

describe('pngTime', () => {
  it('steps to the first day of the next or previous month, across year ends', () => {
    expect(shiftMonthKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftMonthKey('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('shows an instant as a PNG date and time', () => {
    expect(formatPngDateTime('2026-11-09T22:30:00.000Z')).toBe('10 Nov 2026, 8:30 am');
    expect(formatPngDateTime(undefined)).toBe('');
  });
});
