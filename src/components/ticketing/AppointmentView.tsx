import React, { useMemo, useState } from 'react';
import { Building, Calendar, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Clock, List, MapPin, Pencil, Plus, Search, Trash2, User, Utensils } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AppointmentDialog } from '@/components/frontDesk/appointments/AppointmentDialog';
import { useAppointmentMutations, useAppointmentsBetween } from '@/hooks/frontDesk/useAppointments';
import { useFrontDeskPermissions } from '@/hooks/frontDesk/useFrontDeskPermissions';
import { useStaffMembers } from '@/hooks/useStaffMembers';
import {
  appointmentDateKey, appointmentStartTime, appointmentsForTab, dayKeysRange, monthKeys, searchAppointments, sortByStart, weekKeys,
  type AppointmentInput, type AppointmentTab, type FrontDeskAppointment,
} from '@/services/frontDesk/appointmentRules';
import { FrontDeskListMissingError } from '@/services/frontDesk/frontDeskGraph';
import { formatDateKey, formatPngTime, pngDateKey, shiftDateKey, shiftMonthKey } from '@/services/frontDesk/pngTime';
import { DAY_END_HOUR, DAY_START_HOUR, daySlotForTime, type DaySlot } from './appointmentFilters';

type ViewMode = 'month' | 'day' | 'list' | 'week';

const TABS: { id: AppointmentTab; label: string }[] = [
  { id: 'all', label: 'All Appointments' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'canceled', label: 'Canceled' },
];

const STATUS_STYLE: Record<FrontDeskAppointment['status'], string> = {
  Scheduled: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  Completed: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  Canceled: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 line-through opacity-70',
};

const hourLabel = (hour: number) => `${hour % 12 || 12}${hour < 12 ? ' am' : ' pm'}`;
const daySlotLabel = (slot: DaySlot) => {
  if (slot === 'untimed') return 'No time';
  if (slot === 'before') return `Before ${hourLabel(DAY_START_HOUR)}`;
  if (slot === 'after') return `From ${hourLabel(DAY_END_HOUR + 1)}`;
  return hourLabel(slot);
};
const shortDay = (dateKey: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${dateKey}T00:00:00Z`));
const monthTitle = (dateKey: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${dateKey}T00:00:00Z`));
const timeSpan = (a: FrontDeskAppointment) => `${formatPngTime(a.startDateTime)} – ${formatPngTime(a.endDateTime)}`;

/**
 * The front desk appointment calendar (plan Phase 4B), saved in FrontDesk_Appointments.
 * External visitors on an appointment become Expected entries in the visitor log, and the
 * host and staff attendees can be sent an Outlook invite.
 */
const AppointmentView: React.FC = () => {
  const perms = useFrontDeskPermissions();
  const todayKey = pngDateKey();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [dateKey, setDateKey] = useState(todayKey);
  const [tab, setTab] = useState<AppointmentTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<FrontDeskAppointment | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FrontDeskAppointment | null>(null);

  const { staffMembers } = useStaffMembers();
  const staff = useMemo(() => staffMembers
    .filter(s => s.email)
    .map(s => ({ name: s.name, email: s.email.toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name)), [staffMembers]);

  // The day, week or month on screen; the list view shows the month.
  const period = viewMode === 'day' ? { from: dateKey, to: dateKey } : viewMode === 'week' ? weekKeys(dateKey) : monthKeys(dateKey);
  const range = dayKeysRange(period.from, period.to);
  const query = useAppointmentsBetween(range.start, range.end);
  const mutations = useAppointmentMutations();

  const visible = useMemo(() => sortByStart(searchAppointments(appointmentsForTab(query.data ?? [], tab, todayKey), searchQuery)),
    [query.data, tab, todayKey, searchQuery]);
  const onDay = (key: string) => visible.filter(a => appointmentDateKey(a) === key);

  const step = (direction: 1 | -1) => setDateKey(key =>
    viewMode === 'day' ? shiftDateKey(key, direction) : viewMode === 'week' ? shiftDateKey(key, 7 * direction) : shiftMonthKey(key, direction));
  const periodTitle = viewMode === 'day' ? formatDateKey(dateKey)
    : viewMode === 'week' ? `${shortDay(period.from)} – ${shortDay(period.to)} ${period.to.slice(0, 4)}` : monthTitle(dateKey);

  const open = (appointment: FrontDeskAppointment) => { if (perms.canUpdate) setEditing(appointment); };

  const save = async (input: AppointmentInput, sendInvite: boolean) => {
    try {
      await mutations.save.mutateAsync({ appointment: editing && editing !== 'new' ? editing : undefined, input, sendInvite });
      return true;
    } catch {
      return false; // the mutation has already shown the error
    }
  };

  const guestsLine = (a: FrontDeskAppointment) => {
    const guests = a.attendees.filter(x => x.external);
    return guests.length ? `${guests.length} visitor${guests.length === 1 ? '' : 's'}: ${guests.map(g => g.name).join(', ')}` : '';
  };

  // Day view rows: 8 am to 5 pm, plus "no time", "before" and "after" rows only when used. Canceled ones only on their tab.
  const daySlots = useMemo(() => {
    const shown = onDay(dateKey).filter(a => tab === 'canceled' || a.status !== 'Canceled');
    const bySlot = new Map<DaySlot, FrontDeskAppointment[]>();
    for (const a of shown) {
      const slot = daySlotForTime(appointmentStartTime(a));
      bySlot.set(slot, [...(bySlot.get(slot) || []), a]);
    }
    const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
    const ifUsed = (slot: DaySlot) => (bySlot.has(slot) ? [slot] : []);
    return [...ifUsed('untimed'), ...ifUsed('before'), ...hours, ...ifUsed('after')].map(slot => ({ slot, items: bySlot.get(slot) || [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, dateKey, tab]);

  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDateKey(weekKeys(dateKey).from, i));
  const monthCells = useMemo(() => {
    const { from, to } = monthKeys(dateKey);
    const lead = new Date(`${from}T00:00:00Z`).getUTCDay(); // grid starts on Sunday
    const days = Array.from({ length: Number(to.slice(8)) }, (_, i) => shiftDateKey(from, i));
    return [...Array(lead).fill(null), ...days] as (string | null)[];
  }, [dateKey]);

  const chip = (a: FrontDeskAppointment, size: 'xs' | 'sm' = 'xs') => (
    <button
      key={a.id}
      type="button"
      onClick={() => open(a)}
      className={cn('w-full text-left p-1 rounded truncate block', size === 'xs' ? 'text-[10px] sm:text-xs' : 'text-xs', STATUS_STYLE[a.status])}
      title={`${a.title} — ${timeSpan(a)}`}
    >
      {formatPngTime(a.startDateTime)} {a.title}
    </button>
  );

  const renderBody = () => {
    if (query.isLoading) return <p className="text-sm text-muted-foreground py-12 text-center">Loading appointments…</p>;
    if (query.error) {
      return (
        <div className="text-center py-12 text-sm">
          <p className="font-medium">Appointments could not be loaded.</p>
          <p className="text-muted-foreground mt-1">
            {query.error instanceof FrontDeskListMissingError
              ? 'The Front Desk lists have not been set up. An administrator can create them from TestGround → Front Desk Lists Setup.'
              : query.error instanceof Error ? query.error.message : String(query.error)}
          </p>
        </div>
      );
    }
    if (viewMode === 'month') {
      return (
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((key, index) => (
              <div key={key ?? `lead-${index}`} className={cn('p-1 flex flex-col min-h-[110px]', key ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50', key === todayKey && 'bg-red-50 dark:bg-red-900/30')}>
                {key && <div className={cn('text-right p-1 text-xs', key === todayKey && 'font-bold text-primary')}>{Number(key.slice(8))}</div>}
                {key && <div className="mt-1 space-y-1 overflow-hidden">{onDay(key).map(a => chip(a))}</div>}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (viewMode === 'week') {
      return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
            {weekDays.map(key => (
              <div key={key} className="py-2 border-b border-r border-gray-200 dark:border-gray-700">
                <div>{new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(new Date(`${key}T00:00:00Z`))}</div>
                <div className={cn('text-lg font-semibold', key === todayKey ? 'text-primary' : 'text-gray-800 dark:text-gray-200')}>{Number(key.slice(8))}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDays.map(key => (
              <div key={key} className={cn('p-1 border-r border-gray-200 dark:border-gray-700 space-y-1', key === todayKey ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-gray-800')}>
                {onDay(key).map(a => chip(a))}
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (viewMode === 'list') {
      if (!visible.length) return <p className="text-center p-10 text-gray-500 dark:text-gray-400">No appointments in {monthTitle(dateKey)} match.</p>;
      return (
        <div className="space-y-3">
          {visible.map(a => (
            <div key={a.id} className={cn('flex flex-col sm:flex-row justify-between items-start gap-3 p-4 border rounded-lg',
              a.status === 'Scheduled' && 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50',
              a.status === 'Completed' && 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800/50',
              a.status === 'Canceled' && 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50 opacity-80')}>
              <div className="space-y-1">
                <h4 className={cn('font-semibold', a.status === 'Canceled' && 'line-through')}>{a.title}</h4>
                <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex-wrap gap-x-3 gap-y-1">
                  <span className="flex items-center"><CalendarDays className="mr-1 h-3.5 w-3.5" />{formatDateKey(appointmentDateKey(a))}</span>
                  <span className="flex items-center"><Clock className="mr-1 h-3.5 w-3.5" />{timeSpan(a)}</span>
                  <span className="flex items-center"><User className="mr-1 h-3.5 w-3.5" />{a.hostName}</span>
                  {a.location && <span className="flex items-center"><MapPin className="mr-1 h-3.5 w-3.5" />{a.location}</span>}
                </div>
                {guestsLine(a) && <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center"><Building className="mr-1 h-3.5 w-3.5" />{guestsLine(a)}</p>}
                {a.description && <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{a.description}</p>}
              </div>
              <div className="flex gap-1 self-start sm:self-center">
                {perms.canUpdate && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${a.title}`} onClick={() => open(a)}><Pencil className="h-4 w-4" /></Button>
                )}
                {perms.canDelete && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" aria-label={`Delete ${a.title}`} onClick={() => setDeleting(a)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
        {daySlots.map(({ slot, items }) => (
          <div key={String(slot)} className="flex min-h-[60px]">
            <div className="w-20 flex-shrink-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
              {daySlotLabel(slot)}
            </div>
            <div className="flex-grow p-2 space-y-2">
              {items.map(a => (
                <div
                  key={a.id}
                  role={perms.canUpdate ? 'button' : undefined}
                  onClick={() => open(a)}
                  className={cn('bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-2 sm:p-3 rounded-md shadow-sm', perms.canUpdate && 'cursor-pointer',
                    a.status === 'Canceled' && 'opacity-60 line-through', a.status === 'Completed' && 'bg-green-50 border-green-200')}
                >
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 text-sm sm:text-base">{a.title}</h4>
                  <div className="flex items-center mt-1 text-xs sm:text-sm flex-wrap gap-x-3 text-blue-700 dark:text-blue-300">
                    <span className="flex items-center"><Clock className="mr-1 h-3 w-3" />{timeSpan(a)}</span>
                    <span className="flex items-center"><User className="mr-1 h-3 w-3" />{a.hostName}</span>
                    {a.location && <span className="flex items-center"><MapPin className="mr-1 h-3 w-3" />{a.location}</span>}
                  </div>
                  {guestsLine(a) && <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{guestsLine(a)}</p>}
                </div>
              ))}
              {slot === 12 && items.length === 0 && (
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 flex items-center justify-center"><Utensils className="mr-1 h-4 w-4" /> Lunch</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
        {/* Stacked until xl, and the tabs never shrink: side by side at md they collapsed to zero width (M9). */}
        <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
          <div className="overflow-x-auto xl:shrink-0">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={cn('px-4 py-2 font-medium whitespace-nowrap border-b-2',
                    tab === t.id ? 'text-primary border-primary' : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white border-transparent')}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0 xl:justify-end">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input type="text" placeholder="Search appointments..." className="pl-9 w-full md:w-64 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
              {([['day', CalendarDays, 'Day'], ['week', CalendarRange, 'Week'], ['month', Calendar, 'Month'], ['list', List, 'List']] as const).map(([id, Icon, label], i) => (
                <Button key={id} variant={viewMode === id ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode(id)}
                  className={cn('rounded-none', i < 3 && 'border-r border-gray-300 dark:border-gray-600')} aria-label={`${label} view`}>
                  <Icon className="h-4 w-4" /><span className="ml-1 hidden sm:inline">{label}</span>
                </Button>
              ))}
            </div>
            {perms.canCreate && (
              <Button className="bg-primary text-white hover:bg-primary/90" size="sm" onClick={() => setEditing('new')}>
                <Plus className="mr-2 h-4 w-4" />New Appointment
              </Button>
            )}
            {dateKey !== todayKey && <Button variant="outline" size="sm" onClick={() => setDateKey(todayKey)}>Today</Button>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 sm:gap-4 mb-4">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h3 className="text-lg font-semibold">{periodTitle}</h3>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
          {/* Print / Export come back in Phase 7 (P7.5) once they do something. */}
        </div>
        {renderBody()}
      </div>

      <AppointmentDialog
        open={editing !== null}
        appointment={editing && editing !== 'new' ? editing : undefined}
        defaultDate={dateKey}
        staff={staff}
        saving={mutations.save.isPending}
        canDelete={perms.canDelete}
        onClose={() => setEditing(null)}
        onSubmit={save}
        onDelete={a => { setEditing(null); setDeleting(a); }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={isOpen => !isOpen && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The appointment is removed for good. Its Outlook invite is canceled, and visitors who have not arrived are taken off the visitor log.
              To keep a record, set its status to Canceled instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleting) mutations.remove.mutate(deleting); setDeleting(null); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AppointmentView;
