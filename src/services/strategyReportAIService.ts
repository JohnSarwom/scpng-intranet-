import type { StoredStrategyReportArchive } from './strategyReportArchiveService';

export type StrategyAIAudience = 'division' | 'strategy';
export type StrategyAIEvidenceFilter =
  | 'all'
  | 'traceability'
  | 'exceptions'
  | 'delivery-risks'
  | 'accountability'
  | 'variance'
  | 'governance';

export interface StrategyAIArchiveRequest {
  audience: StrategyAIAudience;
  division?: string;
}

const FILTER_SECTIONS: Record<Exclude<StrategyAIEvidenceFilter, 'all'>, readonly string[]> = {
  traceability: ['traceability', 'division-unit-heatmap'],
  exceptions: ['unlinked-records', 'diagnostics'],
  'delivery-risks': ['evidence-warnings', 'overdue'],
  accountability: ['owner-accountability'],
  variance: ['progress-variance'],
  governance: ['kpi-review-governance'],
};

const normalize = (value?: string) => value?.trim().toLowerCase() || '';

/**
 * Selects from StrategyReportArchiveService.history(), which has already verified
 * checksum integrity and authoritative actor scope. Division AI never falls back
 * to another Division. Strategy AI prefers a corporate snapshot, then uses the
 * newest other authorized snapshot without widening its frozen scope.
 */
export function selectStrategyAIArchive(
  history: readonly StoredStrategyReportArchive[],
  request: StrategyAIArchiveRequest,
): StoredStrategyReportArchive {
  if (request.audience === 'division') {
    const division = normalize(request.division);
    if (!division) throw new Error('Division AI requires an exact Division identity.');
    const match = history.find(item => item.record.scope.type === 'division' &&
      normalize(item.record.scope.division || item.record.scope.label) === division);
    if (!match) {
      throw new Error('No authorized archived report exists for this Division. Generate and archive a Division report first.');
    }
    return match;
  }

  const corporate = history.find(item => item.record.scope.type === 'corporate');
  const match = corporate || history[0];
  if (!match) {
    throw new Error('No authorized archived strategy report is available. Generate and archive a report before using Strategy AI.');
  }
  return match;
}

export function strategyAIFilterRowCount(
  archive: StoredStrategyReportArchive | undefined,
  filter: StrategyAIEvidenceFilter,
): number {
  if (!archive) return 0;
  const sections = archive.record.snapshot.sections;
  if (filter === 'all') return sections.reduce((sum, section) => sum + section.rows.length, 0);
  const ids = new Set(FILTER_SECTIONS[filter]);
  return sections.filter(section => ids.has(section.id)).reduce((sum, section) => sum + section.rows.length, 0);
}

/** Serializes only the immutable archived snapshot; no live page metrics are accepted. */
export function serializeArchivedStrategyAIContext(
  archive: StoredStrategyReportArchive,
  filter: StrategyAIEvidenceFilter = 'all',
): string {
  const report = archive.record.snapshot;
  const selectedIds = filter === 'all' ? null : new Set(FILTER_SECTIONS[filter]);
  const sections = report.sections
    .filter(section => !selectedIds || selectedIds.has(section.id))
    .map(section => ({ id: section.id, title: section.title, rows: section.rows }));

  return [
    'ARCHIVED_STRATEGY_EVIDENCE_V1',
    `ARCHIVE_STORAGE_ID: ${archive.storageId}`,
    `SNAPSHOT_ID: ${archive.record.snapshotId}`,
    `SNAPSHOT_SHA256: ${archive.record.snapshotChecksum}`,
    `SCOPE_TYPE: ${archive.record.scope.type}`,
    `SCOPE_LABEL: ${archive.record.scope.label}`,
    `DIVISION: ${archive.record.scope.division || 'not-applicable'}`,
    `UNIT: ${archive.record.scope.unit || 'not-applicable'}`,
    `REPORT_GENERATED_AT: ${report.generatedAt}`,
    `REPORT_PERIOD: ${report.dateRange.start} to ${report.dateRange.end}`,
    `GRAPH_GENERATED_AT: ${report.snapshot.graphGeneratedAt}`,
    `DATE_BASIS: ${report.snapshot.dateBasis}`,
    `DATA_SOURCE: ${report.snapshot.dataSourceSummary}`,
    `PROGRESS_FORMULA: ${report.snapshot.progressFormula}`,
    `EVIDENCE_FILTER: ${filter}`,
    `SUMMARY_JSON: ${JSON.stringify(report.summary)}`,
    `SECTIONS_JSON: ${JSON.stringify(sections)}`,
  ].join('\n');
}

function normalizeNumericToken(token: string): string {
  const withoutFormatting = token.replace(/,/g, '').replace(/%$/, '');
  const value = Number(withoutFormatting);
  return Number.isFinite(value) ? String(value) : withoutFormatting;
}

function numericTokens(text: string, ignoreOrderedListMarkers = false): Set<string> {
  const source = ignoreOrderedListMarkers
    ? text.replace(/^\s*\d{1,3}[.)]\s+/gm, '')
    : text;
  const matches = source.match(/(?<![A-Za-z0-9_])[-+]?\d[\d,]*(?:\.\d+)?%?/g) || [];
  return new Set(matches.map(normalizeNumericToken));
}

export function unsupportedStrategyAINumericFacts(response: string, archivedContext: string): readonly string[] {
  const allowed = numericTokens(archivedContext);
  return Object.freeze([...numericTokens(response, true)].filter(token => !allowed.has(token)).sort());
}

/** Blocks assistant text before display when it introduces a numeric fact absent from the archive context. */
export function assertStrategyAIResponseUsesArchivedNumbers(response: string, archivedContext: string): void {
  if (unsupportedStrategyAINumericFacts(response, archivedContext).length > 0) {
    throw new Error('The AI response was withheld because it introduced numeric facts that are not present in the archived report evidence.');
  }
}
