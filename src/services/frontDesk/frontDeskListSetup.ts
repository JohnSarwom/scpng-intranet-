import type { Client } from '@microsoft/microsoft-graph-client';
import {
  APPOINTMENT_STATUSES,
  FRONT_DESK_LISTS,
  FRONT_DESK_PHOTO_LIBRARY,
  INQUIRY_CATEGORIES,
  INQUIRY_STATUSES,
  MAIL_ITEM_TYPES,
  MAIL_STATUSES,
  PRIORITIES,
  TICKET_STATUSES,
  VISITOR_STATUSES,
} from './frontDeskConfig';
import { FrontDeskGraph, resetFrontDeskGraphCache } from './frontDeskGraph';

type ColumnFacet =
  | { text: { allowMultipleLines?: boolean } }
  | { dateTime: { format: 'dateOnly' | 'dateTime' } }
  | { choice: { choices: string[]; displayAs: 'dropDownMenu'; allowTextEntry: false } }
  | { number: Record<string, never> }
  | { boolean: Record<string, never> };

/** A Graph columnDefinition. `indexed` columns are the ones queries filter on: SharePoint
 *  refuses filtered queries on non-indexed columns once a list passes 5,000 items. */
export type FrontDeskColumn = { name: string; required?: boolean; indexed?: boolean } & ColumnFacet;

export interface FrontDeskListSchema {
  name: string;
  description: string;
  columns: FrontDeskColumn[];
}

type Options = Pick<FrontDeskColumn, 'required' | 'indexed'>;
const text = (name: string, o: Options = {}): FrontDeskColumn => ({ name, ...o, text: {} });
const note = (name: string, o: Options = {}): FrontDeskColumn => ({ name, ...o, text: { allowMultipleLines: true } });
const day = (name: string, o: Options = {}): FrontDeskColumn => ({ name, ...o, dateTime: { format: 'dateOnly' } });
const moment = (name: string, o: Options = {}): FrontDeskColumn => ({ name, ...o, dateTime: { format: 'dateTime' } });
const choice = (name: string, values: readonly string[], o: Options = {}): FrontDeskColumn =>
  ({ name, ...o, choice: { choices: [...values], displayAs: 'dropDownMenu', allowTextEntry: false } });
const number = (name: string, o: Options = {}): FrontDeskColumn => ({ name, ...o, number: {} });
const yesNo = (name: string, o: Options = {}): FrontDeskColumn => ({ name, ...o, boolean: {} });

const required = { required: true };
const indexed = { indexed: true };
const requiredIndexed = { required: true, indexed: true };

/** Appendix A of docs/features/front-desk-execution-plan.md. Every list also has SharePoint's Title column. */
export const FRONT_DESK_SCHEMAS: FrontDeskListSchema[] = [
  {
    name: FRONT_DESK_LISTS.visitors,
    description: 'Front desk visitor log. Title is the visitor name.',
    columns: [
      text('Company'),
      note('Reason', required),
      day('VisitDate', requiredIndexed),
      moment('ExpectedStart'),
      moment('ExpectedEnd'),
      choice('Status', VISITOR_STATUSES, requiredIndexed),
      moment('TimeIn'),
      moment('TimeOut'),
      text('HostEmail'),
      text('HostName'),
      text('Phone'),
      text('Email'),
      text('BadgeNo'),
      text('PhotoUrl'),
      note('Notes'),
      text('GroupRef'),
      text('AppointmentId'),
      text('LoggedByEmail'),
      text('SignedOutByEmail'),
    ],
  },
  {
    name: FRONT_DESK_LISTS.appointments,
    description: 'Front desk appointments. Title is the appointment title.',
    columns: [
      text('HostEmail', required),
      text('HostName', required),
      text('Location'),
      moment('StartDateTime', requiredIndexed),
      moment('EndDateTime', required),
      note('Attendees'),
      choice('Status', APPOINTMENT_STATUSES, required),
      note('Description'),
      text('CreatedByEmail'),
    ],
  },
  {
    name: FRONT_DESK_LISTS.mailPackages,
    description: 'Front desk mail and parcel register. Title is the description or subject.',
    columns: [
      choice('ItemType', MAIL_ITEM_TYPES, required),
      text('Sender'),
      text('Carrier'),
      text('Tracking'),
      text('RecipientEmail'),
      text('RecipientName', required),
      text('RecipientUnit'),
      moment('ReceivedAt', requiredIndexed),
      choice('Status', MAIL_STATUSES, required),
      moment('CollectedAt'),
      text('CollectedBy'),
      note('Notes'),
      text('LoggedByEmail'),
      moment('NotifiedAt'),
    ],
  },
  {
    name: FRONT_DESK_LISTS.inquiries,
    description: 'Front desk general inquiries. Title is the inquiry title.',
    columns: [
      note('Description'),
      choice('Category', INQUIRY_CATEGORIES, required),
      choice('Priority', PRIORITIES, required),
      choice('Status', INQUIRY_STATUSES, required),
      text('AssigneeEmail'),
      text('AssigneeName'),
      text('ReportedBy'),
      moment('ReportedAt', requiredIndexed),
      moment('ResolvedAt'),
      text('EscalatedTicketId'),
      text('LoggedByEmail'),
    ],
  },
  {
    name: FRONT_DESK_LISTS.tickets,
    description: 'Front desk tickets. Title is the ticket title.',
    columns: [
      note('Description'),
      choice('Priority', PRIORITIES, required),
      choice('Status', TICKET_STATUSES, required),
      text('GroupId', required),
      number('SortOrder'),
      moment('StartDate'),
      moment('DueDate'),
      text('AssigneeEmail'),
      text('AssigneeName'),
      yesNo('Completed'),
      moment('CompletedAt'),
      text('SourceInquiryId'),
      text('CreatedByEmail'),
    ],
  },
  {
    name: FRONT_DESK_LISTS.ticketGroups,
    description: 'Front desk ticket board columns. Title is the group name.',
    columns: [number('SortOrder')],
  },
  {
    name: FRONT_DESK_LISTS.ticketComments,
    description: 'Comments on front desk tickets.',
    columns: [
      text('TicketId', requiredIndexed),
      note('Body', required),
      text('AuthorEmail'),
      text('AuthorName'),
    ],
  },
];

export type FrontDeskSetupStatus = 'ok' | 'missing' | 'needs-update' | 'created' | 'updated' | 'failed';

export interface FrontDeskSetupResult {
  name: string;
  kind: 'list' | 'library';
  status: FrontDeskSetupStatus;
  /** Columns that are (or, when checking, would be) added. */
  addedColumns: string[];
  /** Existing columns that are (or would be) switched to indexed. */
  indexedColumns: string[];
  error?: string;
}

interface ExistingColumn { id: string; name: string; indexed?: boolean }

const describeError = (error: unknown) => {
  const e = error as { body?: string; message?: string; code?: string } | null;
  return e?.message || e?.code || 'Unknown SharePoint error';
};

async function ensureList(
  client: Client,
  graph: FrontDeskGraph,
  siteId: string,
  schema: FrontDeskListSchema,
  dryRun: boolean,
): Promise<FrontDeskSetupResult> {
  const result: FrontDeskSetupResult = { name: schema.name, kind: 'list', status: 'ok', addedColumns: [], indexedColumns: [] };
  try {
    const listId = await graph.findListId(schema.name);
    if (!listId) {
      result.addedColumns = schema.columns.map(c => c.name);
      if (dryRun) return { ...result, status: 'missing' };
      const created = await client.api(`/sites/${siteId}/lists`).post({
        displayName: schema.name,
        description: schema.description,
        list: { template: 'genericList' },
      }) as { id: string };
      for (const column of schema.columns) {
        await client.api(`/sites/${siteId}/lists/${created.id}/columns`).post(column);
      }
      return { ...result, status: 'created' };
    }

    const listPath = `/sites/${siteId}/lists/${listId}`;
    const existing = await graph.collectPages<ExistingColumn>(`${listPath}/columns?$select=id,name,indexed&$top=200`);
    const byName = new Map(existing.map(c => [c.name, c]));
    const missing = schema.columns.filter(c => !byName.has(c.name));
    const unindexed = schema.columns.filter(c => c.indexed && byName.get(c.name) && !byName.get(c.name)?.indexed);
    result.addedColumns = missing.map(c => c.name);
    result.indexedColumns = unindexed.map(c => c.name);
    if (!missing.length && !unindexed.length) return result;
    if (dryRun) return { ...result, status: 'needs-update' };

    for (const column of missing) {
      await client.api(`${listPath}/columns`).post(column);
    }
    for (const column of unindexed) {
      await client.api(`${listPath}/columns/${byName.get(column.name)!.id}`).patch({ indexed: true });
    }
    return { ...result, status: 'updated' };
  } catch (error) {
    return { ...result, status: 'failed', error: describeError(error) };
  }
}

async function ensurePhotoLibrary(client: Client, graph: FrontDeskGraph, siteId: string, dryRun: boolean): Promise<FrontDeskSetupResult> {
  const result: FrontDeskSetupResult = { name: FRONT_DESK_PHOTO_LIBRARY, kind: 'library', status: 'ok', addedColumns: [], indexedColumns: [] };
  try {
    if (await graph.findListId(FRONT_DESK_PHOTO_LIBRARY)) return result;
    if (dryRun) return { ...result, status: 'missing' };
    await client.api(`/sites/${siteId}/lists`).post({
      displayName: FRONT_DESK_PHOTO_LIBRARY,
      description: 'Front desk visitor photos. Restrict access to the front desk group and admins (plan D9).',
      list: { template: 'documentLibrary' },
    });
    return { ...result, status: 'created' };
  } catch (error) {
    return { ...result, status: 'failed', error: describeError(error) };
  }
}

/**
 * Creates any missing Front Desk list, column or index, and the photo library. Running it
 * again changes nothing. With `dryRun` it only reports what it would do, and writes nothing.
 * A failure on one list is reported and the others still run.
 */
export async function ensureFrontDeskLists(
  client: Client,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<FrontDeskSetupResult[]> {
  resetFrontDeskGraphCache();
  const graph = new FrontDeskGraph(client);
  const siteId = await graph.resolveSiteId();
  const results: FrontDeskSetupResult[] = [];
  for (const schema of FRONT_DESK_SCHEMAS) {
    results.push(await ensureList(client, graph, siteId, schema, dryRun));
  }
  results.push(await ensurePhotoLibrary(client, graph, siteId, dryRun));
  if (!dryRun) resetFrontDeskGraphCache();
  return results;
}
