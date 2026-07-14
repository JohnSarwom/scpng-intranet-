import React, { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import PageLayout from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { getGraphClient } from '@/services/graphService';
import {
  AttendanceExceptionReason,
  AttendanceRecord,
  LateReason,
  getAttendanceDateKey,
  TimeAttendanceSharePointService,
} from '@/services/timeAttendanceSharePointService';
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Filter,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
  Wifi,
} from 'lucide-react';

const OFFICE_PUBLIC_IP = '124.240.199.154';
const TIME_ZONE = 'Pacific/Port_Moresby';
const WORKDAY_START_MINUTES = 8 * 60 + 30;
const WORKDAY_END_MINUTES = 16 * 60;

const policyItems = [
  { label: 'Workday Start', value: '8:30 AM' },
  { label: 'Workday End', value: '4:00 PM' },
  { label: 'Grace Period', value: 'None' },
  { label: 'Lunch Tracking', value: 'Not tracked' },
];

const lateReasonOptions = [
  { value: 'traffic', label: 'Traffic', category: 'Transport' },
  { value: 'vehicle_issue', label: 'Vehicle issue', category: 'Transport' },
  { value: 'medical_issue', label: 'Medical issue', category: 'Medical' },
  { value: 'official_duty', label: 'Official duty', category: 'OfficialDuty' },
  { value: 'system_issue', label: 'System issue', category: 'SystemIssue' },
  { value: 'family_emergency', label: 'Family emergency', category: 'Other' },
  { value: 'weather', label: 'Weather', category: 'Other' },
  { value: 'other', label: 'Other', category: 'Other' },
];

const missedClockOutReasonOptions = [
  { value: 'forgot', label: 'Forgot to clock out', category: 'ForgotToClockOut' },
  { value: 'official_duty', label: 'Official duty', category: 'OfficialDuty' },
  { value: 'system_issue', label: 'System issue', category: 'SystemIssue' },
  { value: 'medical_issue', label: 'Medical issue', category: 'Medical' },
  { value: 'left_urgently', label: 'Left office urgently', category: 'Other' },
  { value: 'other', label: 'Other', category: 'Other' },
];

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message || fallback : fallback;

const TimeAttendance = () => {
  const { toast } = useToast();
  const { instance, accounts } = useMsal();
  const { user: roleUser, isAdmin, hasPermission } = useRoleBasedAuth();
  const [networkChecking, setNetworkChecking] = useState(true);
  const [networkAllowed, setNetworkAllowed] = useState(false);
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [teamRecords, setTeamRecords] = useState<AttendanceRecord[]>([]);
  const [historyLateReasons, setHistoryLateReasons] = useState<Record<string, LateReason | null>>({});
  const [lateReasonValue, setLateReasonValue] = useState('');
  const [lateReasonDetails, setLateReasonDetails] = useState('');
  const [missedClockOutReasons, setMissedClockOutReasons] = useState<Record<string, AttendanceExceptionReason | null>>({});
  const [missedClockOutForm, setMissedClockOutForm] = useState<Record<string, { reason: string; details: string }>>({});
  const [teamDate, setTeamDate] = useState(getAttendanceDateKey());
  const [teamStatusFilter, setTeamStatusFilter] = useState('all');
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [missedClockOutSavingId, setMissedClockOutSavingId] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [lateClockInDialogOpen, setLateClockInDialogOpen] = useState(false);
  const [earlyClockOutDialogOpen, setEarlyClockOutDialogOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  const account = instance.getActiveAccount() || accounts[0];
  const employeeEmail = account?.username?.toLowerCase() || roleUser?.user_email?.toLowerCase() || '';
  const employeeName = account?.name || roleUser?.full_name || employeeEmail || 'Current User';
  const roleName = roleUser?.role_name?.toLowerCase() || '';
  const canViewSupervisorDashboard = Boolean(
    isAdmin ||
    hasPermission('attendance', 'review') ||
    hasPermission('attendance', 'manage') ||
    ['manager', 'unit_manager', 'division_manager', 'supervisor', 'director', 'hr_officer', 'hr_manager', 'system_admin'].some((role) =>
      roleName.includes(role)
    )
  );

  const today = new Intl.DateTimeFormat('en-PG', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const checkOfficeNetwork = async () => {
    setNetworkChecking(true);
    setNetworkError(null);

    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Unable to verify office network.');
      }

      const data = await response.json();
      const ip = data?.ip || null;
      setDetectedIp(ip);
      setNetworkAllowed(ip === OFFICE_PUBLIC_IP);
    } catch (error: unknown) {
      setNetworkAllowed(false);
      setNetworkError(getErrorMessage(error, 'Unable to verify office network.'));
    } finally {
      setNetworkChecking(false);
    }
  };

  useEffect(() => {
    checkOfficeNetwork();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const getAttendanceService = async () => {
    const graphClient = await getGraphClient(instance);
    if (!graphClient) {
      throw new Error('Could not initialize Microsoft Graph client.');
    }

    const service = new TimeAttendanceSharePointService(graphClient);
    await service.initialize();
    return service;
  };

  const getEmployeeContext = () => ({
    employeeName,
    employeeEmail,
    division: roleUser?.division_name || '',
    unit: roleUser?.unit_name || '',
  });

  const getNetworkContext = () => ({
    detectedPublicIp: detectedIp,
    expectedOfficeIp: OFFICE_PUBLIC_IP,
    internalNetworkRange: '192.168.7.0/24',
    userAgent: navigator.userAgent,
  });

  const loadTodayRecord = async () => {
    if (!employeeEmail) return;

    setAttendanceLoading(true);
    setAttendanceError(null);

    try {
      const service = await getAttendanceService();
      const record = await service.getTodayRecord(employeeEmail);
      setTodayRecord(record);
    } catch (error: unknown) {
      setAttendanceError(getErrorMessage(error, 'Unable to load today attendance record.'));
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadMyHistory = async () => {
    if (!employeeEmail) return;

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const service = await getAttendanceService();
      const records = await service.getMyHistory(employeeEmail, 14);
      setHistoryRecords(records);

      const lateReasonEntries = await Promise.all(
        records
          .filter((record) => record.isLate)
          .map(async (record) => {
            const reason = await service.getLateReasonForAttendance(record.attendanceId);
            return [record.attendanceId, reason] as const;
          })
      );
      setHistoryLateReasons(Object.fromEntries(lateReasonEntries));

      const missingClockOutRecords = records.filter(isPastMissingClockOut);
      const reasonEntries = await Promise.all(
        missingClockOutRecords.map(async (record) => {
          const reason = await service.getExceptionReason(record.attendanceId, 'MissedClockOut');
          return [record.attendanceId, reason] as const;
        })
      );
      setMissedClockOutReasons(Object.fromEntries(reasonEntries));
    } catch (error: unknown) {
      setHistoryError(getErrorMessage(error, 'Unable to load attendance history.'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadTeamAttendance = async () => {
    if (!employeeEmail || !canViewSupervisorDashboard) return;

    setTeamLoading(true);
    setTeamError(null);

    try {
      const service = await getAttendanceService();
      const records = await service.getTeamAttendance({
        dateKey: teamDate,
        supervisorEmail: employeeEmail,
        division: roleUser?.division_name || '',
        unit: roleUser?.unit_name || '',
        roleName: roleUser?.role_name || '',
        isAdmin,
      });
      setTeamRecords(records);
    } catch (error: unknown) {
      setTeamError(getErrorMessage(error, 'Unable to load team attendance.'));
    } finally {
      setTeamLoading(false);
    }
  };

  const isPastMissingClockOut = (record: AttendanceRecord) => {
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Port_Moresby',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    return Boolean(record.clockInTime && !record.clockOutTime && record.attendanceDateKey < todayKey);
  };

  const updateMissedClockOutForm = (attendanceId: string, updates: Partial<{ reason: string; details: string }>) => {
    setMissedClockOutForm((current) => ({
      ...current,
      [attendanceId]: {
        reason: current[attendanceId]?.reason || '',
        details: current[attendanceId]?.details || '',
        ...updates,
      },
    }));
  };

  const handleMissedClockOutSubmit = async (record: AttendanceRecord) => {
    const form = missedClockOutForm[record.attendanceId] || { reason: '', details: '' };
    const selectedReason = missedClockOutReasonOptions.find((option) => option.value === form.reason);
    if (!selectedReason) return;

    if (selectedReason.value === 'other' && !form.details.trim()) {
      toast({
        title: 'Reason details required',
        description: 'Please enter a short description for Other.',
        variant: 'destructive',
      });
      return;
    }

    setMissedClockOutSavingId(record.attendanceId);

    try {
      const service = await getAttendanceService();
      const details = selectedReason.value === 'other'
        ? form.details.trim()
        : `${selectedReason.label}${form.details.trim() ? `: ${form.details.trim()}` : ''}`;
      const savedReason = await service.submitMissedClockOutReason({
        attendance: record,
        employee: getEmployeeContext(),
        reasonCategory: selectedReason.category,
        reasonDetails: details,
      });

      setMissedClockOutReasons((current) => ({
        ...current,
        [record.attendanceId]: savedReason,
      }));
      toast({
        title: 'Missed clock-out reason saved',
        description: 'Your reason has been sent for supervisor review.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Unable to save reason',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setMissedClockOutSavingId(null);
    }
  };

  useEffect(() => {
    loadTodayRecord();
    loadMyHistory();
  }, [employeeEmail]);

  useEffect(() => {
    loadTeamAttendance();
  }, [employeeEmail, teamDate, canViewSupervisorDashboard]);

  const clockedInAt = todayRecord?.clockInTime || null;
  const clockedOutAt = todayRecord?.clockOutTime || null;
  const canClockIn = networkAllowed && !clockedInAt && !attendanceSaving && !attendanceLoading;
  const canClockOut = networkAllowed && !!clockedInAt && !clockedOutAt && !attendanceSaving && !attendanceLoading;

  const isLateClockInNow = () => getTimeZoneMinutes(new Date()) > WORKDAY_START_MINUTES;
  const isEarlyClockOutNow = () => getTimeZoneMinutes(new Date()) < WORKDAY_END_MINUTES;
  const currentLateDuration = () => Math.max(0, getTimeZoneMinutes(new Date()) - WORKDAY_START_MINUTES);
  const currentEarlyClockOutDuration = () => Math.max(0, WORKDAY_END_MINUTES - getTimeZoneMinutes(new Date()));

  const resetLateReasonForm = () => {
    setLateReasonValue('');
    setLateReasonDetails('');
  };

  const handleClockInClick = () => {
    if (!networkAllowed || !canClockIn) return;

    if (isLateClockInNow()) {
      resetLateReasonForm();
      setLateClockInDialogOpen(true);
      return;
    }

    handleClockIn();
  };

  const handleClockIn = async (lateReasonSubmission?: { reasonCategory: string; reasonDetails: string }) => {
    if (!networkAllowed) return false;
    if (!employeeEmail) {
      toast({
        title: 'Profile not ready',
        description: 'Unable to determine your Microsoft 365 email.',
        variant: 'destructive',
      });
      return false;
    }

    setAttendanceSaving(true);
    setAttendanceError(null);

    try {
      const service = await getAttendanceService();
      const record = await service.clockIn(getEmployeeContext(), getNetworkContext());
      setTodayRecord(record);

      if (record.isLate && lateReasonSubmission) {
        try {
          const savedReason = await service.submitLateReason({
            attendance: record,
            employee: getEmployeeContext(),
            reasonCategory: lateReasonSubmission.reasonCategory,
            reasonDetails: lateReasonSubmission.reasonDetails,
          });
          setHistoryLateReasons((current) => ({
            ...current,
            [record.attendanceId]: savedReason,
          }));
        } catch (reasonError: unknown) {
          toast({
            title: 'Clock-in saved, reason not saved',
            description: getErrorMessage(reasonError, 'Please submit the late reason from the attendance page.'),
            variant: 'destructive',
          });
        }
      }

      await loadMyHistory();
      toast({
        title: 'Clock-in recorded',
        description: record.isLate
          ? `Clock-in saved to SharePoint and marked late by ${formatDuration(record.lateMinutes)}.`
          : 'Clock-in saved to SharePoint.',
      });
      return true;
    } catch (error: unknown) {
      setAttendanceError(getErrorMessage(error, 'Unable to clock in.'));
      toast({
        title: 'Clock-in failed',
        description: getErrorMessage(error, 'Unable to clock in.'),
        variant: 'destructive',
      });
      return false;
    } finally {
      setAttendanceSaving(false);
    }
  };

  const handleLateClockInConfirm = async () => {
    const selectedReason = lateReasonOptions.find((option) => option.value === lateReasonValue);
    if (!selectedReason) {
      toast({
        title: 'Late reason required',
        description: 'Please select a reason before clocking in.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedReason.value === 'other' && !lateReasonDetails.trim()) {
      toast({
        title: 'Reason details required',
        description: 'Please enter a short description for Other.',
        variant: 'destructive',
      });
      return;
    }

    const details = selectedReason.value === 'other'
      ? lateReasonDetails.trim()
      : `${selectedReason.label}${lateReasonDetails.trim() ? `: ${lateReasonDetails.trim()}` : ''}`;

    const saved = await handleClockIn({
      reasonCategory: selectedReason.category,
      reasonDetails: details,
    });
    if (saved) {
      setLateClockInDialogOpen(false);
    }
  };

  const handleClockOutClick = () => {
    if (!networkAllowed || !canClockOut) return;

    if (isEarlyClockOutNow()) {
      setEarlyClockOutDialogOpen(true);
      return;
    }

    handleClockOut();
  };

  const handleClockOut = async () => {
    if (!networkAllowed || !clockedInAt) return false;

    setAttendanceSaving(true);
    setAttendanceError(null);

    try {
      const service = await getAttendanceService();
      const record = await service.clockOut(getEmployeeContext(), getNetworkContext());
      setTodayRecord(record);
      await loadMyHistory();
      toast({
        title: 'Clock-out recorded',
        description: record.isOvertime
          ? `Clock-out saved to SharePoint with ${record.overtimeMinutes} overtime minute(s).`
          : 'Clock-out saved to SharePoint.',
      });
      return true;
    } catch (error: unknown) {
      setAttendanceError(getErrorMessage(error, 'Unable to clock out.'));
      toast({
        title: 'Clock-out failed',
        description: getErrorMessage(error, 'Unable to clock out.'),
        variant: 'destructive',
      });
      return false;
    } finally {
      setAttendanceSaving(false);
    }
  };

  const formatTime = (value: string | null) => {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-PG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(value));
  };

  const formatDuration = (minutes: number) => {
    const safeMinutes = Math.max(0, Number(minutes || 0));
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;

    if (hours === 0) {
      return `${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`;
    }

    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`;
  };

  const getReasonText = (reason?: LateReason | null) => {
    if (!reason) return '';
    return reason.reasonDetails || reason.reasonCategory || '';
  };

  const formatDate = (value: string) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-PG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${value}T00:00:00`));
  };

  const missingClockOutRecords = historyRecords.filter(isPastMissingClockOut);
  const teamMissingClockOutRecords = teamRecords.filter((record) => Boolean(record.clockInTime && !record.clockOutTime));
  const filteredTeamRecords = teamRecords.filter((record) => {
    if (teamStatusFilter === 'all') return true;
    if (teamStatusFilter === 'late') return record.isLate;
    if (teamStatusFilter === 'overtime') return record.isOvertime;
    if (teamStatusFilter === 'missing-clock-out') return Boolean(record.clockInTime && !record.clockOutTime);
    if (teamStatusFilter === 'early-departure') return Boolean(record.isEarlyDeparture);
    return record.status === teamStatusFilter;
  });
  const teamPresentCount = teamRecords.filter((record) => Boolean(record.clockInTime)).length;
  const teamClockedOutCount = teamRecords.filter((record) => Boolean(record.clockOutTime)).length;
  const teamLateCount = teamRecords.filter((record) => record.isLate).length;
  const teamOvertimeCount = teamRecords.filter((record) => record.isOvertime).length;
  const presentCount = historyRecords.filter((record) => Boolean(record.clockInTime)).length;
  const lateCount = historyRecords.filter((record) => record.isLate).length;
  const totalOvertimeMinutes = historyRecords.reduce((total, record) => total + (record.overtimeMinutes || 0), 0);
  const leaveCount = 0;
  const profileInitials = employeeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';
  const profileMeta = [roleUser?.division_name, roleUser?.unit_name].filter(Boolean).join(' / ') || employeeEmail || 'Current user';
  const currentTime = new Intl.DateTimeFormat('en-PG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now);
  const currentDate = new Intl.DateTimeFormat('en-PG', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const todayStatusLabel = attendanceLoading
    ? 'LOADING'
    : todayRecord?.status === 'ClockedOut'
      ? 'CLOCKED OUT'
      : todayRecord?.isLate
        ? 'LATE'
        : todayRecord?.clockInTime
          ? 'PRESENT'
          : isLateClockInNow()
            ? 'LATE CLOCK-IN'
            : 'ON TIME';

  const getStatusBadgeClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized.includes('late')) return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
    if (normalized.includes('absent') || normalized.includes('missed')) return 'bg-red-100 text-red-700 hover:bg-red-100';
    if (normalized.includes('clockedout') || normalized.includes('clocked out')) return 'bg-intranet-primary text-white hover:bg-intranet-primary';
    if (normalized.includes('present') || normalized.includes('ontime')) return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
    return 'bg-muted text-muted-foreground hover:bg-muted';
  };

  return (
    <PageLayout>
      <div className="space-y-6">
        <section className="rounded-md bg-intranet-primary px-6 py-7 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <CalendarClock className="h-4 w-4" />
                Time and Attendance
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-normal">Attendance System</h1>
              <p className="mt-1 text-sm text-white/80">Clock in and out while connected to the office network.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  networkAllowed
                    ? 'gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'gap-1.5 border-amber-200 bg-amber-50 text-amber-700'
                }
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {networkChecking ? 'Checking office network' : networkAllowed ? 'Office network verified' : 'Office network required'}
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {today}
              </Badge>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Present', value: historyLoading ? '...' : String(presentCount) },
            { label: 'Late', value: historyLoading ? '...' : String(lateCount) },
            { label: 'Leave', value: String(leaveCount) },
            { label: 'Overtime', value: historyLoading ? '...' : formatDuration(totalOvertimeMinutes) },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="flex min-h-28 flex-col items-center justify-center p-5 text-center">
                <p className="text-3xl font-bold text-intranet-primary">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.55fr_0.9fr]">
          <Card>
            <CardContent className="flex min-h-[330px] flex-col items-center justify-start p-5 pt-9 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-intranet-primary text-xl font-bold text-white">
                {profileInitials}
              </div>
              <h2 className="mt-5 text-lg font-semibold text-gray-900 dark:text-white">{employeeName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{profileMeta}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex min-h-[330px] flex-col justify-center p-5 text-center">
              <p className="text-4xl font-bold tracking-normal text-intranet-primary lg:text-5xl 2xl:text-6xl">{currentTime}</p>
              <p className="mt-3 text-sm text-muted-foreground">{currentDate}</p>
              <Badge className={`mx-auto mt-4 px-4 py-1.5 text-sm ${getStatusBadgeClass(todayStatusLabel)}`}>
                {todayStatusLabel}
              </Badge>

              {(attendanceLoading || attendanceError || todayRecord) && (
                <div className="mx-auto mt-4 max-w-xl rounded-md border bg-background px-4 py-2 text-sm">
                  {attendanceLoading && <span className="text-muted-foreground">Loading today attendance record...</span>}
                  {attendanceError && <span className="text-destructive">{attendanceError}</span>}
                  {!attendanceLoading && !attendanceError && todayRecord && (
                    <div className="flex flex-wrap justify-center gap-3 text-muted-foreground">
                      <span>Status: <strong className="text-foreground">{todayRecord.status}</strong></span>
                      {todayRecord.isLate && <span>Late: <strong className="text-foreground">{formatDuration(todayRecord.lateMinutes)}</strong></span>}
                      {todayRecord.isOvertime && <span>Overtime: <strong className="text-foreground">{formatDuration(todayRecord.overtimeMinutes)}</strong></span>}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 grid gap-4">
                <Button
                  className="h-20 justify-center gap-3 text-base font-bold uppercase"
                  disabled={!canClockIn}
                  onClick={handleClockInClick}
                >
                  <LogIn className="h-5 w-5" />
                  <span>
                    <span className="block">Clock In</span>
                    <span className="block text-xs font-normal normal-case opacity-80">
                      {attendanceSaving
                        ? 'Saving...'
                        : clockedInAt
                          ? `Recorded at ${formatTime(clockedInAt)}`
                          : networkAllowed
                            ? 'Ready to save to SharePoint'
                            : 'Waiting for office network'}
                    </span>
                  </span>
                </Button>
                <Button
                  className="h-20 justify-center gap-3 border-amber-200 bg-amber-50 text-base font-bold uppercase text-amber-900 hover:bg-amber-100"
                  variant="outline"
                  disabled={!canClockOut}
                  onClick={handleClockOutClick}
                >
                  <LogOut className="h-5 w-5" />
                  <span>
                    <span className="block">Clock Out</span>
                    <span className="block text-xs font-normal normal-case text-amber-800/80">
                      {attendanceSaving
                        ? 'Saving...'
                        : clockedOutAt
                          ? `Recorded at ${formatTime(clockedOutAt)}`
                          : clockedInAt
                            ? 'Overtime after 4:00 PM'
                            : 'Available after clock-in'}
                    </span>
                  </span>
                </Button>
              </div>

              <div className="mt-5 rounded-md border bg-muted/30 p-3 text-left">
                <div className="flex items-start gap-2">
                  <Wifi className="mt-0.5 h-4 w-4 text-intranet-primary" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-gray-900 dark:text-white">Network rule</p>
                    <p className="mt-1">Attendance actions are enabled only on the approved office network.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span>Expected IP: {OFFICE_PUBLIC_IP}</span>
                      <span>Detected IP: {detectedIp || 'Checking...'}</span>
                      {networkError && <span className="text-destructive">{networkError}</span>}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={checkOfficeNetwork}
                      disabled={networkChecking}
                    >
                      {networkChecking ? 'Checking...' : 'Recheck Network'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {policyItems.map((item) => (
                <div key={item.label}>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg">Last 14 Days Attendance</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadMyHistory}
                disabled={historyLoading}
              >
                {historyLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {historyLoading && (
              <p className="text-sm text-muted-foreground">Loading your last 14 days of attendance...</p>
            )}

            {!historyLoading && historyError && (
              <p className="text-sm text-destructive">{historyError}</p>
            )}

            {!historyLoading && !historyError && historyRecords.length === 0 && (
              <p className="text-sm text-muted-foreground">No attendance history found for the last 14 days.</p>
            )}

            {!historyLoading && !historyError && missingClockOutRecords.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div className="w-full space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Missed clock-out reason required</p>
                      <p className="text-xs text-muted-foreground">Submit a reason for supervisor review.</p>
                    </div>

                    {missingClockOutRecords.map((record) => {
                      const savedReason = missedClockOutReasons[record.attendanceId];
                      const form = missedClockOutForm[record.attendanceId] || { reason: '', details: '' };
                      return (
                        <div key={record.attendanceId} className="rounded-md border bg-background p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">{formatDate(record.attendanceDateKey)}</p>
                            {savedReason && <Badge variant="secondary">Submitted</Badge>}
                          </div>

                          {savedReason ? (
                            <p className="mt-1 text-xs text-muted-foreground">{savedReason.reasonDetails || savedReason.reasonCategory}</p>
                          ) : (
                            <div className="mt-2 grid gap-2 md:grid-cols-[220px_1fr_auto]">
                              <select
                                value={form.reason}
                                onChange={(event) => updateMissedClockOutForm(record.attendanceId, { reason: event.target.value })}
                                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                              >
                                <option value="">Select reason</option>
                                {missedClockOutReasonOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                value={form.details}
                                onChange={(event) => updateMissedClockOutForm(record.attendanceId, { details: event.target.value })}
                                placeholder={form.reason === 'other' ? 'Enter reason details' : 'Optional description'}
                                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleMissedClockOutSubmit(record)}
                                disabled={!form.reason || missedClockOutSavingId === record.attendanceId}
                              >
                                {missedClockOutSavingId === record.attendanceId ? 'Saving...' : 'Save Reason'}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {!historyLoading && !historyError && historyRecords.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Clock In</th>
                      <th className="px-4 py-3 font-semibold">Clock Out</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map((record) => {
                      const lateReasonText = getReasonText(historyLateReasons[record.attendanceId]);
                      const notes = [
                        record.isLate ? `Late by ${formatDuration(record.lateMinutes)}` : '',
                        record.isLate && lateReasonText ? `Reason: ${lateReasonText}` : '',
                        record.isOvertime ? `Overtime: ${formatDuration(record.overtimeMinutes)}` : '',
                        record.totalMinutes !== undefined ? `Total worked: ${formatDuration(record.totalMinutes)}` : '',
                      ].filter(Boolean);

                      return (
                        <tr key={record.id} className="border-b last:border-b-0">
                          <td className="px-4 py-3">{formatDate(record.attendanceDateKey)}</td>
                          <td className="px-4 py-3">{formatTime(record.clockInTime || null) || '-'}</td>
                          <td className="px-4 py-3">{formatTime(record.clockOutTime || null) || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge className={getStatusBadgeClass(record.status)}>{record.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{notes.length > 0 ? notes.join(' / ') : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {canViewSupervisorDashboard && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-intranet-primary" />
                    Supervisor Dashboard
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Daily team attendance for direct reports and scoped unit/division staff.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="date"
                    value={teamDate}
                    onChange={(event) => setTeamDate(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <select
                    value={teamStatusFilter}
                    onChange={(event) => setTeamStatusFilter(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">All statuses</option>
                    <option value="late">Late</option>
                    <option value="overtime">Overtime</option>
                    <option value="missing-clock-out">Missing clock-out</option>
                    <option value="early-departure">Early departure</option>
                    <option value="ClockedIn">Clocked in</option>
                    <option value="ClockedOut">Clocked out</option>
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 gap-2"
                    onClick={loadTeamAttendance}
                    disabled={teamLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${teamLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: 'Team Records', value: teamLoading ? '...' : String(teamRecords.length) },
                  { label: 'Clocked In', value: teamLoading ? '...' : String(teamPresentCount) },
                  { label: 'Clocked Out', value: teamLoading ? '...' : String(teamClockedOutCount) },
                  { label: 'Late', value: teamLoading ? '...' : String(teamLateCount) },
                  { label: 'Overtime', value: teamLoading ? '...' : String(teamOvertimeCount) },
                ].map((item) => (
                  <div key={item.label} className="rounded-md border bg-muted/20 p-4">
                    <p className="text-2xl font-bold text-intranet-primary">{item.value}</p>
                    <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </section>

              {teamMissingClockOutRecords.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/20">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {teamMissingClockOutRecords.length} team record{teamMissingClockOutRecords.length === 1 ? '' : 's'} missing clock-out
                    </p>
                    <p className="text-xs text-muted-foreground">These should be followed up or reviewed once the exception workflow is enabled.</p>
                  </div>
                </div>
              )}

              {teamError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{teamError}</p>
              )}

              {!teamLoading && !teamError && teamRecords.length === 0 && (
                <div className="rounded-md border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  No team attendance records found for {formatDate(teamDate)}.
                </div>
              )}

              {!teamLoading && !teamError && teamRecords.length > 0 && (
                <div className="overflow-x-auto">
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-3.5 w-3.5" />
                    Showing {filteredTeamRecords.length} of {teamRecords.length} records
                  </div>
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">Unit</th>
                        <th className="px-4 py-3 font-semibold">Clock In</th>
                        <th className="px-4 py-3 font-semibold">Clock Out</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Exceptions</th>
                        <th className="px-4 py-3 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeamRecords.map((record) => {
                        const exceptionNotes = [
                          record.isLate ? `Late ${formatDuration(record.lateMinutes)}` : '',
                          record.isEarlyDeparture ? `Early ${formatDuration(record.earlyDepartureMinutes || 0)}` : '',
                          record.isOvertime ? `Overtime ${formatDuration(record.overtimeMinutes)}` : '',
                          record.clockInTime && !record.clockOutTime ? 'Missing clock-out' : '',
                        ].filter(Boolean);

                        return (
                          <tr key={record.id} className="border-b last:border-b-0">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 dark:text-white">{record.employeeName || record.employeeEmail}</p>
                              <p className="text-xs text-muted-foreground">{record.employeeEmail}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p>{record.unit || '-'}</p>
                              <p className="text-xs text-muted-foreground">{record.division || ''}</p>
                            </td>
                            <td className="px-4 py-3">{formatTime(record.clockInTime || null) || '-'}</td>
                            <td className="px-4 py-3">{formatTime(record.clockOutTime || null) || '-'}</td>
                            <td className="px-4 py-3">
                              <Badge className={getStatusBadgeClass(record.status)}>{record.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{exceptionNotes.length > 0 ? exceptionNotes.join(' / ') : '-'}</td>
                            <td className="px-4 py-3">{record.totalMinutes !== undefined ? formatDuration(record.totalMinutes) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={lateClockInDialogOpen} onOpenChange={setLateClockInDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Late clock-in reason required</DialogTitle>
              <DialogDescription>
                You are clocking in after 8:30 AM. Please select the reason before your clock-in is recorded.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
              Current late time: <strong>{formatDuration(currentLateDuration())}</strong>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
              <select
                value={lateReasonValue}
                onChange={(event) => setLateReasonValue(event.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select reason</option>
                {lateReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                value={lateReasonDetails}
                onChange={(event) => setLateReasonDetails(event.target.value)}
                placeholder={lateReasonValue === 'other' ? 'Enter reason details' : 'Optional description'}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLateClockInDialogOpen(false)}
                disabled={attendanceSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleLateClockInConfirm}
                disabled={!lateReasonValue || attendanceSaving}
              >
                {attendanceSaving ? 'Saving...' : 'Confirm Clock In'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={earlyClockOutDialogOpen} onOpenChange={setEarlyClockOutDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Confirm early clock-out</DialogTitle>
              <DialogDescription>
                You are clocking out before the official 4:00 PM workday end time. Please confirm before this is recorded.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Time remaining before 4:00 PM: <strong className="text-foreground">{formatDuration(currentEarlyClockOutDuration())}</strong>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEarlyClockOutDialogOpen(false)}
                disabled={attendanceSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const saved = await handleClockOut();
                  if (saved) {
                    setEarlyClockOutDialogOpen(false);
                  }
                }}
                disabled={attendanceSaving}
              >
                {attendanceSaving ? 'Saving...' : 'Yes, Clock Out Early'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </PageLayout>
  );
};

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

export default TimeAttendance;
