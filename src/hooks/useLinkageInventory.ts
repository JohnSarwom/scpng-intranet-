import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOpsService } from '@/hooks/useSharePointOps';
import { buildLinkageInventory, type LinkageInventory } from '@/services/linkageInventoryService';
import { isOperationalTask, triageUpdateFor, type TriageAction } from '@/utils/taskAlignment';

// Unfiltered read: the inventory must resolve links that cross Division lines,
// so the list readers' scope filters are bypassed here. Who may view the result
// is decided by canViewLinkageInventory, and SharePoint still enforces read access.
const UNFILTERED_READ = { division: '', unit: '', email: '', name: '', role: 'admin' };

/** Bump when the inventory's shape changes. */
const LINKAGE_INVENTORY_VERSION = 3;

export interface InventoryTaskMeta {
  revision?: string;
  tags: string[];
}

export interface LinkageInventoryResult extends LinkageInventory {
  /** Loaded version and tags per task, so clean-up writes can refuse stale edits. */
  taskMeta: Record<string, InventoryTaskMeta>;
}

/**
 * Read-only linkage inventory for one Division. Loads every page of Tasks, KPIs,
 * KRAs and Unit Objectives; nothing is written. Fetch failures surface as
 * `error` instead of an empty (and misleadingly clean) inventory.
 */
export function useLinkageInventory(divisionName: string | undefined, unitNames: string[], enabled: boolean) {
  const getService = useOpsService();

  return useQuery<LinkageInventoryResult, Error>({
    // Versioned key and no persistence: an inventory saved by an older build (missing
    // newer fields) must never be rendered, and audit counts should always be fresh.
    queryKey: ['linkageInventory', LINKAGE_INVENTORY_VERSION, divisionName, unitNames],
    meta: { persist: false },
    enabled: enabled && !!divisionName,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const service = await getService();
      const [tasks, kpis, kras, objectives] = await Promise.all([
        service.getTasks('Unit', UNFILTERED_READ),
        service.getKPIs(),
        service.getKRAs('Division', UNFILTERED_READ),
        service.getObjectives('Division', UNFILTERED_READ),
      ]);
      const inventory = buildLinkageInventory({
        divisionName: divisionName || '',
        unitNames,
        tasks: tasks.map(task => ({
          id: String(task.id),
          title: task.title,
          status: task.status,
          unit_id: task.unit_id,
          kpi_id: task.kpi_id,
          kra_id: task.kra_id,
          operational: isOperationalTask(task.tags),
        })),
        kpis: kpis.map(kpi => ({ id: String(kpi.id), name: kpi.name, kra_id: kpi.kra_id })),
        kras: kras.map(kra => ({
          id: String(kra.id), title: kra.title, unit: kra.unit, division: kra.division, objective_id: kra.objective_id,
        })),
        objectives: objectives.map(objective => ({
          id: String(objective.id),
          title: objective.title,
          goalType: objective.goalType,
          unit: objective.unit,
          division: objective.division,
          parentGoalId: objective.parentGoalId,
          linkedDeliverable: objective.linkedDeliverable,
        })),
      });
      const taskMeta: Record<string, InventoryTaskMeta> = {};
      for (const task of tasks) taskMeta[String(task.id)] = { revision: task.revision, tags: task.tags || [] };
      return { ...inventory, taskMeta };
    },
  });
}

export interface TriageOutcome {
  taskId: string;
  ok: boolean;
  error?: string;
}

/**
 * Applies a manager's clean-up choice to the selected tasks, one at a time, using
 * the normal task save (version check, KPI→KRA derivation, KPI checklist sync).
 * Each task succeeds or fails on its own; nothing is retried automatically.
 */
export function useLinkageTriage() {
  const getService = useOpsService();
  const queryClient = useQueryClient();

  return useMutation<TriageOutcome[], Error, { taskIds: string[]; action: TriageAction; taskMeta: Record<string, InventoryTaskMeta> }>({
    mutationFn: async ({ taskIds, action, taskMeta }) => {
      const service = await getService();
      const outcomes: TriageOutcome[] = [];
      for (const taskId of taskIds) {
        try {
          const meta = taskMeta[taskId];
          if (!meta?.revision) throw new Error('This task has no loaded version. Refresh and try again.');
          await service.updateTask(taskId, triageUpdateFor(action, meta));
          outcomes.push({ taskId, ok: true });
        } catch (error: any) {
          outcomes.push({ taskId, ok: false, error: error?.message || 'The task could not be saved.' });
        }
      }
      return outcomes;
    },
    onSettled: async () => {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['linkageInventory'] }),
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['sharePoint', 'kras'] }),
      ]);
    },
  });
}
