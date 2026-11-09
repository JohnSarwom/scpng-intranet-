import { FRONT_DESK_LISTS, FRONT_DESK_PHOTO_LIBRARY, type VisitorStatus } from './frontDeskConfig';
import type { FrontDeskGraph } from './frontDeskGraph';
import {
  mapVisitor,
  photoPath,
  pngDayRange,
  signOutError,
  statusChange,
  visitorFields,
  type FrontDeskVisitor,
  type VisitorInput,
} from './visitorRules';

const LIST = FRONT_DESK_LISTS.visitors;

/** Both filters use indexed columns, so they keep working past 5,000 visitors (plan P2.3). */
export const visitorQueries = {
  byDate: (dateKey: string) => {
    const { start, end } = pngDayRange(dateKey);
    return `&$filter=fields/VisitDate ge '${start}' and fields/VisitDate lt '${end}'`;
  },
  onSite: () => `&$filter=fields/Status eq 'On Site'`,
};

/** The FrontDesk_Visitors list: the saved visitor log that replaces the paper sheet (plan P3.1). */
export class VisitorsService {
  constructor(private readonly graph: FrontDeskGraph) {}

  async listByDate(dateKey: string): Promise<FrontDeskVisitor[]> {
    return (await this.graph.getItems(LIST, visitorQueries.byDate(dateKey))).map(mapVisitor);
  }

  /** Everyone signed in and not yet signed out, from any day (audit M1). */
  async listOnSite(): Promise<FrontDeskVisitor[]> {
    return (await this.graph.getItems(LIST, visitorQueries.onSite())).map(mapVisitor);
  }

  /** A walk-in is created On Site with Time In now; a pre-booked visitor is created Expected. */
  async create(input: VisitorInput, status: Extract<VisitorStatus, 'Expected' | 'On Site'>, actorEmail: string, nowIso: string) {
    const fields: Record<string, unknown> = { ...visitorFields(input), Status: status, LoggedByEmail: actorEmail || undefined };
    if (status === 'On Site') fields.TimeIn = input.timeIn || nowIso;
    if (!fields.LoggedByEmail) delete fields.LoggedByEmail;
    return mapVisitor(await this.graph.createItem(LIST, fields));
  }

  /** Edits details, and lets users with `update` correct Time In / Time Out (plan P3.4). */
  async update(visitor: FrontDeskVisitor, input: VisitorInput): Promise<void> {
    // Times are only corrected here, never set or cleared: arrival and departure go through changeStatus.
    const timeIn = visitor.timeIn ? input.timeIn || visitor.timeIn : undefined;
    const timeOut = visitor.timeOut ? input.timeOut || visitor.timeOut : undefined;
    const error = signOutError(timeIn, timeOut);
    if (error) throw new Error(error);
    const fields = visitorFields({ ...input, timeIn, timeOut }, { forUpdate: true });
    if (!timeIn) delete fields.TimeIn;
    if (!timeOut) delete fields.TimeOut;
    await this.graph.updateFields(LIST, visitor.id, fields, visitor.eTag);
  }

  /** Sign in, sign out, no-show, or a board drag. Rejects stale edits through the eTag. */
  async changeStatus(visitor: FrontDeskVisitor, target: VisitorStatus, nowIso: string, actorEmail: string) {
    const change = statusChange(visitor, target, nowIso, actorEmail);
    if (Object.keys(change.fields).length) await this.graph.updateFields(LIST, visitor.id, change.fields, visitor.eTag);
    return change.next;
  }

  async remove(visitor: FrontDeskVisitor): Promise<void> {
    await this.graph.deleteItem(LIST, visitor.id, visitor.eTag);
  }

  /** Uploads to the restricted photo library and stores only the file's link, never the image (plan P3.7). */
  async attachPhoto(visitorId: string, file: File, now = new Date()): Promise<string> {
    const { folder, fileName } = photoPath(visitorId, file.name, now);
    const uploaded = await this.graph.uploadFile(FRONT_DESK_PHOTO_LIBRARY, folder, fileName, file);
    if (!uploaded?.webUrl) throw new Error('The photo uploaded but SharePoint returned no link.');
    await this.graph.updateFields(LIST, visitorId, { PhotoUrl: uploaded.webUrl });
    return uploaded.webUrl;
  }
}
