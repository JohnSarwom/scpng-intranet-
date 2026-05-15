import React, { useMemo } from 'react';
import { format, isAfter, isBefore, parseISO, startOfToday } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, TrendingUp, Users, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeaveApprovals } from '@/hooks/useLeaveApprovals';
import { listPNGPublicHolidays } from '@/utils/pngPublicHolidays';
import { LeaveRequest } from '@/types/hr';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEAVE_COLORS: Record<string, string> = {
  'Annual Leave':          '#3b82f6',
  'Sick Leave':            '#ef4444',
  'Compassionate Leave':   '#8b5cf6',
  'Carers Leave':          '#f59e0b',
  'Leave Without Pay':     '#6b7280',
  'Study Leave':           '#10b981',
  'Maternity Leave':       '#ec4899',
  'Leave For Breast Feeding': '#f472b6',
  'Paternity Leave':       '#06b6d4',
  'Recreational Leave':    '#84cc16',
};

function safeDate(s?: string): Date | null {
  if (!s) return null;
  try { return parseISO(s); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}> = ({ icon, label, value, sub, accent = 'text-gray-900 dark:text-gray-100' }) => (
  <Card className="dark:bg-gray-800 dark:border-white/10">
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-sm font-medium text-muted-foreground dark:text-gray-400">
        {label}
      </CardTitle>
      <span className="text-muted-foreground dark:text-gray-500">{icon}</span>
    </CardHeader>
    <CardContent>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground dark:text-gray-500 mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const LeaveAnalytics: React.FC = () => {
  const { data: allPending = [], isLoading } = useLeaveApprovals();
  const today = startOfToday();
  const currentYear = today.getFullYear();
  const holidays = useMemo(() => listPNGPublicHolidays(currentYear), [currentYear]);

  // ── Pending queue counts by stage ──────────────────────────────────────
  const managerCount  = allPending.filter(r => r.stage === 'Manager Review').length;
  const directorCount = allPending.filter(r => r.stage === 'Director Review').length;
  const hrCount       = allPending.filter(r => r.stage === 'HR Review').length;
  const totalPending  = allPending.length;

  // ── Requests currently active (approved, dates span today) ─────────────
  const currentlyOnLeave: LeaveRequest[] = useMemo(() =>
    allPending.filter(r => {
      if (r.status !== 'Approved') return false;
      const s = safeDate(r.startDate);
      const e = safeDate(r.endDate);
      if (!s || !e) return false;
      return !isAfter(s, today) && !isBefore(e, today);
    }),
    [allPending, today]
  );

  // ── Upcoming approved leaves (start within next 14 days) ───────────────
  const upcoming: LeaveRequest[] = useMemo(() => {
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + 14);
    return allPending
      .filter(r => {
        if (r.status !== 'Approved') return false;
        const s = safeDate(r.startDate);
        return s && isAfter(s, today) && isBefore(s, cutoff);
      })
      .sort((a, b) => (a.startDate > b.startDate ? 1 : -1));
  }, [allPending, today]);

  // ── Pending requests by leave type (for bar chart) ─────────────────────
  const byType: { type: string; count: number; color: string }[] = useMemo(() => {
    const map = new Map<string, number>();
    allPending.forEach(r => {
      const t = r.leaveType || 'Unknown';
      map.set(t, (map.get(t) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type: type.replace(' Leave', '').replace(' leave', ''),
        count,
        color: LEAVE_COLORS[type] ?? '#94a3b8',
      }));
  }, [allPending]);

  // ── Next upcoming PNG public holiday ───────────────────────────────────
  const todayIso = today.toISOString().split('T')[0];
  const nextHoliday = holidays.find(h => h.date >= todayIso);

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="dark:bg-gray-800 dark:border-white/10">
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Stat row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Awaiting Action"
          value={totalPending}
          sub={`${managerCount} Manager · ${directorCount} Director · ${hrCount} HR`}
          accent={totalPending > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Currently on Leave"
          value={currentlyOnLeave.length}
          sub="Approved, dates active today"
          accent={currentlyOnLeave.length > 0 ? 'text-blue-600 dark:text-blue-400' : undefined}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Upcoming (14 days)"
          value={upcoming.length}
          sub="Approved leaves starting soon"
        />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Next Public Holiday"
          value={nextHoliday ? format(parseISO(nextHoliday.date), 'dd MMM') : '—'}
          sub={nextHoliday?.label ?? 'None remaining this year'}
        />
      </div>

      {/* ── Pending requests by leave type ── */}
      {byType.length > 0 && (
        <Card className="dark:bg-gray-800 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Pending Requests by Leave Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byType} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground dark:text-gray-400"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground dark:text-gray-400"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  formatter={(v: number) => [`${v} request${v !== 1 ? 's' : ''}`, '']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byType.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Two-column: upcoming leaves + approval queue ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Upcoming approved leaves */}
        <Card className="dark:bg-gray-800 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Upcoming Approved Leaves
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground dark:text-gray-500">
                No approved leaves starting in the next 14 days.
              </p>
            ) : (
              <div className="divide-y dark:divide-white/10">
                {upcoming.map(r => (
                  <div key={String(r.id)} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium dark:text-gray-200">
                        {r.employeeName || r.employeeId}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-500">
                        {r.leaveType} — {r.daysRequested} day{r.daysRequested !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {safeDate(r.startDate) ? format(safeDate(r.startDate)!, 'dd MMM') : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval queue breakdown */}
        <Card className="dark:bg-gray-800 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Approval Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { stage: 'Manager Review',  count: managerCount,  color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
              { stage: 'Director Review', count: directorCount, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
              { stage: 'HR Review',       count: hrCount,       color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
            ].map(({ stage, count, color }) => (
              <div key={stage} className="flex items-center justify-between">
                <span className="text-sm dark:text-gray-300">{stage}</span>
                <Badge className={`${color} text-xs`} variant="secondary">
                  {count} pending
                </Badge>
              </div>
            ))}

            {totalPending === 0 && (
              <p className="pt-4 text-center text-sm text-muted-foreground dark:text-gray-500">
                All queues clear.
              </p>
            )}

            {totalPending > 5 && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {totalPending} requests are awaiting action. Review the Leave Approvals tab to process them.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── PNG Public Holidays this year ── */}
      <Card className="dark:bg-gray-800 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold dark:text-gray-100">
            PNG Public Holidays {currentYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {holidays.map(h => {
              const isPast = h.date < todayIso;
              return (
                <div
                  key={h.date}
                  className={`rounded-md border px-3 py-2 text-xs ${
                    isPast
                      ? 'border-gray-200 dark:border-white/5 text-gray-400 dark:text-gray-600'
                      : h.date === todayIso
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <p className="font-medium">{format(parseISO(h.date), 'dd MMM')}</p>
                  <p className="truncate" title={h.label}>{h.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default LeaveAnalytics;
