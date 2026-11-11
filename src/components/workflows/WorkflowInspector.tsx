import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Info, Loader2, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkflowDefinition, WorkflowField, WorkflowNode } from '@/workflows/workflowTypes';
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
}

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'steps', label: 'Steps' },
  { id: 'details', label: 'Details' },
  { id: 'data', label: 'Live data' },
  { id: 'history', label: 'Changes' },
];

const TYPE_LABEL: Record<WorkflowNode['type'], string> = { input: 'Input', auto: 'Automatic', gate: 'Decision', end: 'End' };

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
  draft, onDraftChange, onSubmit, onFillExample, onStart, error,
}: WorkflowInspectorProps) {
  const nodeById = (id: string | null) => (id ? definition.nodes.find(node => node.id === id) : undefined);
  const inputNode = nodeById(inputNodeId);
  const selected = nodeById(selectedId);

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
    if (!selected) return <Notice>Select a step on the canvas to see where it happens and what it writes.</Notice>;
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
        <List title="Implemented in" items={info.code} mono />
        {!info.screen && !info.writes && !info.rules && !info.code && !selected.fields && (
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
      {definition.notes?.length ? (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-1">{definition.notes.map(note => <p key={note}>{note}</p>)}</div>
        </div>
      ) : null}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1" role="tabpanel">
        {tab === 'steps' ? steps() : tab === 'details' ? details() : tab === 'data' ? data() : history()}
      </div>
    </div>
  );
}
