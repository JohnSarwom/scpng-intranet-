import { describe, expect, it } from 'vitest';
import { formatReportedAt, initialsFor, reportedWithin, toAssignee } from './inquiryOptions';

describe('inquiry options', () => {
  it('builds assignees from staff with initials', () => {
    expect(toAssignee({ name: 'Mary  Kila Tau', email: 'mtau@scpng.gov.pg' }))
      .toEqual({ name: 'Mary  Kila Tau', email: 'mtau@scpng.gov.pg', initials: 'MK' });
    expect(initialsFor('Moses')).toBe('M');
  });

  it('formats ISO report times and leaves anything else as stored', () => {
    expect(formatReportedAt(new Date(2026, 9, 21, 10, 15).toISOString())).toBe('21 Oct 2026, 10:15 AM');
    expect(formatReportedAt('10:15 AM')).toBe('10:15 AM');
  });

  it('filters by an inclusive date range, treating a start-only range as one day', () => {
    const at = new Date(2026, 9, 21, 16, 45).toISOString();
    expect(reportedWithin(at, undefined)).toBe(true);
    expect(reportedWithin(at, { from: new Date(2026, 9, 21), to: new Date(2026, 9, 21) })).toBe(true);
    expect(reportedWithin(at, { from: new Date(2026, 9, 21), to: undefined })).toBe(true);
    expect(reportedWithin(at, { from: new Date(2026, 9, 22), to: new Date(2026, 9, 30) })).toBe(false);
    expect(reportedWithin('10:15 AM', { from: new Date(2026, 9, 21), to: undefined })).toBe(false);
  });
});
