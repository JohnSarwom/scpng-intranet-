import type { Client } from '@microsoft/microsoft-graph-client';
import type { SlideshowItem, SlideshowCategory } from '@/types/slideshow.types';

export const SLIDESHOW_SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
export const SLIDESHOW_CATEGORIES: SlideshowCategory[] = ['MS Office 365 Tips', 'Capital Market News', 'Capital Market Acts'];
type Fields = Record<string, unknown>;
interface Column { name: string; displayName?: string }
interface ListItem { id: string; fields: Fields }
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';

export function safeSlideshowUrl(value: unknown): string | undefined {
  const raw = typeof value === 'object' && value !== null ? (value as Fields).Url ?? (value as Fields).url : value;
  try {
    const url = new URL(text(raw));
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Invalid optional URLs are never rendered. */ }
  return undefined;
}

export async function resolveSlideshowImage(client: Client, driveId: string, itemId: string): Promise<string | null> {
  const metadata = await client.api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=file,size,@microsoft.graph.downloadUrl`).get();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(metadata.file?.mimeType) ||
    !Number.isFinite(metadata.size) || metadata.size < 0 || metadata.size > 5 * 1024 * 1024) {
    throw new Error('Unsupported slideshow image.');
  }
  return safeSlideshowUrl(metadata['@microsoft.graph.downloadUrl']) || null;
}

async function pages<T>(client: Client, initial: string): Promise<T[]> {
  const values: T[] = [];
  const seen = new Set<string>();
  let next: string | undefined = initial;
  while (next) {
    if (seen.has(next)) throw new Error('Repeated slideshow pagination link.');
    if (!(next.startsWith('/') && !next.startsWith('//')) && !next.startsWith('https://graph.microsoft.com/v1.0/')) throw new Error('Unexpected slideshow pagination destination.');
    seen.add(next);
    const page = await client.api(next).get();
    if (!page || !Array.isArray(page.value)) throw new Error('Incomplete slideshow response.');
    values.push(...page.value);
    const link = page['@odata.nextLink'];
    if (link !== undefined && (typeof link !== 'string' || !link)) throw new Error('Invalid slideshow pagination link.');
    next = link;
  }
  return values;
}

export function isVisibleSlideshow(item: SlideshowItem, now = Date.now()): boolean {
  const start = Date.parse(item.publishDate);
  const end = item.expiryDate ? Date.parse(item.expiryDate) : Infinity;
  const reviewEnd = item.reviewDueAt ? Date.parse(item.reviewDueAt) : item.category === 'Capital Market Acts' ? NaN : Infinity;
  return item.isActive && Number.isFinite(start) && start <= now && end > now && reviewEnd > now;
}

/** Missing approvals or dates never imply publication; legacy sample rows stay hidden. */
export function transformSlideshowItem(item: ListItem): SlideshowItem | null {
  const f = item.fields;
  if (!f || !item.id || f.IsActive !== true || f.Status !== 'Published' ||
    !SLIDESHOW_CATEGORIES.includes(f.Category as SlideshowCategory) ||
    !text(f.Title) || !text(f.Description) || !text(f.SourceName) || !text(f.ContentKey) ||
    !text(f.ReviewedBy) || !Number.isFinite(Date.parse(text(f.ReviewedAt))) ||
    !Number.isFinite(Date.parse(text(f.PublishDate)))) return null;
  const linkUrl = safeSlideshowUrl(f.CanonicalUrl) || safeSlideshowUrl(f.LinkURL);
  if (!linkUrl || (text(f.ExpiryDate) && !Number.isFinite(Date.parse(text(f.ExpiryDate))))) return null;
  const reviewDueAt = text(f.ReviewDueAt);
  if (reviewDueAt && !Number.isFinite(Date.parse(reviewDueAt))) return null;
  if (f.Category === 'Capital Market Acts' && (f.LegalStatus !== 'Current' || !reviewDueAt)) return null;
  const sourcePublishedAt = text(f.SourcePublishedAt);
  return {
    id: item.id, contentKey: text(f.ContentKey), title: text(f.Title), description: text(f.Description),
    category: f.Category as SlideshowCategory, publishDate: text(f.PublishDate),
    expiryDate: text(f.ExpiryDate) || undefined, isActive: true, linkUrl,
    sourceName: text(f.SourceName), author: text(f.Author0),
    sourcePublishedAt: Number.isFinite(Date.parse(sourcePublishedAt)) ? sourcePublishedAt : undefined,
    reviewedAt: text(f.ReviewedAt), reviewDueAt: reviewDueAt || undefined,
    legalStatus: text(f.LegalStatus), instrumentVersion: text(f.InstrumentVersion),
    effectiveDate: Number.isFinite(Date.parse(text(f.EffectiveDate))) ? text(f.EffectiveDate) : undefined,
    imageUrl: text(f.ImageRights) ? safeSlideshowUrl(f.ImageURL) : undefined,
    imageDriveId: text(f.ImageRights) ? text(f.ImageDriveId) : undefined,
    imageItemId: text(f.ImageRights) ? text(f.ImageItemId) : undefined,
    imageAlt: text(f.ImageAlt), imageCredit: text(f.ImageCredit),
    priority: f.Priority === 'High' ? 'High' : 'Normal', orderIndex: Number(f.OrderIndex) || 0,
  };
}

const REQUIRED = ['Title', 'Description', 'Category', 'PublishDate', 'ExpiryDate', 'IsActive', 'Status',
  'ContentKey', 'SourceName', 'ReviewedBy', 'ReviewedAt', 'ReviewDueAt', 'LegalStatus'];

export class SlideshowSharePointService {
  private base = '';
  private keys: Record<string, string> = {};
  constructor(private client: Client) {}

  async initialize(): Promise<void> {
    const site = await this.client.api(SLIDESHOW_SITE).get();
    if (!site?.id) throw new Error('Slideshow site unavailable.');
    const lists = await pages<{ id: string; displayName: string }>(this.client, `/sites/${site.id}/lists?$select=id,displayName`);
    const matches = lists.filter(list => list.displayName === 'InformationSlideshows');
    if (matches.length !== 1) throw new Error('Published InformationSlideshows list is missing or ambiguous.');
    const base = `/sites/${site.id}/lists/${matches[0].id}`;
    const columns = await pages<Column>(this.client, `${base}/columns?$select=name,displayName`);
    const keys: Record<string, string> = {};
    for (const column of columns) keys[column.name] = column.name;
    for (const label of REQUIRED) {
      const match = columns.filter(c => c.name === label);
      const candidates = match.length ? match : columns.filter(c => text(c.displayName).toLowerCase() === label.toLowerCase());
      if (candidates.length !== 1) throw new Error(`Missing or ambiguous slideshow column: ${label}`);
      keys[label] = candidates[0].name;
    }
    if (!keys.LinkURL && !keys.CanonicalUrl) throw new Error('Slideshow source-link column is missing.');
    this.keys = keys;
    this.base = base;
  }

  async getAllSlideshows(): Promise<SlideshowItem[]> {
    if (!this.base) await this.initialize();
    const rows = await pages<ListItem>(this.client, `${this.base}/items?$expand=fields&$top=200`);
    const slides = rows.map(row => {
      if (!row.fields) throw new Error('Incomplete slideshow item.');
      const fields = { ...row.fields };
      for (const [label, key] of Object.entries(this.keys)) fields[label] = row.fields[key];
      return transformSlideshowItem({ ...row, fields });
    }).filter((slide): slide is SlideshowItem => !!slide);
    const seen = new Set<string>();
    return slides.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0) ||
      Date.parse(b.sourcePublishedAt || b.publishDate) - Date.parse(a.sourcePublishedAt || a.publishDate) || a.id.localeCompare(b.id))
      .filter(slide => {
        if (seen.has(slide.contentKey)) return false;
        seen.add(slide.contentKey);
        return true;
      });
  }

  async getSlideshowsByCategory(category: SlideshowCategory): Promise<SlideshowItem[]> {
    return (await this.getAllSlideshows()).filter(slide => slide.category === category && isVisibleSlideshow(slide));
  }
}
export const getAllSlideshows = (client: Client) => new SlideshowSharePointService(client).getAllSlideshows();
export const getMSOffice365Tips = (client: Client) => new SlideshowSharePointService(client).getSlideshowsByCategory('MS Office 365 Tips');
export const getCapitalMarketNews = (client: Client) => new SlideshowSharePointService(client).getSlideshowsByCategory('Capital Market News');
export const getCapitalMarketActs = (client: Client) => new SlideshowSharePointService(client).getSlideshowsByCategory('Capital Market Acts');
