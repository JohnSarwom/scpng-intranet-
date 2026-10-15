import { describe, expect, it, vi } from 'vitest';
import { AnnouncementsSharePointService } from './announcementsSharePointService';

describe('manual notice pagination', () => {
  it('includes a new announcement on a later page and suppresses service alerts', async () => {
    const row = (id: string, date: string, sender?: string) => ({ id, fields: {
      Title: 'Staff notice', Content: 'Message', Category: 'Announcement',
      Created: date, IsPinned: false, SourceEmail: sender,
    } });
    const get = vi.fn()
      .mockResolvedValueOnce({ id: 'site' })
      .mockResolvedValueOnce({ value: [{ id: 'announcements' }] })
      .mockResolvedValueOnce({ value: [row('1', '2026-10-01')], '@odata.nextLink': '/notice-next-page' })
      .mockResolvedValueOnce({ value: [row('101', '2026-10-15'), row('102', '2026-10-15', 'PowerAutomateNoReply@microsoft.com')] });
    const api = { get, filter: vi.fn(), expand: vi.fn(), top: vi.fn() };
    api.filter.mockReturnValue(api); api.expand.mockReturnValue(api); api.top.mockReturnValue(api);
    const client = { api: vi.fn(() => api) };
    const service = new AnnouncementsSharePointService(client as never);
    expect((await service.getAnnouncements()).map(item => item.id)).toEqual(['101', '1']);
    expect(client.api).toHaveBeenCalledWith('/notice-next-page');
  });
});
