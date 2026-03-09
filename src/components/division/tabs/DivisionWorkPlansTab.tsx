import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, FileText, Calendar, ChevronRight, ChevronDown,
  Target, Clock, CheckCircle, AlertTriangle, Trash2, Edit,
  Eye, Layers, BarChart3, Building2,
} from 'lucide-react';
import { WorkPlan, WorkPlanStatus } from '@/types/division.types';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { useWorkPlans } from '@/hooks/useWorkPlans';

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<WorkPlanStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  archived: { label: 'Archived', color: 'bg-gray-200 text-gray-500' },
};

const activityStatusColors: Record<string, string> = {
  'not-started': 'bg-gray-100 text-gray-600',
  'in-progress': 'bg-blue-100 text-blue-700',
  'completed': 'bg-green-100 text-green-700',
  'overdue': 'bg-red-100 text-red-700',
  'blocked': 'bg-amber-100 text-amber-700',
};

// ─── Work Plan Card ───────────────────────────────────────────────────────────

const WorkPlanCard: React.FC<{
  plan: WorkPlan;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}> = ({ plan, onView, onEdit, onDelete, canEdit }) => {
  const totalActivities = plan.goals.reduce((sum, g) => sum + g.activities.length, 0);
  const config = statusConfig[plan.status];

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-sm leading-tight">{plan.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {plan.timePeriod} {plan.year} &middot; {plan.goals.length} goals &middot; {totalActivities} activities
            </p>
            {plan.planningPeriodLabel && (
              <p className="text-xs text-muted-foreground">{plan.planningPeriodLabel}</p>
            )}
          </div>
          <Badge className={`${config.color} border-0 text-xs shrink-0`}>{config.label}</Badge>
        </div>

        <Progress value={plan.overallProgress} className="h-1.5 mb-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>{plan.overallProgress}% complete</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(plan.startDate).toLocaleDateString()} – {new Date(plan.endDate).toLocaleDateString()}
          </span>
        </div>

        {plan.linkedStrategicObjectiveTitle && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Target className="h-3 w-3 shrink-0" />
            <span className="truncate">Linked: {plan.linkedStrategicObjectiveTitle}</span>
          </div>
        )}

        {plan.preparedBy && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">Prepared by: {plan.preparedBy}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={onView}>
            <Eye className="h-3 w-3" /> View
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={onEdit}>
                <Edit className="h-3 w-3" /> Edit
              </Button>
              <Button
                variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Cascade Tree View ────────────────────────────────────────────────────────

const CascadeTree: React.FC<{ plan: WorkPlan }> = ({ plan }) => {
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(
    new Set(plan.goals.map(g => g.id)),
  );

  const toggle = (id: string) =>
    setExpandedGoals(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      {/* Root */}
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#83002A]/5 border border-[#83002A]/20">
        <FileText className="h-4 w-4 text-[#83002A]" />
        <span className="font-semibold text-sm flex-1 truncate">{plan.title}</span>
        <Badge className="text-xs">{plan.overallProgress}%</Badge>
      </div>

      {plan.goals.map(goal => (
        <div key={goal.id} className="ml-4">
          <div
            className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => toggle(goal.id)}
          >
            <div className="w-4 flex justify-center">
              {expandedGoals.has(goal.id)
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </div>
            <Target className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-sm font-medium flex-1">{goal.title}</span>
            <Badge
              variant={goal.status === 'completed' ? 'default' : goal.status === 'at-risk' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {goal.progress}%
            </Badge>
          </div>

          {expandedGoals.has(goal.id) && (
            <div className="ml-6 mt-1 space-y-1">
              {goal.activities.map(act => (
                <div key={act.id} className="flex items-start gap-2 p-1.5 text-xs rounded hover:bg-muted/30">
                  <ChevronRight className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${activityStatusColors[act.status] || ''}`}>
                    {act.status.replace('-', ' ')}
                  </span>
                  <span className="flex-1">{act.title}</span>
                  {act.responsiblePersonName && (
                    <span className="text-muted-foreground shrink-0">{act.responsiblePersonName}</span>
                  )}
                </div>
              ))}
              {goal.activities.length === 0 && (
                <div className="text-xs text-muted-foreground p-1.5">No activities defined</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Activity Timeline ────────────────────────────────────────────────────────

const ActivityTimeline: React.FC<{ plan: WorkPlan }> = ({ plan }) => {
  const activities = plan.goals.flatMap(g => g.activities);
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No activities to display.</p>;
  }

  return (
    <div className="space-y-2">
      {activities.map(activity => {
        const start = new Date(activity.startDate);
        const end = new Date(activity.endDate);
        const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86_400_000);
        const elapsed = Math.max(0, (Date.now() - start.getTime()) / 86_400_000);
        const timeProgress = Math.min(100, Math.round((elapsed / totalDays) * 100));

        return (
          <div key={activity.id} className="flex items-center gap-3 text-xs">
            <span className="w-36 truncate shrink-0">{activity.title}</span>
            <div className="flex-1 bg-muted rounded-full h-5 relative overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  activity.status === 'completed' ? 'bg-green-500'
                    : activity.status === 'overdue' ? 'bg-red-500'
                    : 'bg-[#83002A]'
                }`}
                style={{ width: `${activity.progress}%` }}
              />
              <div
                className="absolute top-0 h-full border-r-2 border-dashed border-foreground/30"
                style={{ left: `${timeProgress}%` }}
                title={`Time elapsed: ${timeProgress}%`}
              />
            </div>
            <span className="w-10 text-right shrink-0">{activity.progress}%</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Plan Detail View ─────────────────────────────────────────────────────────

const PlanDetailView: React.FC<{
  plan: WorkPlan;
  onBack: () => void;
  onEdit: () => void;
  canEdit: boolean;
}> = ({ plan, onBack, onEdit, canEdit }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
        <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        Back to Work Plans
      </Button>
      {canEdit && (
        <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5">
          <Edit className="h-3.5 w-3.5" />
          Edit Plan
        </Button>
      )}
    </div>

    <Card>
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#83002A] to-[#5C001E] rounded-t-lg p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg">{plan.title}</h2>
            <p className="text-white/70 text-sm mt-0.5">{plan.planningPeriodLabel || `${plan.timePeriod} ${plan.year}`}</p>
          </div>
          <Badge className={`${statusConfig[plan.status].color} border-0 shrink-0`}>
            {statusConfig[plan.status].label}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          {plan.organization && (
            <div>
              <p className="text-white/60 text-xs">Organization</p>
              <p className="text-white/90 font-medium truncate">{plan.organization}</p>
            </div>
          )}
          {plan.preparedBy && (
            <div>
              <p className="text-white/60 text-xs">Prepared By</p>
              <p className="text-white/90 font-medium truncate">{plan.preparedBy}</p>
            </div>
          )}
          <div>
            <p className="text-white/60 text-xs">Goals</p>
            <p className="text-white/90 font-medium">{plan.goals.length}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Progress</p>
            <p className="text-white/90 font-medium">{plan.overallProgress}%</p>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Mandate */}
        {plan.mandate && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Division Mandate</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{plan.mandate}</p>
          </div>
        )}

        {/* Work plan activities */}
        <Tabs defaultValue="cascade">
          <TabsList>
            <TabsTrigger value="cascade">Cascade View</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {plan.monitoringAndReporting && (
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="cascade" className="mt-4">
            <CascadeTree plan={plan} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <ActivityTimeline plan={plan} />
          </TabsContent>

          {plan.monitoringAndReporting && (
            <TabsContent value="monitoring" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{plan.monitoringAndReporting}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {plan.reviewFrequency && (
                  <div>
                    <p className="text-xs text-muted-foreground">Review Frequency</p>
                    <p className="font-medium capitalize">{plan.reviewFrequency.replace('-', ' ')}</p>
                  </div>
                )}
                {plan.reportingTo && (
                  <div>
                    <p className="text-xs text-muted-foreground">Reporting To</p>
                    <p className="font-medium">{plan.reportingTo}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  </div>
);

// ─── Main Tab Component ───────────────────────────────────────────────────────

interface DivisionWorkPlansTabProps {
  data: UseDivisionDataReturn;
  canEdit: boolean;
}

export const DivisionWorkPlansTab: React.FC<DivisionWorkPlansTabProps> = ({ data, canEdit }) => {
  const navigate = useNavigate();
  const divisionId = data.division?.id || '';
  const divisionName = data.division?.name || 'Division';

  const { workPlans, deleteWorkPlan } = useWorkPlans(divisionId, divisionName);

  const [selectedPlan, setSelectedPlan] = useState<WorkPlan | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredPlans = useMemo(() => {
    if (statusFilter === 'all') return workPlans;
    return workPlans.filter(p => p.status === statusFilter);
  }, [workPlans, statusFilter]);

  const goToNew = () => navigate(`/division/${divisionId}/workplan/new`);
  const goToEdit = (plan: WorkPlan) => navigate(`/division/${divisionId}/workplan/${plan.id}/edit`);

  // Stats for header
  const stats = useMemo(() => ({
    total: workPlans.length,
    active: workPlans.filter(p => p.status === 'active').length,
    completed: workPlans.filter(p => p.status === 'completed').length,
    draft: workPlans.filter(p => p.status === 'draft').length,
  }), [workPlans]);

  // ── Detail view ──
  if (selectedPlan) {
    return (
      <div className="mt-4">
        <PlanDetailView
          plan={selectedPlan}
          onBack={() => setSelectedPlan(null)}
          onEdit={() => goToEdit(selectedPlan)}
          canEdit={canEdit}
        />
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4 mt-4">

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Plans', value: stats.total, icon: FileText, color: 'text-blue-600' },
          { label: 'Active', value: stats.active, icon: BarChart3, color: 'text-green-600' },
          { label: 'Draft', value: stats.draft, icon: Clock, color: 'text-amber-600' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-gray-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color} shrink-0`} />
              <div>
                <p className="text-lg font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        {canEdit && (
          <Button
            size="sm"
            className="gap-1.5 bg-[#83002A] hover:bg-[#5C001E]"
            onClick={goToNew}
          >
            <Plus className="h-4 w-4" />
            New Work Plan
          </Button>
        )}
      </div>

      {/* Cards grid */}
      {filteredPlans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">
              {statusFilter !== 'all' ? `No ${statusFilter} work plans` : 'No work plans yet'}
            </p>
            {canEdit && (
              <Button variant="link" size="sm" className="mt-1 text-[#83002A]" onClick={goToNew}>
                + Create your first work plan
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map(plan => (
            <WorkPlanCard
              key={plan.id}
              plan={plan}
              canEdit={canEdit}
              onView={() => setSelectedPlan(plan)}
              onEdit={() => goToEdit(plan)}
              onDelete={() => {
                if (window.confirm(`Delete "${plan.title}"?`)) {
                  deleteWorkPlan(plan.id);
                  if (selectedPlan?.id === plan.id) setSelectedPlan(null);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
