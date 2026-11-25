import { describe, expect, it } from 'vitest';
import { validateChristmasResponse } from './validation';
import type { ChristmasResponse } from './christmasEventService';

const base: ChristmasResponse = {
  fullName: 'Test Staff',
  email: 'test@example.org',
  divisionUnit: 'Corporate Services Division / IT Unit',
  attendance: 'Attending',
  arrangement: 'Remaining in Port Moresby',
  destination: '',
  startDate: '',
  endDate: '',
  comments: '',
};

const fields = (r: ChristmasResponse) => validateChristmasResponse(r).map((p) => p.field);

describe('validateChristmasResponse', () => {
  it('accepts a complete answer for someone staying in Port Moresby', () => {
    expect(fields(base)).toEqual([]);
  });

  it('flags every required item on an empty form, in form order', () => {
    expect(fields({ ...base, fullName: ' ', divisionUnit: '', attendance: '', arrangement: '' })).toEqual([
      'fullName',
      'divisionUnit',
      'attendance',
      'arrangement',
    ]);
  });

  it('needs destination and both dates when travelling', () => {
    expect(fields({ ...base, arrangement: 'Taking leave and travelling' })).toEqual([
      'destination',
      'startDate',
      'endDate',
    ]);
  });

  it('needs dates but not a destination for leave within Port Moresby', () => {
    expect(fields({ ...base, arrangement: 'Taking leave within Port Moresby' })).toEqual(['startDate', 'endDate']);
  });

  it('rejects an end date before the start date', () => {
    expect(
      fields({
        ...base,
        arrangement: 'Taking leave within Port Moresby',
        startDate: '2026-12-24',
        endDate: '2026-12-20',
      }),
    ).toEqual(['endDate']);
  });
});
