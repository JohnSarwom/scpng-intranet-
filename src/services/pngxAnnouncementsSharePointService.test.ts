import { describe, expect, it } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import {
  mapPNGXAnnouncement,
  PNGXAnnouncementsSharePointService,
  safeHttpUrl,
} from './pngxAnnouncementsSharePointService';

describe('PNGX announcements SharePoint reader', () => {
  it('maps optional fields and rejects unsafe or malformed links', () => {
    const item = mapPNGXAnnouncement({
      id: '7',
      fields: {
        Title: '  Filing  ',
        Categories: 'Company Announcements, Trading',
        AnnouncementDate: 'invalid',
        AnnouncementPage: 'javascript:alert(1)',
        DocumentURL: { Url: 'https://www.pngx.com.pg/filing.pdf' },
      },
    }, 'Reviewed_x0020_Summary');

    expect(item).toMatchObject({
      id: '7', title: 'Filing', securityCode: '', companyName: '',
      announcementDate: null, reviewedSummary: '', announcementPage: null,
      documentUrl: 'https://www.pngx.com.pg/filing.pdf',
      categories: ['Company Announcements', 'Trading'],
    });
    expect(safeHttpUrl('data:text/html,hello')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
  });

  it('resolves the summary internal name, follows item pages, and sorts newest first', async () => {
    const calls: string[] = [];
    const responses: Record<string, unknown> = {
      '/sites/scpng1.sharepoint.com:/sites/scpngintranet': { id: 'site' },
      '/sites/site/lists': { value: [{ id: 'list' }] },
      '/sites/site/lists/list/columns': {
        value: [{ name: 'Title', displayName: 'Title' }],
        '@odata.nextLink': '/columns-next',
      },
      '/columns-next': { value: [{ name: 'Reviewed_x0020_Summary', displayName: 'Reviewed Summary' }] },
      '/sites/site/lists/list/items?$expand=fields&$top=200': {
        value: [{ id: 'old', fields: { Title: 'Old', AnnouncementDate: '2026-09-29T00:00:00Z' } }],
        '@odata.nextLink': '/items-next',
      },
      '/items-next': {
        value: [{ id: 'new', fields: {
          Title: 'New', SecurityCode: 'ABC', CompanyName: 'Example Ltd',
          AnnouncementDate: '2026-09-30T00:00:00Z',
          AnnouncementPage: 'https://www.pngx.com.pg/new',
          Reviewed_x0020_Summary: 'Human reviewed description',
        } }],
      },
    };
    const client = {
      api: (url: string) => {
        calls.push(url);
        return {
          filter: () => ({ get: async () => responses[url] }),
          get: async () => responses[url],
        };
      },
    } as unknown as Client;

    const result = await new PNGXAnnouncementsSharePointService(client).getAnnouncements();
    expect(result.map(item => item.id)).toEqual(['new', 'old']);
    expect(result[0].reviewedSummary).toBe('Human reviewed description');
    expect(result[0].companyName).toBe('Example Ltd');
    expect(calls).toContain('/columns-next');
    expect(calls).toContain('/items-next');
  });

  it('reports a missing reviewed summary column instead of silently hiding it', async () => {
    const client = {
      api: (url: string) => ({
        filter: () => ({ get: async () => ({ value: [{ id: 'list' }] }) }),
        get: async () => url.includes('/columns')
          ? { value: [{ name: 'Title', displayName: 'Title' }] }
          : { id: 'site' },
      }),
    } as unknown as Client;
    await expect(new PNGXAnnouncementsSharePointService(client).getAnnouncements())
      .rejects.toThrow('Reviewed Summary column was not found');
  });
});
