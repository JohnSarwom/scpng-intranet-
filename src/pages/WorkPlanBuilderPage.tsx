import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useDivisionData } from '@/hooks/useDivisionData';
import { useWorkPlans } from '@/hooks/useWorkPlans';
import { WorkPlanBuilder } from '@/components/division/workplan/WorkPlanBuilder';
import { WorkPlan } from '@/types/division.types';

const WorkPlanBuilderPage: React.FC = () => {
  const { divisionId, planId } = useParams<{ divisionId: string; planId: string }>();
  const navigate = useNavigate();

  const divisionData = useDivisionData(divisionId);
  const resolvedDivisionId = divisionData.division?.id || divisionId || '';
  const resolvedDivisionName = divisionData.division?.name || '';

  const { workPlans, addWorkPlan, updateWorkPlan } = useWorkPlans(
    resolvedDivisionId,
    resolvedDivisionName,
  );

  const isNew = !planId || planId === 'new';
  const existingPlan = isNew ? undefined : workPlans.find(p => p.id === planId);

  const handleSave = (plan: WorkPlan) => {
    if (isNew) {
      addWorkPlan(plan);
    } else {
      updateWorkPlan(plan.id, plan);
    }
    // Navigate back to division work plans tab
    const target = divisionId ? `/division/${divisionId}` : '/division';
    navigate(target, { state: { activeTab: 'workplans' } });
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (divisionData.loading && !divisionData.division) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <WorkPlanBuilder
      initialPlan={existingPlan}
      divisionId={resolvedDivisionId}
      divisionName={resolvedDivisionName}
      defaultOrganization="Securities Commission of Papua New Guinea"
      createdBy={divisionData.userContext.name}
      createdByEmail={divisionData.userContext.email}
      strategicObjectives={divisionData.strategicObjectives}
      staff={divisionData.staff}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
};

export default WorkPlanBuilderPage;
