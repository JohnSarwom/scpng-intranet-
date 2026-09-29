import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOpsService } from './useSharePointOps';
import {
    WorkPlan, WorkPlanRetirementAction, WorkPlanRetirementImpact,
    WorkPlanStructureKind, WorkPlanStructureRetirementImpact,
} from '@/types/division.types';
import { useToast } from '@/components/ui/use-toast';

import { useRoleBasedAuth } from './useRoleBasedAuth';
import { assertCanManageWorkPlan } from '@/utils/workPlanAccess';

export function useWorkPlans(divisionId: string, divisionName: string) {
    const getService = useOpsService();
    const { user: roleUser, loading: roleLoading } = useRoleBasedAuth();
    const assertCanWrite = () => {
        if (roleLoading) throw new Error('Permissions are still loading.');
        assertCanManageWorkPlan(roleUser, divisionName);
    };
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const queryKey = ['sharePoint', 'workplans', divisionId];

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            if (!divisionId) return [];
            const service = await getService();
            // Reading a plan never migrates or writes localStorage records.
            const plans = await service.getWorkPlans(divisionId);

            return plans;
        },
        enabled: !!divisionId,
    });

    const addWorkPlan = async (plan: WorkPlan): Promise<WorkPlan> => {
        assertCanWrite();
        const service = await getService();
        const created = await service.addWorkPlan(plan);

        // Optimistic cache update
        queryClient.setQueryData(queryKey, (old: WorkPlan[] | undefined) => {
            if (!old) return [created];
            return [created, ...old];
        });
        setTimeout(() => { queryClient.invalidateQueries({ queryKey }); }, 3000);

        toast({ title: 'Success', description: 'Work Plan saved.' });
        return created;
    };

    const updateWorkPlan = async (id: string, updates: Partial<WorkPlan>): Promise<WorkPlan> => {
        assertCanWrite();
        const service = await getService();
        const updated = await service.updateWorkPlan(id, updates);

        queryClient.setQueryData(queryKey, (old: WorkPlan[] | undefined) =>
            (old || []).map(p => p.id === id ? { ...p, ...updated } : p)
        );
        setTimeout(() => { queryClient.invalidateQueries({ queryKey }); }, 3000);

        toast({ title: 'Success', description: 'Work Plan updated.' });
        return updated;
    };

    const deleteWorkPlan = async (id: string): Promise<void> => {
        assertCanWrite();
        const service = await getService();
        await service.deleteWorkPlan(id);

        queryClient.setQueryData(queryKey, (old: WorkPlan[] | undefined) =>
            (old || []).filter(p => p.id !== id)
        );
        setTimeout(() => { queryClient.invalidateQueries({ queryKey }); }, 3000);

        toast({ title: 'Deleted', description: 'Work Plan removed.' });
    };

    const activateWorkPlan = async (plan: WorkPlan): Promise<WorkPlan> => {
        assertCanWrite();
        const service = await getService();
        const activated = await service.activateWorkPlan(plan);

        // Invalidate workplans AND all dependent caches so Unit page + Strategy Hub see new items
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'objectives'] });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kras'] });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kpis'] });

        toast({ title: 'Work Plan Activated', description: 'Objectives, KRAs, and KPIs have been created.' });
        return activated;
    };

    const syncWorkPlan = async (plan: WorkPlan): Promise<WorkPlan> => {
        assertCanWrite();
        const service = await getService();
        const synced = await service.syncWorkPlanToSharePoint(plan);

        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'objectives'] });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kras'] });
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kpis'] });

        toast({ title: 'Synced', description: 'Work Plan changes synced to SharePoint.' });
        return synced;
    };

    const previewActivityRetirement = async (
        planId: string,
        activityId: string,
        action: WorkPlanRetirementAction,
        targetKraId?: string,
    ): Promise<WorkPlanRetirementImpact> => {
        assertCanWrite();
        return (await getService()).previewWorkPlanActivityRetirement(planId, activityId, action, targetKraId);
    };

    const retireActivity = async (
        impact: WorkPlanRetirementImpact,
        reason: string,
    ): Promise<WorkPlan> => {
        assertCanWrite();
        const updated = await (await getService()).executeWorkPlanActivityRetirement({ impact, reason });
        queryClient.setQueryData(queryKey, (old: WorkPlan[] | undefined) =>
            (old || []).map(plan => plan.id === updated.id ? updated : plan));
        await Promise.all([
            queryClient.invalidateQueries({ queryKey }),
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'objectives'] }),
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kras'] }),
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kpis'] }),
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'tasks'] }),
        ]);
        toast({
            title: impact.action === 'reassign' ? 'Execution reassigned' : 'Activity retired',
            description: 'The reviewed change was checkpointed without deleting KPI or Task evidence.',
        });
        return updated;
    };

    const previewStructureRetirement = async (
        planId: string,
        entityKind: WorkPlanStructureKind,
        sourceId: string,
        action: WorkPlanRetirementAction,
        targetExecutionId?: string,
    ): Promise<WorkPlanStructureRetirementImpact> => {
        assertCanWrite();
        return (await getService()).previewWorkPlanStructureRetirement(
            planId, entityKind, sourceId, action, targetExecutionId,
        );
    };

    const retireStructure = async (
        impact: WorkPlanStructureRetirementImpact,
        reason: string,
    ): Promise<WorkPlan> => {
        assertCanWrite();
        const updated = await (await getService()).executeWorkPlanStructureRetirement({ impact, reason });
        queryClient.setQueryData(queryKey, (old: WorkPlan[] | undefined) =>
            (old || []).map(plan => plan.id === updated.id ? updated : plan));
        await Promise.all([
            queryClient.invalidateQueries({ queryKey }),
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'objectives'] }),
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kras'] }),
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kpis'] }),
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'tasks'] }),
        ]);
        toast({
            title: impact.action === 'reassign' ? 'Execution subtree reassigned' : 'Execution subtree retired',
            description: 'The reviewed goal/KRA change was checkpointed without deleting KPI or Task evidence.',
        });
        return updated;
    };

    const getWorkPlan = (id: string) => (query.data || []).find(p => p.id === id) ?? null;
    const importLocalWorkPlans = async () => {
        assertCanWrite();
        const raw = localStorage.getItem(`scpng_workplans_${divisionId}`);
        const plans = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(plans)) throw new Error('Saved local work plans are not a valid array.');
        const result = await (await getService()).importLegacyWorkPlans(divisionId, divisionName, plans);
        await queryClient.invalidateQueries({ queryKey });
        return result;
    };

    return {
        workPlans: query.data || [],
        loading: query.isLoading,
        error: query.error,
        addWorkPlan,
        updateWorkPlan,
        deleteWorkPlan,
        activateWorkPlan,
        syncWorkPlan,
        previewActivityRetirement,
        retireActivity,
        previewStructureRetirement,
        retireStructure,
        getWorkPlan,
        importLocalWorkPlans,
    };
}
