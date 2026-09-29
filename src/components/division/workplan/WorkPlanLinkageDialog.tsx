import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';
import type { WorkPlanGoal, WorkPlanActivity, WorkPlanKra } from '@/types/division.types';
import type { WorkPlanMappingOptions } from '@/services/workPlanActivationService';

export function WorkPlanLinkageDialog({ goal: initialGoal, activity: initialActivity, loadOptions, onApply, onClose, onRetireGoal, onRetireKra }: {
  goal: WorkPlanGoal; activity: WorkPlanActivity;
  loadOptions: () => Promise<WorkPlanMappingOptions>;
  onApply: (goal: WorkPlanGoal, activity: WorkPlanActivity) => void;
  onClose: () => void;
  onRetireGoal?: (goal: WorkPlanGoal) => void;
  onRetireKra?: (kra: WorkPlanKra) => void;
}) {
  const [goal, setGoal] = useState(() => structuredClone(initialGoal));
  const [activity, setActivity] = useState(() => structuredClone(initialActivity));
  const [options, setOptions] = useState<WorkPlanMappingOptions | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    loadOptions().then(value => { if (mounted) setOptions(value); }).catch(error => { if (mounted) setError(error.message); });
    return () => { mounted = false; };
  }, [loadOptions]);
  const selectStyle = 'flex w-full rounded-md border bg-background px-3 py-2 text-sm';
  const parent = goal.organizationalGoalRef?.list === 'Strategic_Objectives' ? goal.organizationalGoalRef.id : goal.legacyStrategicObjectiveId;
  const target = activity.annualTarget || { rawText: '' };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Work-plan linkage and source details</DialogTitle></DialogHeader>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {!options && !error && <p>Loading verified list options…</p>}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">Divisional annual goal: {goal.title}</p>
          {goal.linkedObjectiveId && onRetireGoal && <Button type="button" size="sm" variant="destructive" onClick={() => onRetireGoal(initialGoal)}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Retire goal subtree
          </Button>}
        </div>
        <div><Label>Organizational parent</Label><select className={selectStyle} value={goal.organizationalGoalRef ? `${goal.organizationalGoalRef.list}:${goal.organizationalGoalRef.id}` : ''} onChange={e => {
          const selected = options?.goals.find(item => `${item.list}:${item.id}` === e.target.value);
          setGoal({ ...goal, organizationalGoalRef: selected ? { list: selected.list, id: selected.id } : undefined });
        }}><option value="">Select a parent</option>{options?.goals.map(item => <option key={`${item.list}:${item.id}`} value={`${item.list}:${item.id}`}>{item.title} ({item.list === 'Strategic_Goals' ? 'Corporate goal' : 'Legacy objective'} #{item.id})</option>)}</select></div>
        {goal.organizationalGoalRef?.list === 'Strategic_Goals' && <div><Label>Corresponding legacy objective for the existing dashboard</Label><select className={selectStyle} value={goal.legacyStrategicObjectiveId || ''} onChange={e => setGoal({ ...goal, legacyStrategicObjectiveId: e.target.value || undefined })}><option value="">Select the verified correspondence</option>{options?.goals.filter(item => item.list === 'Strategic_Objectives').map(item => <option key={item.id} value={item.id}>{item.title} (#{item.id})</option>)}</select></div>}
        <div><Label>Execution objective in this division</Label><select className={selectStyle} value={goal.linkedObjectiveId || ''} onChange={e => setGoal({ ...goal, linkedObjectiveId: e.target.value || undefined, executionObjectiveRef: e.target.value ? { list: 'Unit_Objectives', id: e.target.value } : undefined })}>
          <option value="">Create on activation</option>{options?.objectives.filter(item => item.parentId === parent).map(item => <option key={item.id} value={item.id}>{item.title} (#{item.id})</option>)}
        </select>{goal.linkedObjectiveId && !goal.executionObjectiveRef && <p className="text-sm text-amber-700">Select the matching execution objective to verify the legacy link.</p>}</div>
        <div><Label>Source goal code</Label><Input value={goal.sourceCode || ''} onChange={e => setGoal({ ...goal, sourceCode: e.target.value })} /></div>
        <div><Label>Strategic objective statement</Label><Textarea value={goal.strategicObjective || goal.description} onChange={e => setGoal({ ...goal, strategicObjective: e.target.value })} /></div>
        <div className="space-y-2"><Label>KRA sections for this goal</Label>
          {(goal.kras || []).map((kra, index) => <div key={kra.id} className="rounded border p-3 space-y-2">
            <div className="flex gap-2"><Input aria-label="KRA source code" placeholder="SG3.1" value={kra.code} onChange={e => setGoal({ ...goal, kras: goal.kras!.map((item, i) => i === index ? { ...item, code: e.target.value } : item) })} /><Input aria-label="KRA title" placeholder="KRA title" value={kra.title} onChange={e => setGoal({ ...goal, kras: goal.kras!.map((item, i) => i === index ? { ...item, title: e.target.value } : item) })} /></div>
            <Input aria-label="KRA objective" placeholder="KRA objective statement" value={kra.objective || ''} onChange={e => setGoal({ ...goal, kras: goal.kras!.map((item, i) => i === index ? { ...item, objective: e.target.value } : item) })} />
            <select aria-label="Existing execution KRA" className={selectStyle} value={kra.linkedKraId || ''} onChange={e => setGoal({ ...goal, kras: goal.kras!.map((item, i) => i === index ? { ...item, linkedKraId: e.target.value || undefined } : item) })}><option value="">Create KRA on activation</option>{options?.kras.filter(item => item.objectiveId === goal.linkedObjectiveId).map(item => <option key={item.id} value={item.id}>{item.title} (#{item.id})</option>)}</select>
            {kra.linkedKraId && onRetireKra && <Button type="button" size="sm" variant="destructive" onClick={() => onRetireKra(kra)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Retire this KRA subtree
            </Button>}
          </div>)}
          <Button type="button" variant="outline" onClick={() => setGoal({ ...goal, kras: [...(goal.kras || []), { id: crypto.randomUUID(), code: '', title: '' }] })}>Add KRA section</Button>
        </div>
        <p className="font-medium">Activity: {activity.title}</p>
        <div><Label>Source KRA</Label><select className={selectStyle} value={activity.sourceKraId || ''} onChange={e => setActivity({ ...activity, sourceKraId: e.target.value })}><option value="">Select KRA</option>{goal.kras?.map(kra => <option key={kra.id} value={kra.id}>{kra.code} — {kra.title}</option>)}</select></div>
        <div><Label>Annual target (exact source wording)</Label><Input value={target.rawText} onChange={e => setActivity({ ...activity, annualTarget: { ...target, rawText: e.target.value } })} /></div>
        <div><Label>Normalized measurement mode</Label><select className={selectStyle} value={target.measurementMode || ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, measurementMode: (e.target.value || undefined) as typeof target.measurementMode } })}>
          <option value="">Infer only from confirmed fields</option><option value="count">Count</option><option value="percentage">Percentage</option><option value="duration-at-most">At-most time</option><option value="population">Population coverage</option><option value="service-level">Population / SLA compliance</option><option value="recurrence">Recurring occurrences</option><option value="milestone">Milestones</option><option value="continuous">Continuous obligation</option><option value="as-required">As-required obligation</option>
        </select></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>Confirmed quantity</Label><Input type="number" value={target.quantity ?? ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, quantity: e.target.value === '' ? undefined : Number(e.target.value) } })} /></div>
          <div><Label>Unit</Label><Input value={target.unit || ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, unit: e.target.value } })} /></div>
          <div><Label>Operator</Label><select className={selectStyle} value={target.operator || ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, operator: (e.target.value || undefined) as typeof target.operator } })}><option value="">Unspecified</option><option value="equal">Equal to</option><option value="at-least">At least</option><option value="at-most">At most</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-2"><div><Label>Frequency</Label><Input value={target.frequency || ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, frequency: e.target.value } })} /></div><div><Label>Service level / turnaround</Label><Input value={target.serviceLevel || ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, serviceLevel: e.target.value } })} /></div></div>
        <div className="grid grid-cols-2 gap-2"><div><Label>Eligible population</Label><Input value={target.population || ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, population: e.target.value } })} /></div><div><Label>Milestone window</Label><Input value={target.milestoneWindow || ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, milestoneWindow: e.target.value } })} /></div></div>
        {target.measurementMode === 'duration-at-most' && <div className="grid grid-cols-2 gap-2"><div><Label>Time allowance</Label><Input type="number" min="0" value={target.timeAllowance?.value ?? ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, timeAllowance: e.target.value === '' ? undefined : { value: Number(e.target.value), unit: target.timeAllowance?.unit || target.unit || '' } } })} /></div><div><Label>Time unit</Label><Input value={target.timeAllowance?.unit || ''} onChange={e => setActivity({ ...activity, annualTarget: { ...target, timeAllowance: target.timeAllowance ? { ...target.timeAllowance, unit: e.target.value } : { value: 0, unit: e.target.value } } })} /></div></div>}
        <div><Label>Planned quarters</Label><div className="flex gap-4">{(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(quarter => <label key={quarter} className="flex gap-1"><input type="checkbox" checked={activity.plannedQuarters?.includes(quarter) || false} onChange={e => setActivity({ ...activity, plannedQuarters: e.target.checked ? [...(activity.plannedQuarters || []), quarter] : activity.plannedQuarters?.filter(value => value !== quarter) })} />{quarter}</label>)}</div></div>
        <div className="grid grid-cols-2 gap-2">{(['responsiblePosition', 'supervisorPosition', 'dependencies', 'risk'] as const).map((field, index) => <div key={field}><Label>{['Responsible position', 'Supervisor position', 'Dependencies', 'Risk'][index]}</Label><Input value={activity[field] || ''} onChange={e => setActivity({ ...activity, [field]: e.target.value })} /></div>)}</div>
        <div><Label>Budget (exact source wording)</Label><Input value={activity.budget?.rawText || ''} onChange={e => setActivity({ ...activity, budget: { rawText: e.target.value } })} /></div>
        <div><Label>Task execution</Label><select className={selectStyle} value={activity.taskPolicy || 'link-existing'} onChange={e => setActivity({ ...activity, taskPolicy: e.target.value as WorkPlanActivity['taskPolicy'] })}><option value="link-existing">Link existing Tasks</option><option value="create-task">Create one ordinary Task if none is linked</option></select></div>
        <div><Label>Existing Tasks (select one or more)</Label><select multiple className={`${selectStyle} min-h-28`} value={activity.linkedTaskIds} onChange={e => setActivity({ ...activity, linkedTaskIds: Array.from(e.target.selectedOptions, option => option.value) })}>{options?.tasks.filter(item => !item.kpiId || item.kpiId === activity.linkedKpiId).map(item => <option key={item.id} value={item.id}>{item.title} (#{item.id})</option>)}</select></div>
        <div className="space-y-2"><Label>Divisional goal measures (separate from activity KPIs)</Label>{goal.goalMeasures?.map((measure, index) => <div key={measure.id} className="grid grid-cols-2 gap-2">
          <Input aria-label="Goal measure" value={measure.description} onChange={e => setGoal({ ...goal, goalMeasures: goal.goalMeasures!.map((item, i) => i === index ? { ...item, description: e.target.value } : item) })} />
          <Input aria-label="Goal measure target" value={measure.target.rawText} onChange={e => setGoal({ ...goal, goalMeasures: goal.goalMeasures!.map((item, i) => i === index ? { ...item, target: { ...item.target, rawText: e.target.value } } : item) })} />
        </div>)}<Button variant="outline" onClick={() => setGoal({ ...goal, goalMeasures: [...(goal.goalMeasures || []), { id: crypto.randomUUID(), description: '', target: { rawText: '' } }] })}>Add goal measure</Button></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!options} onClick={() => onApply(goal, activity)}>Apply details</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
