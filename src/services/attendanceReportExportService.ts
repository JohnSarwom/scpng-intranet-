import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AttendanceExceptionReason, AttendanceRecord } from './timeAttendanceSharePointService';

const TIME_ZONE = 'Pacific/Port_Moresby';
const LUNCH_SECONDS = 60 * 60;
const UNASSIGNED_BRANCH = 'Unassigned';
const UNASSIGNED_TEAM = 'Unassigned';

/**
 * Permission that grants the organisation-wide attendance download. Admins
 * manage it per group under Admin Portal -> Groups -> Time & Attendance.
 * Viewing the supervisor dashboard is governed separately by 'review'.
 */
export const ATTENDANCE_EXPORT_PERMISSION = {
  resource: 'attendance',
  action: 'export',
} as const;

export const ATTENDANCE_REPORT_COLUMNS = [
  'Branch',
  'Team',
  'Full Name',
  'Entry Date',
  'Checkin Time',
  'Checkout Time',
  'Late Clock In Reason',
  'Hrs (-Lunch)',
  'Hrs in Office',
  'Attendance Type',
  'Early Out Reason',
] as const;

export interface AttendanceReportEntry {
  dateKey: string;
  entryDate: string;
  checkInTime: string;
  checkOutTime: string;
  lateReason: string;
  earlyOutReason: string;
  attendanceType: string;
  netSeconds: number | null;
  officeSeconds: number | null;
}

export interface AttendanceReportEmployee {
  fullName: string;
  email: string;
  entries: AttendanceReportEntry[];
  totalNetSeconds: number;
  totalOfficeSeconds: number;
}

export interface AttendanceReportTeam {
  name: string;
  employees: AttendanceReportEmployee[];
}

export interface AttendanceReportBranch {
  name: string;
  teams: AttendanceReportTeam[];
}

export interface AttendanceReport {
  title: string;
  startDateKey: string;
  endDateKey: string;
  branches: AttendanceReportBranch[];
  recordCount: number;
  employeeCount: number;
}

export interface BuildAttendanceReportOptions {
  startDateKey: string;
  endDateKey: string;
  /** Overrides the "SCPNG Division" wording in the title, e.g. a single division name. */
  scopeLabel?: string;
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats an attendance date key (yyyy-MM-dd) as "Fri, 30 Jan 2026". */
export function formatEntryDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]}, ${String(day).padStart(2, '0')} ${MONTHS[month - 1]} ${year}`;
}

/** Formats an attendance date key as "1 Feb 2026" for the report title. */
function formatTitleDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Renders an ISO timestamp as a Port Moresby wall-clock time, "08:03:38". */
function formatClockTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('hour')}:${get('minute')}:${get('second')}`;
}

/* ------------------------------------------------------------------ */
/* Pay period (fortnight) helpers                                      */
/* ------------------------------------------------------------------ */

/**
 * Monday that opened pay period 03-2026. Every fortnight is measured from here,
 * so periods run Monday -> Sunday exactly like the reference workbook.
 */
const FORTNIGHT_ANCHOR_KEY = '2026-01-19';
const FORTNIGHT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FortnightPeriod {
  startDateKey: string;
  endDateKey: string;
}

/** Today's date in Port Moresby, as a yyyy-MM-dd key. */
function getLocalDateKey(reference: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateKeyToUtc(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcToDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Returns a Monday-to-Sunday fortnight. `offset` is relative to the period
 * containing `reference`: 0 is the current one, -1 the previous, and so on.
 */
export function getFortnightPeriod(reference: Date = new Date(), offset = 0): FortnightPeriod {
  const anchor = dateKeyToUtc(FORTNIGHT_ANCHOR_KEY);
  const today = dateKeyToUtc(getLocalDateKey(reference));
  const daysSinceAnchor = Math.floor((today.getTime() - anchor.getTime()) / DAY_MS);
  const periodIndex = Math.floor(daysSinceAnchor / FORTNIGHT_DAYS) + offset;

  const start = new Date(anchor.getTime() + periodIndex * FORTNIGHT_DAYS * DAY_MS);
  const end = new Date(start.getTime() + (FORTNIGHT_DAYS - 1) * DAY_MS);

  return { startDateKey: utcToDateKey(start), endDateKey: utcToDateKey(end) };
}

/**
 * The default report range: the most recently *completed* fortnight. A period
 * that is still running is skipped so the export never returns a partial one.
 */
export function getDefaultReportPeriod(reference: Date = new Date()): FortnightPeriod {
  const current = getFortnightPeriod(reference, 0);
  const todayKey = getLocalDateKey(reference);
  return todayKey <= current.endDateKey ? getFortnightPeriod(reference, -1) : current;
}

/** Human-readable period label, e.g. "Mon, 06 Jul 2026 - Sun, 19 Jul 2026". */
export function describeFortnightPeriod(period: FortnightPeriod): string {
  return `${formatEntryDate(period.startDateKey)} - ${formatEntryDate(period.endDateKey)}`;
}

/** Renders a duration in seconds as "65:30:01" (hours are not wrapped at 24). */
export function formatDurationHms(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

/** The reference report labels branches without the trailing "Division". */
function normaliseBranch(division?: string): string {
  const name = (division || '').trim();
  if (!name) return UNASSIGNED_BRANCH;
  return name.replace(/\s+Division$/i, '');
}

function describeReason(reason?: AttendanceExceptionReason): string {
  if (!reason) return '';
  return (reason.reasonDetails || '').trim() || (reason.reasonCategory || '').trim();
}

/* ------------------------------------------------------------------ */
/* Report builder                                                      */
/* ------------------------------------------------------------------ */

/**
 * Groups flat attendance records into the Branch → Team → Employee → Entry
 * hierarchy used by the divisional attendance report, computing per-employee
 * "Total Hours Worked" subtotals along the way.
 */
export function buildAttendanceReport(
  records: AttendanceRecord[],
  exceptions: Map<string, AttendanceExceptionReason>,
  options: BuildAttendanceReportOptions
): AttendanceReport {
  const { startDateKey, endDateKey, scopeLabel } = options;

  // Branch -> Team -> employee email -> employee
  const branchMap = new Map<string, Map<string, Map<string, AttendanceReportEmployee>>>();
  let employeeCount = 0;

  for (const record of records) {
    const branchName = normaliseBranch(record.division);
    const teamName = (record.unit || '').trim() || UNASSIGNED_TEAM;
    const email = (record.employeeEmail || '').toLowerCase();
    const fullName = (record.employeeName || '').trim() || record.employeeEmail || 'Unknown';

    let teams = branchMap.get(branchName);
    if (!teams) {
      teams = new Map();
      branchMap.set(branchName, teams);
    }

    let employees = teams.get(teamName);
    if (!employees) {
      employees = new Map();
      teams.set(teamName, employees);
    }

    let employee = employees.get(email);
    if (!employee) {
      employee = { fullName, email, entries: [], totalNetSeconds: 0, totalOfficeSeconds: 0 };
      employees.set(email, employee);
      employeeCount += 1;
    }

    const clockIn = record.clockInTime ? new Date(record.clockInTime) : null;
    const clockOut = record.clockOutTime ? new Date(record.clockOutTime) : null;
    const hasSpan = Boolean(clockIn && clockOut && !Number.isNaN(clockIn.getTime()) && !Number.isNaN(clockOut.getTime()));

    const officeSeconds = hasSpan
      ? Math.max(0, Math.round((clockOut!.getTime() - clockIn!.getTime()) / 1000))
      : null;
    const netSeconds = officeSeconds === null ? null : Math.max(0, officeSeconds - LUNCH_SECONDS);

    employee.entries.push({
      dateKey: record.attendanceDateKey,
      entryDate: formatEntryDate(record.attendanceDateKey),
      checkInTime: formatClockTime(record.clockInTime),
      checkOutTime: formatClockTime(record.clockOutTime),
      // Late arrivals are stored with ExceptionType 'Other' by submitLateReason.
      lateReason: record.isLate ? describeReason(exceptions.get(`${record.attendanceId}::Other`)) : '',
      // There is no dedicated early-out reason capture yet; the missed clock-out
      // exception is the only reason on file explaining a short/absent checkout.
      earlyOutReason: describeReason(exceptions.get(`${record.attendanceId}::MissedClockOut`)),
      attendanceType: record.status === 'Leave' || record.status === 'Holiday' ? record.status : 'Normal',
      netSeconds,
      officeSeconds,
    });

    employee.totalNetSeconds += netSeconds ?? 0;
    employee.totalOfficeSeconds += officeSeconds ?? 0;
  }

  const branches: AttendanceReportBranch[] = Array.from(branchMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([branchName, teamMap]) => ({
      name: branchName,
      teams: Array.from(teamMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([teamName, employeeMap]) => ({
          name: teamName,
          employees: Array.from(employeeMap.values())
            .map((employee) => ({
              ...employee,
              // Newest entry first, matching the reference workbook.
              entries: employee.entries.sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
            }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        })),
    }));

  return {
    title: `Staff Attendance Report for ${scopeLabel || 'SCPNG Division'} from ${formatTitleDate(startDateKey)} to ${formatTitleDate(endDateKey)}`,
    startDateKey,
    endDateKey,
    branches,
    recordCount: records.length,
    employeeCount,
  };
}

/* ------------------------------------------------------------------ */
/* Row flattening (shared by both exporters)                           */
/* ------------------------------------------------------------------ */

interface FlatRow {
  cells: string[];
  isTotal: boolean;
}

interface FlatReport {
  rows: FlatRow[];
  /** 1-based row spans (relative to the first data row) for the merged Branch column. */
  branchSpans: Array<{ start: number; end: number }>;
  teamSpans: Array<{ start: number; end: number }>;
  nameSpans: Array<{ start: number; end: number }>;
}

function flattenReport(report: AttendanceReport): FlatReport {
  const rows: FlatRow[] = [];
  const branchSpans: FlatReport['branchSpans'] = [];
  const teamSpans: FlatReport['teamSpans'] = [];
  const nameSpans: FlatReport['nameSpans'] = [];

  for (const branch of report.branches) {
    const branchStart = rows.length + 1;

    for (const team of branch.teams) {
      const teamStart = rows.length + 1;

      for (const employee of team.employees) {
        const nameStart = rows.length + 1;

        for (const entry of employee.entries) {
          rows.push({
            isTotal: false,
            cells: [
              rows.length + 1 === branchStart ? branch.name : '',
              rows.length + 1 === teamStart ? team.name : '',
              rows.length + 1 === nameStart ? employee.fullName : '',
              entry.entryDate,
              entry.checkInTime,
              entry.checkOutTime,
              entry.lateReason,
              entry.netSeconds === null ? '' : formatDurationHms(entry.netSeconds),
              entry.officeSeconds === null ? '' : formatDurationHms(entry.officeSeconds),
              entry.attendanceType,
              entry.earlyOutReason,
            ],
          });
        }

        // Per-employee subtotal row.
        rows.push({
          isTotal: true,
          cells: [
            '',
            '',
            '',
            'Total Hours Worked',
            '',
            '',
            '',
            formatDurationHms(employee.totalNetSeconds),
            formatDurationHms(employee.totalOfficeSeconds),
            '',
            '',
          ],
        });

        nameSpans.push({ start: nameStart, end: rows.length });
      }

      teamSpans.push({ start: teamStart, end: rows.length });
    }

    branchSpans.push({ start: branchStart, end: rows.length });
  }

  return { rows, branchSpans, teamSpans, nameSpans };
}

/* ------------------------------------------------------------------ */
/* Excel export                                                        */
/* ------------------------------------------------------------------ */

const COLUMN_WIDTHS = [15.1, 12.9, 13.5, 14.3, 9.4, 10, 19.7, 9.9, 10, 13.1, 17.5];
const HEADER_FILL = 'FFD3D3D3';
const TOTAL_FONT_COLOUR = 'FF191970';

/** Builds the .xlsx workbook matching the SCPNG divisional attendance layout. */
export async function generateAttendanceReportWorkbook(report: AttendanceReport): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SCPNG Intranet';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('AttendanceDivisional', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Column A is a narrow gutter in the reference file; data starts at column B.
  sheet.getColumn(1).width = 1.74;
  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 2).width = width;
  });

  // Row 2: merged title banner across B:L.
  sheet.mergeCells(2, 2, 2, 12);
  const titleCell = sheet.getCell(2, 2);
  titleCell.value = report.title;
  titleCell.font = { bold: true, size: 9 };
  titleCell.alignment = { horizontal: 'center', vertical: 'top' };

  // Row 4: column headers.
  ATTENDANCE_REPORT_COLUMNS.forEach((label, index) => {
    const cell = sheet.getCell(4, index + 2);
    cell.value = label;
    cell.font = { bold: true, size: 8 };
    cell.alignment = { horizontal: 'left', vertical: 'top' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: 'thin' } };
  });

  const { rows, branchSpans, teamSpans, nameSpans } = flattenReport(report);
  const FIRST_DATA_ROW = 5;

  rows.forEach((row, index) => {
    const rowNumber = FIRST_DATA_ROW + index;

    row.cells.forEach((value, columnIndex) => {
      const cell = sheet.getCell(rowNumber, columnIndex + 2);
      cell.value = value || null;
      cell.font = row.isTotal
        ? { bold: true, size: 8, color: { argb: TOTAL_FONT_COLOUR } }
        : { size: 8 };
      cell.alignment = { vertical: 'top' };
      cell.border = { bottom: { style: 'thin' } };
    });

    if (row.isTotal) {
      // The "Total Hours Worked" label spans Entry Date -> Late Clock In Reason
      // (E:H) right-aligned against the two total columns, and Attendance Type
      // merges with Early Out Reason, matching the reference workbook.
      sheet.mergeCells(rowNumber, 5, rowNumber, 8);
      sheet.mergeCells(rowNumber, 11, rowNumber, 12);
      sheet.getCell(rowNumber, 5).alignment = { horizontal: 'right', vertical: 'top' };
    }
  });

  const mergeSpan = (column: number, spans: FlatReport['branchSpans']) => {
    for (const span of spans) {
      const start = FIRST_DATA_ROW + span.start - 1;
      const end = FIRST_DATA_ROW + span.end - 1;
      if (end > start) sheet.mergeCells(start, column, end, column);
      sheet.getCell(start, column).alignment = { vertical: 'top' };
    }
  };

  mergeSpan(2, branchSpans);
  mergeSpan(3, teamSpans);
  mergeSpan(4, nameSpans);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ------------------------------------------------------------------ */
/* PDF export                                                          */
/* ------------------------------------------------------------------ */

/** Builds a landscape A4 PDF of the same report, one table per branch. */
export function generateAttendanceReportPdf(report: AttendanceReport): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(report.title, pageWidth / 2, 32, { align: 'center' });

  const { rows } = flattenReport(report);

  // Reuse the Excel column proportions so both formats line up, scaled to fill
  // the printable width exactly (autoTable logs an error if fixed columns leave
  // the table narrower than the page).
  const margin = 20;
  const printableWidth = pageWidth - margin * 2;
  const widthTotal = COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);
  const columnStyles = Object.fromEntries(
    COLUMN_WIDTHS.map((width, index) => [index, { cellWidth: (width / widthTotal) * printableWidth }])
  );

  autoTable(doc, {
    startY: 48,
    head: [[...ATTENDANCE_REPORT_COLUMNS]],
    body: rows.map((row) => row.cells),
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [211, 211, 211], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5 },
    columnStyles,
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (rows[data.row.index]?.isTotal) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [25, 25, 112];
        if (data.column.index === 3) data.cell.styles.halign = 'right';
      }
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        `Generated ${new Date().toLocaleString('en-GB', { timeZone: TIME_ZONE })}`,
        40,
        pageHeight - 16
      );
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        pageWidth - 40,
        pageHeight - 16,
        { align: 'right' }
      );
      doc.setTextColor(0);
    },
  });

  return doc.output('blob');
}

/* ------------------------------------------------------------------ */
/* Download helpers                                                    */
/* ------------------------------------------------------------------ */

export function buildAttendanceReportFileName(report: AttendanceReport, extension: 'xlsx' | 'pdf'): string {
  return `AttendanceDivisional ${report.startDateKey} to ${report.endDateKey}.${extension}`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
