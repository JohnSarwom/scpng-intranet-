import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, List, PlusIcon, ScrollText, SearchIcon, UserIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { QuickSignInBar } from '@/components/frontDesk/visitors/QuickSignInBar';
import { VisitorBoard } from '@/components/frontDesk/visitors/VisitorBoard';
import { VisitorCard } from '@/components/frontDesk/visitors/VisitorCard';
import { VisitorFormDialog } from '@/components/frontDesk/visitors/VisitorFormDialog';
import { VisitorTable } from '@/components/frontDesk/visitors/VisitorTable';
import { STATUS_DOT } from '@/components/frontDesk/visitors/visitorDisplay';
import type { VisitorActionHandlers } from '@/components/frontDesk/visitors/VisitorActions';
import { useFrontDeskPermissions } from '@/hooks/frontDesk/useFrontDeskPermissions';
import { useVisitorLog, useVisitorMutations, useVisitorsOnSite } from '@/hooks/frontDesk/useVisitors';
import { useStaffMembers } from '@/hooks/useStaffMembers';
import { VISITOR_STATUSES, type VisitorStatus } from '@/services/frontDesk/frontDeskConfig';
import { FrontDeskListMissingError } from '@/services/frontDesk/frontDeskGraph';
import {
  formatDateKey,
  isCarriedOver,
  logRows,
  pngDateKey,
  searchVisitors,
  shiftDateKey,
  sortForLog,
  VISITOR_STATUS_LABELS,
  type FrontDeskVisitor,
  type VisitorInput,
} from '@/services/frontDesk/visitorRules';

type ViewMode = 'log' | 'board' | 'grid' | 'list';
type Tab = 'all' | VisitorStatus | 'on-site-now';

const VIEWS: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: 'log', label: 'Log', icon: ScrollText },
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'grid', label: 'Grid', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
];

/**
 * The Front Desk visitor log (plan Phase 3): the saved replacement for the paper Visitors Log
 * Sheet. Walk-ins sign in from the bar at the top; the Log view shows the sheet's columns.
 */
const VisitorManagement: React.FC = () => {
  const todayKey = pngDateKey();
  const [dateKey, setDateKey] = useState(todayKey);
  const [tab, setTab] = useState<Tab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('log');
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState<FrontDeskVisitor | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FrontDeskVisitor | null>(null);

  const perms = useFrontDeskPermissions();
  const { staffMembers } = useStaffMembers();
  const staff = useMemo(() => staffMembers
    .filter(s => s.email)
    .map(s => ({ name: s.name, email: s.email.toLowerCase() }))
    .sort((a, b) => a.name.localeCompare(b.name)), [staffMembers]);

  const log = useVisitorLog(dateKey);
  const onSite = useVisitorsOnSite();
  const mutations = useVisitorMutations();
  const nowIso = new Date().toISOString();

  const dayRows = useMemo(() => logRows(log.data ?? [], onSite.data ?? [], dateKey, todayKey), [log.data, onSite.data, dateKey, todayKey]);
  const rows = useMemo(() => {
    const base = tab === 'on-site-now' ? sortForLog(onSite.data ?? []) : dayRows.filter(v => tab === 'all' || v.status === tab);
    return searchVisitors(base, searchQuery);
  }, [tab, onSite.data, dayRows, searchQuery]);

  const onSiteCount = onSite.data?.length ?? 0;
  const carriedOverCount = (onSite.data ?? []).filter(v => isCarriedOver(v, todayKey)).length;
  const isToday = dateKey === todayKey;

  const actions: VisitorActionHandlers = {
    canUpdate: perms.canUpdate,
    canDelete: perms.canDelete,
    onChangeStatus: (visitor, target) => mutations.changeStatus.mutate({ visitor, target }),
    onEdit: visitor => setEditing(visitor),
    onDelete: visitor => setDeleting(visitor),
  };

  const signIn = async (input: VisitorInput) => {
    try {
      return await mutations.create.mutateAsync({ input, status: 'On Site' });
    } catch {
      return undefined; // the mutation has already shown the error
    }
  };

  const saveForm = async (input: VisitorInput, photo?: File) => {
    let visitorId: string;
    try {
      if (editing && editing !== 'new') {
        await mutations.update.mutateAsync({ visitor: editing, input });
        visitorId = editing.id;
      } else {
        visitorId = (await mutations.create.mutateAsync({ input, status: 'Expected' })).id;
      }
    } catch {
      return false;
    }
    // A failed photo upload shows its own error; the visitor is already saved.
    if (photo) await mutations.attachPhoto.mutateAsync({ visitorId, file: photo }).catch(() => undefined);
    return true;
  };

  const changeDate = (next: string) => {
    setDateKey(next || todayKey);
    if (tab === 'on-site-now') setTab('all');
  };

  const listMissing = [log.error, onSite.error].find(e => e instanceof FrontDeskListMissingError);
  const loadError = log.error || onSite.error;

  const renderVisitors = () => {
    if (log.isLoading || onSite.isLoading) {
      return <p className="text-sm text-muted-foreground py-12 text-center">Loading the visitor log…</p>;
    }
    if (loadError) {
      return (
        <div className="text-center py-12 text-sm">
          <p className="font-medium">The visitor log could not be loaded.</p>
          <p className="text-muted-foreground mt-1">
            {listMissing
              ? 'The Front Desk lists have not been set up. An administrator can create them from TestGround → Front Desk Lists Setup.'
              : loadError instanceof Error ? loadError.message : String(loadError)}
          </p>
        </div>
      );
    }
    if (rows.length === 0) {
      const message = searchQuery || tab !== 'all'
        ? 'No visitors match.'
        : isToday ? 'No visitors signed in today.' : `No visitors on ${formatDateKey(dateKey)}.`;
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserIcon className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">{message}</p>
        </div>
      );
    }
    switch (viewMode) {
      case 'board':
        return <VisitorBoard visitors={rows} todayKey={todayKey} nowIso={nowIso} {...actions} />;
      case 'grid':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rows.map(visitor => <VisitorCard key={visitor.id} visitor={visitor} todayKey={todayKey} nowIso={nowIso} {...actions} />)}
          </div>
        );
      default:
        return <VisitorTable visitors={rows} todayKey={todayKey} variant={viewMode === 'list' ? 'list' : 'log'} nowIso={nowIso} {...actions} />;
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: dayRows.length },
    ...VISITOR_STATUSES.map(status => ({ id: status as Tab, label: VISITOR_STATUS_LABELS[status], count: dayRows.filter(v => v.status === status).length })),
  ];

  return (
    <div className="p-4 bg-[#fdfafa] dark:bg-gray-950 min-h-screen space-y-4">
      {perms.canCreate && isToday && (
        <QuickSignInBar todayKey={todayKey} staff={staff} saving={mutations.create.isPending} onSignIn={signIn} />
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous day" onClick={() => changeDate(shiftDateKey(dateKey, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" aria-label="Log date" value={dateKey} max={todayKey} onChange={e => changeDate(e.target.value)} className="h-8 w-[9.5rem]" />
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next day" onClick={() => changeDate(shiftDateKey(dateKey, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && <Button variant="outline" size="sm" className="h-8" onClick={() => changeDate(todayKey)}>Today</Button>}
          <span className="text-sm text-muted-foreground ml-1">{formatDateKey(dateKey)}</span>
          <Button
            variant={tab === 'on-site-now' ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setTab(tab === 'on-site-now' ? 'all' : 'on-site-now')}
          >
            <span className={cn('inline-block w-2 h-2 rounded-full mr-2', STATUS_DOT['On Site'])} />
            On site now: {onSiteCount}
            {carriedOverCount > 0 && <span className="ml-1 text-amber-600 dark:text-amber-400">({carriedOverCount} from earlier days)</span>}
          </Button>
        </div>
        {perms.canCreate && (
          <Button size="sm" className="flex items-center gap-2 bg-primary" onClick={() => setEditing('new')}>
            <PlusIcon className="h-4 w-4" />Pre-book visitor
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex space-x-5 overflow-x-auto border-b w-full md:w-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              className={cn('py-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300')}
              onClick={() => setTab(t.id)}
            >
              {t.label} <span className="text-xs text-muted-foreground">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0 md:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input type="text" placeholder="Search visitors..." className="pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center border rounded-md bg-white dark:bg-gray-800">
            {VIEWS.map(({ id, label, icon: Icon }, index) => (
              <React.Fragment key={id}>
                {index > 0 && <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />}
                <Button variant={viewMode === id ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode(id)} className="h-8 px-2">
                  <Icon className="h-4 w-4 mr-1" />{label}
                </Button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {renderVisitors()}

      <VisitorFormDialog
        open={editing !== null}
        visitor={editing && editing !== 'new' ? editing : undefined}
        defaultDate={dateKey}
        staff={staff}
        saving={mutations.create.isPending || mutations.update.isPending || mutations.attachPhoto.isPending}
        onClose={() => setEditing(null)}
        onSubmit={saveForm}
      />

      <AlertDialog open={deleting !== null} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the visitor from the log for good. To record that they did not come, mark them as a no-show instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
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

export default VisitorManagement;
