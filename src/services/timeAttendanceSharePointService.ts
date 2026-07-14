import { Client } from '@microsoft/microsoft-graph-client';
import { SharePointListSetupService } from './sharePointListSetupService';

const SITE_PATH = '/sites/scpngintranet';
const SITE_DOMAIN = 'scpng1.sharepoint.com';
const TIME_ZONE = 'Pacific/Port_Moresby';
const WORKDAY_START_MINUTES = 8 * 60 + 30;
const WORKDAY_END_MINUTES = 16 * 60;

const LISTS = {
  RECORDS: 'HR_AttendanceRecords',
  EXCEPTIONS: 'HR_AttendanceExceptions',
  AUDIT_LOG: 'HR_AttendanceAuditLog',
};

interface SharePointListItem {
  id: string;
  fields?: Record<string, unknown>;
}

interface SharePointListResponse {
  value?: SharePointListItem[];
}

export interface AttendanceEmployeeContext {
  employeeId?: string;
  employeeName: string;
  employeeEmail: string;
  division?: string;
  unit?: string;
  supervisorName?: string;
  supervisorEmail?: string;
}

export interface AttendanceNetworkContext {
  detectedPublicIp?: string | null;
  expectedOfficeIp: string;
  internalNetworkRange: string;
  userAgent?: string;
}

export interface AttendanceRecord {
  id: string;
  attendanceId: string;
  attendanceDateKey: string;
  employeeEmail: string;
  employeeName?: string;
  division?: string;
  unit?: string;
  supervisorName?: string;
  supervisorEmail?: string;
  clockInTime?: string;
  clockOutTime?: string;
  status: string;
  isLate: boolean;
  lateMinutes: number;
  isEarlyDeparture?: boolean;
  earlyDepartureMinutes?: number;
  isOvertime: boolean;
  overtimeMinutes: number;
  totalMinutes?: number;
}

export interface TeamAttendanceQuery {
  dateKey: string;
  supervisorEmail: string;
  division?: string;
  unit?: string;
  roleName?: string;
  isAdmin?: boolean;
}

export interface LateReason {
  id: string;
  reasonCategory: string;
  reasonDetails?: string;
}

export interface AttendanceExceptionReason {
  id: string;
  exceptionType: string;
  reasonCategory: string;
  reasonDetails?: string;
  reviewStatus: string;
}

export class TimeAttendanceSharePointService {
  private client: Client;
  private siteId: string | null = null;
  private listIds: Map<string, string> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  async initialize(): Promise<void> {
    if (this.siteId && this.listIds.size > 0) return;

    const site = await this.client.api(`/sites/${SITE_DOMAIN}:${SITE_PATH}`).get();
    if (!site?.id) {
      throw new Error(`SharePoint site not found at ${SITE_DOMAIN}:${SITE_PATH}`);
    }

    this.siteId = site.id;
    await this.loadListIds();

    if (!this.listIds.has(LISTS.RECORDS) || !this.listIds.has(LISTS.EXCEPTIONS) || !this.listIds.has(LISTS.AUDIT_LOG)) {
      await this.tryProvisionAttendanceLists();
      await this.loadListIds();
    }

    if (!this.listIds.has(LISTS.RECORDS) || !this.listIds.has(LISTS.EXCEPTIONS) || !this.listIds.has(LISTS.AUDIT_LOG)) {
      throw new Error('Attendance SharePoint lists are not ready. Please ask ICT/Admin to run the Time and Attendance list setup.');
    }
  }

  async getTodayRecord(employeeEmail: string): Promise<AttendanceRecord | null> {
    await this.initialize();

    const email = this.escapeOData(employeeEmail.toLowerCase());
    const dateKey = getAttendanceDateKey();
    const listId = this.getListId(LISTS.RECORDS);

    const response = await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items`)
      .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
      .expand('fields')
      .filter(`fields/EmployeeEmail eq '${email}' and fields/AttendanceDateKey eq '${dateKey}'`)
      .top(1)
      .get() as SharePointListResponse;

    const item = response.value?.[0];
    return item ? this.mapRecord(item) : null;
  }

  async getMyHistory(employeeEmail: string, days: number = 30): Promise<AttendanceRecord[]> {
    await this.initialize();

    const email = this.escapeOData(employeeEmail.toLowerCase());
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - Math.max(1, days));
    const fromKey = getAttendanceDateKey(fromDate);
    const listId = this.getListId(LISTS.RECORDS);

    const response = await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items`)
      .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
      .expand('fields')
      .filter(`fields/EmployeeEmail eq '${email}' and fields/AttendanceDateKey ge '${fromKey}'`)
      .top(200)
      .get() as SharePointListResponse;

    return (response.value || [])
      .map((item) => this.mapRecord(item))
      .sort((a: AttendanceRecord, b: AttendanceRecord) => b.attendanceDateKey.localeCompare(a.attendanceDateKey));
  }

  async getTeamAttendance(query: TeamAttendanceQuery): Promise<AttendanceRecord[]> {
    await this.initialize();

    const dateKey = this.escapeOData(query.dateKey);
    const listId = this.getListId(LISTS.RECORDS);
    const response = await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items`)
      .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
      .expand('fields')
      .filter(`fields/AttendanceDateKey eq '${dateKey}'`)
      .top(5000)
      .get() as SharePointListResponse;

    const supervisorEmail = query.supervisorEmail.toLowerCase();
    const roleName = (query.roleName || '').toLowerCase();
    const division = (query.division || '').trim().toLowerCase();
    const unit = (query.unit || '').trim().toLowerCase();
    const canUseDivisionScope = Boolean(query.isAdmin || roleName.includes('division') || roleName.includes('director') || roleName.includes('hr'));
    const canUseUnitScope = Boolean(canUseDivisionScope || roleName.includes('manager') || roleName.includes('supervisor'));

    return (response.value || [])
      .map((item) => this.mapRecord(item))
      .filter((record: AttendanceRecord) => {
        if (record.employeeEmail.toLowerCase() === supervisorEmail) return false;
        if (record.supervisorEmail?.toLowerCase() === supervisorEmail) return true;
        if (canUseUnitScope && unit && record.unit?.trim().toLowerCase() === unit) return true;
        if (canUseDivisionScope && division && record.division?.trim().toLowerCase() === division) return true;
        return false;
      })
      .sort((a: AttendanceRecord, b: AttendanceRecord) =>
        (a.employeeName || a.employeeEmail).localeCompare(b.employeeName || b.employeeEmail)
      );
  }

  async clockIn(employee: AttendanceEmployeeContext, network: AttendanceNetworkContext): Promise<AttendanceRecord> {
    await this.initialize();

    const existing = await this.getTodayRecord(employee.employeeEmail);
    if (existing?.clockInTime) {
      throw new Error('You have already clocked in today.');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const dateKey = getAttendanceDateKey(now);
    const attendanceId = existing?.attendanceId || createId('ATT');
    const lateMinutes = Math.max(0, getTimeZoneMinutes(now) - WORKDAY_START_MINUTES);
    const isLate = lateMinutes > 0;

    const fields = {
      Title: `${employee.employeeEmail.toLowerCase()}-${dateKey}`,
      AttendanceID: attendanceId,
      AttendanceDate: dateKey,
      AttendanceDateKey: dateKey,
      EmployeeID: employee.employeeId || '',
      EmployeeName: employee.employeeName,
      EmployeeEmail: employee.employeeEmail.toLowerCase(),
      Division: employee.division || '',
      Unit: employee.unit || '',
      SupervisorName: employee.supervisorName || '',
      SupervisorEmail: employee.supervisorEmail || '',
      ClockInTime: nowIso,
      ClockInSource: 'Intranet',
      Status: isLate ? 'Late' : 'ClockedIn',
      IsLate: isLate,
      LateMinutes: lateMinutes,
      IsEarlyDeparture: false,
      EarlyDepartureMinutes: 0,
      IsOvertime: false,
      OvertimeMinutes: 0,
      ClockOutRequired: true,
      NetworkCheckRequired: true,
      NetworkCheckPassed: true,
      NetworkCheckProvider: 'public-ip-lookup',
      DetectedPublicIP: network.detectedPublicIp || '',
      ExpectedOfficeIP: network.expectedOfficeIp,
      InternalNetworkRange: network.internalNetworkRange,
      DeviceUserAgent: network.userAgent || '',
      TimeZone: TIME_ZONE,
      IsManuallyCorrected: false,
      ExceptionStatus: 'None',
    };

    let item: SharePointListItem;
    const listId = this.getListId(LISTS.RECORDS);
    if (existing) {
      await this.client.api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}/fields`).patch(fields);
      item = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}`).expand('fields').get() as SharePointListItem;
    } else {
      item = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post({ fields }) as SharePointListItem;
    }

    await this.addAuditLog({
      actionType: 'ClockIn',
      attendanceId,
      employee,
      network,
      details: isLate ? `Clock-in recorded late by ${lateMinutes} minute(s).` : 'Clock-in recorded.',
    });

    return this.mapRecord(item);
  }

  async clockOut(employee: AttendanceEmployeeContext, network: AttendanceNetworkContext): Promise<AttendanceRecord> {
    await this.initialize();

    const existing = await this.getTodayRecord(employee.employeeEmail);
    if (!existing?.clockInTime) {
      throw new Error('You need to clock in before clocking out.');
    }
    if (existing.clockOutTime) {
      throw new Error('You have already clocked out today.');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const clockIn = new Date(existing.clockInTime);
    const totalMinutes = Math.max(0, Math.round((now.getTime() - clockIn.getTime()) / 60000));
    const nowMinutes = getTimeZoneMinutes(now);
    const overtimeMinutes = Math.max(0, nowMinutes - WORKDAY_END_MINUTES);
    const earlyDepartureMinutes = Math.max(0, WORKDAY_END_MINUTES - nowMinutes);
    const isOvertime = overtimeMinutes > 0;

    const fields = {
      ClockOutTime: nowIso,
      ClockOutSource: 'Intranet',
      Status: isOvertime ? 'Overtime' : 'ClockedOut',
      IsEarlyDeparture: earlyDepartureMinutes > 0,
      EarlyDepartureMinutes: earlyDepartureMinutes,
      IsOvertime: isOvertime,
      OvertimeMinutes: overtimeMinutes,
      TotalMinutes: totalMinutes,
      TotalHours: Number((totalMinutes / 60).toFixed(2)),
      NetworkCheckPassed: true,
      NetworkCheckProvider: 'public-ip-lookup',
      DetectedPublicIP: network.detectedPublicIp || '',
      ExpectedOfficeIP: network.expectedOfficeIp,
      InternalNetworkRange: network.internalNetworkRange,
      DeviceUserAgent: network.userAgent || '',
      TimeZone: TIME_ZONE,
    };

    const listId = this.getListId(LISTS.RECORDS);
    await this.client.api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}/fields`).patch(fields);
    const item = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}`).expand('fields').get() as SharePointListItem;

    await this.addAuditLog({
      actionType: 'ClockOut',
      attendanceId: existing.attendanceId,
      employee,
      network,
      details: isOvertime ? `Clock-out recorded with ${overtimeMinutes} overtime minute(s).` : 'Clock-out recorded.',
    });

    return this.mapRecord(item);
  }

  async getTodayLateReason(employeeEmail: string): Promise<LateReason | null> {
    await this.initialize();

    const email = this.escapeOData(employeeEmail.toLowerCase());
    const dateKey = getAttendanceDateKey();
    const listId = this.getListId(LISTS.EXCEPTIONS);

    const response = await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items`)
      .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
      .expand('fields')
      .filter(`fields/EmployeeEmail eq '${email}' and fields/AttendanceDate eq '${dateKey}' and fields/ExceptionType eq 'Other'`)
      .top(25)
      .get() as SharePointListResponse;

    const item = (response.value || []).find((candidate) =>
      String(candidate.fields?.Title || '').startsWith('late-arrival-')
    );

    if (!item) return null;

    return {
      id: item.id,
      reasonCategory: item.fields?.ReasonCategory || 'Other',
      reasonDetails: item.fields?.ReasonDetails || '',
    };
  }

  async getLateReasonForAttendance(attendanceId: string): Promise<LateReason | null> {
    await this.initialize();

    const safeAttendanceId = this.escapeOData(attendanceId);
    const listId = this.getListId(LISTS.EXCEPTIONS);

    const response = await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items`)
      .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
      .expand('fields')
      .filter(`fields/AttendanceID eq '${safeAttendanceId}' and fields/ExceptionType eq 'Other'`)
      .top(25)
      .get() as SharePointListResponse;

    const item = (response.value || []).find((candidate) =>
      String(candidate.fields?.Title || '').startsWith('late-arrival-')
    );

    if (!item) return null;

    return {
      id: item.id,
      reasonCategory: item.fields?.ReasonCategory || 'Other',
      reasonDetails: item.fields?.ReasonDetails || '',
    };
  }

  async getExceptionReason(attendanceId: string, exceptionType: string): Promise<AttendanceExceptionReason | null> {
    await this.initialize();

    const safeAttendanceId = this.escapeOData(attendanceId);
    const safeType = this.escapeOData(exceptionType);
    const listId = this.getListId(LISTS.EXCEPTIONS);

    const response = await this.client
      .api(`/sites/${this.siteId}/lists/${listId}/items`)
      .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
      .expand('fields')
      .filter(`fields/AttendanceID eq '${safeAttendanceId}' and fields/ExceptionType eq '${safeType}'`)
      .top(1)
      .get() as SharePointListResponse;

    const item = response.value?.[0];
    if (!item) return null;

    return {
      id: item.id,
      exceptionType: item.fields?.ExceptionType || exceptionType,
      reasonCategory: item.fields?.ReasonCategory || 'Other',
      reasonDetails: item.fields?.ReasonDetails || '',
      reviewStatus: item.fields?.ReviewStatus || 'Pending',
    };
  }

  async submitLateReason(params: {
    attendance: AttendanceRecord;
    employee: AttendanceEmployeeContext;
    reasonCategory: string;
    reasonDetails?: string;
  }): Promise<LateReason> {
    await this.initialize();

    const listId = this.getListId(LISTS.EXCEPTIONS);
    const existing = await this.getTodayLateReason(params.employee.employeeEmail);
    const dateKey = params.attendance.attendanceDateKey || getAttendanceDateKey();
    const normalizedEmail = params.employee.employeeEmail.toLowerCase();
    const fields = {
      Title: `late-arrival-${normalizedEmail}-${dateKey}`,
      ExceptionID: existing?.id ? undefined : createId('EXC'),
      AttendanceID: params.attendance.attendanceId,
      AttendanceDate: dateKey,
      EmployeeID: params.employee.employeeId || '',
      EmployeeName: params.employee.employeeName,
      EmployeeEmail: normalizedEmail,
      Division: params.employee.division || '',
      Unit: params.employee.unit || '',
      SupervisorEmail: params.employee.supervisorEmail || '',
      ExceptionType: 'Other',
      ReasonCategory: params.reasonCategory,
      ReasonDetails: params.reasonDetails || '',
      ReviewRequired: false,
      ReviewStatus: 'NotRequired',
      ReviewComments: 'Late arrival reason submitted by employee. No approval required.',
    };

    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    );

    let saved: SharePointListItem;
    if (existing) {
      await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}/fields`)
        .patch(cleanFields);
      saved = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}`).expand('fields').get() as SharePointListItem;
    } else {
      saved = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post({ fields: cleanFields }) as SharePointListItem;
    }

    await this.addAuditLog({
      actionType: 'ExceptionCreated',
      attendanceId: params.attendance.attendanceId,
      employee: params.employee,
      network: {
        expectedOfficeIp: '',
        internalNetworkRange: '',
      },
      details: `Late arrival reason submitted: ${params.reasonCategory}.`,
    });

    return {
      id: saved.id,
      reasonCategory: saved.fields?.ReasonCategory || params.reasonCategory,
      reasonDetails: saved.fields?.ReasonDetails || params.reasonDetails || '',
    };
  }

  async submitMissedClockOutReason(params: {
    attendance: AttendanceRecord;
    employee: AttendanceEmployeeContext;
    reasonCategory: string;
    reasonDetails?: string;
  }): Promise<AttendanceExceptionReason> {
    await this.initialize();

    const listId = this.getListId(LISTS.EXCEPTIONS);
    const existing = await this.getExceptionReason(params.attendance.attendanceId, 'MissedClockOut');
    const normalizedEmail = params.employee.employeeEmail.toLowerCase();
    const fields = {
      Title: `missed-clock-out-${normalizedEmail}-${params.attendance.attendanceDateKey}`,
      ExceptionID: existing?.id ? undefined : createId('EXC'),
      AttendanceID: params.attendance.attendanceId,
      AttendanceDate: params.attendance.attendanceDateKey,
      EmployeeID: params.employee.employeeId || '',
      EmployeeName: params.employee.employeeName,
      EmployeeEmail: normalizedEmail,
      Division: params.employee.division || '',
      Unit: params.employee.unit || '',
      SupervisorEmail: params.employee.supervisorEmail || '',
      ExceptionType: 'MissedClockOut',
      ReasonCategory: params.reasonCategory,
      ReasonDetails: params.reasonDetails || '',
      ReviewRequired: true,
      ReviewStatus: 'Pending',
      ReviewComments: 'Missed clock-out reason submitted by employee for supervisor review.',
    };

    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    );

    let saved: SharePointListItem;
    if (existing) {
      await this.client
        .api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}/fields`)
        .patch(cleanFields);
      saved = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items/${existing.id}`).expand('fields').get() as SharePointListItem;
    } else {
      saved = await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post({ fields: cleanFields }) as SharePointListItem;
    }

    await this.addAuditLog({
      actionType: 'ExceptionCreated',
      attendanceId: params.attendance.attendanceId,
      employee: params.employee,
      network: {
        expectedOfficeIp: '',
        internalNetworkRange: '',
      },
      details: `Missed clock-out reason submitted: ${params.reasonCategory}.`,
    });

    return {
      id: saved.id,
      exceptionType: saved.fields?.ExceptionType || 'MissedClockOut',
      reasonCategory: saved.fields?.ReasonCategory || params.reasonCategory,
      reasonDetails: saved.fields?.ReasonDetails || params.reasonDetails || '',
      reviewStatus: saved.fields?.ReviewStatus || 'Pending',
    };
  }

  private async loadListIds(): Promise<void> {
    if (!this.siteId) throw new Error('Site ID not initialized');

    const lists = await this.client.api(`/sites/${this.siteId}/lists`).get();
    this.listIds.clear();

    for (const list of lists.value || []) {
      if (Object.values(LISTS).includes(list.displayName)) {
        this.listIds.set(list.displayName, list.id);
      }
    }
  }

  private async tryProvisionAttendanceLists(): Promise<void> {
    if (!this.siteId) throw new Error('Site ID not initialized');

    try {
      const setupService = new SharePointListSetupService(this.client, this.siteId);
      const result = await setupService.setupTimeAttendanceLists();
      if (!result.success) {
        console.warn('[TimeAttendance] Attendance list setup did not complete:', result.message);
      }
    } catch (error) {
      console.warn('[TimeAttendance] Attendance list auto-setup failed:', error);
    }
  }

  private getListId(listName: string): string {
    const listId = this.listIds.get(listName);
    if (!listId) throw new Error(`SharePoint list not found: ${listName}`);
    return listId;
  }

  private async addAuditLog(params: {
    actionType: string;
    attendanceId: string;
    employee: AttendanceEmployeeContext;
    network: AttendanceNetworkContext;
    details: string;
  }): Promise<void> {
    try {
      const listId = this.getListId(LISTS.AUDIT_LOG);
      const now = new Date().toISOString();

      await this.client.api(`/sites/${this.siteId}/lists/${listId}/items`).post({
        fields: {
          Title: `${params.actionType}-${params.employee.employeeEmail}-${now}`,
          AuditID: createId('AUD'),
          AttendanceID: params.attendanceId,
          ActionType: params.actionType,
          ActionDateTime: now,
          ActorName: params.employee.employeeName,
          ActorEmail: params.employee.employeeEmail.toLowerCase(),
          ActorRole: 'Employee',
          EmployeeName: params.employee.employeeName,
          EmployeeEmail: params.employee.employeeEmail.toLowerCase(),
          Source: 'Intranet',
          NetworkCheckPassed: true,
          DetectedPublicIP: params.network.detectedPublicIp || '',
          Details: params.details,
        },
      });
    } catch (error) {
      console.warn('[TimeAttendance] Failed to write audit log:', error);
    }
  }

  private mapRecord(item: SharePointListItem): AttendanceRecord {
    const fields = item.fields || {};

    return {
      id: item.id,
      attendanceId: fields.AttendanceID || '',
      attendanceDateKey: fields.AttendanceDateKey || '',
      employeeEmail: fields.EmployeeEmail || '',
      employeeName: fields.EmployeeName || '',
      division: fields.Division || '',
      unit: fields.Unit || '',
      supervisorName: fields.SupervisorName || '',
      supervisorEmail: fields.SupervisorEmail || '',
      clockInTime: fields.ClockInTime || undefined,
      clockOutTime: fields.ClockOutTime || undefined,
      status: fields.Status || 'NotStarted',
      isLate: Boolean(fields.IsLate),
      lateMinutes: Number(fields.LateMinutes || 0),
      isEarlyDeparture: Boolean(fields.IsEarlyDeparture),
      earlyDepartureMinutes: Number(fields.EarlyDepartureMinutes || 0),
      isOvertime: Boolean(fields.IsOvertime),
      overtimeMinutes: Number(fields.OvertimeMinutes || 0),
      totalMinutes: fields.TotalMinutes !== undefined ? Number(fields.TotalMinutes || 0) : undefined,
    };
  }

  private escapeOData(value: string): string {
    return value.replace(/'/g, "''");
  }
}

export function getAttendanceDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function getTimeZoneMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
