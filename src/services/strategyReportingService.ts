import type {
  LinkageDiagnostic,
  PerformanceNode,
  ProgressScope,
  StrategyExecutionGraph,
  StrategyReportRow,
  StrategyReportSection,
  StrategyReportType,
  StrategyTraceabilityReport,
  TaskNode,
} from '@/types/strategyExecution';

export interface StrategyReportRequest {
  type: StrategyReportType;
  title: string;
  generatedBy: string;
  dateRange: { start: string; end: string };
  generatedAt?: string;
  scopeLabel?: string;
}

const asTime = (value?: string | Date): number | undefined => {
  if (!value) return undefined;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
};

const inRange = (value: string | Date | undefined, start: number, end: number) => {
  const time = asTime(value);
  return time !== undefined && time >= start && time <= end;
};

/** A Task contributes when its planned interval overlaps the report or it completed inside it. */
export function taskIntersectsReportingWindow(task: TaskNode, start: number, end: number): boolean {
  if (inRange(task.completedAt, start, end)) return true;
  const raw = task.raw;
  const plannedStart = asTime(raw?.startDate);
  const plannedEnd = asTime(task.dueDate);
  if (plannedStart !== undefined && plannedEnd !== undefined) return plannedStart <= end && plannedEnd >= start;
  if (plannedStart !== undefined) return plannedStart >= start && plannedStart <= end;
  if (plannedEnd !== undefined) return plannedEnd >= start && plannedEnd <= end;
  return false;
}

function measurementEvidenceCount(node: PerformanceNode, start: number, end: number): number {
  const evidence = node.measurementEvidence;
  if (!evidence) return 0;
  const windowStart = asTime(evidence.windowStart);
  const windowEnd = asTime(evidence.windowEnd || evidence.asOf);
  const windowOverlaps = windowStart !== undefined && windowEnd !== undefined
    ? windowStart <= end && windowEnd >= start
    : windowStart !== undefined
      ? windowStart >= start && windowStart <= end
      : windowEnd !== undefined && windowEnd >= start && windowEnd <= end;
  const observations = (evidence.observations || []).filter(item => inRange(item.observedAt, start, end));
  const milestones = (evidence.milestones || []).filter(item =>
    inRange(item.completedAt, start, end) || inRange(item.dueDate, start, end));
  const refs = windowOverlaps ? evidence.evidenceRefs?.length || 0 : 0;
  const scalar = windowOverlaps && [
    evidence.actual, evidence.eligibleCount, evidence.compliantCount,
    evidence.expectedOccurrences, evidence.completedOccurrences,
  ].some(value => value !== undefined) ? 1 : 0;
  return observations.length + milestones.length + refs + scalar;
}

function diagnosticRows(diagnostics: LinkageDiagnostic[]): StrategyReportRow[] {
  return diagnostics.map(item => ({
    entityType: item.entityType,
    entityId: item.entityId,
    title: item.title || item.entityId,
    parentPath: item.parentEntityId ? `${item.parentEntityType || 'parent'}:${item.parentEntityId}` : '',
    diagnosticCount: 1,
    nextAction: item.recommendedAction || item.message,
    evidenceState: 'not-applicable',
  }));
}

function measurementVariance(node: PerformanceNode): Pick<StrategyReportRow, 'target' | 'actual' | 'variance' | 'varianceState' | 'measurementMode' | 'measurementOperator'> {
  const measurement = node.progress?.measurement;
  const target = measurement?.target;
  const actual = measurement?.actual;
  const base = {
    target,
    actual,
    measurementMode: measurement?.mode,
    measurementOperator: measurement?.operator,
  };
  if (target === undefined || actual === undefined || !Number.isFinite(target) || !Number.isFinite(actual)) {
    return { ...base, varianceState: 'unavailable' };
  }
  const variance = measurement?.operator === 'at-most' ? target - actual : actual - target;
  return {
    ...base,
    variance,
    varianceState: variance > 0 ? 'favorable' : variance < 0 ? 'unfavorable' : 'on-target',
  };
}

function freezeSnapshot<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) freezeSnapshot(child);
  return value;
}

export function buildStrategyReport(
  graph: StrategyExecutionGraph,
  request: StrategyReportRequest,
): StrategyTraceabilityReport {
  const start = asTime(request.dateRange.start);
  const parsedEnd = asTime(request.dateRange.end);
  const end = parsedEnd !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(request.dateRange.end)
    ? parsedEnd + 86_399_999
    : parsedEnd;
  const capturedAt = request.generatedAt || new Date().toISOString();
  const capturedTime = asTime(capturedAt);
  if (start === undefined || end === undefined || start > end) throw new Error('Choose a valid report date range.');
  if (capturedTime === undefined) throw new Error('Set a valid report generation time.');
  if (!request.generatedBy.trim()) throw new Error('The report generator identity is required.');
  if (!graph.integrity.isConserved) throw new Error('The strategy graph failed conservation; reporting is blocked.');
  if (['personal', 'unit', 'division'].includes(graph.scope) && !request.scopeLabel?.trim()) {
    throw new Error(`A ${graph.scope} report requires an explicit scope label.`);
  }

  const taskIncluded = new Set(
    Object.values(graph.lookups.tasksById).filter(task => taskIntersectsReportingWindow(task, start, end)).map(task => task.id),
  );
  const traceability: StrategyReportRow[] = [];
  const accountability: StrategyReportRow[] = [];
  const overdue: StrategyReportRow[] = [];
  const evidenceWarnings: StrategyReportRow[] = [];
  const seenPerformance = new Set<string>();
  const seenTasks = new Set<string>();
  let evidenceCount = 0;

  const visitTask = (task: TaskNode, path: string, divisionName?: string, unitName?: string) => {
    if (!taskIncluded.has(task.id) || seenTasks.has(task.id)) return;
    seenTasks.add(task.id);
    const completed = ['completed', 'done'].includes(task.status || '');
    const taskEvidence = task.evidenceCount || 0;
    evidenceCount += taskEvidence;
    const row: StrategyReportRow = {
      entityType: 'task', entityId: task.sourceId || task.id, title: task.title, parentPath: path,
      ownerName: task.ownerName, progress: completed ? 100 : task.raw?.completionPercentage || 0,
      statusBand: completed ? 'completed' : task.progress?.statusBand,
      calculationSource: task.progress?.source || 'explicit-status', evidenceCount: taskEvidence,
      diagnosticCount: task.diagnostics?.length || 0, divisionName, unitName,
      dueDate: task.dueDate, completedAt: task.completedAt,
      sourceList: task.sourceList, status: task.status, priority: task.raw?.priority,
      evidenceState: completed ? (taskEvidence > 0 ? 'present' : 'missing') : 'not-applicable',
      nextAction: completed && taskEvidence === 0 ? 'Attach completion evidence or add a dated comment.' : undefined,
    };
    traceability.push(row);
    if (completed && taskEvidence === 0) evidenceWarnings.push(row);
    const due = asTime(task.dueDate);
    if (!completed && due !== undefined && due < Math.min(end, capturedTime)) {
      overdue.push({ ...row, nextAction: 'Review the overdue Task and record the next action.' });
    }
  };

  const visitPerformance = (node: PerformanceNode, path: string, divisionName?: string, unitName?: string) => {
    if (seenPerformance.has(node.id)) return;
    seenPerformance.add(node.id);
    const nodePath = path ? `${path} > ${node.title}` : node.title;
    const directEvidence = measurementEvidenceCount(node, start, end);
    evidenceCount += directEvidence;
    const entityType = node.sourceList === 'Unit_Objectives'
      ? 'objective'
      : node.sourceList === 'Performance_KPIs' || node.ownerRole === 'officer'
        ? 'kpi'
        : 'performance_kra';
    const row: StrategyReportRow = {
      entityType,
      entityId: node.sourceId || node.id, title: node.title, parentPath: path,
      ownerName: node.ownerName, progress: node.progress?.value, statusBand: node.progress?.statusBand,
      calculationSource: node.progress?.source, evidenceCount: directEvidence,
      diagnosticCount: node.diagnostics?.length || 0,
      divisionName: node.division || divisionName, unitName: node.unit || unitName,
      evidenceState: node.measurementDefinition ? (directEvidence > 0 ? 'present' : 'missing') : 'not-applicable',
      sourceList: node.sourceList, status: node.status,
      ...measurementVariance(node),
      dataSource: node.dataSource,
      reportingFrequency: node.reportingFrequency,
      reviewAuthority: node.reviewAuthority,
      reviewStatus: node.reviewStatus,
    };
    traceability.push(row);
    node.tasks.forEach(task => visitTask(task, nodePath, node.division || divisionName, node.unit || unitName));
    node.children.forEach(child => visitPerformance(child, nodePath, node.division || divisionName, node.unit || unitName));
  };

  for (const goal of graph.goals) {
    traceability.push({
      entityType: 'strategic_goal', entityId: goal.sourceId || goal.id, title: goal.title,
      parentPath: '', ownerName: goal.ownerName, progress: goal.progress?.value,
      statusBand: goal.progress?.statusBand, calculationSource: goal.progress?.source,
      diagnosticCount: goal.diagnostics?.length || 0, evidenceState: 'not-applicable',
      sourceList: goal.sourceList,
    });
    (goal.performanceRoots || []).forEach(node => visitPerformance(node, goal.title, goal.divisionName));
  }
  graph.exceptions.performanceRecords.forEach(node => visitPerformance(node, 'Exceptions'));
  graph.exceptions.tasks.forEach(task => visitTask(task, 'Exceptions'));

  const performanceRows = traceability.filter(row => ['objective', 'performance_kra', 'kpi'].includes(row.entityType));
  const progressRows = performanceRows.filter(row => row.progress !== undefined);
  const kpiRows = performanceRows.filter(row => row.entityType === 'kpi');
  const bandForProgress = (progress?: number): StrategyReportRow['statusBand'] => {
    if (progress === undefined) return 'no_linked_data';
    if (progress >= 100) return 'completed';
    if (progress >= 80) return 'on_track';
    if (progress >= 60) return 'in_progress';
    if (progress > 0) return 'behind_or_early';
    return 'not_started';
  };
  const heatmapGroups = new Map<string, StrategyReportRow[]>();
  performanceRows.forEach(row => {
    const groupKey = `${row.divisionName || 'Unassigned division'}|${row.unitName || 'Division-wide'}`;
    const rows = heatmapGroups.get(groupKey) || [];
    rows.push(row);
    heatmapGroups.set(groupKey, rows);
  });
  const heatmap = [...heatmapGroups.entries()].map(([groupKey, rows]) => {
    const [divisionName, unitName] = groupKey.split('|');
    const available = rows.filter(row => row.progress !== undefined);
    const progress = available.length
      ? Math.round(available.reduce((sum, row) => sum + (row.progress || 0), 0) / available.length)
      : undefined;
    return {
      entityType: 'unit' as const,
      entityId: groupKey,
      title: unitName,
      parentPath: divisionName,
      divisionName,
      unitName,
      progress,
      statusBand: bandForProgress(progress),
      evidenceCount: rows.reduce((sum, row) => sum + (row.evidenceCount || 0), 0),
      diagnosticCount: rows.reduce((sum, row) => sum + (row.diagnosticCount || 0), 0),
      evidenceState: rows.some(row => row.evidenceState === 'missing') ? 'missing' as const : 'not-applicable' as const,
      nextAction: progress === undefined ? 'Resolve missing linked data before relying on this heatmap cell.' : undefined,
    };
  }).sort((left, right) => left.entityId.localeCompare(right.entityId));
  const accountabilityGroups = new Map<string, StrategyReportRow[]>();
  traceability.filter(row => ['objective', 'performance_kra', 'kpi', 'task'].includes(row.entityType)).forEach(row => {
    const owner = row.ownerName?.trim() || 'Unassigned';
    const groupKey = `${owner}|${row.divisionName || ''}|${row.unitName || ''}`;
    const rows = accountabilityGroups.get(groupKey) || [];
    rows.push(row);
    accountabilityGroups.set(groupKey, rows);
  });
  accountability.push(...[...accountabilityGroups.entries()].map(([groupKey, rows]) => {
    const [ownerName, divisionName, unitName] = groupKey.split('|');
    const available = rows.filter(row => row.progress !== undefined);
    const progress = available.length
      ? Math.round(available.reduce((sum, row) => sum + (row.progress || 0), 0) / available.length)
      : undefined;
    const actionCount = rows.filter(row => row.nextAction || row.evidenceState === 'missing' || (row.diagnosticCount || 0) > 0).length;
    return {
      entityType: 'report' as const,
      entityId: groupKey,
      title: ownerName,
      parentPath: [divisionName, unitName].filter(Boolean).join(' > '),
      ownerName,
      divisionName: divisionName || undefined,
      unitName: unitName || undefined,
      progress,
      statusBand: bandForProgress(progress),
      evidenceCount: rows.reduce((sum, row) => sum + (row.evidenceCount || 0), 0),
      diagnosticCount: rows.reduce((sum, row) => sum + (row.diagnosticCount || 0), 0),
      nextAction: ownerName === 'Unassigned'
        ? `Assign an accountable owner to ${rows.length} record${rows.length === 1 ? '' : 's'}.`
        : actionCount > 0
          ? `Review ${actionCount} evidence, linkage or overdue action${actionCount === 1 ? '' : 's'}.`
          : undefined,
    };
  }).sort((left, right) => left.title.localeCompare(right.title)));
  const exceptionRows = traceability.filter(row => row.parentPath === 'Exceptions' || row.parentPath.startsWith('Exceptions >'));
  const relationshipDiagnostics = diagnosticRows(graph.diagnostics.filter(item =>
    Boolean(item.missingRelationship) || item.id.includes('unlinked') || item.id.includes('orphan')));
  const unlinked = [...exceptionRows, ...relationshipDiagnostics];
  const variance = kpiRows.map(row => ({
    ...row,
    nextAction: row.varianceState === 'unavailable'
      ? 'Record a normalized target and dated actual evidence for this reporting window.'
      : row.varianceState === 'unfavorable'
        ? 'Review the unfavorable measurement variance and record a corrective action.'
        : undefined,
  }));
  const reviewGovernance = kpiRows.map(row => {
    const missing = [
      !row.dataSource && 'data source',
      !row.reportingFrequency && 'reporting frequency',
      !row.reviewAuthority && 'review authority',
      (!row.reviewStatus || row.reviewStatus !== 'approved') && 'approved review',
      row.evidenceState === 'missing' && 'dated evidence',
    ].filter(Boolean);
    return {
      ...row,
      nextAction: missing.length ? `Complete KPI governance: ${missing.join(', ')}.` : undefined,
    };
  });
  const sections: StrategyReportSection[] = [
    { id: 'traceability', title: 'Strategy traceability', rows: traceability },
    { id: 'division-unit-heatmap', title: 'Division and Unit heatmap', rows: heatmap },
    { id: 'unlinked-records', title: 'Unlinked and exception records', rows: unlinked },
    { id: 'evidence-warnings', title: 'Completed without evidence', rows: evidenceWarnings },
    { id: 'overdue', title: 'Overdue strategic Tasks', rows: overdue },
    { id: 'owner-accountability', title: 'Owner accountability', rows: accountability },
    { id: 'progress-variance', title: 'KPI measurement variance', rows: variance },
    { id: 'kpi-review-governance', title: 'KPI evidence and review governance', rows: reviewGovernance },
    { id: 'diagnostics', title: 'Linkage diagnostics', rows: diagnosticRows(graph.diagnostics) },
  ];
  const sourceCounts = performanceRows.reduce((counts, row) => {
    counts[row.entityType] = (counts[row.entityType] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const report: StrategyTraceabilityReport = {
    id: `strategy-report:${graph.scope}:${capturedAt}`,
    title: request.title,
    type: request.type,
    scope: graph.scope,
    generatedAt: capturedAt,
    generatedBy: request.generatedBy,
    dateRange: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
    source: 'graph',
    goals: structuredClone(graph.goals),
    diagnostics: structuredClone(graph.diagnostics),
    summary: {
      strategicGoalCount: graph.goals.length,
      organisationalKraCount: graph.goals.reduce((sum, goal) => sum + (goal.organisationalKras?.length || 0), 0),
      divisionCount: Object.keys(graph.lookups.divisionsById).length,
      unitCount: Object.keys(graph.lookups.unitsById).length,
      objectiveCount: sourceCounts.objective || 0,
      performanceKraCount: sourceCounts.performance_kra || 0,
      kpiCount: sourceCounts.kpi || 0,
      taskCount: seenTasks.size,
      evidenceCount,
      diagnosticCount: graph.diagnostics.length,
      averageProgress: progressRows.length
        ? Math.round(progressRows.reduce((sum, row) => sum + (row.progress || 0), 0) / progressRows.length)
        : 0,
    },
    sections,
    snapshot: {
      version: 1,
      graphGeneratedAt: graph.generatedAt,
      capturedAt,
      immutable: true,
      dateBasis: 'task-interval-overlap-and-completion-events',
      scopeLabel: request.scopeLabel?.trim() || graph.scope,
      dataSourceSummary: 'Conserved strategy execution graph with dated Task and KPI measurement evidence.',
      progressFormula: 'Stored graph calculation source per row; parent values use the graph rollup contract.',
    },
    integrity: structuredClone(graph.integrity),
  };
  return freezeSnapshot(report);
}

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** Export the same frozen rows shown in preview, including scope and hierarchy metadata. */
export function strategyReportToCsv(report: StrategyTraceabilityReport): string {
  const header = [
    'Report section', 'Scope', 'Scope label', 'Period start', 'Period end', 'Entity type', 'Source list', 'Entity ID', 'Title',
    'Parent path', 'Division', 'Unit', 'Owner', 'Progress', 'Status band', 'Calculation source',
    'Status', 'Priority', 'Due date', 'Completion date', 'Evidence count', 'Evidence state', 'Diagnostic count',
    'Measurement mode', 'Operator', 'Target', 'Actual', 'Variance', 'Variance state', 'Data source',
    'Reporting frequency', 'Review authority', 'Review status', 'Next action',
  ];
  const rows = report.sections.flatMap(section => section.rows.map(row => [section.title, row] as const));
  return [header, ...rows.map(([section, row]) => [
    section, report.scope, report.snapshot.scopeLabel, report.dateRange.start, report.dateRange.end,
    row.entityType, row.sourceList, row.entityId, row.title, row.parentPath, row.divisionName, row.unitName,
    row.ownerName, row.progress, row.statusBand, row.calculationSource, row.status, row.priority, row.dueDate, row.completedAt,
    row.evidenceCount, row.evidenceState, row.diagnosticCount, row.measurementMode, row.measurementOperator,
    row.target, row.actual, row.variance, row.varianceState, row.dataSource, row.reportingFrequency,
    row.reviewAuthority, row.reviewStatus, row.nextAction,
  ])].map(row => row.map(csvCell).join(',')).join('\n');
}
