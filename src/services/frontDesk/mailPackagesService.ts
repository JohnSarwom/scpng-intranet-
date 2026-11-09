import { FRONT_DESK_LISTS, type MailStatus } from './frontDeskConfig';
import type { FrontDeskGraph } from './frontDeskGraph';
import { mailFields, mailStatusFields, mapMailItem, OUTSTANDING_STATUSES, type FrontDeskMailItem, type MailInput } from './mailRules';

const LIST = FRONT_DESK_LISTS.mailPackages;

/** Every filter uses an indexed column (ReceivedAt, Status), so the register keeps working past 5,000 items. */
export const mailQueries = {
  receivedBetween: (start: string, end: string) => `&$filter=fields/ReceivedAt ge '${start}' and fields/ReceivedAt lt '${end}'`,
  withStatus: (status: MailStatus) => `&$filter=fields/Status eq '${status}'`,
};

/** The FrontDesk_MailPackages list: the saved mail and parcel register (plan P4.1). */
export class MailPackagesService {
  constructor(private readonly graph: FrontDeskGraph) {}

  async listReceivedBetween(start: string, end: string): Promise<FrontDeskMailItem[]> {
    return (await this.graph.getItems(LIST, mailQueries.receivedBetween(start, end))).map(mapMailItem);
  }

  /** Everything not yet collected, from any day. One equality query per status keeps each on the index. */
  async listOutstanding(): Promise<FrontDeskMailItem[]> {
    const pages = await Promise.all(OUTSTANDING_STATUSES.map(status => this.graph.getItems(LIST, mailQueries.withStatus(status))));
    return pages.flat().map(mapMailItem);
  }

  async create(input: MailInput, actorEmail: string): Promise<FrontDeskMailItem> {
    const fields = mailFields(input);
    if (actorEmail) fields.LoggedByEmail = actorEmail;
    return mapMailItem(await this.graph.createItem(LIST, fields));
  }

  async update(item: FrontDeskMailItem, input: MailInput): Promise<void> {
    await this.graph.updateFields(LIST, item.id, mailFields(input, { forUpdate: true }), item.eTag);
  }

  /** Moving to Collected needs the collection record (plan P4.3); moving back clears it. */
  async changeStatus(item: FrontDeskMailItem, target: MailStatus, collection?: { collectedBy: string; collectedAt: string }) {
    if (target === item.status) return item;
    const fields = mailStatusFields(item, target, collection);
    await this.graph.updateFields(LIST, item.id, fields, item.eTag);
    return {
      ...item,
      status: target,
      collectedBy: target === 'Delivered' ? collection?.collectedBy.trim() : undefined,
      collectedAt: target === 'Delivered' ? collection?.collectedAt : undefined,
    };
  }

  async remove(item: FrontDeskMailItem): Promise<void> {
    await this.graph.deleteItem(LIST, item.id, item.eTag);
  }
}
