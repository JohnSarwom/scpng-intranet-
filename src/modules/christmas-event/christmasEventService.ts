/**
 * Christmas Closing Event responses: SharePoint backend.
 *
 * One row per staff member in the list named in CHRISTMAS_EVENT.listName.
 * The list is created on first use by anyone allowed to create lists on the
 * site (an admin). Until it exists, staff who cannot create it are not shown
 * the envelope, so nobody fills in a form that cannot be saved.
 */
import type { Client } from '@microsoft/microsoft-graph-client';
import { CHRISTMAS_EVENT, ARRANGEMENT_OPTIONS, ATTENDANCE_OPTIONS, type Arrangement, type Attendance } from './config';

const SITE_HOSTNAME = 'scpng1.sharepoint.com';
const SITE_PATH = '/sites/scpngintranet';

export interface ChristmasResponse {
  id?: string;
  fullName: string;
  email: string;
  divisionUnit: string;
  attendance: Attendance | '';
  arrangement: Arrangement | '';
  destination: string;
  /** yyyy-mm-dd or '' */
  startDate: string;
  /** yyyy-mm-dd or '' */
  endDate: string;
  comments: string;
  updatedAt?: string;
}

export interface ChristmasResponseStore {
  /** Throws ChristmasListNotReadyError when the list is missing and cannot be created. */
  getMine(email: string): Promise<ChristmasResponse | null>;
  save(response: ChristmasResponse): Promise<ChristmasResponse>;
}

export class ChristmasListNotReadyError extends Error {
  constructor(message = 'The Christmas event list is not set up yet.') {
    super(message);
    this.name = 'ChristmasListNotReadyError';
  }
}

const escapeOData = (v: string) => v.replace(/'/g, "''");

/** Store a date at midday UTC so it shows as the same calendar day in every time zone. */
const toSpDate = (d: string) => (d ? `${d}T12:00:00Z` : null);

/** Read a SharePoint date back as a local yyyy-mm-dd. */
const fromSpDate = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const LIST_COLUMNS = [
  { name: 'StaffEmail', text: {}, indexed: true },
  { name: 'DivisionUnit', text: {} },
  {
    name: 'Attendance',
    choice: { choices: ATTENDANCE_OPTIONS.map((o) => o.value), allowTextEntry: false },
  },
  {
    name: 'Arrangement',
    choice: { choices: ARRANGEMENT_OPTIONS.map((o) => o.value), allowTextEntry: false },
  },
  { name: 'Destination', text: {} },
  { name: 'LeaveStart', dateTime: { format: 'dateOnly' } },
  { name: 'LeaveEnd', dateTime: { format: 'dateOnly' } },
  { name: 'Comments', text: { allowMultipleLines: true, maxLength: 1000 } },
];

let cachedIds: { siteId: string; listId: string } | null = null;

export class ChristmasEventSharePointStore implements ChristmasResponseStore {
  constructor(private client: Client) {}

  private async ids() {
    if (cachedIds) return cachedIds;
    const site = await this.client.api(`/sites/${SITE_HOSTNAME}:${SITE_PATH}`).select('id').get();
    const siteId: string = site.id;
    const listName = CHRISTMAS_EVENT.listName;

    const found = await this.client
      .api(`/sites/${siteId}/lists`)
      .filter(`displayName eq '${escapeOData(listName)}'`)
      .select('id')
      .get();

    let listId: string | undefined = found.value?.[0]?.id;
    if (!listId) {
      try {
        const created = await this.client.api(`/sites/${siteId}/lists`).post({
          displayName: listName,
          description: `${CHRISTMAS_EVENT.title}: staff attendance and availability (one row per staff member).`,
          columns: LIST_COLUMNS,
          list: { template: 'genericList' },
        });
        listId = created.id;
      } catch (e: any) {
        if (e?.statusCode === 403 || e?.statusCode === 401) throw new ChristmasListNotReadyError();
        throw e;
      }
    }
    cachedIds = { siteId, listId: listId! };
    return cachedIds;
  }

  private items(siteId: string, listId: string) {
    return `/sites/${siteId}/lists/${listId}/items`;
  }

  async getMine(email: string): Promise<ChristmasResponse | null> {
    const { siteId, listId } = await this.ids();
    const res = await this.client
      .api(this.items(siteId, listId))
      .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
      .filter(`fields/StaffEmail eq '${escapeOData(email.toLowerCase())}'`)
      .expand('fields')
      .top(1)
      .get();
    const item = res.value?.[0];
    if (!item) return null;
    const f = item.fields ?? {};
    return {
      id: item.id,
      fullName: f.Title ?? '',
      email: f.StaffEmail ?? email,
      divisionUnit: f.DivisionUnit ?? '',
      attendance: f.Attendance ?? '',
      arrangement: f.Arrangement ?? '',
      destination: f.Destination ?? '',
      startDate: fromSpDate(f.LeaveStart),
      endDate: fromSpDate(f.LeaveEnd),
      comments: f.Comments ?? '',
      updatedAt: item.lastModifiedDateTime,
    };
  }

  async save(r: ChristmasResponse): Promise<ChristmasResponse> {
    const { siteId, listId } = await this.ids();
    const fields = {
      Title: r.fullName.trim(),
      StaffEmail: r.email.toLowerCase(),
      DivisionUnit: r.divisionUnit.trim(),
      Attendance: r.attendance || null,
      Arrangement: r.arrangement || null,
      Destination: r.destination.trim(),
      LeaveStart: toSpDate(r.startDate),
      LeaveEnd: toSpDate(r.endDate),
      Comments: r.comments.trim(),
    };

    // Look the row up again so two open tabs never create two rows.
    const existing = r.id ? { id: r.id } : await this.getMine(r.email);
    if (existing?.id) {
      await this.client.api(`${this.items(siteId, listId)}/${existing.id}/fields`).patch(fields);
      return { ...r, id: existing.id, updatedAt: new Date().toISOString() };
    }
    const created = await this.client.api(this.items(siteId, listId)).post({ fields });
    return { ...r, id: created.id, updatedAt: created.createdDateTime };
  }
}

/** In-memory store for the developer preview page; nothing leaves the browser. */
export class ChristmasEventDemoStore implements ChristmasResponseStore {
  private rows = new Map<string, ChristmasResponse>();
  async getMine(email: string) {
    await new Promise((r) => setTimeout(r, 300));
    return this.rows.get(email.toLowerCase()) ?? null;
  }
  async save(r: ChristmasResponse) {
    await new Promise((res) => setTimeout(res, 900));
    const saved = { ...r, id: r.id ?? 'demo-1', updatedAt: new Date().toISOString() };
    this.rows.set(r.email.toLowerCase(), saved);
    return saved;
  }
}
