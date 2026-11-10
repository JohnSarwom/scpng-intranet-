import { describe, expect, it } from 'vitest';
import {
  collectionErrors,
  daysWaiting,
  isOverdue,
  mailFields,
  mailStatusFields,
  mapMailItem,
  mergeRegister,
  OUTSTANDING_STATUSES,
  periodRange,
  searchMail,
  validateMailInput,
  type FrontDeskMailItem,
  type MailInput,
} from './mailRules';

const item = (over: Partial<FrontDeskMailItem> = {}): FrontDeskMailItem => ({
  id: '1', itemType: 'Package', title: 'Box', recipientName: 'Mary K', receivedAt: '2026-11-09T23:00:00.000Z', status: 'Received', ...over,
});
const input = (over: Partial<MailInput> = {}): MailInput => ({
  itemType: 'Mail', title: 'Letter', recipientName: 'Mary K', receivedAt: '2026-11-09T23:00:00.000Z', status: 'Received', ...over,
});

describe('periods', () => {
  it('turns a period into PNG days and a UTC range on the indexed ReceivedAt', () => {
    expect(periodRange('today', '2026-11-10')).toEqual({
      from: '2026-11-10', to: '2026-11-10', start: '2026-11-09T14:00:00.000Z', end: '2026-11-10T14:00:00.000Z',
    });
    expect(periodRange('last-7-days', '2026-11-10')).toMatchObject({ from: '2026-11-04', to: '2026-11-10' });
    expect(periodRange('last-30-days', '2026-11-10')).toMatchObject({ from: '2026-10-12', to: '2026-11-10' });
  });

  it('accepts a custom range in either order', () => {
    expect(periodRange('custom', '2026-11-10', { from: '2026-11-05', to: '2026-11-01' })).toMatchObject({ from: '2026-11-01', to: '2026-11-05' });
  });

  it('only shows outstanding statuses as waiting', () => {
    expect(OUTSTANDING_STATUSES).toEqual(['Received', 'Pending Pickup', 'Signature Required']);
  });
});

describe('mapMailItem', () => {
  it('maps fields, lower-cases the recipient email and falls back on unknown values', () => {
    expect(mapMailItem({
      id: '4', eTag: '"e,1"',
      fields: { Title: ' Parcel ', ItemType: 'Package', RecipientName: 'Mary K', RecipientEmail: 'Mary@SCPNG.gov.pg', ReceivedAt: '2026-11-09T23:00:00Z', Status: 'Delivered', CollectedBy: 'Mary K', CollectedAt: '2026-11-10T01:00:00Z' },
    })).toMatchObject({
      id: '4', eTag: '"e,1"', title: 'Parcel', itemType: 'Package', recipientEmail: 'mary@scpng.gov.pg',
      status: 'Delivered', collectedBy: 'Mary K', collectedAt: '2026-11-10T01:00:00.000Z',
    });
    expect(mapMailItem({ id: '5', fields: { ItemType: 'Crate', Status: 'Lost' } })).toMatchObject({ itemType: 'Mail', status: 'Received', recipientName: '' });
  });
});

describe('mailFields', () => {
  it('leaves empty fields out of new items', () => {
    expect(mailFields(input({ sender: ' ', recipientEmail: 'Mary@SCPNG.gov.pg' }))).toEqual({
      Title: 'Letter', ItemType: 'Mail', RecipientName: 'Mary K', ReceivedAt: '2026-11-09T23:00:00.000Z', Status: 'Received',
      RecipientEmail: 'mary@scpng.gov.pg',
    });
  });

  it('clears emptied fields and the collection record on edits of uncollected items', () => {
    expect(mailFields(input(), { forUpdate: true })).toMatchObject({ Sender: null, Notes: null, CollectedBy: null, CollectedAt: null });
  });

  it('writes the collection record for collected items', () => {
    expect(mailFields(input({ status: 'Delivered', collectedBy: 'Mary K', collectedAt: '2026-11-10T01:00:00.000Z' })))
      .toMatchObject({ CollectedBy: 'Mary K', CollectedAt: '2026-11-10T01:00:00.000Z' });
  });
});

describe('validation', () => {
  it('needs a title, a recipient and a past received time', () => {
    const now = '2026-11-10T02:00:00.000Z';
    expect(validateMailInput(input(), now)).toEqual({});
    expect(validateMailInput(input({ title: '', recipientName: ' ', receivedAt: '' }), now)).toEqual({
      title: 'Enter the subject.', recipientName: expect.any(String), receivedAt: expect.any(String),
    });
    expect(validateMailInput(input({ receivedAt: '2026-11-10T05:00:00.000Z' }), '2026-11-10T01:00:00.000Z').receivedAt).toContain('future');
  });

  it('needs who collected it and when, no earlier than it arrived', () => {
    expect(collectionErrors('2026-11-10T01:00:00.000Z', '', '')).toEqual({ collectedBy: expect.any(String), collectedAt: expect.any(String) });
    expect(collectionErrors('2026-11-10T01:00:00.000Z', 'Mary', '2026-11-10T00:59:00.000Z').collectedAt).toContain('before it arrived');
    expect(collectionErrors('2026-11-10T01:00:00.000Z', 'Mary', '2026-11-10T01:00:00.000Z')).toEqual({});
  });
});

describe('mailStatusFields', () => {
  it('records the collection when an item is collected and clears it when it goes back', () => {
    expect(mailStatusFields(item(), 'Delivered', { collectedBy: ' Mary K ', collectedAt: '2026-11-10T01:00:00.000Z' }))
      .toEqual({ Status: 'Delivered', CollectedBy: 'Mary K', CollectedAt: '2026-11-10T01:00:00.000Z' });
    expect(mailStatusFields(item({ status: 'Delivered' }), 'Pending Pickup')).toEqual({ Status: 'Pending Pickup', CollectedBy: null, CollectedAt: null });
    expect(mailStatusFields(item(), 'Signature Required')).toEqual({ Status: 'Signature Required' });
  });

  it('refuses a collection without a name', () => {
    expect(() => mailStatusFields(item(), 'Delivered', { collectedBy: '', collectedAt: '2026-11-10T01:00:00.000Z' })).toThrow('who collected');
  });
});

describe('the register', () => {
  it('merges the period with older outstanding items, newest first, each once', () => {
    const old = item({ id: 'old', receivedAt: '2026-10-01T00:00:00.000Z' });
    const recent = item({ id: 'recent', receivedAt: '2026-11-10T00:00:00.000Z' });
    expect(mergeRegister([recent], [old, recent]).map(i => i.id)).toEqual(['recent', 'old']);
  });

  it('flags items still waiting from an earlier day and counts the days', () => {
    expect(isOverdue(item({ receivedAt: '2026-11-08T23:00:00.000Z' }), '2026-11-10')).toBe(true);
    expect(isOverdue(item({ receivedAt: '2026-11-09T23:00:00.000Z' }), '2026-11-10')).toBe(false);
    expect(isOverdue(item({ receivedAt: '2026-11-08T23:00:00.000Z', status: 'Delivered' }), '2026-11-10')).toBe(false);
    expect(daysWaiting(item({ receivedAt: '2026-11-07T01:00:00.000Z' }), '2026-11-10T02:00:00.000Z')).toBe(3);
  });

  it('searches title, sender, tracking, recipient, unit and collector', () => {
    const list = [item({ id: '1', tracking: 'PX123' }), item({ id: '2', recipientUnit: 'Legal', collectedBy: 'John' })];
    expect(searchMail(list, 'px1').map(i => i.id)).toEqual(['1']);
    expect(searchMail(list, 'legal').map(i => i.id)).toEqual(['2']);
    expect(searchMail(list, 'john').map(i => i.id)).toEqual(['2']);
  });
});
