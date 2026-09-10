import {
  createStrategyReportDeliveryRecord,
  verifyStrategyReportArchive,
  verifyStrategyReportDeliveryRecord,
  type StoredStrategyReportArchive,
  type StrategyReportArchiveRecord,
  type StrategyReportDeliveryEvent,
  type StrategyReportDeliveryRecord,
  type StrategyReportDeliveryRequest,
} from './strategyReportArchiveService';
import type {
  IdempotentStrategyReportEmailSender,
  StrategyReportEmailMessage,
  StrategyReportScheduleCheckpointStore,
  StrategyReportScheduleClaim,
  StrategyReportScheduleClaimResult,
  StrategyReportScheduledArchiveReader,
  StrategyReportScheduledDeliveryJournal,
} from './strategyReportSchedulerService';

const ARCHIVE_TEMPLATE_ID = 'strategy-report-archive-v1';
const DELIVERY_TEMPLATE_ID = 'strategy-report-delivery-v1';

interface SchedulerGraphRequest {
  expand(value: string): SchedulerGraphRequest;
  filter(value: string): SchedulerGraphRequest;
  top(value: number): SchedulerGraphRequest;
  header(name: string, value: string): SchedulerGraphRequest;
  get(): Promise<any>;
  post(body: unknown): Promise<any>;
  patch(body: unknown): Promise<any>;
}

export interface SchedulerGraphClient {
  api(path: string): SchedulerGraphRequest;
}

export interface SchedulerExecutorServiceIdentity {
  tenantId: string;
  principalId: string;
  displayName: string;
  permissionScope: 'Lists.SelectedOperations.Selected';
  permittedListIds: readonly string[];
}

export interface SharePointSchedulerAdapterConfiguration {
  siteId: string;
  reportsListId: string;
  schedulesListId: string;
  identity: SchedulerExecutorServiceIdentity;
}

const required = (value: string | undefined, label: string): string => {
  const result = value?.trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
};

const statusCode = (error: any): number | undefined => error?.statusCode ?? error?.status ?? error?.response?.status;
const itemPath = (siteId: string, listId: string, itemId: string) =>
  `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`;
const fieldsPath = (siteId: string, listId: string, itemId: string) => `${itemPath(siteId, listId, itemId)}/fields`;
const collectionPath = (siteId: string, listId: string) =>
  `/sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items`;
const odataText = (value: string) => value.replace(/'/g, "''");

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach(child => deepFreeze(child));
  return value;
}

function parsedContent(item: any, expectedTemplate: string): Record<string, any> {
  const fields = item?.fields;
  if (!item?.id || !fields) throw new Error('SharePoint returned an incomplete report item.');
  if (fields.ReportType !== expectedTemplate) {
    throw new Error(`SharePoint report item ${item.id} is not a ${expectedTemplate} record.`);
  }
  if (typeof fields.ContentJSON !== 'string' || !fields.ContentJSON.trim()) {
    throw new Error(`SharePoint report item ${item.id} has no immutable content payload.`);
  }
  try {
    const content = JSON.parse(fields.ContentJSON);
    if (!content || typeof content !== 'object') throw new Error('not an object');
    return content;
  } catch {
    throw new Error(`SharePoint report item ${item.id} has invalid JSON content.`);
  }
}

function itemETag(item: any): string {
  return required(item?.eTag || item?.['@odata.etag'], `SharePoint item ${item?.id || 'unknown'} ETag`);
}

export function assertSchedulerExecutorLeastPrivilege(
  identity: SchedulerExecutorServiceIdentity,
  reportsListId: string,
  schedulesListId: string,
): void {
  required(identity?.tenantId, 'Executor tenant identity');
  required(identity?.principalId, 'Executor principal identity');
  required(identity?.displayName, 'Executor display name');
  if (identity.permissionScope !== 'Lists.SelectedOperations.Selected') {
    throw new Error('The scheduler executor must use Lists.SelectedOperations.Selected application permission.');
  }
  const expected = new Set([required(reportsListId, 'Reports list identity'), required(schedulesListId, 'Schedules list identity')]);
  const granted = new Set((identity.permittedListIds || []).map(value => value.trim()).filter(Boolean));
  if (granted.size !== expected.size || [...expected].some(id => !granted.has(id))) {
    throw new Error('The scheduler executor must be restricted to exactly the reports and schedules lists.');
  }
}

/** Exact, read-only Performance_Reports item adapter. */
export class SharePointStrategyReportScheduledArchiveReader implements StrategyReportScheduledArchiveReader {
  constructor(
    private client: SchedulerGraphClient,
    private siteId: string,
    private reportsListId: string,
  ) {
    required(siteId, 'SharePoint site identity');
    required(reportsListId, 'Performance_Reports list identity');
  }

  async getByStorageId(storageId: string): Promise<StoredStrategyReportArchive | null> {
    const id = required(storageId, 'Archive storage identity');
    try {
      const item = await this.client.api(itemPath(this.siteId, this.reportsListId, id))
        .expand('fields($select=ReportType,ContentJSON)')
        .get();
      if (String(item?.id || '') !== id) {
        throw new Error(`SharePoint returned archive item ${item?.id || 'unknown'} for requested storage ID ${id}.`);
      }
      const archive = parsedContent(item, ARCHIVE_TEMPLATE_ID).archive as StrategyReportArchiveRecord | undefined;
      if (!archive) throw new Error(`SharePoint report item ${id} has no archive envelope.`);
      await verifyStrategyReportArchive(archive, id);
      return deepFreeze({ storageId: String(item.id), record: structuredClone(archive) });
    } catch (error) {
      if (statusCode(error) === 404) return null;
      throw error;
    }
  }
}

/** Uses indexed ReportType reads and POST-only writes for immutable delivery events. */
export class SharePointStrategyReportScheduledDeliveryJournal implements StrategyReportScheduledDeliveryJournal {
  constructor(
    private client: SchedulerGraphClient,
    private siteId: string,
    private reportsListId: string,
    private recordedBy: string,
    private now: () => string = () => new Date().toISOString(),
    private nextId: () => string = () => globalThis.crypto.randomUUID(),
  ) {
    required(siteId, 'SharePoint site identity');
    required(reportsListId, 'Performance_Reports list identity');
    required(recordedBy, 'Delivery journal actor');
  }

  async listVerified(archive: StoredStrategyReportArchive): Promise<readonly StrategyReportDeliveryEvent[]> {
    await verifyStrategyReportArchive(archive.record, archive.storageId);
    const events: StrategyReportDeliveryEvent[] = [];
    let next: string | undefined = collectionPath(this.siteId, this.reportsListId);
    let page = 0;
    while (next) {
      if (++page > 20) throw new Error('Delivery journal paging exceeded the safety limit.');
      let request = this.client.api(next);
      if (page === 1) {
        request = request
          .expand('fields($select=ReportType,ContentJSON)')
          .filter(`fields/ReportType eq '${odataText(DELIVERY_TEMPLATE_ID)}'`)
          .top(200);
      }
      const response = await request.get();
      if (!Array.isArray(response?.value)) throw new Error('SharePoint returned an incomplete delivery journal page.');
      for (const item of response.value) {
        const delivery = parsedContent(item, DELIVERY_TEMPLATE_ID).delivery as StrategyReportDeliveryRecord | undefined;
        if (!delivery) throw new Error(`SharePoint delivery item ${item.id} has no delivery envelope.`);
        if (delivery.snapshotId !== archive.record.snapshotId) continue;
        await verifyStrategyReportDeliveryRecord(delivery, archive.record, String(item.id));
        events.push(structuredClone(delivery.event));
      }
      next = typeof response['@odata.nextLink'] === 'string' ? response['@odata.nextLink'] : undefined;
    }
    return deepFreeze(events.sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt)));
  }

  async record(archive: StoredStrategyReportArchive, request: StrategyReportDeliveryRequest): Promise<void> {
    const delivery = await createStrategyReportDeliveryRecord(
      archive.record, request, this.recordedBy, this.now, this.nextId,
    );
    await this.client.api(collectionPath(this.siteId, this.reportsListId)).post({
      fields: {
        Title: `${delivery.event.channel}:${delivery.snapshotId}`,
        ReportType: DELIVERY_TEMPLATE_ID,
        GeneratedBy: delivery.event.recordedBy,
        StartDate: delivery.event.occurredAt,
        EndDate: delivery.event.occurredAt,
        ContentJSON: JSON.stringify({
          metadata: { generated_at: delivery.event.occurredAt, version: DELIVERY_TEMPLATE_ID, ai_generated: false },
          delivery,
        }),
        AIAnalysis: false,
        Status: 'Generated',
      },
    });
  }
}

type ScheduleItem = { id: string; eTag: string; fields: Record<string, any> };

/** ETag-conditional Report_Schedules lease and checkpoint repository. */
export class SharePointStrategyReportScheduleCheckpointStore implements StrategyReportScheduleCheckpointStore {
  constructor(
    private client: SchedulerGraphClient,
    private siteId: string,
    private schedulesListId: string,
    private now: () => string = () => new Date().toISOString(),
  ) {
    required(siteId, 'SharePoint site identity');
    required(schedulesListId, 'Report_Schedules list identity');
  }

  private async read(scheduleId: string): Promise<ScheduleItem> {
    const id = required(scheduleId, 'Schedule identity');
    const item = await this.client.api(itemPath(this.siteId, this.schedulesListId, id))
      .expand('fields($select=DispatchId,DispatchState,LeaseUntil,LastSentAt,LastProviderMessageId,LastError)')
      .get();
    if (!item?.id || !item?.fields) throw new Error(`SharePoint schedule ${id} is incomplete.`);
    return { id: String(item.id), eTag: itemETag(item), fields: item.fields };
  }

  private async patch(item: ScheduleItem, fields: Record<string, unknown>): Promise<void> {
    await this.client.api(fieldsPath(this.siteId, this.schedulesListId, item.id))
      .header('If-Match', item.eTag)
      .patch(fields);
  }

  async claim(claim: StrategyReportScheduleClaim): Promise<StrategyReportScheduleClaimResult> {
    const scheduleId = required(claim?.scheduleId, 'Schedule identity');
    const dispatchId = required(claim?.dispatchId, 'Dispatch identity');
    const scheduledFor = required(claim?.scheduledFor, 'Scheduled dispatch time');
    const leaseUntil = required(claim?.leaseUntil, 'Schedule lease expiry');
    if (!Number.isFinite(Date.parse(scheduledFor)) || !Number.isFinite(Date.parse(leaseUntil))) {
      throw new Error('The schedule claim timestamps are invalid.');
    }
    const item = await this.read(scheduleId);
    const state = String(item.fields.DispatchState || '').trim().toLowerCase();
    const currentDispatch = String(item.fields.DispatchId || '').trim();
    if (currentDispatch === dispatchId && state === 'sent') return 'completed';
    const currentLease = Date.parse(String(item.fields.LeaseUntil || ''));
    const currentTime = Date.parse(required(this.now(), 'Checkpoint clock'));
    if (!Number.isFinite(currentTime)) throw new Error('The checkpoint clock is invalid.');
    if (Number.isFinite(currentLease) && currentLease > currentTime) return 'busy';
    try {
      await this.patch(item, {
        DispatchId: dispatchId,
        DispatchState: 'leased',
        LeaseUntil: new Date(leaseUntil).toISOString(),
        LastProviderMessageId: null,
        LastError: null,
      });
      return 'acquired';
    } catch (error) {
      if (statusCode(error) === 412) return 'busy';
      throw error;
    }
  }

  async markSent(scheduleId: string, dispatchId: string, sentAt: string, providerMessageId?: string): Promise<void> {
    const timestamp = required(sentAt, 'Email completion time');
    if (!Number.isFinite(Date.parse(timestamp))) throw new Error('The email completion time is invalid.');
    const item = await this.read(scheduleId);
    this.assertOwnsDispatch(item, dispatchId);
    await this.patch(item, {
      DispatchState: 'sent',
      LeaseUntil: null,
      LastSentAt: new Date(timestamp).toISOString(),
      LastProviderMessageId: providerMessageId?.trim() || null,
      LastError: null,
    });
  }

  async markFailed(scheduleId: string, dispatchId: string, failedAt: string, error: string): Promise<void> {
    if (!Number.isFinite(Date.parse(required(failedAt, 'Failure checkpoint time')))) {
      throw new Error('The failure checkpoint time is invalid.');
    }
    const item = await this.read(scheduleId);
    this.assertOwnsDispatch(item, dispatchId);
    if (String(item.fields.DispatchState || '').trim().toLowerCase() === 'sent') {
      throw new Error(`Schedule ${item.id} is already marked sent and cannot be overwritten as failed.`);
    }
    await this.patch(item, {
      DispatchState: 'failed',
      LeaseUntil: null,
      LastError: required(error, 'Schedule failure description'),
    });
  }

  private assertOwnsDispatch(item: ScheduleItem, dispatchId: string): void {
    const expected = required(dispatchId, 'Dispatch identity');
    if (String(item.fields.DispatchId || '').trim() !== expected) {
      throw new Error(`Schedule ${item.id} is owned by a different dispatch.`);
    }
  }
}

export interface ResendStrategyReportEmailConfiguration {
  apiKey: string;
  from: string;
  endpoint?: string;
}

/** Server-side only. Resend preserves a repeated Idempotency-Key for its documented retry window. */
export class ResendStrategyReportEmailSender implements IdempotentStrategyReportEmailSender {
  private endpoint: string;

  constructor(
    private configuration: ResendStrategyReportEmailConfiguration,
    private fetchImplementation: typeof fetch = globalThis.fetch,
  ) {
    required(configuration?.apiKey, 'Resend API key');
    required(configuration?.from, 'Report sender address');
    this.endpoint = configuration.endpoint?.trim() || 'https://api.resend.com/emails';
    if (typeof fetchImplementation !== 'function') throw new Error('A server-side fetch implementation is required.');
  }

  async send(message: StrategyReportEmailMessage, options: { idempotencyKey: string }): Promise<{ messageId: string }> {
    const key = required(options?.idempotencyKey, 'Email idempotency key');
    if (key.length > 256 || !/^[\x21-\x7E]+$/.test(key)) {
      throw new Error('The email idempotency key must be printable ASCII and no more than 256 characters.');
    }
    const response = await this.fetchImplementation(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.configuration.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        from: this.configuration.from,
        to: [required(message?.to, 'Report recipient')],
        cc: message.cc ? [message.cc] : undefined,
        subject: required(message?.subject, 'Report email subject'),
        html: required(message?.html, 'Report email body'),
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.message || payload?.error || response.statusText || 'unknown provider error';
      throw new Error(`Resend email request failed (${response.status}): ${detail}`);
    }
    return { messageId: required(payload?.id, 'Email provider message identity') };
  }
}

export function createSharePointSchedulerTenantAdapters(
  client: SchedulerGraphClient,
  configuration: SharePointSchedulerAdapterConfiguration,
  now: () => string = () => new Date().toISOString(),
  nextId: () => string = () => globalThis.crypto.randomUUID(),
) {
  const siteId = required(configuration?.siteId, 'SharePoint site identity');
  const reportsListId = required(configuration?.reportsListId, 'Performance_Reports list identity');
  const schedulesListId = required(configuration?.schedulesListId, 'Report_Schedules list identity');
  assertSchedulerExecutorLeastPrivilege(configuration.identity, reportsListId, schedulesListId);
  return deepFreeze({
    archiveReader: new SharePointStrategyReportScheduledArchiveReader(client, siteId, reportsListId),
    journal: new SharePointStrategyReportScheduledDeliveryJournal(
      client, siteId, reportsListId, configuration.identity.displayName, now, nextId,
    ),
    checkpoints: new SharePointStrategyReportScheduleCheckpointStore(client, siteId, schedulesListId, now),
  });
}
