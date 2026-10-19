import { describe, expect, it } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { getAllSlideshows, isVisibleSlideshow, resolveSlideshowImage, safeSlideshowUrl, transformSlideshowItem } from './slideshowSharePointService';

const fields = {
  Title: 'Verified announcement', Description: 'A source-backed summary.', Category: 'Capital Market News',
  ContentKey: 'pngx:123', Status: 'Published', SourceName: 'PNGX', IsActive: true,
  PublishDate: '2026-10-15T00:00:00Z', ReviewedAt: '2026-10-15T00:00:00Z', ReviewedBy: 'Editor',
  LinkURL: { Url: 'https://www.pngx.com.pg/announcement' },
};
const row = (overrides = {}) => ({ id: '1', fields: { ...fields, ...overrides } });
function clientFixture(mode = '') {
  const columns = [...Object.keys(fields), 'ExpiryDate', 'ReviewDueAt', 'LegalStatus'];
  const routes: Record<string, unknown> = {
    '/sites/scpng1.sharepoint.com:/sites/scpngintranet': { id: 'site' },
    '/sites/site/lists?$select=id,displayName': { value: [{ id: 'slides', displayName: 'InformationSlideshows' }] },
    '/sites/site/lists/slides/columns?$select=name,displayName': { value: columns.filter(c => mode !== 'schema' || c !== 'Status').map(name =>
      name === 'Description' ? { name: 'Description0', displayName: 'Description ' } : { name }) },
    '/sites/site/lists/slides/items?$expand=fields&$top=200': { value: [{ id: '1', fields: { ...fields, Description: undefined, Description0: 'Mapped description' } }], '@odata.nextLink': '/page2' },
    '/page2': mode === 'broken' ? {} : mode === 'loop' ? { value: [], '@odata.nextLink': '/page2' } : { value: [
      { id: '2', fields: { ...fields, Description0: fields.Description, ContentKey: 'pngx:456' } }, row({ Status: 'NeedsReview' }), row(),
    ] },
  };
  return { api: (url: string) => ({ get: async () => {
    if (!(url in routes)) throw new Error(`Unexpected request: ${url}`);
    return routes[url];
  } }) } as unknown as Client;
}

describe('published information slides', () => {
  it('normalizes URL fields and preserves an unknown source date', () => {
    const slide = transformSlideshowItem(row());
    expect(slide.linkUrl).toBe('https://www.pngx.com.pg/announcement');
    expect(slide.sourcePublishedAt).toBeUndefined();
    expect(slide.publishDate).toBe(fields.PublishDate);
  });
  it.each([{ Status: 'Draft' }, { IsActive: false }, { ReviewedAt: '' }, { ReviewedBy: '' },
    { PublishDate: '' }, { PublishDate: 'bad' }, { SourceName: '' }, { Category: 'Other' }, { ExpiryDate: 'bad' }, { LinkURL: 'javascript:alert(1)' }])(
    'excludes unapproved or invalid records: %j', override => expect(transformSlideshowItem(row(override))).toBeNull());
  it('hides unreviewed, repealed and overdue legal material', () => {
    expect(transformSlideshowItem(row({ Category: 'Capital Market Acts' }))).toBeNull();
    expect(transformSlideshowItem(row({ Category: 'Capital Market Acts', LegalStatus: 'Repealed', ReviewDueAt: '2027-01-01' }))).toBeNull();
    const slide = transformSlideshowItem(row({ Category: 'Capital Market Acts', LegalStatus: 'Current', ReviewDueAt: '2026-10-16T00:00:00Z' }));
    expect(isVisibleSlideshow(slide, Date.parse('2026-10-17'))).toBe(false);
  });
  it('honours visibility and expiry without changing stored publication dates', () => {
    const slide = transformSlideshowItem(row({ ExpiryDate: '2026-10-18T00:00:00Z' }));
    expect(isVisibleSlideshow(slide, Date.parse('2026-10-14'))).toBe(false);
    expect(isVisibleSlideshow(slide, Date.parse('2026-10-16'))).toBe(true);
    expect(isVisibleSlideshow(slide, Date.parse('2026-10-18'))).toBe(false);
  });
  it('does not use image URLs without a recorded reuse basis', () => {
    expect(transformSlideshowItem(row({ ImageURL: 'https://example.com/image.jpg' })).imageUrl).toBeUndefined();
    expect(transformSlideshowItem(row({ ImageURL: 'https://example.com/image.jpg', ImageRights: 'Owned' })).imageUrl).toBeTruthy();
  });
  it('rejects unsafe, credential-bearing and non-HTTPS URLs', () => {
    for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com', '/relative']) expect(safeSlideshowUrl(url)).toBeUndefined();
  });
  it('resolves protected image identity and validates media before returning a short-lived URL', async () => {
    let route = '';
    const mediaClient = (metadata: unknown) => ({ api: (path: string) => {
      route = path;
      return { get: async () => metadata };
    } }) as unknown as Client;
    await expect(resolveSlideshowImage(mediaClient({ file: { mimeType: 'image/png' }, size: 1200,
      '@microsoft.graph.downloadUrl': 'https://scpng1.sharepoint.com/download?temporary=1' }), 'drive/id', 'item/id')).resolves.toContain('https://scpng1.sharepoint.com/');
    expect(route).toContain('/drives/drive%2Fid/items/item%2Fid?');
    for (const metadata of [{ file: { mimeType: 'text/html' }, size: 20 }, { file: { mimeType: 'image/png' }, size: 6000000 }, { file: { mimeType: 'image/png' } }]) {
      await expect(resolveSlideshowImage(mediaClient(metadata), 'drive', 'item')).rejects.toThrow('Unsupported');
    }
  });
  it('pages results, resolves trimmed column names and deduplicates without drafts', async () => {
    const slides = await getAllSlideshows(clientFixture());
    expect(slides).toHaveLength(2);
    expect(slides.find(s => s.id === '1').description).toBe('Mapped description');
  });
  it.each(['broken', 'loop', 'schema'])('fails closed on %s responses', async mode => {
    await expect(getAllSlideshows(clientFixture(mode))).rejects.toThrow();
  });
});
