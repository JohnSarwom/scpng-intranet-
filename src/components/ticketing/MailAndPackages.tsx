import React, { useMemo, useState } from 'react';
import {
  AlertCircle, Box, CheckCircle, ChevronDown, Clock, Filter, LayoutGrid, List, Mail, Pencil, Plus, Search, Trash2, Undo,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CollectionDialog } from '@/components/frontDesk/mail/CollectionDialog';
import { useFrontDeskPermissions } from '@/hooks/frontDesk/useFrontDeskPermissions';
import { useMailInPeriod, useMailMutations, useMailOutstanding } from '@/hooks/frontDesk/useMailPackages';
import { useStaffMembers } from '@/hooks/useStaffMembers';
import { MAIL_ITEM_TYPES, MAIL_STATUSES, type MailItemType, type MailStatus } from '@/services/frontDesk/frontDeskConfig';
import { FrontDeskListMissingError } from '@/services/frontDesk/frontDeskGraph';
import {
  daysWaiting, isOverdue, MAIL_STATUS_LABELS, mergeRegister, periodRange, searchMail, type FrontDeskMailItem, type MailInput, type MailPeriod,
} from '@/services/frontDesk/mailRules';
import { formatPngDateTime, formatPngTime, pngDateKey } from '@/services/frontDesk/pngTime';
import MailPackageDialog from './MailPackageDialog';

type ViewMode = 'list' | 'grid';
type Tab = 'all' | MailStatus;

const STATUS_STYLE: Record<MailStatus, { icon: React.ElementType; className: string }> = {
  Received: { icon: Mail, className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600' },
  'Pending Pickup': { icon: Clock, className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
  'Signature Required': { icon: AlertCircle, className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700' },
  Delivered: { icon: CheckCircle, className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-200 dark:border-green-700' },
};

const TYPE_STYLE: Record<MailItemType, string> = {
  Mail: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  Package: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

const PERIODS: { id: MailPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'last-7-days', label: 'Last 7 days' },
  { id: 'last-30-days', label: 'Last 30 days' },
  { id: 'custom', label: 'Custom range' },
];

const initials = (name: string) =>
  name.split(/\s+/).map(part => part.match(/[\p{L}\p{N}]/u)?.[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';

/**
 * The mail and parcel register (plan Phase 4A), saved in FrontDesk_MailPackages. Items still
 * waiting at reception always show, whatever period is chosen, so nothing is forgotten.
 */
const MailAndPackages: React.FC = () => {
  const perms = useFrontDeskPermissions();
  const todayKey = pngDateKey();
  const [period, setPeriod] = useState<MailPeriod>('last-7-days');
  const [custom, setCustom] = useState({ from: todayKey, to: todayKey });
  const [types, setTypes] = useState<MailItemType[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editing, setEditing] = useState<FrontDeskMailItem | 'new' | null>(null);
  const [collecting, setCollecting] = useState<FrontDeskMailItem | null>(null);
  const [deleting, setDeleting] = useState<FrontDeskMailItem | null>(null);

  const { staffMembers } = useStaffMembers();
  const staff = useMemo(() => staffMembers
    .filter(s => s.email)
    .map(s => ({ name: s.name, email: s.email.toLowerCase(), unit: s.department || '' }))
    .sort((a, b) => a.name.localeCompare(b.name)), [staffMembers]);

  const range = periodRange(period, todayKey, custom);
  const inPeriod = useMailInPeriod(range.start, range.end);
  const outstanding = useMailOutstanding();
  const mutations = useMailMutations();
  const nowIso = new Date().toISOString();

  const register = useMemo(() => mergeRegister(inPeriod.data ?? [], outstanding.data ?? [])
    .filter(item => !types.length || types.includes(item.itemType)), [inPeriod.data, outstanding.data, types]);
  const rows = useMemo(() => searchMail(register.filter(item => tab === 'all' || item.status === tab), searchQuery), [register, tab, searchQuery]);
  const waitingCount = (outstanding.data ?? []).length;

  const changeStatus = (item: FrontDeskMailItem, target: MailStatus) => {
    if (target === item.status) return;
    if (target === 'Delivered') setCollecting(item);
    else mutations.changeStatus.mutate({ item, target });
  };

  const saveItem = async (input: MailInput) => {
    try {
      if (editing && editing !== 'new') await mutations.update.mutateAsync({ item: editing, input });
      else await mutations.create.mutateAsync(input);
      return true;
    } catch {
      return false; // the mutation has already shown the error
    }
  };

  const loading = inPeriod.isLoading || outstanding.isLoading;
  const loadError = inPeriod.error || outstanding.error;
  const listMissing = [inPeriod.error, outstanding.error].some(e => e instanceof FrontDeskListMissingError);

  const statusControl = (item: FrontDeskMailItem) => {
    const { icon: Icon, className } = STATUS_STYLE[item.status];
    const badge = (
      <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}>
        <Icon className="h-3 w-3 mr-1" />{MAIL_STATUS_LABELS[item.status]}
        {perms.canUpdate && <ChevronDown className="h-3 w-3 ml-1 opacity-50" />}
      </span>
    );
    if (!perms.canUpdate) return badge;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Change status of ${item.title}`}>{badge}</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Change status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MAIL_STATUSES.map(status => {
            const { icon: Icon2 } = STATUS_STYLE[status];
            return (
              <DropdownMenuItem key={status} disabled={item.status === status} onClick={() => changeStatus(item, status)} className="text-xs">
                <Icon2 className="h-3 w-3 mr-2" />{status === 'Delivered' ? 'Collected…' : MAIL_STATUS_LABELS[status]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const received = (item: FrontDeskMailItem) => (
    <div>
      <p className="text-sm text-gray-700 dark:text-gray-200">{formatPngDateTime(item.receivedAt).split(',')[0]}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{formatPngTime(item.receivedAt)}</p>
      {isOverdue(item, todayKey) && (
        <p className="text-xs text-amber-700 dark:text-amber-400">Waiting {daysWaiting(item, nowIso) || 1} day{daysWaiting(item, nowIso) === 1 ? '' : 's'}</p>
      )}
    </div>
  );

  const collected = (item: FrontDeskMailItem) =>
    item.status === 'Delivered' && item.collectedBy
      ? <p className="text-xs text-green-700 dark:text-green-400 mt-1">Collected by {item.collectedBy}, {formatPngDateTime(item.collectedAt)}</p>
      : null;

  const itemActions = (item: FrontDeskMailItem, compact = false) => (
    <div className="flex items-center justify-end gap-1">
      {perms.canUpdate && item.status !== 'Delivered' && (
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setCollecting(item)}>
          <CheckCircle className="h-3.5 w-3.5 mr-1" />{compact ? 'Collect' : 'Mark collected'}
        </Button>
      )}
      {perms.canUpdate && item.status === 'Delivered' && (
        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-gray-600" title="Undo collection" onClick={() => changeStatus(item, 'Pending Pickup')}>
          <Undo className="h-3.5 w-3.5" />
        </Button>
      )}
      {perms.canUpdate && (
        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-gray-600" title="Edit" aria-label={`Edit ${item.title}`} onClick={() => setEditing(item)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {perms.canDelete && (
        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-600" title="Delete" aria-label={`Delete ${item.title}`} onClick={() => setDeleting(item)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  const typeIcon = (type: MailItemType, size: 'sm' | 'md' = 'md') => (
    <div className={cn('rounded-full flex items-center justify-center flex-shrink-0', TYPE_STYLE[type], size === 'md' ? 'w-10 h-10' : 'w-8 h-8')}>
      {type === 'Mail' ? <Mail className="h-4 w-4" /> : <Box className="h-4 w-4" />}
    </div>
  );

  const renderItems = () => {
    if (loading) return <p className="text-sm text-muted-foreground py-12 text-center">Loading the register…</p>;
    if (loadError) {
      return (
        <div className="text-center py-12 text-sm">
          <p className="font-medium">The mail register could not be loaded.</p>
          <p className="text-muted-foreground mt-1">
            {listMissing
              ? 'The Front Desk lists have not been set up. An administrator can create them from TestGround → Front Desk Lists Setup.'
              : loadError instanceof Error ? loadError.message : String(loadError)}
          </p>
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Mail className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm">{searchQuery || tab !== 'all' || types.length ? 'No items match.' : 'No mail or parcels in this period, and nothing is waiting.'}</p>
        </div>
      );
    }
    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm flex flex-col p-4">
              <div className="flex items-center justify-between mb-3">
                {typeIcon(item.itemType, 'sm')}
                {statusControl(item)}
              </div>
              <h4 className="font-medium text-sm line-clamp-2">{item.title}</h4>
              {item.sender && <p className="text-xs text-gray-500 dark:text-gray-400">From: {item.sender}</p>}
              {item.tracking && <p className="text-xs text-gray-500 dark:text-gray-400">Tracking: {item.tracking}</p>}
              <div className="flex items-center mt-auto pt-3 border-t dark:border-gray-700/50">
                <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-md flex items-center justify-center text-xs mr-2 font-medium flex-shrink-0">{initials(item.recipientName)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{item.recipientName}</p>
                  {item.recipientUnit && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.recipientUnit}</p>}
                </div>
              </div>
              <div className="mt-2 text-xs">{received(item)}</div>
              {collected(item)}
              <div className="mt-2">{itemActions(item, true)}</div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border dark:border-gray-700">
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          <div className="col-span-1">Type</div>
          <div className="col-span-3">Details</div>
          <div className="col-span-2">Recipient</div>
          <div className="col-span-2">Received</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {rows.map(item => (
          <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 p-4 border-b last:border-b-0 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <div className="md:col-span-1">{typeIcon(item.itemType)}</div>
            <div className="md:col-span-3">
              <h4 className="font-medium">{item.title}</h4>
              {item.sender && <p className="text-sm text-gray-500 dark:text-gray-400">From: {item.sender}{item.carrier ? ` · ${item.carrier}` : ''}</p>}
              {!item.sender && item.carrier && <p className="text-sm text-gray-500 dark:text-gray-400">{item.carrier}</p>}
              {item.tracking && <p className="text-sm text-gray-500 dark:text-gray-400">Tracking: {item.tracking}</p>}
              {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">Note: {item.notes}</p>}
            </div>
            <div className="md:col-span-2">
              <div className="flex items-center">
                <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-md flex items-center justify-center text-xs mr-2 font-medium flex-shrink-0">{initials(item.recipientName)}</div>
                <span className="text-sm">{item.recipientName}</span>
              </div>
              {item.recipientUnit && <p className="text-sm text-gray-500 dark:text-gray-400 md:mt-1">{item.recipientUnit}</p>}
            </div>
            <div className="md:col-span-2">{received(item)}</div>
            <div className="md:col-span-2">{statusControl(item)}{collected(item)}</div>
            <div className="md:col-span-2">{itemActions(item)}</div>
          </div>
        ))}
      </div>
    );
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All items', count: register.length },
    ...MAIL_STATUSES.map(status => ({ id: status as Tab, label: MAIL_STATUS_LABELS[status], count: register.filter(i => i.status === status).length })),
  ];

  return (
    <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-[500px] space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={value => setPeriod(value as MailPeriod)}>
              <SelectTrigger className="h-9 w-[10.5rem]" aria-label="Received period"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            {period === 'custom' && (
              <>
                <Input type="date" aria-label="From date" className="h-9 w-[9.5rem]" value={custom.from} max={todayKey} onChange={e => setCustom(c => ({ ...c, from: e.target.value || todayKey }))} />
                <span className="text-sm text-muted-foreground">to</span>
                <Input type="date" aria-label="To date" className="h-9 w-[9.5rem]" value={custom.to} max={todayKey} onChange={e => setCustom(c => ({ ...c, to: e.target.value || todayKey }))} />
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="mr-2 h-4 w-4 text-gray-500" />Type
                  {types.length > 0 && <Badge variant="secondary" className="ml-2 rounded-full px-1.5 text-xs">{types.length}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {MAIL_ITEM_TYPES.map(type => (
                  <DropdownMenuCheckboxItem
                    key={type}
                    checked={types.includes(type)}
                    onCheckedChange={checked => setTypes(t => (checked ? [...t, type] : t.filter(x => x !== type)))}
                  >
                    {type === 'Package' ? 'Parcel' : type}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-xs text-muted-foreground">
              {waitingCount} waiting for collection — always shown, whatever the period.
            </span>
          </div>
          {perms.canCreate && (
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setEditing('new')}>
              <Plus className="mr-2 h-4 w-4" />Log item
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex flex-wrap -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn('px-3 py-2 text-sm font-medium border-b-2',
                  tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white')}
              >
                {t.label} <span className="text-xs text-muted-foreground">({t.count})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input type="search" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-full md:w-64" />
            </div>
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none border-r dark:border-gray-600" onClick={() => setViewMode('grid')} title="Grid view">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode('list')} title="List view">
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {renderItems()}

      <MailPackageDialog
        open={editing !== null}
        item={editing && editing !== 'new' ? editing : null}
        staff={staff}
        saving={mutations.create.isPending || mutations.update.isPending}
        onClose={() => setEditing(null)}
        onSubmit={saveItem}
      />

      <CollectionDialog
        item={collecting}
        saving={mutations.changeStatus.isPending}
        onClose={() => setCollecting(null)}
        onConfirm={collection => {
          if (collecting) mutations.changeStatus.mutate({ item: collecting, target: 'Delivered', collection });
          setCollecting(null);
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `${deleting.title} for ${deleting.recipientName}` : ''} will be removed from the register for good.
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

export default MailAndPackages;
