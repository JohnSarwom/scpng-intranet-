import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useDivisionData } from '@/hooks/useDivisionData';
import { useWorkPlans } from '@/hooks/useWorkPlans';
import { WorkPlanBuilder } from '@/components/division/workplan/WorkPlanBuilder';
import {
  WorkPlan, WorkPlanRetirementAction, WorkPlanRetirementImpact,
  WorkPlanStructureKind, WorkPlanStructureRetirementImpact,
} from '@/types/division.types';
import { useOpsService } from '@/hooks/useSharePointOps';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { Button } from '@/components/ui/button';

const WorkPlanBuilderPage: React.FC = () => {
  const { divisionId, planId } = useParams<{ divisionId: string; planId: string }>();
  const navigate = useNavigate();
  const getService = useOpsService();
  const { isAdmin } = useRoleBasedAuth();

  const divisionData = useDivisionData(divisionId);
  const resolvedDivisionId = divisionData.division?.id || divisionId || '';
  const resolvedDivisionName = divisionData.division?.name || '';

  const {
    workPlans, loading: plansLoading, addWorkPlan, updateWorkPlan, activateWorkPlan,
    syncWorkPlan, importLocalWorkPlans, previewActivityRetirement, retireActivity,
    previewStructureRetirement, retireStructure,
  } = useWorkPlans(
    resolvedDivisionId,
    resolvedDivisionName,
  );

  const isNew = !planId || planId === 'new';
  const existingPlan = isNew ? undefined : workPlans.find(p => p.id === planId);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<WorkPlan | null>(null);
  const [schemaMessage, setSchemaMessage] = useState('');
  const loadMappingOptions = useCallback(async () => (await getService()).getWorkPlanMappingOptions(resolvedDivisionName), [getService, resolvedDivisionName]);
  const previewRetirement = useCallback((
    activityId: string,
    action: WorkPlanRetirementAction,
    targetKraId?: string,
  ) => {
    const id = existingPlan?.id || savedDraft?.id;
    if (!id) return Promise.reject(new Error('Save the work plan before reviewing an activated retirement.'));
    return previewActivityRetirement(id, activityId, action, targetKraId);
  }, [existingPlan?.id, savedDraft?.id, previewActivityRetirement]);
  const executeRetirement = useCallback((
    impact: WorkPlanRetirementImpact,
    reason: string,
  ) => retireActivity(impact, reason), [retireActivity]);
  const previewStructure = useCallback((
    entityKind: WorkPlanStructureKind,
    sourceId: string,
    action: WorkPlanRetirementAction,
    targetExecutionId?: string,
  ) => {
    const id = existingPlan?.id || savedDraft?.id;
    if (!id) return Promise.reject(new Error('Save the work plan before reviewing an activated retirement.'));
    return previewStructureRetirement(id, entityKind, sourceId, action, targetExecutionId);
  }, [existingPlan?.id, savedDraft?.id, previewStructureRetirement]);
  const executeStructure = useCallback((
    impact: WorkPlanStructureRetirementImpact,
    reason: string,
  ) => retireStructure(impact, reason), [retireStructure]);

  const prepareSchema = async () => {
    setSaving(true);
    try {
      const errors = await (await getService()).prepareWorkPlanActivationSchema(resolvedDivisionName);
      setSchemaMessage(errors.length ? errors.join('\n') : 'Activation schema is ready.');
    } catch (error) { setSchemaMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  };
  const importLocal = async () => {
    setSaving(true);
    try {
      const results = await importLocalWorkPlans();
      setSchemaMessage(`${results.filter(result => result.created).length} local plans imported as drafts; ${results.filter(result => !result.created).length} already imported. Local copies retained.`);
    } catch (error) { setSchemaMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  };

  const handleSave = async (plan: WorkPlan) => {
    if (!divisionData.canEditStrategy) {
      setSaveError('You do not have permission to manage this division’s work plans.');
      return;
    }
    if (saving || plansLoading || (!isNew && !existingPlan)) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (isNew && !savedDraft) {
        if (plan.status === 'active') {
          // New plan being activated — save as draft first, then activate
          const saved = await addWorkPlan({ ...plan, status: 'draft' });
          setSavedDraft(saved);
          // Persist the new identity in the URL before activation can fail or the page reloads.
          navigate(`/division/${encodeURIComponent(divisionId || resolvedDivisionId)}/workplan/${saved.id}/edit`, { replace: true });
          await activateWorkPlan({ ...plan, id: saved.id, revision: saved.revision });
        } else {
          await addWorkPlan(plan);
        }
      } else {
        if (savedDraft) plan = { ...plan, id: savedDraft.id, revision: savedDraft.revision };
        if (plan.status === 'active' && existingPlan?.status !== 'active') {
          // Transitioning from draft to active — run cascade
          await activateWorkPlan(plan);
        } else if (plan.status === 'active' && existingPlan?.status === 'active') {
          // Already active — sync changes to existing SharePoint items
          await syncWorkPlan(plan);
        } else {
          // Saving as draft
          await updateWorkPlan(plan.id, plan);
        }
      }
      // Navigate back to division work plans tab
      const target = divisionId ? `/division/${divisionId}` : '/division';
      navigate(target, { state: { activeTab: 'workplans' } });
    } catch (error) {
      console.error('[WorkPlanBuilderPage] Save failed:', error);
      setSaveError(error instanceof Error ? error.message : 'Work plan could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if ((divisionData.loading && !divisionData.division) || (!isNew && plansLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 space-y-4">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!isNew && !existingPlan) {
    return <div role="alert" className="p-6">This work plan could not be loaded. Return to the division and reload before editing.</div>;
  }

  if (!divisionData.canEditStrategy) {
    return <div role="alert" className="p-6">You do not have permission to manage this division’s work plans.</div>;
  }

  return (
    <>
    {saveError && <div role="alert" className="p-4 text-destructive">{saveError}</div>}
    <div className="p-3 flex flex-wrap gap-2">{isAdmin && <Button variant="outline" disabled={saving} onClick={prepareSchema}>Prepare work-plan activation schema</Button>}<Button variant="outline" disabled={saving} onClick={importLocal}>Import saved local plans</Button>{schemaMessage && <p role="status" className="w-full whitespace-pre-line text-sm mt-2">{schemaMessage}</p>}</div>
    <WorkPlanBuilder
      key={existingPlan?.id ?? `new-${resolvedDivisionId}`}
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
      saving={saving}
      loadMappingOptions={loadMappingOptions}
      previewActivityRetirement={previewRetirement}
      retireActivity={executeRetirement}
      previewStructureRetirement={previewStructure}
      retireStructure={executeStructure}
    />
    </>
  );
};

export default WorkPlanBuilderPage;
