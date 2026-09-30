import type { Client } from '@microsoft/microsoft-graph-client';

const SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';
const LIST_NAME = 'Market_Announcements';

type Fields = Record<string, unknown>;

interface GraphPage<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

interface GraphListItem {
  id: string;
  fields?: Fields;
}

interface GraphColumn {
  name: string;
  displayName?: string;
}

export interface PNGXAnnouncement {
  id: string;
  title: string;
  securityCode: string;
  companyName: string;
  announcementDate: string | null;
  dateImported: string | null;
  categories: string[];
  reviewedSummary: string;
  announcementPage: string | null;
  documentUrl: string | null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function safeHttpUrl(value: unknown): string | null {
  const raw = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? (value as Record<string, unknown>).Url ?? (value as Record<string, unknown>).url
      : undefined;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function validDate(value: unknown): string | null {
  const text = asText(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
}

export function mapPNGXAnnouncement(item: GraphListItem, reviewedSummaryField: string): PNGXAnnouncement {
  const fields = item.fields ?? {};
  return {
    id: item.id,
    title: asText(fields.Title) || 'Untitled announcement',
    securityCode: asText(fields.SecurityCode),
    companyName: asText(fields.CompanyName),
    announcementDate: validDate(fields.AnnouncementDate),
    dateImported: validDate(fields.DateImported),
    categories: asText(fields.Categories).split(',').map(value => value.trim()).filter(Boolean),
    reviewedSummary: asText(fields[reviewedSummaryField]),
    announcementPage: safeHttpUrl(fields.AnnouncementPage),
    documentUrl: safeHttpUrl(fields.DocumentURL),
  };
}

export function sortPNGXAnnouncements(items: PNGXAnnouncement[]): PNGXAnnouncement[] {
  return [...items].sort((a, b) => {
    const aDate = Date.parse(a.announcementDate ?? a.dateImported ?? '') || 0;
    const bDate = Date.parse(b.announcementDate ?? b.dateImported ?? '') || 0;
    return bDate - aDate || a.title.localeCompare(b.title);
  });
}

export class PNGXAnnouncementsSharePointService {
  constructor(private readonly client: Client) {}

  private async collectPages<T>(firstUrl: string): Promise<T[]> {
    const items: T[] = [];
    const visited = new Set<string>();
    let nextUrl: string | undefined = firstUrl;
    while (nextUrl) {
      if (visited.has(nextUrl)) throw new Error('SharePoint returned a repeated page link.');
      visited.add(nextUrl);
      const page = await this.client.api(nextUrl).get() as GraphPage<T>;
      if (!Array.isArray(page.value)) throw new Error('SharePoint returned an invalid list response.');
      items.push(...page.value);
      nextUrl = page['@odata.nextLink'];
    }
    return items;
  }

  async getAnnouncements(): Promise<PNGXAnnouncement[]> {
    const site = await this.client.api(SITE).get() as { id?: string };
    if (!site.id) throw new Error('SCPNG SharePoint site was not found.');

    const lists = await this.client.api(`/sites/${site.id}/lists`)
      .filter(`displayName eq '${LIST_NAME}'`).get() as GraphPage<{ id: string }>;
    const listId = lists.value?.[0]?.id;
    if (!listId) throw new Error('Market_Announcements list was not found in SharePoint.');

    const listPath = `/sites/${site.id}/lists/${listId}`;
    const columns = await this.collectPages<GraphColumn>(`${listPath}/columns`);
    const summaryColumn = columns.find(column => column.displayName?.trim().toLowerCase() === 'reviewed summary');
    if (!summaryColumn?.name) {
      throw new Error('The Reviewed Summary column was not found in Market_Announcements.');
    }

    const records = await this.collectPages<GraphListItem>(`${listPath}/items?$expand=fields&$top=200`);
    return sortPNGXAnnouncements(records.map(record => mapPNGXAnnouncement(record, summaryColumn.name)));
  }
}
