import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, BarChart3, Clock, CheckCircle } from 'lucide-react';
import { useWorkPlans } from '@/hooks/useWorkPlans';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';

interface DivisionWorkPlanStatsProps {
  data: UseDivisionDataReturn;
}

export const DivisionWorkPlanStats: React.FC<DivisionWorkPlanStatsProps> = ({ data }) => {
  const divisionId = data.division?.id || '';
  const divisionName = data.division?.name || 'Division';

  const { workPlans } = useWorkPlans(divisionId, divisionName);

  // Stats calculation (consolidated from DivisionWorkPlansTab)
  const stats = useMemo(() => {
    const objectives = data.objectives || [];
    const kras = data.combinedKras || [];

    const enriched = workPlans.map(plan => {
      if (plan.status !== 'active') return plan;

      const enrichedGoals = plan.goals.map(goal => {
        if (!goal.linkedObjectiveId) return goal;
        const obj = objectives.find(o => String(o.id) === goal.linkedObjectiveId);
        const goalProgress = obj?.progress ?? goal.progress;

        const enrichedActivities = goal.activities.map(act => {
          if (!act.linkedKraId) return act;
          const kra = kras.find(k => String(k.id) === act.linkedKraId);
          return { ...act, progress: kra?.progress ?? act.progress };
        });

        return { ...goal, progress: goalProgress, activities: enrichedActivities };
      });

      const overallProgress = enrichedGoals.length > 0
        ? Math.round(enrichedGoals.reduce((s, g) => s + g.progress, 0) / enrichedGoals.length)
        : 0;

      return { ...plan, goals: enrichedGoals, overallProgress };
    });

    return {
      total: enriched.length,
      active: enriched.filter(p => p.status === 'active').length,
      completed: enriched.filter(p => p.status === 'completed').length,
      draft: enriched.filter(p => p.status === 'draft').length,
    };
  }, [workPlans, data.objectives, data.combinedKras]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Plans', value: stats.total, icon: FileText, color: 'text-blue-600' },
        { label: 'Active', value: stats.active, icon: BarChart3, color: 'text-green-600' },
        { label: 'Draft', value: stats.draft, icon: Clock, color: 'text-amber-600' },
        { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-gray-600' },
      ].map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-white/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('600', '100')} dark:bg-white/10`}>
              <Icon className={`h-5 w-5 ${color} shrink-0`} />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
