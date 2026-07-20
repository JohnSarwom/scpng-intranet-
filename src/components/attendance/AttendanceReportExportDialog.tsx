import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getGraphClient } from '@/services/graphService';
import { TimeAttendanceSharePointService } from '@/services/timeAttendanceSharePointService';
import {
  buildAttendanceReport,
  buildAttendanceReportFileName,
  describeFortnightPeriod,
  downloadBlob,
  generateAttendanceReportPdf,
  generateAttendanceReportWorkbook,
  getDefaultReportPeriod,
  getFortnightPeriod,
} from '@/services/attendanceReportExportService';
import { AlertTriangle, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

interface AttendanceReportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Divisions the current user is allowed to export. Empty means all divisions. */
  availableDivisions?: string[];
  /** Pre-selects a division when the user is scoped to one. */
  defaultDivision?: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message || fallback : fallback;

type PeriodPreset = 'last' | 'previous' | 'current' | 'custom';

const periodPresets: Array<{ value: Exclude<PeriodPreset, 'custom'>; label: string; offset: number }> = [
  { value: 'last', label: 'Last completed fortnight', offset: 0 },
  { value: 'previous', label: 'Fortnight before last', offset: -1 },
  { value: 'current', label: 'Current fortnight (in progress)', offset: 1 },
];

/**
 * Resolves a preset to its date range. The "last completed" period is the
 * baseline, so the other presets step relative to it.
 */
const resolvePreset = (preset: Exclude<PeriodPreset, 'custom'>) => {
  const baseline = getDefaultReportPeriod();
  const offset = periodPresets.find((option) => option.value === preset)?.offset ?? 0;
  if (offset === 0) return baseline;
  // Re-anchor on the baseline's own start date so offsets stay relative to it.
  return getFortnightPeriod(new Date(`${baseline.startDateKey}T12:00:00Z`), offset);
};

const AttendanceReportExportDialog: React.FC<AttendanceReportExportDialogProps> = ({
  open,
  onOpenChange,
  availableDivisions = [],
  defaultDivision = '',
}) => {
  const { toast } = useToast();
  const [preset, setPreset] = useState<PeriodPreset>('last');
  const [startDate, setStartDate] = useState(() => getDefaultReportPeriod().startDateKey);
  const [endDate, setEndDate] = useState(() => getDefaultReportPeriod().endDateKey);
  const [division, setDivision] = useState(defaultDivision);
  const [generating, setGenerating] = useState<'xlsx' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeIsValid = useMemo(
    () => Boolean(startDate && endDate && startDate <= endDate),
    [startDate, endDate]
  );

  const rangeLabel = useMemo(
    () => (rangeIsValid ? describeFortnightPeriod({ startDateKey: startDate, endDateKey: endDate }) : ''),
    [rangeIsValid, startDate, endDate]
  );

  const handlePresetChange = (next: PeriodPreset) => {
    setPreset(next);
    setError(null);
    if (next === 'custom') return;
    const period = resolvePreset(next);
    setStartDate(period.startDateKey);
    setEndDate(period.endDateKey);
  };

  // Editing either date by hand means the range is no longer a preset fortnight.
  const handleDateChange = (which: 'start' | 'end', value: string) => {
    setPreset('custom');
    setError(null);
    if (which === 'start') setStartDate(value);
    else setEndDate(value);
  };

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    if (!rangeIsValid) {
      setError('The start date must be on or before the end date.');
      return;
    }

    setGenerating(format);
    setError(null);

    try {
      const client = await getGraphClient();
      const service = new TimeAttendanceSharePointService(client);

      const [records, exceptions] = await Promise.all([
        service.getAttendanceRange({ startDateKey: startDate, endDateKey: endDate, division: division || undefined }),
        service.getExceptionReasonsInRange(startDate, endDate),
      ]);

      if (records.length === 0) {
        setError('No attendance records were found for the selected range.');
        return;
      }

      const report = buildAttendanceReport(records, exceptions, {
        startDateKey: startDate,
        endDateKey: endDate,
        scopeLabel: division || undefined,
      });

      const blob =
        format === 'xlsx'
          ? await generateAttendanceReportWorkbook(report)
          : generateAttendanceReportPdf(report);

      downloadBlob(blob, buildAttendanceReportFileName(report, format));

      toast({
        title: 'Report downloaded',
        description: `${report.recordCount} record${report.recordCount === 1 ? '' : 's'} across ${report.employeeCount} staff member${report.employeeCount === 1 ? '' : 's'}.`,
      });

      onOpenChange(false);
    } catch (exportError) {
      const message = getErrorMessage(exportError, 'Unable to generate the attendance report.');
      setError(message);
      toast({ title: 'Export failed', description: message, variant: 'destructive' });
    } finally {
      setGenerating(null);
    }
  };

  const busy = generating !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-intranet-primary" />
            Export Attendance Report
          </DialogTitle>
          <DialogDescription>
            Downloads every attendance record in the selected period, grouped by branch, team and
            staff member with per-person total hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Pay period</span>
            <select
              value={preset}
              disabled={busy}
              onChange={(event) => handlePresetChange(event.target.value as PeriodPreset)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {periodPresets.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom range</option>
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Period start</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                disabled={busy}
                onChange={(event) => handleDateChange('start', event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Period end</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                disabled={busy}
                onChange={(event) => handleDateChange('end', event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>

          {rangeLabel && (
            <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Reporting on <span className="font-medium text-foreground">{rangeLabel}</span>
              {preset === 'custom' && ' (custom range)'}
            </p>
          )}

          {availableDivisions.length > 0 && (
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Division</span>
              <select
                value={division}
                disabled={busy}
                onChange={(event) => setDivision(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All divisions</option>
                {availableDivisions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={busy || !rangeIsValid}
            onClick={() => handleExport('pdf')}
          >
            {generating === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={busy || !rangeIsValid}
            onClick={() => handleExport('xlsx')}
          >
            {generating === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceReportExportDialog;
