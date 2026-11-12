import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Info, Loader2, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { APP_STATUS_LABEL, RANK_LABEL } from '@/components/workflows/WorkflowCanvas';
import { appStatusCounts, hierarchyChildren, isHierarchy, reportingChain } from '@/workflows/workflowSchema';
import type { AppStatus, WorkflowDefinition, WorkflowField, WorkflowNode } from '@/workflows/workflowTypes';
import type { RunState } from '@/workflows/workflowRun';

export type InspectorTab = 'steps' | 'details' | 'data' | 'history';

interface WorkflowInspectorProps {
  definition: WorkflowDefinition;
  run: RunState | null;
  traveling: boolean;
  /** The active step waiting for someone to fill it in. */
  inputNodeId: string | null;
  selectedId: string | null;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  draft: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onFillExample: () => void;
  onStart: () => void;
  error: string | null;
  /** Selects another box or step (structure charts link to the boxes above and beneath). */
  onSelectNode?: (nodeId: string) => void;
}

const STATUS_TONE: Record<AppStatus, { box: string; dot: string }> = {
  built: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100', dot: 'bg-emerald-500' },
  partial: { box: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100', dot: 'bg-amber-500' },
  missing: { box: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100', dot: 'bg-rose-500' },
};

/** "In the app / Partly built / Not built yet", with how the app handles it today. */
function AppToday({ node }: { node: WorkflowNode }) {
  if (!node.appStatus && !node.details?.today) return null;
  const tone = STATUS_TONE[node.appStatus || 'partial'];
  return (
    <div className={cn('rounded-lg border p-3 text-xs leading-relaxed', tone.box)}>
      <p className="mb-1 flex items-center gap-1.5 font-bold">
        <span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden="true" />
        {node.appStatus ? APP_STATUS_LABEL[node.appStatus] : 'In the app today'}
      </p>
      {node.details?.today && <p>{node.details.today}</p>}
    </div>
  );
}

function StatusSummary({ definition }: { definition: WorkflowDefinition }) {
  const counts = appStatusCounts(definition);
  if (!counts) return null;
  const total = counts.built + counts.partial + counts.missing;
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Against the app today</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
        {(['built', 'partial', 'missing'] as AppStatus[]).map(status => (
          <span key={status} className={STATUS_TONE[status].dot} style={{ width: `${(counts[status] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="space-y-1 text-xs">
        {(['built', 'partial', 'missing'] as AppStatus[]).map(status => (
          <li key={status} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', STATUS_TONE[status].dot)} aria-hidden="true" />{APP_STATUS_LABEL[status]}</span>
            <strong>{counts[status]} of {total}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'steps', label: 'Steps' },
  { id: 'details', label: 'Details' },
  { id: 'data', label: 'Live data' },
  { id: 'history', label: 'Changes' },
];

const TYPE_LABEL: Record<WorkflowNode['type'], string> = { input: 'Input', auto: 'Automatic', gate: 'Decision', end: 'End', org: 'Box' };

function Notice({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'error'; children: React.ReactNode }) {
  return (
    <div className={cn(
      'rounded-lg border p-3 text-xs leading-relaxed',
      tone === 'ok' && 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
      tone === 'error' && 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
      tone === 'info' && 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-gray-900 dark:text-gray-300',
    )}>
      {children}
    </div>
  );
}

function FieldControl({ field, node, value, onChange }: {
  field: WorkflowField;
  node: WorkflowNode;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `wf-field-${node.id}-${field.key}`;
  const multi = node.type === 'gate' && node.gate?.mode === 'andor' && field.key === node.gate.choiceField;
  const required = field.required || (node.type === 'gate' && node.gate?.mode !== 'and' && field.key === node.gate?.choiceField);
  const label = <Label htmlFor={id} className="text-xs font-semibold">{field.label}{required && <span className="text-red-500"> *</span>}</Label>;

  if (multi) {
    const chosen = value.split(',').map(item => item.trim()).filter(Boolean);
    return (
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold">{field.label}{required && <span className="text-red-500"> *</span>}</legend>
        {(field.options || []).map(option => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[#83002A]"
              checked={chosen.includes(option)}
              onChange={event => onChange((event.target.checked ? [...chosen, option] : chosen.filter(item => item !== option)).join(', '))}
            />
            {option}
          </label>
        ))}
      </fieldset>
    );
  }
  if (field.kind === 'select') {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={id}
          value={value}
          onChange={event => onChange(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-intranet-primary/40"
        >
          <option value="">Choose…</option>
          {(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    );
  }
  if (field.kind === 'textarea') {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea id={id} value={value} onChange={event => onChange(event.target.value)} rows={3} placeholder={field.example} />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {label}
      <Input id={id} type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'} value={value} onChange={event => onChange(event.target.value)} placeholder={field.example} />
    </div>
  );
}

function List({ title, items, mono = false }: { title: string; items?: string[]; mono?: boolean }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item} className={cn('rounded-md border border-gray-100 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-gray-900', mono && 'font-mono text-[11px] break-all')}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WorkflowInspector({
  definition, run, traveling, inputNodeId, selectedId, tab, onTabChange,
  draft, onDraftChange, onSubmit, onFillExample, onStart, error, onSelectNode,
}: WorkflowInspectorProps) {
  const nodeById = (id: string | null) => (id ? definition.nodes.find(node => node.id === id) : undefined);
  const inputNode = nodeById(inputNodeId);
  const selected = nodeById(selectedId);
  const chart = isHierarchy(definition);

  const boxLink = (node: WorkflowNode, current = false) => (
    <button
      type="button"
      onClick={() => onSelectNode?.(node.id)}
      disabled={current}
      aria-current={current ? 'true' : undefined}
      className={cn(
        'w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
        current
          ? 'border-intranet-primary/40 bg-intranet-primary/5 font-semibold dark:border-rose-400/40 dark:bg-rose-950/20'
          : 'border-gray-100 bg-white hover:border-intranet-primary/40 dark:border-white/10 dark:bg-gray-900 dark:hover:border-rose-400/40',
      )}
    >
      <span className="block">{node.label}</span>
      <span className="block text-[10px] text-muted-foreground">
        {node.rank ? RANK_LABEL[node.rank] : ''}{node.sub ? ` · ${node.sub}` : ''}
      </span>
    </button>
  );

  /** Structure charts: one panel for the selected box. */
  const chartPanel = () => {
    if (!selected) {
      return (
        <div className="space-y-3">
          <Notice>
            Click a box to see its reporting line, what it covers and how the app records it today.
            Use + and − on a box to open or close the branch beneath it.
          </Notice>
          <StatusSummary definition={definition} />
        </div>
      );
    }
    // Grouping boxes are drawn for layout only, so they are left out of the line.
    const chain = reportingChain(definition, selected.id).filter(node => node.rank !== 'group' || node.id === selected.id);
    const beneath = hierarchyChildren(definition, selected.id);
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-intranet-primary dark:text-rose-300">{selected.rank ? RANK_LABEL[selected.rank] : 'Box'}</p>
          <h3 className="text-base font-bold leading-snug">{selected.label}</h3>
          {selected.sub && <p className="mt-0.5 text-xs text-muted-foreground">{selected.sub}</p>}
        </div>
        <AppToday node={selected} />
        <List title="Role" items={selected.details?.rules} />
        {chain.length > 1 && (
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reporting line</p>
            <ol className="space-y-1">
              {chain.map((node, index) => (
                <li key={node.id} style={{ paddingLeft: `${Math.min(index, 6) * 8}px` }}>{boxLink(node, node.id === selected.id)}</li>
              ))}
            </ol>
          </div>
        )}
        {beneath.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Directly beneath ({beneath.length})</p>
            <ul className="space-y-1">{beneath.map(node => <li key={node.id}>{boxLink(node)}</li>)}</ul>
          </div>
        )}
        <List title="Where the app records it" items={selected.details?.code} mono />
      </div>
    );
  };

  const steps = () => {
    if (!run) {
      return (
        <div className="space-y-3">
          <Notice>
            Start a simulation to walk a sample record through each step, from the bottom of the diagram upward.
            Nothing is saved; it runs in your browser.
          </Notice>
          <Button onClick={onStart} className="w-full bg-intranet-primary text-white hover:bg-intranet-secondary">
            <Play className="mr-2 h-4 w-4" />Start simulation
          </Button>
          <StatusSummary definition={definition} />
        </div>
      );
    }
    if (run.finished) {
      return (
        <div className="space-y-3">
          <Notice tone="ok"><CheckCircle2 className="mr-1 inline h-4 w-4" />Workflow finished. See Live data and Changes for what was recorded.</Notice>
          <Button variant="outline" onClick={onStart} className="w-full"><Play className="mr-2 h-4 w-4" />Run again</Button>
        </div>
      );
    }
    if (traveling) return <Notice tone="ok">Carrying the submitted information along the highlighted connection…</Notice>;
    if (!inputNode) {
      const current = nodeById(run.active[0]);
      return <Notice><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />{current ? `${current.label} runs automatically…` : 'Working…'}</Notice>;
    }
    return (
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); onSubmit(); }} noValidate>
        <Notice>
          Active step: <strong>{inputNode.label}</strong>{inputNode.type === 'gate' ? ' — choose the route.' : '.'}
        </Notice>
        {(inputNode.fields || []).map(field => (
          <FieldControl key={field.key} field={field} node={inputNode} value={draft[field.key] || ''} onChange={value => onDraftChange(field.key, value)} />
        ))}
        {!(inputNode.fields || []).length && <p className="text-xs text-muted-foreground">This step has no fields. Continue to move on.</p>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="bg-intranet-primary text-white hover:bg-intranet-secondary">Submit &amp; cascade ↑</Button>
          {(inputNode.fields || []).length > 0 && (
            <Button type="button" variant="outline" onClick={onFillExample}><Sparkles className="mr-1.5 h-4 w-4" />Fill example</Button>
          )}
        </div>
      </form>
    );
  };

  const details = () => {
    if (!selected) {
      return (
        <div className="space-y-3">
          <Notice>Select a step on the canvas to see where it happens and what it writes.</Notice>
          <StatusSummary definition={definition} />
        </div>
      );
    }
    const info = selected.details || {};
    return (
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{selected.label}</h3>
            <Badge variant="outline">{TYPE_LABEL[selected.type]}{selected.gate ? ` · ${selected.gate.mode.toUpperCase()}` : ''}</Badge>
            {selected.track && selected.track !== 'main' && <Badge variant="secondary">{selected.track === 'side' ? 'Side track' : 'Feedback loop'}</Badge>}
          </div>
          {selected.sub && <p className="text-xs text-muted-foreground mt-1">{selected.sub}</p>}
        </div>
        <AppToday node={selected} />
        {info.screen && (
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Where</p>
            <p className="text-sm">{info.screen}</p>
            {info.route && (
              <Link to={info.route} className="inline-flex items-center gap-1 text-xs font-semibold text-intranet-primary hover:underline dark:text-rose-300">
                Open {info.route} <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
        {selected.outcome && <List title="Records" items={[selected.outcome]} />}
        <List title="Writes" items={info.writes} />
        <List title="Rules" items={info.rules} />
        <List title="Fields" items={(selected.fields || []).map(field => `${field.label}${field.options ? ` (${field.options.join(' / ')})` : ''}`)} />
        <List title={selected.appStatus ? 'Related code' : 'Implemented in'} items={info.code} mono />
        {!info.screen && !info.writes && !info.rules && !info.code && !selected.fields && !info.today && (
          <p className="text-xs text-muted-foreground">No details recorded for this step.</p>
        )}
      </div>
    );
  };

  const data = () => {
    const entries = Object.entries(run?.values || {});
    if (!entries.length) return <Notice>Submit the first step of a simulation to see its data here.</Notice>;
    return (
      <div className="space-y-3">
        {entries.map(([nodeId, values]) => (
          <div key={nodeId} className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
            <div className="bg-gray-50 px-3 py-1.5 text-xs font-bold dark:bg-gray-900">{nodeById(nodeId)?.label || nodeId}</div>
            <dl className="divide-y divide-gray-100 dark:divide-white/5">
              {Object.entries(values).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 px-3 py-1.5 text-xs">
                  <dt className="text-muted-foreground">{nodeById(nodeId)?.fields?.find(field => field.key === key)?.label || key}</dt>
                  <dd className="text-right font-medium break-words">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  };

  const history = () => {
    if (!run?.history.length) return <Notice>No changes yet. Submissions and automatic steps appear here.</Notice>;
    return (
      <ol className="space-y-2">
        {[...run.history].reverse().map((event, index) => (
          <li key={index} className="border-b border-gray-100 pb-2 text-xs dark:border-white/5">
            <p className="font-semibold">{nodeById(event.nodeId)?.label || event.nodeId} <span className="font-normal text-muted-foreground">· {event.kind}</span></p>
            <p className="text-muted-foreground">{event.detail}</p>
          </li>
        ))}
      </ol>
    );
  };

  const notes = definition.notes?.length ? (
    <div className={cn('flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200', !chart && 'mt-3')}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="space-y-1">{definition.notes.map(note => <p key={note}>{note}</p>)}</div>
    </div>
  ) : null;

  if (chart) {
    // A structure chart has nothing to simulate: one panel, no tabs.
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        {notes}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{chartPanel()}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900" role="tablist" aria-label="Inspector">
        {TABS.map(item => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
              tab === item.id ? 'bg-white text-intranet-primary shadow-sm dark:bg-gray-800 dark:text-rose-300' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {notes}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1" role="tabpanel">
        {tab === 'steps' ? steps() : tab === 'details' ? details() : tab === 'data' ? data() : history()}
      </div>
    </div>
  );
}
