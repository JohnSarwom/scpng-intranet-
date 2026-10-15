import { describe, expect, it, vi } from 'vitest';
import { IAnnouncement } from '@/types';
import { EmailAnnouncementsSharePointService, mergeEmailAnnouncements } from './emailAnnouncementsSharePointService';

const notice = (id: string, audience: IAnnouncement['audience']): IAnnouncement => ({
  id,
  title: 'Office update',
  content: '<p>Meeting at 10</p>',
  category: 'Announcement',
  isPinned: false,
  createdDate: new Date('2026-10-05T00:00:00Z'),
  source: 'email',
  audience,
  internetMessageId: '<notice@example.com>',
});

describe('email notice handling', () => {
  it('shows one item to a member of both groups', () => {
    expect(mergeEmailAnnouncements([
      notice('staff:1', 'All Staff'),
      notice('officers:2', 'All Officers'),
    ])).toMatchObject([{ audience: 'Both groups', internetMessageId: '<notice@example.com>' }]);
  });

  it('keeps distinct case-sensitive message IDs separate', () => {
    const first = notice('staff:1', 'All Staff');
    const second = { ...notice('staff:2', 'All Staff'), internetMessageId: '<Notice@example.com>' };

    expect(mergeEmailAnnouncements([first, second])).toHaveLength(2);
  });

  it('reads only lists returned as accessible by SharePoint', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ id: 'site' })
      .mockResolvedValueOnce({ value: [{ id: 'staff-list', displayName: 'EmailAnnouncements_AllStaff' }] })
      .mockResolvedValueOnce({ value: [{
        id: '1',
        fields: {
          Title: 'Office update', Content: '<p>Meeting at 10</p>',
          SourceEmail: 'sender@scpng.gov.pg', InternetMessageId: '<notice@example.com>',
          ReceivedDate: '2026-10-05T00:00:00Z',
        },
      }] });
    const api = vi.fn(() => ({ get, expand: () => ({ top: () => ({ get }) }) }));
    const service = new EmailAnnouncementsSharePointService({ api } as never);

    const result = await service.getAnnouncements();

    expect(result).toHaveLength(1);
    expect(result[0].audience).toBe('All Staff');
    expect(api).not.toHaveBeenCalledWith('/sites/site/lists/EmailAnnouncements_AllOfficers/items');
  });
});
