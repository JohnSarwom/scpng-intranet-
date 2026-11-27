import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { AlertTriangle, Check, ChevronDown, Filter, Info, MoreVertical, Pencil, Plus, Search, Trash2, User, XCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import InquiryDialog from '@/components/frontDesk/inquiries/InquiryDialog';
import { categoryStyle, initialsOf, STATUS_BADGE, STATUS_DOT, type StaffOption } from '@/components/frontDesk/inquiries/inquiryDisplay';
import { useFrontDeskPermissions } from '@/hooks/frontDesk/useFrontDeskPermissions';
import { useInquiriesReported, useInquiryMutations, useOpenInquiries } from '@/hooks/frontDesk/useInquiries';
import { useStaffMembers } from '@/hooks/useStaffMembers';
import {
  INQUIRY_CATEGORIES, INQUIRY_STATUSES, PRIORITIES, type InquiryCategory, type InquiryStatus, type Priority,
} from '@/services/frontDesk/frontDeskConfig';
import { FrontDeskListMissingError } from '@/services/frontDesk/frontDeskGraph';
import {
  filterInquiries, inquiryPeriod, inquiryToInput, mergeInquiries, RECENT_DAYS, searchInquiries, UNASSIGNED,
  type FrontDeskInquiry, type InquiryInput,
} from '@/services/frontDesk/inquiryRules';
import { formatDateKey, formatPngDateTime, pngDateKey } from '@/services/frontDesk/pngTime';

type StatusTab = 'all' | InquiryStatus;

const PRIORITY_ICON: Record<Priority, React.ReactNode> = {
  High: <XCircle className="h-4 w-4 text-red-600" />,
  Medium: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  Low: <Info className="h-4 w-4 text-green-500" />,
};

const toggle = <T,>(values: T[], value: T, on: boolean) => (on ? [...values, value] : values.filter(v => v !== value));
/** The picker's dates are calendar days as clicked; read them as PNG days. */
const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');

/**
 * General inquiries taken at reception, saved in FrontDesk_Inquiries (plan Phase 5A). Without a
 * date filter it shows every open inquiry, however old, plus the last 30 days of resolved ones.
 */
const GeneralInquiries = (): React.ReactElement => {
  const perms = useFrontDeskPermissions();
  const todayKey = pngDateKey();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [tab, setTab] = useState<StatusTab>('all');
  const [categories, setCategories] = useState<InquiryCategory[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<FrontDeskInquiry | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FrontDeskInquiry | null>(null);

  const { staffMembers } = useStaffMembers();
  const staff = useMemo<StaffOption[]>(() => staffMembers
    .filter(s => s.email)
    .map(s => ({ name: s.name, email: s.email.toLowerCase(), unit: s.department || '' }))
    .sort((a, b) => a.name.localeCompare(b.name)), [staffMembers]);

  const period = inquiryPeriod(todayKey, dateRange?.from ? { from: dayKey(dateRange.from), to: dayKey(dateRange.to ?? dateRange.from) } : undefined);
  const reported = useInquiriesReported(period.start, period.end);
  const open = useOpenInquiries(period.includeOpen);
  const mutations = useInquiryMutations();

  const register = useMemo(
    () => mergeInquiries(reported.data ?? [], period.includeOpen ? open.data ?? [] : []),
    [reported.data, open.data, period.includeOpen],
  );
  const filtered = useMemo(() => filterInquiries(register, { categories, priorities, assignees }), [register, categories, priorities, assignees]);
  const rows = useMemo(() => searchInquiries(filterInquiries(filtered, { status: tab === 'all' ? undefined : tab }), searchQuery), [filtered, tab, searchQuery]);
  const counts = useMemo(() => Object.fromEntries(INQUIRY_STATUSES.map(s => [s, filtered.filter(i => i.status === s).length])), [filtered]);

  /** Assignees to filter by: everyone assigned in the register, by name. */
  const assigneeOptions = useMemo(() => {
    const byEmail = new Map<string, string>();
    for (const i of register) if (i.assigneeEmail) byEmail.set(i.assigneeEmail, i.assigneeName || i.assigneeEmail);
    return [...byEmail].map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [register]);

  const loading = reported.isLoading || (period.includeOpen && open.isLoading);
  const loadError = reported.error || (period.includeOpen ? open.error : null);
  const listMissing = loadError instanceof FrontDeskListMissingError;

  const saveInquiry = async (input: InquiryInput) => {
    try {
      if (editing && editing !== 'new') await mutations.update.mutateAsync({ inquiry: editing, input });
      else await mutations.create.mutateAsync(input);
      return true;
    } catch {
      return false; // the mutation has already shown the error
    }
  };

  const change = (inquiry: FrontDeskInquiry, patch: Partial<InquiryInput>) =>
    mutations.update.mutate({ inquiry, input: { ...inquiryToInput(inquiry), ...patch } });

  const assignTo = (inquiry: FrontDeskInquiry, email: string | null) => {
    if ((email || '') === (inquiry.assigneeEmail || '')) return;
    const person = staff.find(s => s.email === email);
    change(inquiry, { assigneeEmail: person?.email, assigneeName: person?.name });
  };

  // ─── Row parts (render functions, so rows are not remounted on each refresh) ───

  const trigger = (label: React.ReactNode, className: string, aria: string, style?: React.CSSProperties) => (
    <Button variant="ghost" size="sm" aria-label={aria} disabled={!perms.canUpdate} style={style}
      className={cn('text-xs justify-start p-1 h-auto rounded-md hover:opacity-80 disabled:opacity-100 group-hover:border group-hover:border-dashed', className)}>
      <span className="truncate mr-1">{label}</span>
      {perms.canUpdate && <ChevronDown className="h-3 w-3 opacity-50 ml-auto flex-shrink-0" />}
    </Button>
  );

  const categoryMenu = (inquiry: FrontDeskInquiry) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!perms.canUpdate}>
        {trigger(inquiry.category, 'font-normal min-w-[80px]', `Category of ${inquiry.title}`, categoryStyle(inquiry.category))}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Change category</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {INQUIRY_CATEGORIES.map(category => (
          <DropdownMenuItem key={category} className="text-xs" disabled={inquiry.category === category} onClick={() => change(inquiry, { category })}>
            <span className="mr-2" style={{ color: categoryStyle(category).color }}>●</span>{category}
            {inquiry.category === category && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const statusMenu = (inquiry: FrontDeskInquiry) => (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!perms.canUpdate}>
          {trigger(inquiry.status, cn('font-medium min-w-[90px]', STATUS_BADGE[inquiry.status]), `Status of ${inquiry.title}`)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Change status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {INQUIRY_STATUSES.map(status => (
            <DropdownMenuItem key={status} className="text-xs" disabled={inquiry.status === status} onClick={() => change(inquiry, { status })}>
              <span className={cn('mr-2 h-2 w-2 rounded-full', STATUS_DOT[status])} />{status}
              {inquiry.status === status && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {inquiry.status === 'Resolved' && inquiry.resolvedAt && (
        <p className="text-[11px] text-muted-foreground mt-1 pl-1">{formatPngDateTime(inquiry.resolvedAt)}</p>
      )}
    </div>
  );

  const avatar = (name: string) => (
    <Avatar className="h-5 w-5 mr-1.5">
      <AvatarFallback className="text-[10px] bg-muted-foreground/20 text-muted-foreground">{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );

  const assigneeMenu = (inquiry: FrontDeskInquiry) => {
    const name = inquiry.assigneeName || inquiry.assigneeEmail;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!perms.canUpdate}>
          {trigger(
            name ? <span className="inline-flex items-center">{avatar(name)}{name}</span> : <span className="text-muted-foreground italic">Unassigned</span>,
            'font-normal min-w-[80px] hover:bg-gray-100 dark:hover:bg-gray-700',
            `Assignee of ${inquiry.title}`,
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Assign to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs italic" onClick={() => assignTo(inquiry, null)}>
            Unassigned{!inquiry.assigneeEmail && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          {staff.map(person => (
            <DropdownMenuItem key={person.email} className="text-xs" onClick={() => assignTo(inquiry, person.email)}>
              {avatar(person.name)}{person.name}
              {inquiry.assigneeEmail === person.email && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const actions = (inquiry: FrontDeskInquiry) => (perms.canUpdate || perms.canDelete) && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted" aria-label={`More actions for ${inquiry.title}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {perms.canUpdate && <DropdownMenuItem onClick={() => setEditing(inquiry)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>}
        {perms.canUpdate && perms.canDelete && <DropdownMenuSeparator />}
        {perms.canDelete && (
          <DropdownMenuItem onClick={() => setDeleting(inquiry)} className="text-red-600 focus:text-red-600 focus:bg-red-100/50 dark:focus:bg-red-800/30">
            <Trash2 className="mr-2 h-4 w-4" />Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const row = (inquiry: FrontDeskInquiry) => (
    <div key={inquiry.id} className="grid grid-cols-[auto_minmax(200px,_4fr)_minmax(100px,_2fr)_minmax(100px,_2fr)_minmax(120px,_2fr)_auto] gap-4 items-center p-3 px-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
      <span title={`${inquiry.priority} priority`}>{PRIORITY_ICON[inquiry.priority]}</span>
      <div className="min-w-0">
        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{inquiry.title}</div>
        {inquiry.description && <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={inquiry.description}>{inquiry.description}</div>}
        <div className="text-xs text-muted-foreground mt-1">
          Reported{inquiry.reportedBy ? ` by ${inquiry.reportedBy}` : ''} · {formatPngDateTime(inquiry.reportedAt)}
        </div>
      </div>
      <div className="flex items-center">{categoryMenu(inquiry)}</div>
      <div className="flex items-center">{statusMenu(inquiry)}</div>
      <div className="flex items-center">{assigneeMenu(inquiry)}</div>
      <div className="flex justify-end items-center">{actions(inquiry)}</div>
    </div>
  );

  const renderRows = () => {
    if (loading) return <p className="text-sm text-muted-foreground py-12 text-center">Loading inquiries…</p>;
    if (loadError) {
      return (
        <div className="text-center py-12 text-sm">
          <p className="font-medium">The inquiries could not be loaded.</p>
          <p className="text-muted-foreground mt-1">
            {listMissing
              ? 'The Front Desk lists have not been set up. An administrator can create them from TestGround → Front Desk Lists Setup.'
              : loadError instanceof Error ? loadError.message : String(loadError)}
          </p>
        </div>
      );
    }
    if (!rows.length) {
      return (
        <div className="text-center py-16 text-sm text-gray-500 dark:text-gray-400">
          {register.length
            ? 'No inquiries match these filters.'
            : period.includeOpen ? 'No inquiries yet.' : 'No inquiries were reported on these dates.'}
        </div>
      );
    }
    return rows.map(row);
  };

  const filterButton = (label: string, count: number, icon: React.ReactNode) => (
    <Button variant="outline" size="sm" className={cn(count > 0 && 'border-primary text-primary')}>
      {icon}{label}{count > 0 && ` (${count})`}
    </Button>
  );

  return (
    <div className="h-full flex flex-col p-4 bg-gray-50 dark:bg-gray-900">
      <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker selectedRange={dateRange} onSelectRange={setDateRange} placeholder="Filter by date reported…" className="w-[280px]" />
            {dateRange?.from && <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>Clear dates</Button>}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>{filterButton('Category', categories.length, <Filter className="mr-2 h-4 w-4" />)}</DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {INQUIRY_CATEGORIES.map(category => (
                  <DropdownMenuCheckboxItem key={category} checked={categories.includes(category)} onCheckedChange={on => setCategories(c => toggle(c, category, !!on))}>
                    {category}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>{filterButton('Priority', priorities.length, <Filter className="mr-2 h-4 w-4" />)}</DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PRIORITIES.map(priority => (
                  <DropdownMenuCheckboxItem key={priority} checked={priorities.includes(priority)} onCheckedChange={on => setPriorities(p => toggle(p, priority, !!on))}>
                    {PRIORITY_ICON[priority]}<span className="ml-2">{priority}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>{filterButton('Assigned to', assignees.length, <User className="mr-2 h-4 w-4" />)}</DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel>Filter by assignee</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={assignees.includes(UNASSIGNED)} onCheckedChange={on => setAssignees(a => toggle(a, UNASSIGNED, !!on))}>
                  <span className="italic text-muted-foreground">Unassigned</span>
                </DropdownMenuCheckboxItem>
                {assigneeOptions.map(person => (
                  <DropdownMenuCheckboxItem key={person.email} checked={assignees.includes(person.email)} onCheckedChange={on => setAssignees(a => toggle(a, person.email, !!on))}>
                    {avatar(person.name)}{person.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {perms.canCreate && (
            <Button onClick={() => setEditing('new')} size="sm">
              <Plus className="h-4 w-4 mr-1" />New Inquiry
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {period.includeOpen
            ? `Showing every open inquiry and the last ${RECENT_DAYS} days of resolved ones.`
            : `Showing inquiries reported ${period.from === period.to ? `on ${formatDateKey(period.from)}` : `from ${formatDateKey(period.from)} to ${formatDateKey(period.to)}`}.`}
        </p>
      </div>

      <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <nav className="-mb-px flex space-x-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0" aria-label="Status">
            {(['all', ...INQUIRY_STATUSES] as StatusTab[]).map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm',
                  tab === value
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200',
                )}
              >
                {value === 'all' ? `All (${filtered.length})` : `${value} (${counts[value] ?? 0})`}
              </button>
            ))}
          </nav>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search inquiries…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
          <div className="grid grid-cols-[auto_minmax(200px,_4fr)_minmax(100px,_2fr)_minmax(100px,_2fr)_minmax(120px,_2fr)_auto] gap-4 items-center p-3 px-4 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="w-4" />
            <div>Inquiry</div>
            <div>Category</div>
            <div>Status</div>
            <div>Assigned to</div>
            <div className="w-6" />
          </div>
        </div>
        <div>{renderRows()}</div>
      </div>

      <InquiryDialog
        open={editing !== null}
        inquiry={editing === 'new' ? null : editing}
        staff={staff}
        saving={mutations.create.isPending || mutations.update.isPending}
        onClose={() => setEditing(null)}
        onSubmit={saveInquiry}
      />

      <AlertDialog open={!!deleting} onOpenChange={isOpen => { if (!isOpen) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this inquiry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <span className="font-medium">{deleting?.title}</span>. Use Resolved instead to keep the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'destructive' }))}
              onClick={() => { if (deleting) mutations.remove.mutate(deleting); setDeleting(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GeneralInquiries;
