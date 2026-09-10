import {
  buildStrategyReportDispatchEnvelope,
  type StoredStrategyReportArchive,
  type StrategyReportDeliveryEvent,
  type StrategyReportDeliveryRequest,
  type StrategyReportDispatchEnvelope,
  type StrategyReportScheduleBinding,
} from './strategyReportArchiveService';

export interface ScheduledStrategyReportDispatchRequest {
  requestVersion: 1;
  scheduleId: string;
  scheduledFor: string;
  binding: StrategyReportScheduleBinding;
}

export interface StrategyReportScheduleClaim {
  scheduleId: string;
  dispatchId: string;
  scheduledFor: string;
  leaseUntil: string;
}

export type StrategyReportScheduleClaimResult = 'acquired' | 'busy' | 'completed';

/** Must implement conditional/ETag writes so only one executor owns a dispatch lease. */
export interface StrategyReportScheduleCheckpointStore {
  claim(claim: StrategyReportScheduleClaim): Promise<StrategyReportScheduleClaimResult>;
  markSent(scheduleId: string, dispatchId: string, sentAt: string, providerMessageId?: string): Promise<void>;
  markFailed(scheduleId: string, dispatchId: string, failedAt: string, error: string): Promise<void>;
}

/** Must load one archive by its exact immutable Performance_Reports item ID. */
export interface StrategyReportScheduledArchiveReader {
  getByStorageId(storageId: string): Promise<StoredStrategyReportArchive | null>;
}

/** Implementations must checksum-verify events before returning them and append rather than update. */
export interface StrategyReportScheduledDeliveryJournal {
  listVerified(archive: StoredStrategyReportArchive): Promise<readonly StrategyReportDeliveryEvent[]>;
  record(archive: StoredStrategyReportArchive, request: StrategyReportDeliveryRequest): Promise<void>;
}

export interface StrategyReportEmailMessage {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  archiveStorageId: string;
  snapshotId: string;
  snapshotChecksum: string;
}

/** The provider must treat repeated calls with the same idempotency key as one email. */
export interface IdempotentStrategyReportEmailSender {
  send(message: StrategyReportEmailMessage, options: { idempotencyKey: string }): Promise<{ messageId: string }>;
}

export interface StrategyReportScheduledDispatchResult {
  dispatchId: string;
  status: 'sent' | 'already-sent' | 'busy';
  providerMessageId?: string;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach(child => deepFreeze(child));
  return value;
}

function validTimestamp(value: string, label: string): string {
  if (!value?.trim() || !Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(value).toISOString();
}

function required(value: string, label: string): string {
  const result = value?.trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(part => part.toString(16).padStart(2, '0')).join('');
}

export async function createStrategyReportDispatchId(
  request: ScheduledStrategyReportDispatchRequest,
): Promise<string> {
  if (request?.requestVersion !== 1 || request.binding?.contractVersion !== 1) {
    throw new Error('The scheduled report dispatch contract is unsupported.');
  }
  const scheduleId = required(request.scheduleId, 'Schedule identity');
  const scheduledFor = validTimestamp(request.scheduledFor, 'Scheduled dispatch time');
  const storageId = required(request.binding.archiveStorageId, 'Archive storage identity');
  const snapshotId = required(request.binding.snapshotId, 'Snapshot identity');
  const checksum = required(request.binding.snapshotChecksum, 'Snapshot checksum');
  return sha256(JSON.stringify([scheduleId, scheduledFor, storageId, snapshotId, checksum]));
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const metric = (value: unknown) => Number.isFinite(Number(value)) ? String(Number(value)) : 'Unavailable';

/** Renders only fields from the checksum-verified dispatch envelope; no live metric input exists. */
export function renderStrategyReportScheduledEmail(
  envelope: StrategyReportDispatchEnvelope,
): StrategyReportEmailMessage {
  const { binding, snapshot } = envelope;
  const summary = snapshot.summary;
  const subject = `${snapshot.title} — ${snapshot.snapshot.scopeLabel}`;
  const rows = [
    ['Average progress', `${metric(summary.averageProgress)}%`],
    ['Strategic goals', metric(summary.strategicGoalCount)],
    ['Objectives', metric(summary.objectiveCount)],
    ['Performance KRAs', metric(summary.performanceKraCount)],
    ['KPIs', metric(summary.kpiCount)],
    ['Tasks', metric(summary.taskCount)],
    ['Evidence records', metric(summary.evidenceCount)],
    ['Diagnostics', metric(summary.diagnosticCount)],
  ].map(([label, value]) => `<tr><th align="left" style="padding:6px 12px">${escapeHtml(label)}</th><td style="padding:6px 12px">${escapeHtml(value)}</td></tr>`).join('');
  const html = [
    '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222">',
    `<h1>${escapeHtml(snapshot.title)}</h1>`,
    `<p><strong>Scope:</strong> ${escapeHtml(snapshot.snapshot.scopeLabel)}</p>`,
    `<p><strong>Reporting period:</strong> ${escapeHtml(snapshot.dateRange.start)} to ${escapeHtml(snapshot.dateRange.end)}</p>`,
    `<table style="border-collapse:collapse">${rows}</table>`,
    `<p><strong>Data source:</strong> ${escapeHtml(snapshot.snapshot.dataSourceSummary)}</p>`,
    `<p><strong>Progress formula:</strong> ${escapeHtml(snapshot.snapshot.progressFormula)}</p>`,
    `<p style="font-size:11px;color:#666">Immutable snapshot ${escapeHtml(snapshot.id)} · SHA-256 ${escapeHtml(binding.snapshotChecksum)}</p>`,
    '</body></html>',
  ].join('');
  return deepFreeze({
    to: binding.recipient,
    cc: binding.cc,
    subject,
    html,
    archiveStorageId: binding.archiveStorageId,
    snapshotId: binding.snapshotId,
    snapshotChecksum: binding.snapshotChecksum,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown scheduled delivery failure');
}

/**
 * Provider-neutral executor core. Tenant adapters remain disabled until archive reads, journal appends,
 * conditional schedule leases and idempotent email sends are independently verified.
 */
export class StrategyReportScheduledDeliveryExecutor {
  constructor(
    private archiveReader: StrategyReportScheduledArchiveReader,
    private journal: StrategyReportScheduledDeliveryJournal,
    private sender: IdempotentStrategyReportEmailSender,
    private checkpoints: StrategyReportScheduleCheckpointStore,
    private now: () => string = () => new Date().toISOString(),
    private leaseMilliseconds = 5 * 60 * 1000,
  ) {}

  async execute(request: ScheduledStrategyReportDispatchRequest): Promise<StrategyReportScheduledDispatchResult> {
    const dispatchId = await createStrategyReportDispatchId(request);
    const scheduledFor = validTimestamp(request.scheduledFor, 'Scheduled dispatch time');
    const startedAt = validTimestamp(this.now(), 'Executor time');
    if (Date.parse(scheduledFor) > Date.parse(startedAt)) {
      throw new Error('The scheduled report dispatch is not due yet.');
    }
    if (!Number.isFinite(this.leaseMilliseconds) || this.leaseMilliseconds <= 0) {
      throw new Error('The scheduled report lease duration is invalid.');
    }
    const leaseUntil = new Date(Date.parse(startedAt) + this.leaseMilliseconds).toISOString();
    const scheduleId = request.scheduleId.trim();
    const claim = await this.checkpoints.claim({ scheduleId, dispatchId, scheduledFor, leaseUntil });
    if (claim === 'busy') return deepFreeze({ dispatchId, status: 'busy' });
    if (claim === 'completed') return deepFreeze({ dispatchId, status: 'already-sent' });
    if (claim !== 'acquired') throw new Error('The schedule checkpoint store returned an unsupported claim result.');

    let archive: StoredStrategyReportArchive | null = null;
    let envelopeVerified = false;
    let sentJournaled = false;
    try {
      archive = await this.archiveReader.getByStorageId(request.binding.archiveStorageId);
      if (!archive) throw new Error(`Archived strategy report ${request.binding.archiveStorageId} was not found.`);
      const envelope = await buildStrategyReportDispatchEnvelope(request.binding, archive);
      envelopeVerified = true;
      const history = await this.journal.listVerified(archive);
      const priorSent = history.find(event => event.channel === 'email' && event.status === 'sent' && event.dispatchId === dispatchId);
      if (priorSent) {
        await this.checkpoints.markSent(scheduleId, dispatchId, startedAt, priorSent.providerMessageId);
        return deepFreeze({ dispatchId, status: 'already-sent', providerMessageId: priorSent.providerMessageId });
      }
      if (!history.some(event => event.channel === 'email' && event.status === 'queued' && event.dispatchId === dispatchId)) {
        await this.journal.record(archive, {
          channel: 'email', status: 'queued', recipient: request.binding.recipient, scheduleId, dispatchId,
        });
      }
      const message = renderStrategyReportScheduledEmail(envelope);
      const sent = await this.sender.send(message, { idempotencyKey: dispatchId });
      const providerMessageId = required(sent?.messageId, 'Email provider message identity');
      await this.journal.record(archive, {
        channel: 'email', status: 'sent', recipient: request.binding.recipient,
        scheduleId, dispatchId, providerMessageId,
      });
      sentJournaled = true;
      const sentAt = validTimestamp(this.now(), 'Email completion time');
      await this.checkpoints.markSent(scheduleId, dispatchId, sentAt, providerMessageId);
      return deepFreeze({ dispatchId, status: 'sent', providerMessageId });
    } catch (error) {
      const message = errorMessage(error);
      const failedAt = validTimestamp(this.now(), 'Failure checkpoint time');
      const secondary: string[] = [];
      if (archive && envelopeVerified && !sentJournaled) {
        try {
          await this.journal.record(archive, {
            channel: 'email', status: 'failed', recipient: request.binding.recipient,
            scheduleId, dispatchId, error: message,
          });
        } catch (journalError) {
          secondary.push(`delivery journal: ${errorMessage(journalError)}`);
        }
      }
      try {
        await this.checkpoints.markFailed(scheduleId, dispatchId, failedAt, message);
      } catch (checkpointError) {
        secondary.push(`schedule checkpoint: ${errorMessage(checkpointError)}`);
      }
      throw new Error(secondary.length ? `${message} (${secondary.join('; ')})` : message);
    }
  }
}
