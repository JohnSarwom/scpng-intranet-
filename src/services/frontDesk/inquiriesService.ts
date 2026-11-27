import { FRONT_DESK_LISTS, type InquiryStatus } from './frontDeskConfig';
import type { FrontDeskGraph } from './frontDeskGraph';
import { inquiryFields, mapInquiry, OPEN_INQUIRY_STATUSES, type FrontDeskInquiry, type InquiryInput } from './inquiryRules';

const LIST = FRONT_DESK_LISTS.inquiries;

/** Every filter uses an indexed column (ReportedAt, Status), so the register keeps working past 5,000 items. */
export const inquiryQueries = {
  reportedBetween: (start: string, end: string) => `&$filter=fields/ReportedAt ge '${start}' and fields/ReportedAt lt '${end}'`,
  withStatus: (status: InquiryStatus) => `&$filter=fields/Status eq '${status}'`,
};

/** The FrontDesk_Inquiries list: general inquiries taken at reception (plan P5.1). */
export class InquiriesService {
  constructor(private readonly graph: FrontDeskGraph) {}

  async listReportedBetween(start: string, end: string): Promise<FrontDeskInquiry[]> {
    return (await this.graph.getItems(LIST, inquiryQueries.reportedBetween(start, end))).map(mapInquiry);
  }

  /** Every unresolved inquiry, from any day. One equality query per status keeps each on the index. */
  async listOpen(): Promise<FrontDeskInquiry[]> {
    const pages = await Promise.all(OPEN_INQUIRY_STATUSES.map(status => this.graph.getItems(LIST, inquiryQueries.withStatus(status))));
    return pages.flat().map(mapInquiry);
  }

  async create(input: InquiryInput, actorEmail: string): Promise<FrontDeskInquiry> {
    const fields = inquiryFields(input, { actorEmail });
    if (actorEmail) fields.LoggedByEmail = actorEmail;
    return mapInquiry(await this.graph.createItem(LIST, fields));
  }

  /** Saves the whole input against the version the receptionist saw (eTag), so a newer change is never overwritten. */
  async update(inquiry: FrontDeskInquiry, input: InquiryInput, actorEmail: string): Promise<void> {
    await this.graph.updateFields(LIST, inquiry.id, inquiryFields(input, { previous: inquiry, actorEmail }), inquiry.eTag);
  }

  async remove(inquiry: FrontDeskInquiry): Promise<void> {
    await this.graph.deleteItem(LIST, inquiry.id, inquiry.eTag);
  }
}
