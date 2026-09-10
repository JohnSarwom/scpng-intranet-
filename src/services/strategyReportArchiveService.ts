import type { ProgressScope, StrategyTraceabilityReport } from '@/types/strategyExecution';

export interface StrategyReportActor {
  email: string;
  name?: string;
  role?: string;
  division?: string;
  unit?: string;
  isAdmin?: boolean;
}

export interface StrategyReportScopeIdentity {
  division?: string;
  unit?: string;
  ownerEmail?: string;
}

export interface StrategyReportArchiveRecord {
  archiveVersion: 1;
  snapshotId: string;
  snapshotChecksum: string;
  snapshot: StrategyTraceabilityReport;
  archivedAt: string;
  archivedBy: { email: string; name: string };
  scope: {
    type: ProgressScope;
    label: string;
    division?: string;
    unit?: string;
    ownerEmail?: string;
  };
  presentationConfig: Record<string, unknown>;
  retention: { mode: 'hold-until-policy-approved' };
  deliveryHistory: readonly StrategyReportDeliveryEvent[];
}

export interface StrategyReportDeliveryEvent {
  id: string;
  occurredAt: string;
  recordedBy: string;
  status: 'queued' | 'sent' | 'failed';
  channel: 'email' | 'download' | 'print';
  recipient?: string;
  error?: string;
  scheduleId?: string;
  dispatchId?: string;
  providerMessageId?: string;
}

export interface StoredStrategyReportArchive {
  storageId: string;
  record: StrategyReportArchiveRecord;
}

export interface StrategyReportArchiveStore {
  append(record: StrategyReportArchiveRecord): Promise<{ storageId: string }>;
  list(limit: number): Promise<StoredStrategyReportArchive[]>;
  appendDelivery(record: StrategyReportDeliveryRecord): Promise<{ storageId: string }>;
  listDeliveries(snapshotIds: readonly string[], limit: number): Promise<StoredStrategyReportDelivery[]>;
}

export interface StrategyReportDeliveryRecord {
  eventVersion: 1;
  snapshotId: string;
  snapshotChecksum: string;
  eventChecksum: string;
  event: StrategyReportDeliveryEvent;
}

export interface StoredStrategyReportDelivery {
  storageId: string;
  record: StrategyReportDeliveryRecord;
}

export type StrategyReportDeliveryRequest = Pick<
  StrategyReportDeliveryEvent,
  'status' | 'channel' | 'recipient' | 'error' | 'scheduleId' | 'dispatchId' | 'providerMessageId'
>;

export interface StrategyReportScheduleBinding {
  contractVersion: 1;
  archiveStorageId: string;
  snapshotId: string;
  snapshotChecksum: string;
  scope: StrategyReportArchiveRecord['scope'];
  recipient: string;
  cc?: string;
  boundAt: string;
  boundBy: { email: string; name: string };
}

export interface StrategyReportDispatchEnvelope {
  dispatchVersion: 1;
  binding: StrategyReportScheduleBinding;
  snapshot: StrategyTraceabilityReport;
}

export interface StrategyReportSchedulerDeploymentContract {
  contractVersion: 1;
  archiveTemplateId: 'strategy-report-archive-v1';
  deliveryTemplateId: 'strategy-report-delivery-v1';
  executorId: 'strategy-report-scheduled-delivery-v1';
  scheduleSnapshotFieldsVerified: true;
  dispatchReadsArchiveByIdAndChecksum: true;
  deliveryJournalWritesVerified: true;
  scheduleLeaseAndCheckpointWritesVerified: true;
  idempotentEmailSendVerified: true;
}

export const ARCHIVE_BOUND_SCHEDULER_BLOCK_MESSAGE =
  'Report scheduler deployment is blocked until it reads a checksum-verified archived strategy snapshot and writes its delivery lifecycle to the immutable journal.';

export const LEGACY_REPORT_FLOW_QUARANTINE_MESSAGE =
  'The legacy report flows are quarantined because they recalculate live metrics. Deploy the verified archive-bound executor through its approved tenant adapter instead.';

export function assertLegacyReportFlowQuarantined(): never {
  throw new Error(LEGACY_REPORT_FLOW_QUARANTINE_MESSAGE);
}

export interface StrategyReportIdentityProvider {
  current(): Promise<StrategyReportActor | null>;
}

type SharePointReport = {
  id: string;
  name: string;
  template_id: string;
  created_by: string;
  date_range: { start_date: string; end_date: string };
  content: Record<string, any>;
};

export interface StrategyReportSharePointGateway {
  saveReport(report: Omit<SharePointReport, 'id'>): Promise<SharePointReport>;
  getReports(limit?: number): Promise<SharePointReport[]>;
}

export interface AuthenticatedStrategyReportSharePointGateway extends StrategyReportSharePointGateway {
  getCurrentReportArchiveActor(): Promise<StrategyReportActor>;
}

const TEMPLATE_ID = 'strategy-report-archive-v1';
const DELIVERY_TEMPLATE_ID = 'strategy-report-delivery-v1';
const normalize = (value?: string) => value?.trim().toLowerCase() || '';
const isAdministrator = (actor: StrategyReportActor) => actor.isAdmin || ['admin', 'super_admin'].includes(normalize(actor.role));

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach(child => deepFreeze(child));
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

async function checksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(part => part.toString(16).padStart(2, '0')).join('');
}

export async function verifyStrategyReportDeliveryRecord(
  delivery: StrategyReportDeliveryRecord,
  archive: Pick<StrategyReportArchiveRecord, 'snapshotId' | 'snapshotChecksum'>,
  storageId = delivery?.event?.id || 'unknown',
): Promise<void> {
  if (delivery?.eventVersion !== 1 || delivery.snapshotId !== archive.snapshotId ||
    delivery.snapshotChecksum !== archive.snapshotChecksum) {
    throw new Error(`Stored delivery ${storageId} does not match its archived snapshot.`);
  }
  if (await checksum(delivery.event) !== delivery.eventChecksum) {
    throw new Error(`Stored delivery ${storageId} failed its event checksum.`);
  }
}

export async function createStrategyReportDeliveryRecord(
  archive: StrategyReportArchiveRecord,
  request: StrategyReportDeliveryRequest,
  recordedBy: string,
  now: () => string = () => new Date().toISOString(),
  nextId: () => string = () => globalThis.crypto.randomUUID(),
): Promise<StrategyReportDeliveryRecord> {
  await verifyStrategyReportArchive(archive, archive.snapshotId);
  const actor = normalize(recordedBy);
  if (!actor) throw new Error('A delivery journal actor is required.');
  if (request.channel === 'email') assertEmail(request.recipient, 'Email delivery recipient');
  if (request.status === 'failed' && !request.error?.trim()) {
    throw new Error('A failed delivery event requires an error description.');
  }
  if (request.providerMessageId && request.status !== 'sent') {
    throw new Error('A provider message ID is valid only for a sent delivery event.');
  }
  if (!!request.scheduleId !== !!request.dispatchId) {
    throw new Error('Scheduled delivery events require both schedule and dispatch identities.');
  }
  const occurredAt = now();
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error('The delivery event time is invalid.');
  const event: StrategyReportDeliveryEvent = {
    id: nextId(),
    occurredAt: new Date(occurredAt).toISOString(),
    recordedBy: actor,
    status: request.status,
    channel: request.channel,
    ...(normalize(request.recipient) ? { recipient: normalize(request.recipient) } : {}),
    ...(request.error?.trim() ? { error: request.error.trim() } : {}),
    ...(request.scheduleId?.trim() ? { scheduleId: request.scheduleId.trim() } : {}),
    ...(request.dispatchId?.trim() ? { dispatchId: request.dispatchId.trim() } : {}),
    ...(request.providerMessageId?.trim() ? { providerMessageId: request.providerMessageId.trim() } : {}),
  };
  return deepFreeze({
    eventVersion: 1,
    snapshotId: archive.snapshotId,
    snapshotChecksum: archive.snapshotChecksum,
    eventChecksum: await checksum(event),
    event,
  });
}

function assertIdentity(actor: StrategyReportActor | null): asserts actor is StrategyReportActor {
  if (!actor || !normalize(actor.email) || (!normalize(actor.role) && !actor.isAdmin)) {
    throw new Error('Unable to verify the signed-in report user and role.');
  }
}

function assertScopeIdentity(report: StrategyTraceabilityReport, identity: StrategyReportScopeIdentity): void {
  const label = normalize(report.snapshot.scopeLabel);
  if (report.scope === 'division' && (!normalize(identity.division) || normalize(identity.division) !== label)) {
    throw new Error('The report division identity does not match its frozen scope label.');
  }
  if (report.scope === 'unit' && (!normalize(identity.unit) || normalize(identity.unit) !== label || !normalize(identity.division))) {
    throw new Error('The report Unit identity does not match its frozen scope label.');
  }
  if (report.scope === 'personal' && !normalize(identity.ownerEmail)) {
    throw new Error('A personal report requires an exact owner email.');
  }
}

export function canAccessStrategyReport(
  actor: StrategyReportActor,
  scope: StrategyReportArchiveRecord['scope'],
): boolean {
  if (isAdministrator(actor)) return true;
  if (scope.type === 'corporate' || scope.type === 'audit') return false;
  if (scope.type === 'division') return !!normalize(scope.division) && normalize(actor.division) === normalize(scope.division);
  if (scope.type === 'unit') {
    return !!normalize(scope.unit) && !!normalize(scope.division) &&
      normalize(actor.unit) === normalize(scope.unit) && normalize(actor.division) === normalize(scope.division);
  }
  return !!normalize(scope.ownerEmail) && normalize(actor.email) === normalize(scope.ownerEmail);
}

function assertCanArchive(actor: StrategyReportActor, scope: StrategyReportArchiveRecord['scope']): void {
  if (!canAccessStrategyReport(actor, scope)) throw new Error('You do not have permission to archive this report scope.');
  if (scope.type === 'division' && !isAdministrator(actor) && !['director', 'manager'].includes(normalize(actor.role))) {
    throw new Error('Only a Division manager, director or administrator can archive a Division report.');
  }
  if ((scope.type === 'corporate' || scope.type === 'audit') && !isAdministrator(actor)) {
    throw new Error('Only an administrator can archive corporate or audit reports.');
  }
}

function sameScope(
  left: StrategyReportArchiveRecord['scope'],
  right: StrategyReportArchiveRecord['scope'],
): boolean {
  return left.type === right.type && normalize(left.label) === normalize(right.label) &&
    normalize(left.division) === normalize(right.division) && normalize(left.unit) === normalize(right.unit) &&
    normalize(left.ownerEmail) === normalize(right.ownerEmail);
}

function assertEmail(value: string | undefined, label: string): string {
  const email = normalize(value);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${label} must be a valid email address.`);
  }
  return email;
}

export async function verifyStrategyReportArchive(
  archive: StrategyReportArchiveRecord,
  storageId = archive?.snapshotId || 'unknown',
): Promise<void> {
  if (archive?.archiveVersion !== 1 || archive.snapshotId !== archive.snapshot?.id) {
    throw new Error(`Stored report ${storageId} has an invalid archive envelope.`);
  }
  if (!archive.snapshot.integrity.isConserved || !archive.snapshot.snapshot.immutable ||
    archive.snapshot.snapshot.version !== 1 || archive.snapshot.snapshot.capturedAt !== archive.snapshot.generatedAt) {
    throw new Error(`Stored report ${storageId} has invalid immutable snapshot provenance.`);
  }
  if (await checksum(archive.snapshot) !== archive.snapshotChecksum) {
    throw new Error(`Stored report ${storageId} failed its snapshot checksum.`);
  }
}

export async function createStrategyReportScheduleBinding(
  archive: StoredStrategyReportArchive,
  actor: StrategyReportActor | null,
  recipient: string,
  cc?: string,
  now: () => string = () => new Date().toISOString(),
): Promise<StrategyReportScheduleBinding> {
  assertIdentity(actor);
  await verifyStrategyReportArchive(archive.record, archive.storageId);
  assertCanArchive(actor, archive.record.scope);
  const binding: StrategyReportScheduleBinding = {
    contractVersion: 1,
    archiveStorageId: archive.storageId,
    snapshotId: archive.record.snapshotId,
    snapshotChecksum: archive.record.snapshotChecksum,
    scope: clone(archive.record.scope),
    recipient: assertEmail(recipient, 'Report recipient'),
    cc: cc?.trim() ? assertEmail(cc, 'Report copy recipient') : undefined,
    boundAt: now(),
    boundBy: { email: normalize(actor.email), name: actor.name?.trim() || actor.email.trim() },
  };
  if (!Number.isFinite(Date.parse(binding.boundAt))) throw new Error('The schedule binding time is invalid.');
  return deepFreeze(clone(binding));
}

export async function buildStrategyReportDispatchEnvelope(
  binding: StrategyReportScheduleBinding,
  archive: StoredStrategyReportArchive,
): Promise<StrategyReportDispatchEnvelope> {
  await verifyStrategyReportArchive(archive.record, archive.storageId);
  if (binding.contractVersion !== 1 || binding.archiveStorageId !== archive.storageId ||
    binding.snapshotId !== archive.record.snapshotId || binding.snapshotChecksum !== archive.record.snapshotChecksum ||
    !sameScope(binding.scope, archive.record.scope)) {
    throw new Error('The report schedule binding does not match the archived snapshot identity and checksum.');
  }
  assertEmail(binding.recipient, 'Report recipient');
  if (binding.cc) assertEmail(binding.cc, 'Report copy recipient');
  return deepFreeze({ dispatchVersion: 1, binding: clone(binding), snapshot: clone(archive.record.snapshot) });
}

export function assertStrategyReportSchedulerDeployment(
  contract?: StrategyReportSchedulerDeploymentContract,
): asserts contract is StrategyReportSchedulerDeploymentContract {
  if (contract?.contractVersion !== 1 || contract.archiveTemplateId !== TEMPLATE_ID ||
    contract.deliveryTemplateId !== DELIVERY_TEMPLATE_ID || contract.executorId !== 'strategy-report-scheduled-delivery-v1' ||
    contract.scheduleSnapshotFieldsVerified !== true ||
    contract.dispatchReadsArchiveByIdAndChecksum !== true || contract.deliveryJournalWritesVerified !== true) {
    throw new Error(ARCHIVE_BOUND_SCHEDULER_BLOCK_MESSAGE);
  }
  if (contract.scheduleLeaseAndCheckpointWritesVerified !== true || contract.idempotentEmailSendVerified !== true) {
    throw new Error(ARCHIVE_BOUND_SCHEDULER_BLOCK_MESSAGE);
  }
}

/** Maps immutable archives onto the existing Performance_Reports list contract. */
export class SharePointStrategyReportArchiveStore implements StrategyReportArchiveStore {
  constructor(private gateway: StrategyReportSharePointGateway) {}

  async append(record: StrategyReportArchiveRecord): Promise<{ storageId: string }> {
    const saved = await this.gateway.saveReport({
      name: record.snapshot.title,
      template_id: TEMPLATE_ID,
      created_by: record.archivedBy.email,
      date_range: {
        start_date: record.snapshot.dateRange.start,
        end_date: record.snapshot.dateRange.end,
      },
      content: {
        metadata: { generated_at: record.snapshot.generatedAt, version: TEMPLATE_ID, ai_generated: false },
        archive: record,
      },
    });
    return { storageId: saved.id };
  }

  async list(limit: number): Promise<StoredStrategyReportArchive[]> {
    const reports = await this.gateway.getReports(Math.min(limit * 5, 200));
    return reports
      .filter(report => report.template_id === TEMPLATE_ID && report.content?.archive)
      .map(report => ({ storageId: report.id, record: report.content.archive as StrategyReportArchiveRecord }));
  }

  async appendDelivery(record: StrategyReportDeliveryRecord): Promise<{ storageId: string }> {
    const saved = await this.gateway.saveReport({
      name: `${record.event.channel}:${record.snapshotId}`,
      template_id: DELIVERY_TEMPLATE_ID,
      created_by: record.event.recordedBy,
      date_range: { start_date: record.event.occurredAt, end_date: record.event.occurredAt },
      content: {
        metadata: { generated_at: record.event.occurredAt, version: DELIVERY_TEMPLATE_ID, ai_generated: false },
        delivery: record,
      },
    });
    return { storageId: saved.id };
  }

  async listDeliveries(snapshotIds: readonly string[], limit: number): Promise<StoredStrategyReportDelivery[]> {
    if (snapshotIds.length === 0) return [];
    const wanted = new Set(snapshotIds);
    const reports = await this.gateway.getReports(Math.min(Math.max(limit * 10, 50), 200));
    return reports
      .filter(report => report.template_id === DELIVERY_TEMPLATE_ID && report.content?.delivery)
      .map(report => ({ storageId: report.id, record: report.content.delivery as StrategyReportDeliveryRecord }))
      .filter(item => wanted.has(item.record.snapshotId));
  }
}

/** Append-only archive: snapshots are checked, authorized, hashed and never updated in place. */
export class StrategyReportArchiveService {
  constructor(
    private store: StrategyReportArchiveStore,
    private identity: StrategyReportIdentityProvider,
    private now: () => string = () => new Date().toISOString(),
    private nextId: () => string = () => globalThis.crypto.randomUUID(),
  ) {}

  async archive(
    snapshot: StrategyTraceabilityReport,
    presentationConfig: Record<string, unknown>,
    scopeIdentity: StrategyReportScopeIdentity,
  ): Promise<StoredStrategyReportArchive> {
    const actor = await this.identity.current();
    assertIdentity(actor);
    if (!snapshot.integrity.isConserved || !snapshot.snapshot.immutable) {
      throw new Error('Only a conserved immutable strategy report can be archived.');
    }
    if (snapshot.snapshot.version !== 1 || snapshot.snapshot.capturedAt !== snapshot.generatedAt) {
      throw new Error('The report snapshot provenance is inconsistent.');
    }
    assertScopeIdentity(snapshot, scopeIdentity);
    const scope: StrategyReportArchiveRecord['scope'] = {
      type: snapshot.scope,
      label: snapshot.snapshot.scopeLabel,
      division: scopeIdentity.division?.trim() || undefined,
      unit: scopeIdentity.unit?.trim() || undefined,
      ownerEmail: normalize(scopeIdentity.ownerEmail) || undefined,
    };
    assertCanArchive(actor, scope);
    const snapshotCopy = clone(snapshot);
    const record: StrategyReportArchiveRecord = {
      archiveVersion: 1,
      snapshotId: snapshot.id,
      snapshotChecksum: await checksum(snapshotCopy),
      snapshot: snapshotCopy,
      archivedAt: this.now(),
      archivedBy: { email: normalize(actor.email), name: actor.name?.trim() || actor.email.trim() },
      scope,
      presentationConfig: clone(presentationConfig),
      retention: { mode: 'hold-until-policy-approved' },
      deliveryHistory: [],
    };
    const saved = await this.store.append(deepFreeze(clone(record)));
    return deepFreeze({ storageId: saved.storageId, record: clone(record) });
  }

  async history(limit = 50): Promise<readonly StoredStrategyReportArchive[]> {
    const actor = await this.identity.current();
    assertIdentity(actor);
    const stored = await this.store.list(Math.max(1, Math.min(limit, 200)));
    const visible: StoredStrategyReportArchive[] = [];
    for (const item of stored) {
      const record = item.record;
      await verifyStrategyReportArchive(record, item.storageId);
      if (canAccessStrategyReport(actor, record.scope)) visible.push(clone(item));
    }
    const bySnapshot = new Map(visible.map(item => [item.record.snapshotId, item]));
    const deliveryHistory = new Map<string, StrategyReportDeliveryEvent[]>(
      visible.map(item => [item.record.snapshotId, []]),
    );
    const deliveries = await this.store.listDeliveries([...bySnapshot.keys()], limit);
    for (const storedDelivery of deliveries) {
      const delivery = storedDelivery.record;
      const archive = bySnapshot.get(delivery.snapshotId);
      if (!archive) throw new Error(`Stored delivery ${storedDelivery.storageId} does not match its archived snapshot.`);
      await verifyStrategyReportDeliveryRecord(delivery, archive.record, storedDelivery.storageId);
      deliveryHistory.get(delivery.snapshotId)?.push(clone(delivery.event));
    }
    const hydrated = visible.map(item => ({
      ...item,
      record: {
        ...item.record,
        deliveryHistory: (deliveryHistory.get(item.record.snapshotId) || []).sort((left, right) =>
          Date.parse(right.occurredAt) - Date.parse(left.occurredAt)),
      },
    }));
    return deepFreeze(hydrated.sort((left, right) =>
      Date.parse(right.record.snapshot.generatedAt) - Date.parse(left.record.snapshot.generatedAt)));
  }

  async recordDelivery(
    archive: StrategyReportArchiveRecord,
    request: StrategyReportDeliveryRequest,
  ): Promise<StoredStrategyReportDelivery> {
    const actor = await this.identity.current();
    assertIdentity(actor);
    await verifyStrategyReportArchive(archive, archive.snapshotId);
    if (!canAccessStrategyReport(actor, archive.scope)) {
      throw new Error('You do not have permission to record delivery for this report scope.');
    }
    if (request.channel === 'email') assertCanArchive(actor, archive.scope);
    const record = await createStrategyReportDeliveryRecord(
      archive, request, actor.email, this.now, this.nextId,
    );
    const saved = await this.store.appendDelivery(deepFreeze(clone(record)));
    return deepFreeze({ storageId: saved.storageId, record: clone(record) });
  }
}

export function createSharePointStrategyReportArchiveService(
  gateway: AuthenticatedStrategyReportSharePointGateway,
): StrategyReportArchiveService {
  return new StrategyReportArchiveService(
    new SharePointStrategyReportArchiveStore(gateway),
    { current: () => gateway.getCurrentReportArchiveActor() },
  );
}
