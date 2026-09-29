import type { StrategyReportSchedulerDeploymentContract } from './strategyReportArchiveService';

export type SchedulerTenantEnvironmentKind = 'non-production' | 'production';
export type SchedulerColumnKind = 'text' | 'multiline-text' | 'date-time' | 'boolean' | 'choice' | 'unknown';

export interface SchedulerTenantColumnInventory {
  name: string;
  displayName?: string;
  kind: SchedulerColumnKind;
  indexed: boolean;
  enforceUniqueValues: boolean;
}

export interface SchedulerTenantListInventory {
  name: 'Performance_Reports' | 'Report_Schedules';
  exists: boolean;
  id?: string;
  displayName?: string;
  webUrl?: string;
  columns: readonly SchedulerTenantColumnInventory[];
  sampleItemHasETag: boolean | null;
  inspectionError?: string;
}

export interface SchedulerTenantInventory {
  inventoryVersion: 1;
  environmentName: string;
  environmentKind: SchedulerTenantEnvironmentKind;
  capturedAt: string;
  lists: readonly SchedulerTenantListInventory[];
}

export interface SchedulerTenantListMetadata {
  id: string;
  displayName?: string;
  webUrl?: string;
}

export interface SchedulerTenantColumnMetadata {
  name: string;
  displayName?: string;
  indexed?: boolean;
  enforceUniqueValues?: boolean;
  text?: { allowMultipleLines?: boolean };
  dateTime?: Record<string, unknown>;
  boolean?: Record<string, unknown>;
  choice?: { choices?: string[] };
}

/** Read-only by construction: implementations expose no create, patch, delete or send operation. */
export interface SchedulerTenantReadOnlyInventoryGateway {
  getListByName(name: 'Performance_Reports' | 'Report_Schedules'): Promise<SchedulerTenantListMetadata | null>;
  getColumns(listId: string): Promise<readonly SchedulerTenantColumnMetadata[]>;
  sampleItemETag(listId: string): Promise<string | null>;
}

interface SchedulerReadOnlyGraphRequest {
  select(value: string): SchedulerReadOnlyGraphRequest;
  top(value: number): SchedulerReadOnlyGraphRequest;
  get(): Promise<any>;
}

export interface SchedulerReadOnlyGraphClient {
  api(path: string): SchedulerReadOnlyGraphRequest;
}

/** Microsoft Graph adapter with GET-only surface area; it cannot provision or mutate tenant state. */
export class SharePointSchedulerTenantReadOnlyInventoryGateway implements SchedulerTenantReadOnlyInventoryGateway {
  constructor(private client: SchedulerReadOnlyGraphClient, private siteId: string) {
    if (!siteId?.trim()) throw new Error('A SharePoint site identity is required for scheduler inventory.');
  }

  async getListByName(name: 'Performance_Reports' | 'Report_Schedules'): Promise<SchedulerTenantListMetadata | null> {
    try {
      const list = await this.client
        .api(`/sites/${this.siteId}/lists/${encodeURIComponent(name)}`)
        .select('id,displayName,webUrl')
        .get();
      return list?.id ? { id: String(list.id), displayName: list.displayName, webUrl: list.webUrl } : null;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.status === 404) return null;
      throw error;
    }
  }

  async getColumns(listId: string): Promise<readonly SchedulerTenantColumnMetadata[]> {
    const result = await this.client
      .api(`/sites/${this.siteId}/lists/${encodeURIComponent(listId)}/columns`)
      .select('name,displayName,indexed,enforceUniqueValues,text,dateTime,boolean,choice')
      .get();
    if (!Array.isArray(result?.value)) throw new Error(`Column inventory for list ${listId} was incomplete.`);
    return result.value;
  }

  async sampleItemETag(listId: string): Promise<string | null> {
    const result = await this.client
      .api(`/sites/${this.siteId}/lists/${encodeURIComponent(listId)}/items`)
      .select('id,eTag')
      .top(1)
      .get();
    const item = Array.isArray(result?.value) ? result.value[0] : undefined;
    return item?.eTag || item?.['@odata.etag'] || null;
  }
}

export interface SchedulerTenantCapabilityAttestations {
  verifiedAt: string;
  evidenceReference: string;
  leastPrivilegeServiceIdentity: boolean;
  exactArchiveReadByStorageId: boolean;
  appendOnlyDeliveryJournalWrites: boolean;
  conditionalScheduleLeaseAndCheckpointWrites: boolean;
  idempotentEmailSend: boolean;
}

export interface SchedulerTenantReadinessFinding {
  severity: 'blocker' | 'warning';
  code: string;
  target: string;
  message: string;
}

export interface SchedulerTenantReadinessManifest {
  manifestVersion: 1;
  assessedAt: string;
  inventory: SchedulerTenantInventory;
  findings: readonly SchedulerTenantReadinessFinding[];
  schemaReadyForAdapterImplementation: boolean;
  activationReady: boolean;
  deploymentContract?: StrategyReportSchedulerDeploymentContract;
}

type ExpectedColumn = {
  name: string;
  kinds: readonly SchedulerColumnKind[];
  indexed?: boolean;
  unique?: boolean;
};

const EXPECTED_COLUMNS: Record<SchedulerTenantListInventory['name'], readonly ExpectedColumn[]> = {
  Performance_Reports: [
    { name: 'Title', kinds: ['text'] },
    { name: 'ReportType', kinds: ['text'], indexed: true },
    { name: 'GeneratedBy', kinds: ['text'] },
    { name: 'StartDate', kinds: ['date-time'] },
    { name: 'EndDate', kinds: ['date-time'] },
    { name: 'ContentJSON', kinds: ['multiline-text'] },
    { name: 'AIAnalysis', kinds: ['boolean'] },
    { name: 'Status', kinds: ['choice', 'text'] },
  ],
  Report_Schedules: [
    { name: 'Title', kinds: ['text'] },
    { name: 'UserEmail', kinds: ['text'] },
    { name: 'ManagerEmail', kinds: ['text'] },
    { name: 'IsActive', kinds: ['boolean', 'text'], indexed: true },
    { name: 'NextSendAt', kinds: ['date-time'], indexed: true },
    { name: 'LastSentAt', kinds: ['date-time'] },
    { name: 'ArchiveStorageId', kinds: ['text'], indexed: true },
    { name: 'SnapshotId', kinds: ['text'], indexed: true },
    { name: 'SnapshotChecksum', kinds: ['text'] },
    { name: 'BindingJSON', kinds: ['multiline-text'] },
    { name: 'DispatchId', kinds: ['text'], indexed: true },
    { name: 'DispatchState', kinds: ['choice', 'text'] },
    { name: 'LeaseUntil', kinds: ['date-time'] },
    { name: 'LastProviderMessageId', kinds: ['text'] },
    { name: 'LastError', kinds: ['multiline-text'] },
  ],
};

const normalize = (value?: string) => value?.trim().toLowerCase() || '';

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

function columnKind(column: SchedulerTenantColumnMetadata): SchedulerColumnKind {
  if (column.text) return column.text.allowMultipleLines ? 'multiline-text' : 'text';
  if (column.dateTime) return 'date-time';
  if (column.boolean) return 'boolean';
  if (column.choice) return 'choice';
  return 'unknown';
}

async function inspectList(
  gateway: SchedulerTenantReadOnlyInventoryGateway,
  name: SchedulerTenantListInventory['name'],
): Promise<SchedulerTenantListInventory> {
  try {
    const list = await gateway.getListByName(name);
    if (!list?.id?.trim()) return { name, exists: false, columns: [], sampleItemHasETag: null };
    const [columns, sampleETag] = await Promise.all([
      gateway.getColumns(list.id),
      gateway.sampleItemETag(list.id),
    ]);
    return {
      name,
      exists: true,
      id: list.id.trim(),
      displayName: list.displayName?.trim() || undefined,
      webUrl: list.webUrl?.trim() || undefined,
      columns: columns.map(column => ({
        name: column.name,
        displayName: column.displayName,
        kind: columnKind(column),
        indexed: column.indexed === true,
        enforceUniqueValues: column.enforceUniqueValues === true,
      })),
      sampleItemHasETag: sampleETag === null ? null : !!sampleETag.trim(),
    };
  } catch (error) {
    return {
      name,
      exists: false,
      columns: [],
      sampleItemHasETag: null,
      inspectionError: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function collectSchedulerTenantInventory(
  gateway: SchedulerTenantReadOnlyInventoryGateway,
  environmentName: string,
  environmentKind: SchedulerTenantEnvironmentKind,
  now: () => string = () => new Date().toISOString(),
): Promise<SchedulerTenantInventory> {
  if (!environmentName?.trim()) throw new Error('A tenant environment name is required.');
  if (!['non-production', 'production'].includes(environmentKind)) throw new Error('The tenant environment kind is invalid.');
  const capturedAt = validTimestamp(now(), 'Inventory capture time');
  const lists = await Promise.all([
    inspectList(gateway, 'Performance_Reports'),
    inspectList(gateway, 'Report_Schedules'),
  ]);
  return deepFreeze({
    inventoryVersion: 1,
    environmentName: environmentName.trim(),
    environmentKind,
    capturedAt,
    lists,
  });
}

function schemaFindings(inventory: SchedulerTenantInventory): SchedulerTenantReadinessFinding[] {
  const findings: SchedulerTenantReadinessFinding[] = [];
  for (const list of inventory.lists) {
    if (!list.exists) {
      findings.push({
        severity: 'blocker', code: list.inspectionError ? 'list-inspection-failed' : 'list-missing', target: list.name,
        message: list.inspectionError || `${list.name} was not found.`,
      });
      continue;
    }
    const actualByName = new Map(list.columns.map(column => [normalize(column.name), column]));
    for (const expected of EXPECTED_COLUMNS[list.name]) {
      const actual = actualByName.get(normalize(expected.name));
      if (!actual) {
        findings.push({ severity: 'blocker', code: 'column-missing', target: `${list.name}.${expected.name}`, message: 'Required column is missing.' });
        continue;
      }
      if (!expected.kinds.includes(actual.kind)) {
        findings.push({
          severity: 'blocker', code: 'column-kind-mismatch', target: `${list.name}.${expected.name}`,
          message: `Expected ${expected.kinds.join(' or ')}, found ${actual.kind}.`,
        });
      }
      if (expected.indexed && !actual.indexed) {
        findings.push({ severity: 'blocker', code: 'column-not-indexed', target: `${list.name}.${expected.name}`, message: 'Required query/identity column is not indexed.' });
      }
      if (expected.unique && !actual.enforceUniqueValues) {
        findings.push({ severity: 'blocker', code: 'column-not-unique', target: `${list.name}.${expected.name}`, message: 'Required identity column does not enforce unique values.' });
      }
    }
    if (list.name === 'Report_Schedules' && list.sampleItemHasETag !== true) {
      findings.push({
        severity: 'blocker', code: list.sampleItemHasETag === null ? 'schedule-etag-unverified' : 'schedule-etag-missing',
        target: list.name, message: 'A schedule item ETag is required for conditional lease/checkpoint writes.',
      });
    }
  }
  return findings;
}

function attestationFindings(
  inventory: SchedulerTenantInventory,
  attestations: SchedulerTenantCapabilityAttestations | undefined,
  assessedAt: string,
): SchedulerTenantReadinessFinding[] {
  if (!attestations) return [{
    severity: 'blocker', code: 'capability-attestations-missing', target: 'executor',
    message: 'Activation requires verified least-privilege identity, archive read, append-only journal, conditional checkpoint and idempotent email evidence.',
  }];
  const findings: SchedulerTenantReadinessFinding[] = [];
  let verifiedAt: string;
  try { verifiedAt = validTimestamp(attestations.verifiedAt, 'Capability verification time'); }
  catch (error) {
    return [{ severity: 'blocker', code: 'capability-attestation-time-invalid', target: 'executor', message: error instanceof Error ? error.message : String(error) }];
  }
  if (!attestations.evidenceReference?.trim()) {
    findings.push({ severity: 'blocker', code: 'capability-evidence-reference-missing', target: 'executor', message: 'Capability verification requires an auditable evidence reference.' });
  }
  const age = Date.parse(assessedAt) - Date.parse(verifiedAt);
  if (age < 0 || age > 30 * 24 * 60 * 60 * 1000) {
    findings.push({ severity: 'blocker', code: 'capability-attestations-stale', target: 'executor', message: 'Capability evidence must be current and no more than 30 days old.' });
  }
  for (const [key, label] of [
    ['leastPrivilegeServiceIdentity', 'Least-privilege executor service identity'],
    ['exactArchiveReadByStorageId', 'Exact archive read by storage ID and checksum'],
    ['appendOnlyDeliveryJournalWrites', 'Append-only delivery journal writes'],
    ['conditionalScheduleLeaseAndCheckpointWrites', 'Conditional schedule lease/checkpoint writes'],
    ['idempotentEmailSend', 'Idempotent email-provider send'],
  ] as const) {
    if (attestations[key] !== true) findings.push({ severity: 'blocker', code: `capability-${key}-unverified`, target: 'executor', message: `${label} is not verified.` });
  }
  if (inventory.environmentKind === 'production') {
    findings.push({ severity: 'blocker', code: 'production-activation-not-approved', target: inventory.environmentName, message: 'This readiness slice does not authorize production activation.' });
  }
  return findings;
}

export function assessSchedulerTenantReadiness(
  inventory: SchedulerTenantInventory,
  attestations?: SchedulerTenantCapabilityAttestations,
  now: () => string = () => new Date().toISOString(),
): SchedulerTenantReadinessManifest {
  if (inventory?.inventoryVersion !== 1 || inventory.lists.length !== 2) throw new Error('The scheduler tenant inventory envelope is invalid.');
  const assessedAt = validTimestamp(now(), 'Readiness assessment time');
  const schema = schemaFindings(inventory);
  const capabilities = attestationFindings(inventory, attestations, assessedAt);
  const schemaReadyForAdapterImplementation = !schema.some(finding => finding.severity === 'blocker');
  const activationReady = schemaReadyForAdapterImplementation && !capabilities.some(finding => finding.severity === 'blocker');
  const deploymentContract: StrategyReportSchedulerDeploymentContract | undefined = activationReady ? {
    contractVersion: 1,
    archiveTemplateId: 'strategy-report-archive-v1',
    deliveryTemplateId: 'strategy-report-delivery-v1',
    executorId: 'strategy-report-scheduled-delivery-v1',
    scheduleSnapshotFieldsVerified: true,
    dispatchReadsArchiveByIdAndChecksum: true,
    deliveryJournalWritesVerified: true,
    scheduleLeaseAndCheckpointWritesVerified: true,
    idempotentEmailSendVerified: true,
  } : undefined;
  return deepFreeze({
    manifestVersion: 1,
    assessedAt,
    inventory,
    findings: [...schema, ...capabilities],
    schemaReadyForAdapterImplementation,
    activationReady,
    deploymentContract,
  });
}
