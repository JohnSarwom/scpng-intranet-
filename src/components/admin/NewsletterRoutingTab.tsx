import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  PremiumTable,
  PremiumTableBody,
  PremiumTableCell,
  PremiumTableHead,
  PremiumTableHeader,
  PremiumTableRow,
} from '@/components/ui/PremiumTable';
import {
  newslettersConfigured,
  NewsletterService,
} from '@/services/newsletterService';
import { canonicalDivision, isOrganizationDivision } from '@/lib/newsletters/organizationDivision';
import {
  type Assignment,
  type Role,
  type RoutingAdminView,
  type RoutingDocument,
  routingRoleLabels,
  routingWarnings,
  validateRoutingEdit,
} from '@/types/newsletterRouting';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50 dark:bg-gray-800';
function localDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
}
function timestamp(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export default function NewsletterRoutingTab() {
  const { instance, accounts } = useMsal();
  const identity = (instance.getActiveAccount() || accounts[0])?.homeAccountId;
  const service = useMemo(() => new NewsletterService(instance), [instance]);
  const [view, setView] = useState<RoutingAdminView | null>(null);
  const [draft, setDraft] = useState<RoutingDocument | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const sequence = useRef(0);
  const locked = useRef(false);
  const load = useCallback(async () => {
    if (!newslettersConfigured() || locked.current) return;
    const token = ++sequence.current;
    locked.current = true;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const next = await service.routingSettings();
      if (token !== sequence.current) return;
      setView(next);
      setDraft(structuredClone(next.config));
      setReason('');
    } catch (e) {
      if (token === sequence.current) {
        setError(
          e instanceof Error
            ? e.message
            : 'Could not load newsletter appointments.',
        );
      }
    } finally {
      if (token === sequence.current) {
        setBusy(false);
        locked.current = false;
      }
    }
  }, [service]);
  useEffect(() => {
    sequence.current++;
    locked.current = false;
    setView(null);
    setDraft(null);
    setReason('');
    setError('');
    setSaved('');
    if (identity) void load();
    return () => {
      // Invalidate the latest request on identity change/unmount, not a captured DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequence.current++;
      locked.current = false;
    };
  }, [identity, load]);
  const divisions = useMemo(
    () => [...new Set(view?.roster.map((s) => canonicalDivision(s.division)).filter(isOrganizationDivision) || [])].sort(),
    [view],
  );
  const validation = useMemo(() => {
    if (!draft || !view) return { error: '', warnings: [] as string[] };
    try {
      const next = validateRoutingEdit(draft, view.roster, view.config);
      return { error: '', warnings: routingWarnings(next) };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Check the appointments.',
        warnings: [] as string[],
      };
    }
  }, [draft, view]);
  const dirty = !!draft && !!view &&
    JSON.stringify(draft) !== JSON.stringify(view.config);
  const edit = (index: number, patch: Partial<Assignment>) => {
    setSaved('');
    setDraft((current) =>
      current
        ? {
          ...current,
          assignments: current.assignments.map((a, i) =>
            i === index ? { ...a, ...patch } : a
          ),
        }
        : current
    );
  };
  async function save() {
    if (!draft || !view || locked.current || validation.error) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setSaved('');
    const token = sequence.current;
    try {
      const next = await service.saveRouting(draft, view.etag, reason.trim());
      if (token !== sequence.current) return;
      setView(next);
      setDraft(structuredClone(next.config));
      setReason('');
      setSaved(
        'Newsletter appointments saved and verified. New submissions and subsequent decisions use these appointments.',
      );
    } catch (e) {
      if (token === sequence.current) {
        setError(
          e instanceof Error
            ? e.message
            : 'Could not save newsletter appointments.',
        );
      }
    } finally {
      if (token === sequence.current) {
        setBusy(false);
        locked.current = false;
      }
    }
  }
  if (!newslettersConfigured()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Newsletter Routing</CardTitle>
          <CardDescription>
            Assign newsletter approvers, reviewers and publishers here once the
            Power Automate flows and SharePoint request lists are configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            The Power Automate processor and SharePoint request lists need
            configuration before appointments can be loaded or saved. General
            user roles remain available in Users and Roles & Groups.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className='space-y-6'>
      <Card className='dark:border-white/10 dark:bg-gray-800'>
        <CardHeader>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div>
              <CardTitle>Newsletter Routing</CardTitle>
              <CardDescription className='mt-2'>
                Choose who approves, edits and publishes newsletters. Staff
                choices come from the synchronized directory.
              </CardDescription>
              <p className='mt-2 text-sm text-muted-foreground'>
                Intranet administrators can manage these appointments. To delegate
                this access, enable “Manage reviewers and publishers” under
                Newsletter appointments in Roles &amp; Groups, then assign that
                group to the person in Users. Removing the permission removes
                their newsletter administration access.
              </p>
            </div>
            <Button variant='outline' disabled={busy || dirty} onClick={load}>
              <RefreshCw className='mr-2 h-4 w-4' />Reload staff & appointments
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-5'>
          {busy && (
            <p role='status' className='flex items-center gap-2 text-sm'>
              <Loader2 className='h-4 w-4 animate-spin' />
              {view
                ? 'Saving or refreshing appointments…'
                : 'Loading newsletter appointments…'}
            </p>
          )}
          {error && (
            <p
              role='alert'
              className='rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100'
            >
              {error}{' '}
              Your unsaved changes are retained. For a changed-settings
              conflict, discard your draft and reload before trying again.
            </p>
          )}
          {saved && (
            <p
              role='status'
              className='flex gap-2 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
            >
              <CheckCircle2 className='h-5 w-5 shrink-0' />
              {saved}
            </p>
          )}
          {draft && view && (
            <>
              <div className='rounded-lg bg-muted/40 p-4 text-sm leading-6'>
                <p>
                  <strong>{view.roster.length} current staff</strong> ·{' '}
                  {view.configured
                    ? 'Saved routing configuration'
                    : 'First-time routing setup'}
                </p>
                <p>
                  Use a division for divisional approvers. For temporary cover,
                  end the existing appointment at the replacement's start time.
                  Dates use your browser's local time.
                </p>
                <p>
                  Appointments grant newsletter responsibilities only. General
                  intranet access is managed under Users and Roles & Groups.
                </p>
              </div>
              <fieldset disabled={busy} className='space-y-5'>
                <div className='grid gap-4 md:grid-cols-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='routing-rp'>
                      Research & Publication division
                    </Label>
                    <select
                      id='routing-rp'
                      className={selectClass}
                      value={draft.rpDivision}
                      onChange={(e) =>
                        setDraft({ ...draft, rpDivision: e.target.value })}
                    >
                      {divisions.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='routing-days'>
                      Review deadline (working days)
                    </Label>
                    <Input
                      id='routing-days'
                      type='number'
                      min={1}
                      max={30}
                      value={draft.reviewDays}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          reviewDays: Number(e.target.value),
                        })}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='routing-escalation'>
                      Escalation contact
                    </Label>
                    <select
                      id='routing-escalation'
                      className={selectClass}
                      value={draft.escalationOid || ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          escalationOid: e.target.value || undefined,
                        })}
                    >
                      <option value=''>No escalation contact</option>
                      {view.roster.map((s) => (
                        <option key={s.oid} value={s.oid}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <h3 className='text-lg font-semibold'>Appointments</h3>
                  <Button
                    variant='outline'
                    onClick={() =>
                      setDraft({
                        ...draft,
                        assignments: [...draft.assignments, {
                          oid: '',
                          role: 'division_approver',
                          division: divisions[0],
                        }],
                      })}
                  >
                    <Plus className='mr-2 h-4 w-4' />Add appointment
                  </Button>
                </div>
                {draft.assignments.length
                  ? (
                    <PremiumTable>
                      <PremiumTableHeader>
                        <PremiumTableRow>
                          <PremiumTableHead>Officer</PremiumTableHead>
                          <PremiumTableHead>
                            Responsibility / division
                          </PremiumTableHead>
                          <PremiumTableHead>Start / end</PremiumTableHead>
                          <PremiumTableHead>Action</PremiumTableHead>
                        </PremiumTableRow>
                      </PremiumTableHeader>
                      <PremiumTableBody>
                        {draft.assignments.map((a, index) => (
                          <PremiumTableRow key={index}>
                            <PremiumTableCell className='min-w-[230px] align-top'>
                              <Label
                                className='sr-only'
                                htmlFor={`routing-officer-${index}`}
                              >
                                Officer for appointment {index + 1}
                              </Label>
                              <select
                                id={`routing-officer-${index}`}
                                className={selectClass}
                                value={a.oid}
                                onChange={(e) =>
                                  edit(index, { oid: e.target.value })}
                              >
                                <option value=''>Choose staff member</option>
                                {draft.staff.map((s) => (
                                  <option
                                    key={s.oid}
                                    value={s.oid}
                                    disabled={!s.active}
                                  >
                                    {s.name}
                                    {s.active
                                      ? ''
                                      : ' (no longer in staff roster)'}
                                  </option>
                                ))}
                              </select>
                              <p className='mt-2 text-xs text-muted-foreground'>
                                {draft.staff.find((s) =>
                                  s.oid === a.oid
                                )?.email}
                              </p>
                            </PremiumTableCell>
                            <PremiumTableCell className='min-w-[260px] space-y-2 align-top'>
                              <Label
                                className='sr-only'
                                htmlFor={`routing-role-${index}`}
                              >
                                Responsibility for appointment {index + 1}
                              </Label>
                              <select
                                id={`routing-role-${index}`}
                                className={selectClass}
                                value={a.role}
                                onChange={(e) =>
                                  edit(index, {
                                    role: e.target.value as Role,
                                    division:
                                      e.target.value === 'division_approver'
                                        ? a.division || divisions[0]
                                        : a.division,
                                  })}
                              >
                                {Object.entries(routingRoleLabels).map((
                                  [role, name],
                                ) => (
                                  <option key={role} value={role}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                              <Label
                                className='sr-only'
                                htmlFor={`routing-division-${index}`}
                              >
                                Division for appointment {index + 1}
                              </Label>
                              <select
                                id={`routing-division-${index}`}
                                className={selectClass}
                                value={a.division || ''}
                                onChange={(e) =>
                                  edit(index, {
                                    division: e.target.value || undefined,
                                  })}
                              >
                                {a.role !== 'division_approver' && (
                                  <option value=''>All divisions</option>
                                )}
                                {divisions.map((d) => (
                                  <option key={d}>{d}</option>
                                ))}
                              </select>
                            </PremiumTableCell>
                            <PremiumTableCell className='min-w-[220px] space-y-2 align-top'>
                              <Label
                                htmlFor={`routing-start-${index}`}
                                className='text-xs'
                              >
                                Start (blank = already effective)
                              </Label>
                              <Input
                                id={`routing-start-${index}`}
                                type='datetime-local'
                                value={localDate(a.startsAt)}
                                onChange={(e) =>
                                  edit(index, {
                                    startsAt: timestamp(e.target.value),
                                  })}
                              />
                              <Label
                                htmlFor={`routing-end-${index}`}
                                className='text-xs'
                              >
                                End (blank = ongoing)
                              </Label>
                              <Input
                                id={`routing-end-${index}`}
                                type='datetime-local'
                                value={localDate(a.endsAt)}
                                onChange={(e) =>
                                  edit(index, {
                                    endsAt: timestamp(e.target.value),
                                  })}
                              />
                            </PremiumTableCell>
                            <PremiumTableCell className='align-top'>
                              <Button
                                variant='ghost'
                                size='icon'
                                aria-label={`Remove appointment ${index + 1}`}
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    assignments: draft.assignments.filter((
                                      _,
                                      i,
                                    ) => i !== index),
                                  })}
                              >
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            </PremiumTableCell>
                          </PremiumTableRow>
                        ))}
                      </PremiumTableBody>
                    </PremiumTable>
                  )
                  : (
                    <p className='rounded-lg border border-dashed p-6 text-sm text-muted-foreground'>
                      No appointments yet. Add divisional approval, editorial
                      review, final approval and publishing responsibilities for
                      the pilot.
                    </p>
                  )}
                {validation.error && (
                  <p
                    role='alert'
                    className='text-sm text-red-700 dark:text-red-300'
                  >
                    {validation.error}
                  </p>
                )}
                {!!validation.warnings.length && (
                  <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100'>
                    <h3 className='flex items-center gap-2 font-semibold'>
                      <AlertCircle className='h-4 w-4' />Coverage and
                      independent review
                    </h3>
                    <p className='mt-2'>
                      You can save pilot settings with these gaps. Affected
                      submissions remain blocked until the required appointments
                      are available.
                    </p>
                    <ul className='mt-2 list-disc space-y-1 pl-5'>
                      {validation.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className='space-y-2'>
                  <Label htmlFor='routing-reason'>Reason for this change</Label>
                  <Textarea
                    id='routing-reason'
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder='For example: appoint the pilot reviewers, or cover an officer on leave.'
                  />
                  <p className='text-xs text-muted-foreground'>
                    A reason and private before/after snapshot are recorded for
                    each save.
                  </p>
                </div>
                <div className='flex flex-wrap gap-3'>
                  <Button
                    className='bg-intranet-primary text-white hover:bg-intranet-primary/90'
                    disabled={!!validation.error || reason.trim().length < 5 ||
                      (!dirty && view.configured)}
                    onClick={save}
                  >
                    <Save className='mr-2 h-4 w-4' />Save appointments
                  </Button>
                  <Button
                    variant='outline'
                    disabled={!dirty && !error}
                    onClick={() => {
                      setDraft(structuredClone(view.config));
                      setReason('');
                      setError('');
                      setSaved('');
                    }}
                  >
                    Discard draft
                  </Button>
                </div>
              </fieldset>
              <p className='text-sm text-muted-foreground'>
                Existing submissions keep their recorded reviewer assignment. If
                an officer changes, an authorised publisher must open the
                submission and use Refresh Reviewer Assignment with a reason.
                Ending an appointment removes that officer's authority for
                subsequent decisions.
              </p>
            </>
          )}
        </CardContent>
      </Card>
      {!!view?.config.audit?.length && (
        <Card className='dark:border-white/10 dark:bg-gray-800'>
          <CardHeader>
            <CardTitle>Appointment history</CardTitle>
            <CardDescription>
              Verified settings changes. Private recovery snapshots are retained
              in the newsletter document library.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PremiumTable>
              <PremiumTableHeader>
                <PremiumTableRow>
                  <PremiumTableHead>When</PremiumTableHead>
                  <PremiumTableHead>Changed by</PremiumTableHead>
                  <PremiumTableHead>Reason</PremiumTableHead>
                </PremiumTableRow>
              </PremiumTableHeader>
              <PremiumTableBody>
                {[...view.config.audit].reverse().map((a) => (
                  <PremiumTableRow key={a.version}>
                    <PremiumTableCell>
                      {new Date(a.at).toLocaleString()}
                    </PremiumTableCell>
                    <PremiumTableCell>
                      {view.config.staff.find((s) =>
                        s.oid === a.actorOid
                      )
                        ?.name || a.actorOid}
                    </PremiumTableCell>
                    <PremiumTableCell>{a.reason}</PremiumTableCell>
                  </PremiumTableRow>
                ))}
              </PremiumTableBody>
            </PremiumTable>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
