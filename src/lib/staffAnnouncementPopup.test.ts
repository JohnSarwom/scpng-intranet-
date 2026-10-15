import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IAnnouncement } from '@/types';
import { dismissStaffNotices, getUnseenStaffAnnouncements, readDismissedStaffNotices } from './staffAnnouncementPopup';

const now = new Date('2026-10-15T00:00:00Z');
const notice = (id: string, overrides: Partial<IAnnouncement> = {}): IAnnouncement => ({
  id, title: 'Staff announcement', content: 'Office update', source: 'manual',
  category: 'Announcement', isPinned: false, createdDate: new Date('2026-10-14T00:00:00Z'), ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

describe('home screen all-staff announcement eligibility', () => {
  it('never promotes restricted email, ambiguous sources, or other audiences', () => {
    const items = [notice('public'), notice('explicit', { audience: 'All Staff' }),
      notice('officers', { audience: 'All Officers' }), notice('unknown', { source: undefined }),
      notice('email', { source: 'email', audience: 'All Staff' }),
      notice('both', { source: 'email', audience: 'Both groups' })];
    expect(getUnseenStaffAnnouncements(items, new Set(), now).map(item => item.id)).toEqual(['public', 'explicit']);
  });

  it('excludes dismissed, expired, future, invalid and non-announcement entries', () => {
    const items = [notice('seen'), notice('expired', { expiryDate: now }),
      notice('future', { createdDate: new Date('2026-10-16') }), notice('invalid', { createdDate: new Date('invalid') }),
      notice('invalid-expiry', { expiryDate: new Date('invalid') }), notice('event', { category: 'Event' }),
      notice('empty', { title: ' ' }), notice('missing-body', { content: undefined }), notice('valid')];
    expect(getUnseenStaffAnnouncements(items, new Set(['seen']), now).map(item => item.id)).toEqual(['valid']);
  });

  it('suppresses service alerts and puts the newest qualifying notice first', () => {
    const items = [notice('old'), notice('digest', { sourceEmail: ' PowerAutomateNoReply@Microsoft.com ' }),
      notice('throttled', { title: 'Alert: Your operation has been throttled.' }),
      notice('new', { createdDate: new Date('2026-10-14T12:00:00Z') })];
    expect(getUnseenStaffAnnouncements(items, new Set(), now).map(item => item.id)).toEqual(['new', 'old']);
  });
});

describe('per-user notice dismissals', () => {
  it('keeps dismissals separate across accounts and stores only IDs', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) });
    dismissStaffNotices('account-one', ['17']);
    expect([...readDismissedStaffNotices('account-one')]).toEqual(['17']);
    expect([...readDismissedStaffNotices('account-two')]).toEqual([]);
    expect([...values.values()]).toEqual(['["17"]']);
  });

  it('tolerates malformed storage and retains session dismissals when storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{bad json', setItem: () => { throw new Error('blocked'); } });
    expect([...readDismissedStaffNotices('blocked-account')]).toEqual([]);
    dismissStaffNotices('blocked-account', ['18']);
    expect([...readDismissedStaffNotices('blocked-account')]).toEqual(['18']);
  });
});
