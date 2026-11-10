import { describe, expect, it } from 'vitest';
import {
  formatPngTime,
  isCarriedOver,
  isoToPngTime,
  logRows,
  mapVisitor,
  photoPath,
  pngDateKey,
  pngDayRange,
  pngTimeToIso,
  searchVisitors,
  shiftDateKey,
  signOutError,
  sortForLog,
  statusChange,
  validateVisitorInput,
  visitDuration,
  visitorFields,
  type FrontDeskVisitor,
} from './visitorRules';

const visitor = (over: Partial<FrontDeskVisitor> = {}): FrontDeskVisitor => ({
  id: '1', name: 'A Visitor', company: 'Company A', reason: 'Meeting', visitDate: '2026-10-26', status: 'Expected', ...over,
});

describe('PNG dates and times', () => {
  it('turns a PNG day into a UTC range that starts at PNG midnight', () => {
    expect(pngDayRange('2026-10-26')).toEqual({ start: '2026-10-25T14:00:00.000Z', end: '2026-10-26T14:00:00.000Z' });
  });

  it('steps a date key across month and year ends', () => {
    expect(shiftDateKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('reads both ways SharePoint can return a date-only value as the same PNG day', () => {
    expect(pngDateKey('2026-10-25T14:00:00Z')).toBe('2026-10-26');
    expect(pngDateKey('2026-10-26T00:00:00Z')).toBe('2026-10-26');
  });

  it('converts PNG clock times to instants and back', () => {
    const iso = pngTimeToIso('2026-10-26', '09:05');
    expect(iso).toBe('2026-10-25T23:05:00.000Z');
    expect(isoToPngTime(iso)).toBe('09:05');
    expect(formatPngTime(iso)).toBe('9:05 am');
    expect(() => pngTimeToIso('2026-10-26', '9am')).toThrow();
  });

  it('calculates the visit length from Time In and Time Out, counting open visits up to now', () => {
    expect(visitDuration('2026-10-26T00:00:00Z', '2026-10-26T01:05:00Z')).toBe('1h 05m');
    expect(visitDuration('2026-10-26T00:00:00Z', undefined, '2026-10-26T00:45:00Z')).toBe('45m');
    expect(visitDuration(undefined, undefined)).toBe('');
  });
});

describe('mapVisitor', () => {
  it('maps SharePoint fields, trims names and lower-cases the host email', () => {
    const mapped = mapVisitor({
      id: '7', eTag: '"x,1"',
      fields: {
        Title: '  Mary   K ', Company: 'Firm', Reason: 'Delivery', VisitDate: '2026-10-25T14:00:00Z', Status: 'On Site',
        TimeIn: '2026-10-25T23:05:00Z', HostEmail: 'Host@SCPNG.gov.pg', HostName: 'Host Name',
      },
    });
    expect(mapped).toMatchObject({
      id: '7', eTag: '"x,1"', name: 'Mary K', company: 'Firm', reason: 'Delivery', visitDate: '2026-10-26',
      status: 'On Site', timeIn: '2026-10-25T23:05:00.000Z', hostEmail: 'host@scpng.gov.pg', hostName: 'Host Name',
    });
  });

  it('tolerates missing optional fields and an unknown status', () => {
    expect(mapVisitor({ id: '8', fields: { Title: 'B', Status: 'checked-in' } })).toMatchObject({
      name: 'B', company: '', reason: '', visitDate: '', status: 'Expected', timeIn: undefined, hostEmail: undefined,
    });
  });
});

describe('visitorFields', () => {
  const input = { name: ' Mary  K ', reason: 'Delivery', visitDate: '2026-10-26', company: '', hostEmail: 'Host@scpng.gov.pg' };

  it('leaves empty fields out of new items and writes the date-only value at midnight UTC', () => {
    expect(visitorFields(input)).toEqual({
      Title: 'Mary K', VisitDate: '2026-10-26T00:00:00Z', Reason: 'Delivery', HostEmail: 'host@scpng.gov.pg',
    });
  });

  it('clears emptied fields on edits', () => {
    expect(visitorFields(input, { forUpdate: true })).toMatchObject({ Company: null, Phone: null, Reason: 'Delivery' });
  });
});

describe('validation', () => {
  it('requires only a name and a reason, so a first name and an initial is enough', () => {
    expect(validateVisitorInput({ name: 'Mary K', reason: 'Delivery', visitDate: '2026-10-26' })).toEqual({});
    expect(validateVisitorInput({ name: ' ', reason: '', visitDate: '' })).toEqual({
      name: expect.any(String), reason: expect.any(String), visitDate: expect.any(String),
    });
  });

  it('refuses a Time Out earlier than Time In', () => {
    expect(signOutError('2026-10-26T01:00:00Z', '2026-10-26T00:59:00Z')).toContain('cannot be earlier');
    expect(signOutError('2026-10-26T01:00:00Z', '2026-10-26T01:00:00Z')).toBeUndefined();
    expect(signOutError(undefined, '2026-10-26T01:00:00Z')).toContain('without a time in');
  });
});

describe('statusChange', () => {
  const now = '2026-10-26T02:00:00.000Z';

  it('signs an expected visitor in without touching their expected time', () => {
    const v = visitor({ expectedStart: '2026-10-26T00:00:00.000Z' });
    expect(statusChange(v, 'On Site', now, 'r@scpng.gov.pg')).toEqual({
      fields: { Status: 'On Site', TimeIn: now },
      next: { ...v, status: 'On Site', timeIn: now },
    });
  });

  it('signs a visitor out with the time and who did it', () => {
    const v = visitor({ status: 'On Site', timeIn: '2026-10-26T01:00:00.000Z' });
    expect(statusChange(v, 'Signed Out', now, 'r@scpng.gov.pg').fields)
      .toEqual({ Status: 'Signed Out', TimeOut: now, SignedOutByEmail: 'r@scpng.gov.pg' });
  });

  it('undoes a sign-out and returns an on-site visitor to expected', () => {
    const out = visitor({ status: 'Signed Out', timeIn: '2026-10-26T01:00:00.000Z', timeOut: now, signedOutByEmail: 'r@x' });
    expect(statusChange(out, 'On Site', now, '').fields).toEqual({ Status: 'On Site', TimeOut: null, SignedOutByEmail: null });
    const onSite = visitor({ status: 'On Site', timeIn: now });
    expect(statusChange(onSite, 'Expected', now, '').fields).toEqual({ Status: 'Expected', TimeIn: null });
  });

  it('refuses changes that make no sense', () => {
    expect(() => statusChange(visitor(), 'Signed Out', now, '')).toThrow('Sign the visitor in');
    expect(() => statusChange(visitor({ status: 'On Site', timeIn: now }), 'No Show', now, '')).toThrow('no-show');
    expect(() => statusChange(visitor({ status: 'Signed Out', timeIn: now, timeOut: now }), 'Expected', now, '')).toThrow();
    expect(() => statusChange(visitor({ status: 'On Site', timeIn: '2026-10-26T03:00:00.000Z' }), 'Signed Out', now, ''))
      .toThrow('cannot be earlier');
  });

  it('does nothing when the status is unchanged', () => {
    expect(statusChange(visitor(), 'Expected', now, '').fields).toEqual({});
  });
});

describe('the log', () => {
  const today = '2026-10-26';
  const carried = visitor({ id: 'old', status: 'On Site', visitDate: '2026-10-24', timeIn: '2026-10-23T23:00:00.000Z' });

  it('adds visitors still on site from earlier days to today’s log, flagged', () => {
    const day = [visitor({ id: 'b', status: 'On Site', timeIn: '2026-10-25T23:30:00.000Z' }), visitor({ id: 'a', expectedStart: '2026-10-26T01:00:00.000Z' })];
    expect(logRows(day, [carried, day[0]], today, today).map(v => v.id)).toEqual(['old', 'b', 'a']);
    expect(logRows(day, [carried], '2026-10-25', today).map(v => v.id)).toEqual(['b', 'a']);
    expect(isCarriedOver(carried, today)).toBe(true);
    expect(isCarriedOver(day[0], today)).toBe(false);
  });

  it('puts visitors with no time after everyone with one', () => {
    const noTime = visitor({ id: 'none', status: 'No Show' });
    const early = visitor({ id: 'early', status: 'On Site', timeIn: '2026-10-25T22:00:00.000Z' });
    expect(sortForLog([noTime, early]).map(v => v.id)).toEqual(['early', 'none']);
  });

  it('searches name, company, reason, host and badge', () => {
    const list = [visitor({ id: '1', hostName: 'Grace H' }), visitor({ id: '2', name: 'Other', company: 'X', reason: 'Y', badgeNo: 'B12' })];
    expect(searchVisitors(list, 'grace').map(v => v.id)).toEqual(['1']);
    expect(searchVisitors(list, 'b12').map(v => v.id)).toEqual(['2']);
    expect(searchVisitors(list, '  ')).toHaveLength(2);
  });
});

it('names photos by visitor and time, in a year/month folder, so uploads never collide', () => {
  expect(photoPath('42', 'IMG 0001.JPEG', new Date('2026-10-26T01:02:03Z'))).toEqual({ folder: '2026/10', fileName: '42-20261026010203.jpeg' });
  expect(photoPath('42', 'photo', new Date('2026-10-26T01:02:03Z')).fileName).toBe('42-20261026010203.jpg');
});
