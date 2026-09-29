import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, FileCheck2, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  WorkPlanActivity, WorkPlanRetirementAction, WorkPlanRetirementImpact,
} from '@/types/division.types';
import type { WorkPlanMappingOptions } from '@/services/workPlanActivationService';

interface Props {
  open: boolean;
  planId: string;
  activity?: WorkPlanActivity;
  onOpenChange: (open: boolean) => void;
  loadMappingOptions: () => Promise<WorkPlanMappingOptions>;
  preview: (
    activityId: string,
    action: WorkPlanRetirementAction,
    targetKraId?: string,
  ) => Promise<WorkPlanRetirementImpact>;
  confirm: (impact: WorkPlanRetirementImpact, reason: string) => Promise<void>;
}

const labels: Record<WorkPlanRetirementAction, string> = {
  retire: 'Retire and retain Task links',
  'clear-links': 'Retire and clear Task strategy links',
  reassign: 'Reassign KPI and Tasks to another KRA',
};

export const WorkPlanRetirementDialog: React.FC<Props> = ({
  open, planId, activity, onOpenChange, loadMappingOptions, preview, confirm,
}) => {
  const [action, setAction] = useState<WorkPlanRetirementAction>('retire');
  const [targetKraId, setTargetKraId] = useState('');
  const [reason, setReason] = useState('');
  const [options, setOptions] = useState<WorkPlanMappingOptions['kras']>([]);
  const [impact, setImpact] = useState<WorkPlanRetirementImpact>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !activity) return;
    setAction('retire');
    setTargetKraId('');
    setReason('');
    setImpact(undefined);
    setError('');
    loadMappingOptions().then(result =>
      setOptions(result.kras.filter(kra => kra.id !== activity.linkedKraId)),
    ).catch(error => setError(error instanceof Error ? error.message : String(error)));
  }, [open, activity, loadMappingOptions]);

  useEffect(() => {
    if (!open || !activity || (action === 'reassign' && !targetKraId)) {
      setImpact(undefined);
      return;
    }
    let current = true;
    setLoading(true);
    setError('');
    preview(activity.id, action, action === 'reassign' ? targetKraId : undefined)
      .then(result => { if (current) setImpact(result); })
      .catch(error => { if (current) setError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [open, activity, action, targetKraId, preview]);

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

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Review activated activity removal
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          “{activity?.title}” is linked to live execution. The source row can be removed only through
          a versioned retirement or reassignment checkpoint. No KPI or Task record will be deleted.
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
            <Label>Target KRA</Label>
            <Select value={targetKraId} onValueChange={setTargetKraId}>
              <SelectTrigger><SelectValue placeholder="Choose the reviewed new parent" /></SelectTrigger>
              <SelectContent>
                {options.map(kra => <SelectItem key={kra.id} value={kra.id}>{kra.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading && !impact && <p role="status" className="text-sm text-muted-foreground">Calculating live impact…</p>}
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

        {impact && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Old parent</p>
                <p className="font-medium">{impact.sourceKra.title}</p>
                <p className="text-sm">{impact.sourceKra.activeKpiCount} KPI(s): {impact.sourceKra.progress}% <ArrowRight className="inline h-3.5 w-3.5" /> {impact.sourceKra.projectedProgress}%</p>
              </div>
              {impact.targetKra && <div>
                <p className="text-xs text-muted-foreground">New parent</p>
                <p className="font-medium">{impact.targetKra.title}</p>
                <p className="text-sm">{impact.targetKra.activeKpiCount} KPI(s): {impact.targetKra.progress}% <ArrowRight className="inline h-3.5 w-3.5" /> {impact.targetKra.projectedProgress}%</p>
              </div>}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5"><ListChecks className="h-4 w-4" /> {impact.tasks.length} Task(s) retained</span>
              <span className="flex items-center gap-1.5"><FileCheck2 className="h-4 w-4" /> {impact.kpi.measurementEvidenceCount} evidence reference(s)</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {impact.warnings.map(warning => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="retirement-reason">Reason and approval reference</Label>
          <Textarea
            id="retirement-reason"
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Record why this change is authorized and where the approval can be verified."
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
            {action === 'reassign' ? 'Confirm reassignment' : 'Confirm retirement'}
          </Button>
        </DialogFooter>
        <span className="sr-only">Work plan {planId}</span>
      </DialogContent>
    </Dialog>
  );
};
