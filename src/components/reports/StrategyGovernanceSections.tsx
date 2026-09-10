import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { StrategyReportRow, StrategyTraceabilityReport } from '@/types/strategyExecution';
import type { StrategyReportDeliveryEvent } from '@/services/strategyReportArchiveService';

const SECTION_IDS = [
  'division-unit-heatmap',
  'unlinked-records',
  'evidence-warnings',
  'overdue',
  'owner-accountability',
  'progress-variance',
  'kpi-review-governance',
  'diagnostics',
];

const findingSections = new Set(['unlinked-records', 'evidence-warnings', 'overdue', 'diagnostics']);

const bandClass = (row: StrategyReportRow) => {
  if (row.statusBand === 'completed' || row.statusBand === 'on_track' || row.varianceState === 'favorable') {
    return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300';
  }
  if (row.statusBand === 'behind_or_early' || row.varianceState === 'unfavorable' || row.evidenceState === 'missing') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300';
};

export const StrategyGovernanceSections: React.FC<{
  report: StrategyTraceabilityReport;
  deliveryHistory?: readonly StrategyReportDeliveryEvent[];
}> = ({ report, deliveryHistory = [] }) => {
  const sections = SECTION_IDS.map(id => report.sections.find(section => section.id === id)).filter(Boolean);
  return (
    <div className="space-y-6">
      {sections.map(section => {
        if (!section) return null;
        return (
          <section key={section.id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">{section.title}</h2>
              <Badge variant="outline">{section.rows.length}</Badge>
            </div>
            {section.rows.length === 0 ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
                {findingSections.has(section.id) ? 'No findings in this frozen scope and reporting period.' : 'No report rows are available for this section.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[920px] text-xs">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-2 font-semibold">Record</th>
                      <th className="p-2 font-semibold">Division / Unit</th>
                      <th className="p-2 font-semibold">Owner</th>
                      <th className="p-2 font-semibold">State</th>
                      <th className="p-2 text-right font-semibold">Progress</th>
                      <th className="p-2 text-right font-semibold">Evidence</th>
                      <th className="p-2 font-semibold">Variance / Review</th>
                      <th className="p-2 font-semibold">Required action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, index) => (
                      <tr key={`${section.id}:${row.entityType}:${row.entityId}:${index}`} className="border-t align-top">
                        <td className="p-2">
                          <div className="font-medium">{row.title}</div>
                          <div className="mt-0.5 capitalize text-muted-foreground">{row.entityType.replace(/_/g, ' ')}</div>
                        </td>
                        <td className="p-2">{[row.divisionName, row.unitName].filter(Boolean).join(' / ') || row.parentPath || '—'}</td>
                        <td className="p-2">{row.ownerName || 'Unassigned'}</td>
                        <td className="p-2">
                          <Badge variant="outline" className={bandClass(row)}>
                            {(row.statusBand || row.varianceState || row.evidenceState || row.status || 'recorded').replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">{row.progress === undefined ? '—' : `${Math.round(row.progress)}%`}</td>
                        <td className="p-2 text-right">{row.evidenceCount || 0}</td>
                        <td className="p-2">
                          {row.variance !== undefined ? `${row.variance > 0 ? '+' : ''}${row.variance}` : '—'}
                          {row.reviewStatus && <div className="mt-0.5 capitalize text-muted-foreground">{row.reviewStatus.replace(/_/g, ' ')}</div>}
                        </td>
                        <td className="p-2">{row.nextAction || 'No action recorded.'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">Delivery and export audit</h2>
          <Badge variant="outline">{deliveryHistory.length}</Badge>
        </div>
        {deliveryHistory.length === 0 ? (
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            No queued, sent, failed, print or download event has been recorded for this archived snapshot.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="p-2 font-semibold">Time</th><th className="p-2 font-semibold">Channel</th>
                <th className="p-2 font-semibold">Status</th><th className="p-2 font-semibold">Recipient</th>
                <th className="p-2 font-semibold">Recorded by</th><th className="p-2 font-semibold">Error</th>
              </tr></thead>
              <tbody>{deliveryHistory.map(event => (
                <tr key={event.id} className="border-t">
                  <td className="p-2">{new Date(event.occurredAt).toLocaleString('en-PG')}</td>
                  <td className="p-2 capitalize">{event.channel}</td>
                  <td className="p-2 capitalize">{event.status}</td>
                  <td className="p-2">{event.recipient || '—'}</td>
                  <td className="p-2">{event.recordedBy}</td>
                  <td className="p-2">{event.error || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
