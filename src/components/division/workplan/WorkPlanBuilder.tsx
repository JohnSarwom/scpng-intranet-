import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Save, Target, BookOpen, Table2, BarChart3,
  Plus, Trash2, Copy, X, FileText, Building2, Calendar,
  Users, AlertCircle, ChevronDown, ChevronUp, ChevronsUpDown, Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  WorkPlan, WorkPlanGoal, WorkPlanActivity, WorkPlanTimePeriod,
} from '@/types/division.types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StrategicObjectiveOption {
  id: string | number;
  title: string;
  description?: string;
  linkedDeliverable?: string;
}

export interface StaffOption {
  name: string;
  email: string;
  unit: string;
  jobTitle: string;
}

export interface WorkPlanBuilderProps {
  initialPlan?: Partial<WorkPlan>;
  divisionId: string;
  divisionName: string;
  defaultOrganization?: string;
  createdBy: string;
  createdByEmail: string;
  strategicObjectives: StrategicObjectiveOption[];
  staff: StaffOption[];
  onSave: (plan: WorkPlan) => void;
  onCancel: () => void;
}

// Flat row model used internally in the table
interface TableRow {
  id: string;
  strategicObjective: string;
  linkedObjectiveId?: string;
  activity: string;
  output: string;
  kpi: string;
  responsibleOfficer: string;
  responsibleOfficerEmail?: string;
  timelineStart: string;
  timelineEnd: string;
  resources: string;
  status: WorkPlanActivity['status'];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: WorkPlanActivity['status']; label: string; color: string }[] = [
  { value: 'not-started', label: 'Not Started', color: 'bg-gray-100 text-gray-600' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-700' },
  { value: 'blocked', label: 'Blocked', color: 'bg-amber-100 text-amber-700' },
];

const TIME_PERIODS: WorkPlanTimePeriod[] = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'annual', 'custom'];
const REVIEW_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'bi-annually', 'annually'];

// ─── Utilities ──────────────────────────────────────────────────────────────

function goalsToRows(goals: WorkPlanGoal[]): TableRow[] {
  const rows: TableRow[] = [];
  goals.forEach(goal => {
    if (goal.activities.length === 0) {
      rows.push({
        id: `empty-${goal.id}`,
        strategicObjective: goal.title,
        linkedObjectiveId: goal.linkedObjectiveId,
        activity: '',
        output: '',
        kpi: '',
        responsibleOfficer: '',
        timelineStart: '',
        timelineEnd: '',
        resources: '',
        status: 'not-started',
      });
    } else {
      goal.activities.forEach(act => {
        rows.push({
          id: act.id,
          strategicObjective: goal.title,
          linkedObjectiveId: goal.linkedObjectiveId,
          activity: act.title,
          output: act.expectedOutput || '',
          kpi: act.kpiDescription || '',
          responsibleOfficer: act.responsiblePersonName || '',
          responsibleOfficerEmail: act.responsiblePersonEmail,
          timelineStart: act.startDate || '',
          timelineEnd: act.endDate || '',
          resources: act.resourcesRequired || '',
          status: act.status,
        });
      });
    }
  });
  return rows;
}

function rowsToGoals(rows: TableRow[], planId: string): WorkPlanGoal[] {
  const grouped: Record<string, { objective: string; linkedId?: string; rows: TableRow[] }> = {};
  rows.forEach(row => {
    const key = row.linkedObjectiveId || row.strategicObjective || 'general';
    if (!grouped[key]) {
      grouped[key] = {
        objective: row.strategicObjective || 'General',
        linkedId: row.linkedObjectiveId,
        rows: [],
      };
    }
    grouped[key].rows.push(row);
  });

  return Object.values(grouped).map(({ objective, linkedId, rows: groupRows }, idx) => {
    const goalId = `goal-${planId}-${idx}-${Date.now()}`;
    const completedCount = groupRows.filter(r => r.status === 'completed' && r.activity.trim()).length;
    const totalCount = groupRows.filter(r => r.activity.trim()).length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const allCompleted = totalCount > 0 && completedCount === totalCount;
    const anyAtRisk = groupRows.some(r => r.status === 'overdue' || r.status === 'blocked');

    return {
      id: goalId,
      workPlanId: planId,
      title: objective,
      description: '',
      linkedObjectiveId: linkedId,
      linkedObjectiveTitle: objective,
      responsibleUnitIds: [],
      responsibleUnitNames: [],
      activities: groupRows
        .filter(r => r.activity.trim())
        .map((row, i): WorkPlanActivity => ({
          id:
            row.id.startsWith('new-') || row.id.startsWith('empty-')
              ? `act-${planId}-${idx}-${i}`
              : row.id,
          goalId,
          title: row.activity,
          description: '',
          assignedUnitId: '',
          assignedUnitName: '',
          responsiblePersonName: row.responsibleOfficer || undefined,
          responsiblePersonEmail: row.responsibleOfficerEmail,
          startDate: row.timelineStart,
          endDate: row.timelineEnd,
          expectedOutput: row.output,
          kpiDescription: row.kpi,
          resourcesRequired: row.resources,
          linkedTaskIds: [],
          status: row.status,
          progress:
            row.status === 'completed'
              ? 100
              : row.status === 'in-progress'
              ? 50
              : 0,
          order: i,
        })),
      progress,
      status: allCompleted ? 'completed' : anyAtRisk ? 'at-risk' : progress > 0 ? 'in-progress' : 'not-started',
      order: idx,
    } as WorkPlanGoal;
  });
}

// ─── Editable Table Row ──────────────────────────────────────────────────────

interface EditableRowProps {
  row: TableRow;
  rowIndex: number;
  objectiveOptions: { id: string; title: string; linkedDeliverable?: string }[];
  staffData: StaffOption[];
  onChange: (id: string, updates: Partial<TableRow>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const EditableRow: React.FC<EditableRowProps> = ({
  row, rowIndex, objectiveOptions, staffData, onChange, onDelete, onDuplicate,
}) => {
  const [officerOpen, setOfficerOpen] = useState(false);
  const statusOpt = STATUS_OPTIONS.find(s => s.value === row.status);

  return (
    <tr className="border-b hover:bg-muted/20 group align-top transition-colors">
      {/* Row number */}
      <td className="p-2 text-center text-xs text-muted-foreground pt-3 w-8 shrink-0">
        {rowIndex + 1}
      </td>

      {/* Strategic Objective */}
      <td className="p-1.5 min-w-[180px]">
        <Input
          list={`obj-${row.id}`}
          value={row.strategicObjective}
          onChange={e => {
            const match = objectiveOptions.find(o => o.title === e.target.value);
            onChange(row.id, {
              strategicObjective: e.target.value,
              // Auto-populate Output if a linked deliverable exists and field is still empty
              ...(match?.linkedDeliverable && !row.output
                ? { output: match.linkedDeliverable }
                : {}),
            });
          }}
          className="h-8 text-xs"
          placeholder="Strategic objective..."
        />
        <datalist id={`obj-${row.id}`}>
          {objectiveOptions.map((o, i) => <option key={i} value={o.title} />)}
        </datalist>
      </td>

      {/* Activity */}
      <td className="p-1.5 min-w-[180px]">
        <Input
          value={row.activity}
          onChange={e => onChange(row.id, { activity: e.target.value })}
          className="h-8 text-xs"
          placeholder="Activity..."
        />
      </td>

      {/* Output */}
      <td className="p-1.5 min-w-[160px]">
        <Input
          value={row.output}
          onChange={e => onChange(row.id, { output: e.target.value })}
          className="h-8 text-xs"
          placeholder="Expected output..."
        />
      </td>

      {/* KPI */}
      <td className="p-1.5 min-w-[160px]">
        <Input
          value={row.kpi}
          onChange={e => onChange(row.id, { kpi: e.target.value })}
          className="h-8 text-xs"
          placeholder="KPI indicator..."
        />
      </td>

      {/* Responsible Officer */}
      <td className="p-1.5 min-w-[170px]">
        <Popover open={officerOpen} onOpenChange={setOfficerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="h-8 w-full justify-between font-normal text-xs px-2 min-w-[150px]"
            >
              <span className="truncate text-left flex-1">
                {row.responsibleOfficer || (
                  <span className="text-muted-foreground">Select officer...</span>
                )}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search staff..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty>No staff found.</CommandEmpty>
                <CommandGroup>
                  {staffData.map(s => (
                    <CommandItem
                      key={s.email}
                      value={s.name}
                      onSelect={val => {
                        const found = staffData.find(
                          x => x.name.toLowerCase() === val.toLowerCase(),
                        );
                        onChange(row.id, {
                          responsibleOfficer: found?.name || val,
                          responsibleOfficerEmail: found?.email,
                        });
                        setOfficerOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-3 w-3 shrink-0',
                          row.responsibleOfficer === s.name ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{s.jobTitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </td>

      {/* Timeline */}
      <td className="p-1.5 min-w-[220px]">
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={row.timelineStart}
            onChange={e => onChange(row.id, { timelineStart: e.target.value })}
            className="h-8 text-xs flex-1"
          />
          <span className="text-muted-foreground text-[10px] shrink-0">→</span>
          <Input
            type="date"
            value={row.timelineEnd}
            onChange={e => onChange(row.id, { timelineEnd: e.target.value })}
            className="h-8 text-xs flex-1"
          />
        </div>
      </td>

      {/* Resources */}
      <td className="p-1.5 min-w-[140px]">
        <Input
          value={row.resources}
          onChange={e => onChange(row.id, { resources: e.target.value })}
          className="h-8 text-xs"
          placeholder="Resources required..."
        />
      </td>

      {/* Status */}
      <td className="p-1.5 min-w-[120px]">
        <Select
          value={row.status}
          onValueChange={v => onChange(row.id, { status: v as WorkPlanActivity['status'] })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusOpt?.color || ''}`}>
                {statusOpt?.label || row.status}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.color}`}>
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Row actions */}
      <td className="p-1.5 w-16">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost" size="sm" className="h-7 w-7 p-0"
            onClick={() => onDuplicate(row.id)} title="Duplicate"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(row.id)} title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

// ─── Section Header ──────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  description?: string;
  number: number;
}> = ({ icon, title, description, number }) => (
  <div className="flex items-start gap-3 mb-1">
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#83002A] text-white text-xs font-bold shrink-0 mt-0.5">
      {number}
    </div>
    <div>
      <CardTitle className="flex items-center gap-2 text-base">
        {icon}
        {title}
      </CardTitle>
      {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
    </div>
  </div>
);

// ─── Main WorkPlanBuilder ────────────────────────────────────────────────────

export const WorkPlanBuilder: React.FC<WorkPlanBuilderProps> = ({
  initialPlan,
  divisionId,
  divisionName,
  defaultOrganization = 'Securities Commission of Papua New Guinea',
  createdBy,
  createdByEmail,
  strategicObjectives,
  staff,
  onSave,
  onCancel,
}) => {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  // ── Section 1: Plan identity ──
  const [title, setTitle] = useState(
    initialPlan?.title || `${divisionName} Annual Work Plan ${nextYear}`,
  );
  const [organization, setOrganization] = useState(
    initialPlan?.organization || defaultOrganization,
  );
  const [preparedBy, setPreparedBy] = useState(
    initialPlan?.preparedBy || divisionName,
  );
  const [planningPeriod, setPlanningPeriod] = useState(
    initialPlan?.planningPeriodLabel || `January – December ${nextYear}`,
  );
  const [timePeriod, setTimePeriod] = useState<WorkPlanTimePeriod>(
    initialPlan?.timePeriod || 'annual',
  );
  const [year, setYear] = useState(initialPlan?.year || nextYear);
  const [startDate, setStartDate] = useState(
    initialPlan?.startDate || `${nextYear}-01-01`,
  );
  const [endDate, setEndDate] = useState(
    initialPlan?.endDate || `${nextYear}-12-31`,
  );

  // ── Section 2: Mandate ──
  const [mandate, setMandate] = useState(initialPlan?.mandate || '');

  // ── Section 3: Strategic objectives ──
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>(() => {
    if (!initialPlan?.goals) return [];
    return initialPlan.goals
      .map(g => g.linkedObjectiveId)
      .filter((id): id is string => Boolean(id));
  });
  const [customObjectives, setCustomObjectives] = useState<string[]>([]);
  const [newCustomObj, setNewCustomObj] = useState('');

  // ── Section 4: Table rows ──
  const [tableRows, setTableRows] = useState<TableRow[]>(
    initialPlan?.goals ? goalsToRows(initialPlan.goals) : [],
  );

  // ── Section 5: Monitoring ──
  const [monitoring, setMonitoring] = useState(
    initialPlan?.monitoringAndReporting || '',
  );
  const [reviewFrequency, setReviewFrequency] = useState(
    initialPlan?.reviewFrequency || 'monthly',
  );
  const [reportingTo, setReportingTo] = useState(
    initialPlan?.reportingTo || 'Senior Management',
  );

  // ── Derived ──
  // Full option objects for the table row (carries linkedDeliverable for auto-populate)
  const selectedObjectiveOptions = useMemo(() => {
    const fromStrategy = strategicObjectives
      .filter(o => selectedObjectiveIds.includes(String(o.id)))
      .map(o => ({
        id: String(o.id),
        title: o.title,
        linkedDeliverable: o.linkedDeliverable,
      }));
    const fromCustom = customObjectives.map((t, i) => ({
      id: `custom-${i}`,
      title: t,
      linkedDeliverable: undefined as string | undefined,
    }));
    return [...fromStrategy, ...fromCustom];
  }, [strategicObjectives, selectedObjectiveIds, customObjectives]);

  // Plain titles kept for display-only use (Section 3 count label)
  const selectedObjectiveTitles = useMemo(
    () => selectedObjectiveOptions.map(o => o.title),
    [selectedObjectiveOptions],
  );

  const completedRows = tableRows.filter(r => r.status === 'completed' && r.activity.trim()).length;
  const totalRows = tableRows.filter(r => r.activity.trim()).length;
  const overallProgress = totalRows > 0 ? Math.round((completedRows / totalRows) * 100) : 0;

  // ── Row handlers ──
  const handleRowChange = (id: string, updates: Partial<TableRow>) =>
    setTableRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

  const handleRowDelete = (id: string) =>
    setTableRows(prev => prev.filter(r => r.id !== id));

  const handleRowDuplicate = (id: string) => {
    const existing = tableRows.find(r => r.id === id);
    if (existing) {
      setTableRows(prev => [
        ...prev,
        { ...existing, id: `new-${Date.now()}` },
      ]);
    }
  };

  const handleAddRow = () => {
    setTableRows(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        strategicObjective: selectedObjectiveTitles[0] || '',
        linkedObjectiveId: selectedObjectiveIds[0] || undefined,
        activity: '',
        output: '',
        kpi: '',
        responsibleOfficer: '',
        timelineStart: `${year}-01-01`,
        timelineEnd: `${year}-12-31`,
        resources: '',
        status: 'not-started',
      },
    ]);
  };

  // ── Save ──
  const handleSave = (status: 'draft' | 'active') => {
    const planId = initialPlan?.id || `wp-${Date.now()}`;
    const goals = rowsToGoals(tableRows, planId);
    const plan: WorkPlan = {
      id: planId,
      title: title.trim() || `${divisionName} Work Plan`,
      description: mandate.substring(0, 300),
      divisionId,
      divisionName,
      organization,
      preparedBy,
      planningPeriodLabel: planningPeriod,
      mandate,
      monitoringAndReporting: monitoring,
      reviewFrequency,
      reportingTo,
      status,
      timePeriod,
      year,
      startDate,
      endDate,
      linkedStrategicObjectiveId: selectedObjectiveIds[0],
      linkedStrategicObjectiveTitle: selectedObjectiveTitles[0],
      goals,
      overallProgress,
      createdBy: initialPlan?.createdBy || createdBy,
      createdByEmail: initialPlan?.createdByEmail || createdByEmail,
      createdAt: initialPlan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(plan);
  };

  const isValid = title.trim().length > 0;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-[1400px] mx-auto px-3 py-3 flex items-center gap-4">
          <Button
            variant="ghost" size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
            onClick={onCancel}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{divisionName}</p>
            <h1 className="text-sm font-semibold truncate">{title || 'New Work Plan'}</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {totalRows > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {totalRows} {totalRows === 1 ? 'activity' : 'activities'} · {overallProgress}% complete
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => handleSave('draft')}>
              Save Draft
            </Button>
            <Button
              size="sm"
              className="bg-[#83002A] hover:bg-[#5C001E] gap-1.5"
              onClick={() => handleSave('active')}
              disabled={!isValid}
            >
              <Save className="h-3.5 w-3.5" />
              Save & Activate
            </Button>
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="max-w-[1400px] mx-auto px-3 py-5 space-y-5">

        {/* ── Document title banner ── */}
        <div className="bg-gradient-to-r from-[#83002A] to-[#5C001E] rounded-xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-7 w-7 opacity-80" />
            <div>
              <h2 className="text-xl font-bold">{title || 'Work Plan'}</h2>
              <p className="text-white/70 text-sm">{divisionName} · {planningPeriod || String(year)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">Organization</p>
              <p className="font-medium text-white/90 truncate">{organization || '—'}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">Division</p>
              <p className="font-medium text-white/90 truncate">{divisionName}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">Planning Period</p>
              <p className="font-medium text-white/90 truncate">{planningPeriod || '—'}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wide">Prepared By</p>
              <p className="font-medium text-white/90 truncate">{preparedBy || '—'}</p>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 1 — Plan Identity
        ───────────────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <SectionHeader
              number={1}
              icon={<FileText className="h-4 w-4 text-[#83002A]" />}
              title="Plan Identity"
              description="Basic details that identify this work plan"
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-3">
                <Label htmlFor="wp-title">Work Plan Title *</Label>
                <Input
                  id="wp-title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={`e.g., ${divisionName} Annual Work Plan ${nextYear}`}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="wp-org">Organization</Label>
                <Input
                  id="wp-org"
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Division</Label>
                <Input value={divisionName} readOnly className="mt-1 bg-muted/60 cursor-not-allowed" />
              </div>
              <div>
                <Label htmlFor="wp-prepared">Prepared By</Label>
                <Input
                  id="wp-prepared"
                  value={preparedBy}
                  onChange={e => setPreparedBy(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="wp-period">Planning Period Label</Label>
                <Input
                  id="wp-period"
                  value={planningPeriod}
                  onChange={e => setPlanningPeriod(e.target.value)}
                  placeholder="e.g., January – December 2026"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Time Period</Label>
                <Select value={timePeriod} onValueChange={v => setTimePeriod(v as WorkPlanTimePeriod)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PERIODS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="wp-year">Year</Label>
                <Input
                  id="wp-year"
                  type="number"
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  min={currentYear}
                  max={currentYear + 5}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="wp-start">Start Date</Label>
                <Input
                  id="wp-start"
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="wp-end">End Date</Label>
                <Input
                  id="wp-end"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 2 — Division Mandate
        ───────────────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <SectionHeader
              number={2}
              icon={<BookOpen className="h-4 w-4 text-[#83002A]" />}
              title="Division Mandate"
              description="State the core mandate and purpose of this division"
            />
          </CardHeader>
          <CardContent>
            <Textarea
              value={mandate}
              onChange={e => setMandate(e.target.value)}
              rows={5}
              placeholder="e.g., Provide administrative, financial, human resource, procurement, and ICT support services to ensure the organization operates efficiently, transparently, and in compliance with internal policies and national regulations."
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {mandate.length} characters
            </p>
          </CardContent>
        </Card>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 3 — Strategic Objectives
        ───────────────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <SectionHeader
              number={3}
              icon={<Target className="h-4 w-4 text-[#83002A]" />}
              title="Strategic Objectives"
              description="Select the strategic objectives this work plan addresses. These will appear as options in the work plan table."
            />
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Objectives linked from Strategy page */}
            {strategicObjectives.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  From Strategy Page
                </p>
                {strategicObjectives.map((obj, idx) => (
                  <label
                    key={String(obj.id)}
                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      checked={selectedObjectiveIds.includes(String(obj.id))}
                      onCheckedChange={checked => {
                        setSelectedObjectiveIds(prev =>
                          checked
                            ? [...prev, String(obj.id)]
                            : prev.filter(id => id !== String(obj.id)),
                        );
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#83002A]">
                          {idx + 1}.
                        </span>
                        <span className="text-sm font-medium">{obj.title}</span>
                        {selectedObjectiveIds.includes(String(obj.id)) && (
                          <Badge variant="secondary" className="text-[10px] h-4 bg-[#83002A]/10 text-[#83002A]">
                            Selected
                          </Badge>
                        )}
                      </div>
                      {obj.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                          {obj.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>No strategic objectives found. Add custom objectives below.</span>
              </div>
            )}

            {/* Custom objectives */}
            {customObjectives.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Custom Objectives
                </p>
                {customObjectives.map((obj, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                    <span className="text-xs font-semibold text-[#83002A] shrink-0">
                      {strategicObjectives.length + idx + 1}.
                    </span>
                    <span className="text-sm flex-1">{obj}</span>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setCustomObjectives(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add custom objective */}
            <div className="flex gap-2 pt-1">
              <Input
                value={newCustomObj}
                onChange={e => setNewCustomObj(e.target.value)}
                placeholder="Add a custom strategic objective..."
                className="text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCustomObj.trim()) {
                    setCustomObjectives(prev => [...prev, newCustomObj.trim()]);
                    setNewCustomObj('');
                  }
                }}
              />
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  if (newCustomObj.trim()) {
                    setCustomObjectives(prev => [...prev, newCustomObj.trim()]);
                    setNewCustomObj('');
                  }
                }}
                className="shrink-0 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            {selectedObjectiveTitles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-[#83002A]">{selectedObjectiveTitles.length}</span> objective{selectedObjectiveTitles.length !== 1 ? 's' : ''} selected — these appear as suggestions in the work plan table below.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 4 — Annual Work Plan Table
        ───────────────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <SectionHeader
                number={4}
                icon={<Table2 className="h-4 w-4 text-[#83002A]" />}
                title="Annual Work Plan"
                description="Define activities, outputs, KPIs, responsible officers, and timelines. Rows sharing the same Strategic Objective are grouped as a goal."
              />
              <Button
                variant="outline" size="sm"
                onClick={handleAddRow}
                className="gap-1.5 shrink-0 mt-1"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
            </div>

            {/* Progress summary */}
            {totalRows > 0 && (
              <div className="flex items-center gap-4 mt-3 p-3 rounded-lg bg-muted/30 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-medium text-foreground">{totalRows}</span> activities
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-medium text-green-600">{completedRows}</span> completed
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-medium text-[#83002A]">{overallProgress}%</span> overall
                </div>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#83002A] rounded-full transition-all"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {tableRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-t">
                <Table2 className="h-10 w-10 opacity-20 mb-3" />
                <p className="text-sm font-medium mb-1">No activities yet</p>
                <p className="text-xs text-center max-w-xs">
                  Click "Add Row" to start building your work plan table.
                  {selectedObjectiveTitles.length === 0 &&
                    ' Select strategic objectives above first for auto-suggestions.'}
                </p>
                <Button variant="link" size="sm" className="mt-2 text-[#83002A]" onClick={handleAddRow}>
                  + Add first activity
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#83002A]/5 border-b">
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground w-8">#</th>
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground min-w-[180px]">
                        Strategic Objective
                      </th>
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground min-w-[180px]">
                        Activity
                      </th>
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground min-w-[160px]">
                        Output / Deliverable
                      </th>
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground min-w-[160px]">
                        Key Performance Indicator
                      </th>
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground min-w-[150px]">
                        Responsible Officer
                      </th>
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground min-w-[220px]">
                        Timeline
                      </th>
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground min-w-[140px]">
                        Resources Required
                      </th>
                      <th className="text-left p-2 text-xs font-semibold text-muted-foreground min-w-[120px]">
                        Status
                      </th>
                      <th className="text-left p-2 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, idx) => (
                      <EditableRow
                        key={row.id}
                        row={row}
                        rowIndex={idx}
                        objectiveOptions={selectedObjectiveOptions}
                        staffData={staff}
                        onChange={handleRowChange}
                        onDelete={handleRowDelete}
                        onDuplicate={handleRowDuplicate}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/20">
                      <td colSpan={10} className="p-2">
                        <Button
                          variant="ghost" size="sm"
                          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={handleAddRow}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add another row
                        </Button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─────────────────────────────────────────────────────────────────
            SECTION 5 — Monitoring and Reporting
        ───────────────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-4">
            <SectionHeader
              number={5}
              icon={<BarChart3 className="h-4 w-4 text-[#83002A]" />}
              title="Monitoring and Reporting"
              description="Define how progress will be tracked and reported to stakeholders"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="wp-monitoring">Monitoring Approach</Label>
              <Textarea
                id="wp-monitoring"
                value={monitoring}
                onChange={e => setMonitoring(e.target.value)}
                rows={5}
                placeholder="e.g., Progress against this work plan will be reviewed monthly by the Division Head and reported quarterly to senior management. Key performance indicators will be used to assess completion of activities and identify areas requiring corrective action."
                className="resize-none mt-1.5"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Review Frequency</Label>
                <Select value={reviewFrequency} onValueChange={setReviewFrequency}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVIEW_FREQUENCIES.map(f => (
                      <SelectItem key={f} value={f}>
                        {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="wp-reporting">Reporting To</Label>
                <Input
                  id="wp-reporting"
                  value={reportingTo}
                  onChange={e => setReportingTo(e.target.value)}
                  placeholder="e.g., Senior Management, Division Head"
                  className="mt-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Bottom actions ── */}
        <div className="flex items-center justify-between pb-10">
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSave('draft')}>
              Save as Draft
            </Button>
            <Button
              className="bg-[#83002A] hover:bg-[#5C001E] gap-1.5"
              onClick={() => handleSave('active')}
              disabled={!isValid}
            >
              <Save className="h-4 w-4" />
              Save & Activate
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkPlanBuilder;
