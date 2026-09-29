import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Network, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  WorkPlanRetirementAction, WorkPlanStructureKind, WorkPlanStructureRetirementImpact,
} from '@/types/division.types';
import type { WorkPlanMappingOptions } from '@/services/workPlanActivationService';

interface Props {
  open: boolean;
  entityKind: WorkPlanStructureKind;
  sourceId: string;
  sourceExecutionId: string;
  sourceTitle: string;
  onOpenChange: (open: boolean) => void;
  loadMappingOptions: () => Promise<WorkPlanMappingOptions>;
  preview: (
    entityKind: WorkPlanStructureKind,
    sourceId: string,
    action: WorkPlanRetirementAction,
    targetExecutionId?: string,
  ) => Promise<WorkPlanStructureRetirementImpact>;
  confirm: (impact: WorkPlanStructureRetirementImpact, reason: string) => Promise<void>;
}

const labels: Record<WorkPlanRetirementAction, string> = {
  retire: 'Retire subtree and retain Task links',
  'clear-links': 'Retire subtree and clear Task strategy links',
  reassign: 'Reassign the complete execution subtree',
};

export const WorkPlanStructureRetirementDialog: React.FC<Props> = ({
  open, entityKind, sourceId, sourceExecutionId, sourceTitle, onOpenChange,
  loadMappingOptions, preview, confirm,
}) => {
  const [action, setAction] = useState<WorkPlanRetirementAction>('retire');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [options, setOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [impact, setImpact] = useState<WorkPlanStructureRetirementImpact>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAction('retire');
    setTargetId('');
    setReason('');
    setImpact(undefined);
    setError('');
    loadMappingOptions().then(result => {
      const candidates = entityKind === 'goal' ? result.objectives : result.kras;
      setOptions(candidates.filter(item => item.id !== sourceExecutionId));
    }).catch(error => setError(error instanceof Error ? error.message : String(error)));
  }, [open, entityKind, sourceExecutionId, loadMappingOptions]);

  useEffect(() => {
    if (!open || (action === 'reassign' && !targetId)) {
      setImpact(undefined);
      return;
    }
    let current = true;
    setLoading(true);
    setError('');
    preview(entityKind, sourceId, action, action === 'reassign' ? targetId : undefined)
      .then(result => { if (current) setImpact(result); })
      .catch(error => { if (current) setError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [open, entityKind, sourceId, action, targetId, preview]);

  const submit = async () => {
    if (!impact || !reason.trim()) return;
    setLoading(true);
    setError('');
    try {
      await confirm(impact, reason.trim());
      onOpenChange(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const childLabel = entityKind === 'goal' ? 'KRA' : 'KPI';
  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Review {entityKind === 'goal' ? 'goal' : 'source KRA'} retirement
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          “{sourceTitle}” owns an activated execution subtree. This review covers every descendant
          record; it never deletes a KPI or Task.
        </p>

        <div className="space-y-2">
          <Label>Action</Label>
          <Select value={action} onValueChange={value => setAction(value as WorkPlanRetirementAction)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(labels) as WorkPlanRetirementAction[]).map(value =>
                <SelectItem key={value} value={value}>{labels[value]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {action === 'reassign' && (
          <div className="space-y-2">
            <Label>Target {entityKind === 'goal' ? 'objective' : 'KRA'}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="Choose the reviewed new parent" /></SelectTrigger>
              <SelectContent>
                {options.map(item => <SelectItem key={item.id} value={item.id}>{item.title} (#{item.id})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading && !impact && <p role="status" className="text-sm text-muted-foreground">Calculating full subtree impact…</p>}
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

        {impact && (
          <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Objectives</p><p className="text-lg font-semibold">{impact.affected.objectiveIds.length}</p></div>
              <div><p className="text-xs text-muted-foreground">KRAs</p><p className="text-lg font-semibold">{impact.affected.kraIds.length}</p></div>
              <div><p className="text-xs text-muted-foreground">KPIs</p><p className="text-lg font-semibold">{impact.affected.kpiIds.length}</p></div>
              <div><p className="text-xs text-muted-foreground">Tasks</p><p className="text-lg font-semibold">{impact.affected.taskIds.length}</p></div>
            </div>
            <div className="space-y-2">
              {impact.progress.map(item => (
                <div key={`${item.kind}:${item.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background p-2 text-sm">
                  <span><span className="text-xs uppercase text-muted-foreground">{item.kind}</span> {item.title}</span>
                  <span>{item.activeMemberCount} {item.kind === 'kra' ? 'KPI' : 'KRA'}(s): {item.progress}% <ArrowRight className="inline h-3.5 w-3.5" /> {item.projectedProgress}% ({item.projectedMemberCount} after)</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5"><Network className="h-4 w-4" /> {impact.affected.kpiIds.length} {childLabel}(s) conserved</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> {impact.evidence.measurementEvidenceRefs} measurement evidence reference(s)</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {impact.warnings.map(warning => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="structure-retirement-reason">Reason and approval reference</Label>
          <Textarea
            id="structure-retirement-reason"
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Record why the complete subtree change is authorized and where approval can be verified."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            variant={action === 'reassign' ? 'default' : 'destructive'}
            disabled={loading || !impact || !reason.trim()}
            onClick={submit}
          >
            {action === 'reassign' ? 'Confirm subtree reassignment' : 'Confirm subtree retirement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
