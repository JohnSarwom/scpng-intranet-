/**
 * Workflow Studio (/workflows)
 *
 * Lists the workflows in the system — built-in ones that describe the code as
 * it is, and saved ones from the Workflow_Definitions list — and draws the
 * selected one on a canvas that can be simulated step by step. An AI panel
 * drafts new workflows using the app's existing AI configuration.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Copy, Download, Loader2, Maximize, Move, PanelRight, Play, RotateCcw, Save, Search,
  Trash2, Upload, Workflow as WorkflowIcon, ZoomIn, ZoomOut, LayoutGrid, X,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import WorkflowCanvas, { type CanvasTransfer, type WorkflowCanvasHandle } from '@/components/workflows/WorkflowCanvas';
import WorkflowInspector, { type InspectorTab } from '@/components/workflows/WorkflowInspector';
import WorkflowAIBuilder from '@/components/workflows/WorkflowAIBuilder';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import {
  useCanManageWorkflows, useSavedWorkflows, useWorkflowListReadiness, useWorkflowMutations,
} from '@/hooks/useWorkflowDefinitions';
import { BUILT_IN_WORKFLOWS } from '@/workflows/builtInWorkflows';
import { autoLayout, workflowToJson } from '@/workflows/workflowSchema';
import {
  advanceRun, derivedChoice, exampleValues, startRun, type RunState, type Transfer,
} from '@/workflows/workflowRun';
import type { SavedWorkflow, WorkflowDefinition, WorkflowStatus } from '@/workflows/workflowTypes';

type Selection = { kind: 'built-in'; id: string } | { kind: 'saved'; itemId: string } | { kind: 'draft' };
type Positions = Record<string, { x: number; y: number }>;
type Confirm = 'prepare' | 'delete' | 'discard' | null;

const STATUS_BADGE: Record<WorkflowStatus, { label: string; className: string }> = {
  implemented: { label: 'As implemented', className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  published: { label: 'Published', className: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300' },
  draft: { label: 'Draft', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
};

const selectionKey = (selection: Selection) =>
  selection.kind === 'built-in' ? `built-in:${selection.id}` : selection.kind === 'saved' ? `saved:${selection.itemId}` : 'draft';

function downloadJson(definition: WorkflowDefinition) {
  const blob = new Blob([workflowToJson(definition)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${definition.id}.workflow.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const Workflows = () => {
  const { toast } = useToast();
  const { isAdmin } = useRoleBasedAuth();
  const canManage = useCanManageWorkflows();
  const readiness = useWorkflowListReadiness();
  const listReady = !!readiness.data?.exists && readiness.data.problems.length === 0;
  const saved = useSavedWorkflows(listReady);
  const mutations = useWorkflowMutations();

  const [selection, setSelection] = useState<Selection>({ kind: 'built-in', id: BUILT_IN_WORKFLOWS[0].id });
  const [draft, setDraft] = useState<WorkflowDefinition | null>(null);
  /** The saved workflow a draft will update, when it started from one. */
  const [draftBase, setDraftBase] = useState<SavedWorkflow | null>(null);
  const [positions, setPositions] = useState<Record<string, Positions>>({});
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<'inspector' | 'ai'>('inspector');
  const [tab, setTab] = useState<InspectorTab>('steps');
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [run, setRun] = useState<RunState | null>(null);
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [queue, setQueue] = useState<Transfer[]>([]);
  const [transfer, setTransfer] = useState<CanvasTransfer | null>(null);
  const [pendingRun, setPendingRun] = useState<RunState | null>(null);
  const transferCounter = useRef(0);
  const canvasRef = useRef<WorkflowCanvasHandle>(null);

  const savedWorkflows = saved.data?.workflows || [];
  const selectedSaved = selection.kind === 'saved' ? savedWorkflows.find(item => item.itemId === selection.itemId) || null : null;

  const baseDefinition: WorkflowDefinition | null = useMemo(() => {
    if (selection.kind === 'built-in') return BUILT_IN_WORKFLOWS.find(item => item.id === selection.id) || null;
    if (selection.kind === 'saved') return selectedSaved?.definition || null;
    return draft;
  }, [selection, selectedSaved, draft]);

  const key = selectionKey(selection);
  const definition: WorkflowDefinition | null = useMemo(() => {
    if (!baseDefinition) return null;
    const moved = positions[key];
    if (!moved) return baseDefinition;
    return { ...baseDefinition, nodes: baseDefinition.nodes.map(node => (moved[node.id] ? { ...node, ...moved[node.id] } : node)) };
  }, [baseDefinition, positions, key]);
  const layoutChanged = !!positions[key] && Object.keys(positions[key]).length > 0;

  const traveling = !!transfer || queue.length > 0;

  const resetRun = useCallback(() => {
    setRun(null);
    setPendingRun(null);
    setQueue([]);
    setTransfer(null);
    setRunError(null);
    setInputs({});
  }, []);

  // A different workflow starts with a clean run.
  useEffect(() => {
    resetRun();
    setSelectedNode(null);
    setEditing(false);
  }, [key, definition?.id, resetRun]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fall back to the built-in workflow if the selected saved one disappears.
  useEffect(() => {
    if (selection.kind === 'saved' && saved.isSuccess && !selectedSaved) {
      setSelection({ kind: 'built-in', id: BUILT_IN_WORKFLOWS[0].id });
    }
  }, [selection, saved.isSuccess, selectedSaved]);

  /** The active step waiting for a person: an input, or a decision not decided automatically. */
  const inputNodeId = useMemo(() => {
    if (!run || !definition || traveling || run.finished) return null;
    return run.active.find(id => {
      const node = definition.nodes.find(item => item.id === id);
      if (!node) return false;
      if (node.type === 'input') return true;
      return node.type === 'gate' && node.gate?.mode !== 'and' && !derivedChoice(definition, id, run.values);
    }) || null;
  }, [run, definition, traveling]);

  const applyAdvance = useCallback((state: RunState, nodeId: string, values: Record<string, string>) => {
    if (!definition) return;
    try {
      const result = advanceRun(definition, state, nodeId, values);
      setRunError(null);
      if (result.transfers.length) {
        setPendingRun(result.state);
        setQueue(result.transfers);
      } else {
        setRun(result.state);
      }
    } catch (error: any) {
      setRunError(error?.message || 'This step could not be completed.');
    }
  }, [definition]);

  // Play queued transfers one at a time, then show the new state.
  useEffect(() => {
    if (transfer || queue.length === 0) return;
    transferCounter.current += 1;
    setTransfer({ ...queue[0], key: transferCounter.current });
  }, [queue, transfer]);

  const onTransferDone = useCallback(() => {
    setTransfer(null);
    setQueue(previous => previous.slice(1));
  }, []);

  // When the last transfer lands, show the run's new state.
  useEffect(() => {
    if (transfer || queue.length > 0 || !pendingRun) return;
    setRun(pendingRun);
    setPendingRun(null);
    const next = pendingRun.active[0];
    if (next) { setSelectedNode(next); setTab('steps'); }
  }, [transfer, queue, pendingRun]);

  // Follow the simulation: keep the step being worked on centred and readable.
  const followId = run && !run.finished ? run.active[0] : null;
  useEffect(() => {
    if (followId) canvasRef.current?.focusOn(followId);
  }, [followId]);
  // At the end, show the whole workflow with the completed path highlighted.
  useEffect(() => {
    if (run?.finished) canvasRef.current?.fit();
  }, [run?.finished]);

  // Automatic steps (and decisions taken from an earlier answer) move on by themselves.
  useEffect(() => {
    if (!run || !definition || traveling || run.finished) return;
    const automatic = run.active.find(id => {
      const node = definition.nodes.find(item => item.id === id);
      return !!node && (node.type === 'auto' || node.type === 'end' ||
        (node.type === 'gate' && (node.gate?.mode === 'and' || !!derivedChoice(definition, id, run.values))));
    });
    if (!automatic) return;
    const timer = setTimeout(() => applyAdvance(run, automatic, derivedChoice(definition, automatic, run.values) || {}), 550);
    return () => clearTimeout(timer);
  }, [run, definition, traveling, applyAdvance]);

  const startSimulation = () => {
    if (!definition) return;
    try {
      resetRun();
      const state = startRun(definition);
      setRun(state);
      setSelectedNode(state.active[0]);
      setTab('steps');
      setPanel('inspector');
      setEditing(false);
    } catch (error: any) {
      toast({ title: 'Cannot start', description: error?.message, variant: 'destructive' });
    }
  };

  const submitStep = () => {
    if (!run || !inputNodeId) return;
    applyAdvance(run, inputNodeId, inputs[inputNodeId] || {});
  };

  const onDraftChange = (field: string, value: string) => {
    if (!inputNodeId) return;
    setInputs(previous => ({ ...previous, [inputNodeId]: { ...(previous[inputNodeId] || {}), [field]: value } }));
  };

  const fillExample = () => {
    if (!definition || !inputNodeId) return;
    setInputs(previous => ({ ...previous, [inputNodeId]: exampleValues(definition, inputNodeId) }));
  };

  const moveNode = (nodeId: string, x: number, y: number) => {
    setPositions(previous => ({ ...previous, [key]: { ...(previous[key] || {}), [nodeId]: { x, y } } }));
  };

  /** The definition as currently shown, including moved positions. */
  const currentDefinition = () => definition!;

  const openDraft = (next: WorkflowDefinition, base: SavedWorkflow | null) => {
    resetRun();
    setSelectedNode(null);
    setDraft(next);
    setDraftBase(base);
    setPositions(previous => { const copy = { ...previous }; delete copy.draft; return copy; });
    setSelection({ kind: 'draft' });
  };

  const duplicateAsDraft = () => {
    if (!definition) return;
    const existing = new Set([...savedWorkflows.map(item => item.definition.id), ...BUILT_IN_WORKFLOWS.map(item => item.id)]);
    let id = `${definition.id}-copy`.slice(0, 60);
    for (let n = 2; existing.has(id); n += 1) id = `${definition.id}-copy-${n}`.slice(0, 64);
    openDraft({ ...currentDefinition(), id, title: `${definition.title} (copy)`, status: 'draft', source: 'manual' }, null);
    toast({ title: 'Draft created', description: 'Change it with the AI panel or Edit layout, then save it.' });
  };

  const onAiDraft = (next: WorkflowDefinition) => {
    // Refining a saved workflow keeps it as the save target; anything else is a new draft.
    const base = selection.kind === 'saved' ? selectedSaved : selection.kind === 'draft' ? draftBase : null;
    openDraft(next, base);
  };

  const saveDraft = async () => {
    if (!draft) return;
    const toSave: WorkflowDefinition = { ...currentDefinition(), status: draftBase?.definition.status === 'published' ? 'published' : 'draft' };
    setBusy('Saving…');
    try {
      const result = draftBase
        ? await mutations.update.mutateAsync({ saved: draftBase, definition: { ...toSave, id: draftBase.definition.id } })
        : await mutations.create.mutateAsync(toSave);
      setDraft(null);
      setDraftBase(null);
      setSelection({ kind: 'saved', itemId: result.itemId });
      toast({ title: 'Workflow saved', description: `${result.definition.title} is in the Workflow_Definitions list.` });
    } catch (error: any) {
      toast({ title: 'Not saved', description: error?.message || 'The workflow could not be saved.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const saveSavedChanges = async (status?: WorkflowStatus) => {
    if (!selectedSaved || !definition) return;
    setBusy(status ? 'Updating status…' : 'Saving layout…');
    try {
      await mutations.update.mutateAsync({ saved: selectedSaved, definition: { ...currentDefinition(), status: status || selectedSaved.definition.status } });
      setPositions(previous => { const copy = { ...previous }; delete copy[key]; return copy; });
      toast({ title: status ? (status === 'published' ? 'Published' : 'Moved back to draft') : 'Layout saved' });
    } catch (error: any) {
      toast({ title: 'Not saved', description: error?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runConfirmed = async () => {
    const action = confirm;
    setConfirm(null);
    if (action === 'prepare') {
      setBusy('Creating the list…');
      try {
        await mutations.prepare.mutateAsync();
        toast({ title: 'Workflow_Definitions list created' });
      } catch (error: any) {
        toast({ title: 'List not created', description: error?.message, variant: 'destructive' });
      } finally {
        setBusy(null);
      }
    } else if (action === 'delete' && selectedSaved) {
      setBusy('Deleting…');
      try {
        await mutations.remove.mutateAsync(selectedSaved);
        setSelection({ kind: 'built-in', id: BUILT_IN_WORKFLOWS[0].id });
        toast({ title: 'Workflow deleted' });
      } catch (error: any) {
        toast({ title: 'Not deleted', description: error?.message, variant: 'destructive' });
      } finally {
        setBusy(null);
      }
    } else if (action === 'discard') {
      setDraft(null);
      setDraftBase(null);
      setSelection(draftBase ? { kind: 'saved', itemId: draftBase.itemId } : { kind: 'built-in', id: BUILT_IN_WORKFLOWS[0].id });
    }
  };

  const term = search.trim().toLowerCase();
  const matches = (item: WorkflowDefinition) =>
    !term || [item.title, item.summary, item.area].some(value => (value || '').toLowerCase().includes(term));

  const libraryItem = (item: WorkflowDefinition, target: Selection, subtitle?: string) => {
    const active = selectionKey(target) === key;
    const badge = STATUS_BADGE[item.status];
    return (
      <button
        key={selectionKey(target)}
        type="button"
        onClick={() => setSelection(target)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'w-full rounded-xl border p-3 text-left transition-colors',
          active
            ? 'border-intranet-primary bg-intranet-primary/5 dark:border-rose-400/60 dark:bg-rose-950/20'
            : 'border-gray-200 bg-white hover:border-intranet-primary/40 dark:border-white/10 dark:bg-gray-900 dark:hover:border-rose-400/40',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold leading-snug">{item.title}</span>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', badge.className)}>{badge.label}</Badge>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{subtitle || `${item.area ? `${item.area} · ` : ''}${item.nodes.length} steps`}</p>
      </button>
    );
  };

  return (
    <PageLayout>
      <div className="space-y-6 pb-10">
        {/* Hero, matching the Strategy Hub */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#400010] to-[#800020] p-6 text-white shadow-xl md:p-8">
          <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="space-y-2">
              <Badge variant="outline" className="border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                <WorkflowIcon className="mr-2 inline h-3 w-3" />Workflow Studio
              </Badge>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">Workflows</h1>
              <p className="max-w-2xl text-sm text-white/80 md:text-base">
                See how work moves through the intranet, step by step, and draft new workflows with AI.
              </p>
            </div>
            <Button
              onClick={() => setPanel('ai')}
              className="h-auto rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-intranet-primary shadow-xl hover:bg-white/90"
            >
              <Bot className="mr-2 h-5 w-5" />Create with AI
            </Button>
          </div>
        </div>

        {/* Saved-workflow list status */}
        {readiness.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            Saved workflows could not be checked: {(readiness.error as Error)?.message}
          </div>
        )}
        {readiness.data && !readiness.data.exists && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 md:flex-row md:items-center md:justify-between">
            <span>
              {isAdmin
                ? 'Saving workflows needs the Workflow_Definitions SharePoint list, which has not been created yet. Built-in workflows and AI drafts work without it.'
                : 'Saved workflows are not available yet: an administrator needs to create the Workflow_Definitions list. Built-in workflows and AI drafts still work.'}
            </span>
            {isAdmin && (
              <Button size="sm" onClick={() => setConfirm('prepare')} disabled={!!busy} className="shrink-0 bg-intranet-primary text-white hover:bg-intranet-secondary">
                Create list
              </Button>
            )}
          </div>
        )}
        {readiness.data?.exists && readiness.data.problems.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            The Workflow_Definitions list needs attention: {readiness.data.problems.join(' ')}
            {isAdmin && <Button size="sm" variant="outline" className="ml-3" onClick={() => setConfirm('prepare')}>Repair columns</Button>}
          </div>
        )}

        <div className="grid gap-4 lg:h-[calc(100vh-120px)] lg:min-h-[560px] lg:grid-cols-[250px_minmax(0,1fr)_380px]">
          {/* Library */}
          <aside className="flex min-h-0 flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search workflows" className="pl-8" aria-label="Search workflows" />
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <section className="space-y-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Built in</h2>
                {BUILT_IN_WORKFLOWS.filter(matches).map(item => libraryItem(item, { kind: 'built-in', id: item.id }))}
              </section>
              {draft && (
                <section className="space-y-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Unsaved draft</h2>
                  {libraryItem(draft, { kind: 'draft' }, draftBase ? `Changes to “${draftBase.definition.title}”` : `${draft.nodes.length} steps · not saved`)}
                </section>
              )}
              <section className="space-y-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saved</h2>
                {!listReady && <p className="text-xs text-muted-foreground">{readiness.isLoading ? 'Checking…' : 'Not available yet.'}</p>}
                {listReady && saved.isLoading && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Loading…</p>}
                {listReady && saved.isError && <p className="text-xs text-red-600">{(saved.error as Error)?.message}</p>}
                {listReady && saved.isSuccess && savedWorkflows.length === 0 && <p className="text-xs text-muted-foreground">No saved workflows yet.</p>}
                {savedWorkflows.filter(item => matches(item.definition)).map(item =>
                  libraryItem(item.definition, { kind: 'saved', itemId: item.itemId },
                    `${item.definition.nodes.length} steps${item.modifiedBy ? ` · ${item.modifiedBy}` : ''}`))}
                {(saved.data?.unreadable || []).map(item => (
                  <div key={item.itemId} className="rounded-xl border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                    <strong>{item.title}</strong> can't be opened: {item.errors[0]}
                  </div>
                ))}
              </section>
            </div>
          </aside>

          {/* Canvas */}
          <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900/60">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3 dark:border-white/10">
              <div className="mr-auto min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-bold">{definition?.title || 'No workflow selected'}</h2>
                  {definition && <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[definition.status].className)}>{STATUS_BADGE[definition.status].label}</Badge>}
                  {definition?.source === 'ai' && <Badge variant="secondary" className="text-[10px]">AI drafted</Badge>}
                </div>
                {definition?.summary && <p className="line-clamp-1 text-[11px] text-muted-foreground" title={definition.summary}>{definition.summary}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {run ? (
                  <Button size="sm" variant="outline" onClick={resetRun} title="Stop and clear the simulation"><RotateCcw className="mr-1.5 h-4 w-4" />Reset</Button>
                ) : (
                  <Button size="sm" onClick={startSimulation} disabled={!definition} className="bg-intranet-primary text-white hover:bg-intranet-secondary"><Play className="mr-1.5 h-4 w-4" />Simulate</Button>
                )}
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => canvasRef.current?.zoomBy(1.2)} title="Zoom in" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => canvasRef.current?.zoomBy(0.82)} title="Zoom out" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => canvasRef.current?.fit()} title="Fit the whole workflow" aria-label="Fit the whole workflow"><Maximize className="h-4 w-4" /></Button>
                <Button size="sm" variant={editing ? 'default' : 'outline'} onClick={() => { setEditing(value => !value); if (run) resetRun(); }} title="Drag steps to rearrange them" className={editing ? 'bg-intranet-primary text-white hover:bg-intranet-secondary' : undefined}>
                  <Move className="mr-1.5 h-4 w-4" />{editing ? 'Done' : 'Edit layout'}
                </Button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              {definition ? (
                <WorkflowCanvas
                  ref={canvasRef}
                  definition={definition}
                  activeIds={traveling ? [] : run?.active || []}
                  waitingIds={run?.waiting || []}
                  completedIds={run?.completed || []}
                  selectedId={selectedNode}
                  onSelect={id => { setSelectedNode(id); if (!run || id !== inputNodeId) setTab('details'); else setTab('steps'); setPanel('inspector'); }}
                  transfer={transfer}
                  onTransferDone={onTransferDone}
                  editing={editing}
                  onMoveNode={moveNode}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</div>
              )}
              {editing && (
                <div className="absolute left-3 top-3 max-w-xs rounded-xl border border-gray-200 bg-white/95 p-3 text-xs shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/95">
                  <p className="font-semibold">Edit layout</p>
                  <p className="mt-1 text-muted-foreground">
                    Drag steps to rearrange them.{' '}
                    {selection.kind === 'built-in' ? 'Built-in layouts are not saved; duplicate it to keep a layout.' : selection.kind === 'saved' ? 'Save layout to keep the change.' : 'The layout is saved with the draft.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => definition && setPositions(previous => ({
                      ...previous,
                      [key]: Object.fromEntries(autoLayout(baseDefinition!, true).nodes.map(node => [node.id, { x: node.x!, y: node.y! }])),
                    }))}><LayoutGrid className="mr-1 h-3.5 w-3.5" />Tidy</Button>
                    {layoutChanged && <Button size="sm" variant="outline" onClick={() => setPositions(previous => { const copy = { ...previous }; delete copy[key]; return copy; })}>Undo moves</Button>}
                  </div>
                </div>
              )}
              <p className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm dark:bg-gray-900/90">
                Scroll to zoom · drag the background to pan · click a step for details
                {run && !run.finished && (traveling ? ' · data moving…' : inputNodeId ? ` · waiting for: ${definition?.nodes.find(node => node.id === inputNodeId)?.label}` : '')}
              </p>
            </div>

            {/* Workflow actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 p-3 dark:border-white/10">
              <Button size="sm" variant="outline" onClick={() => definition && downloadJson(currentDefinition())} disabled={!definition}><Download className="mr-1.5 h-4 w-4" />Export JSON</Button>
              {selection.kind !== 'draft' && (
                <Button size="sm" variant="outline" onClick={duplicateAsDraft} disabled={!definition}><Copy className="mr-1.5 h-4 w-4" />Duplicate as draft</Button>
              )}
              {selection.kind === 'draft' && (
                <>
                  <Button
                    size="sm"
                    onClick={saveDraft}
                    disabled={!canManage || !listReady || !!busy}
                    title={!canManage ? 'You need permission to create and edit workflows.' : !listReady ? 'The Workflow_Definitions list is not ready.' : undefined}
                    className="bg-intranet-primary text-white hover:bg-intranet-secondary"
                  >
                    <Save className="mr-1.5 h-4 w-4" />{draftBase ? 'Save changes' : 'Save workflow'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm('discard')} disabled={!!busy}><X className="mr-1.5 h-4 w-4" />Discard draft</Button>
                </>
              )}
              {selection.kind === 'saved' && selectedSaved && canManage && (
                <>
                  {layoutChanged && <Button size="sm" onClick={() => saveSavedChanges()} disabled={!!busy} className="bg-intranet-primary text-white hover:bg-intranet-secondary"><Save className="mr-1.5 h-4 w-4" />Save layout</Button>}
                  {selectedSaved.definition.status === 'draft'
                    ? <Button size="sm" variant="outline" onClick={() => saveSavedChanges('published')} disabled={!!busy}><Upload className="mr-1.5 h-4 w-4" />Publish</Button>
                    : <Button size="sm" variant="outline" onClick={() => saveSavedChanges('draft')} disabled={!!busy}>Move to draft</Button>}
                  <Button size="sm" variant="outline" onClick={() => setConfirm('delete')} disabled={!!busy} className="text-red-600 hover:text-red-700"><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button>
                </>
              )}
              {selection.kind === 'draft' && !canManage && <span className="text-xs text-muted-foreground">You can export this draft; saving needs the "Create and edit workflows" permission.</span>}
              {busy && <span className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />{busy}</span>}
            </div>
          </section>

          {/* Inspector / AI */}
          <aside className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900/60 lg:min-h-0">
            <div className="flex gap-1 border-b border-gray-100 p-2 dark:border-white/10" role="tablist" aria-label="Side panel">
              {([['inspector', 'Inspector', PanelRight], ['ai', 'AI builder', Bot]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={panel === id}
                  onClick={() => setPanel(id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                    panel === id ? 'bg-intranet-primary text-white' : 'text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
            <div className={cn('min-h-0 flex-1 p-3', panel !== 'inspector' && 'hidden')}>
              {definition && (
                <WorkflowInspector
                  definition={definition}
                  run={run}
                  traveling={traveling}
                  inputNodeId={inputNodeId}
                  selectedId={selectedNode}
                  tab={tab}
                  onTabChange={setTab}
                  draft={(inputNodeId && inputs[inputNodeId]) || {}}
                  onDraftChange={onDraftChange}
                  onSubmit={submitStep}
                  onFillExample={fillExample}
                  onStart={startSimulation}
                  error={runError}
                />
              )}
            </div>
            {/* Kept mounted so the conversation survives switching panels. */}
            <div className={cn('min-h-0 flex-1', panel !== 'ai' && 'hidden')}>
              <WorkflowAIBuilder current={definition} onDraft={onAiDraft} />
            </div>
          </aside>
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'prepare' && 'Create the Workflow_Definitions list?'}
              {confirm === 'delete' && `Delete “${selectedSaved?.definition.title}”?`}
              {confirm === 'discard' && 'Discard this draft?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'prepare' && 'Creates a SharePoint list on the intranet site (or adds its missing columns) to store saved workflows as JSON. No other list is changed.'}
              {confirm === 'delete' && 'Removes the saved workflow from the Workflow_Definitions list for everyone. Export it first if you may need it again.'}
              {confirm === 'discard' && 'The unsaved draft and any AI changes to it will be lost.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed} className={confirm === 'delete' ? 'bg-red-600 hover:bg-red-700' : undefined}>
              {confirm === 'prepare' ? 'Create list' : confirm === 'delete' ? 'Delete' : 'Discard'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default Workflows;
