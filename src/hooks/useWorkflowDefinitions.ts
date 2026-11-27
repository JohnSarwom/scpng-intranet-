import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { WorkflowDefinitionsService } from '@/services/workflowDefinitionsService';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import type { SavedWorkflow, WorkflowDefinition } from '@/workflows/workflowTypes';

const KEY = ['workflows'] as const;

function useWorkflowService() {
  const { instance } = useMsal();
  return useCallback(async () => {
    const client = await getGraphClient(instance);
    if (!client) throw new Error('Could not connect to Microsoft Graph.');
    return new WorkflowDefinitionsService(client);
  }, [instance]);
}

/** Whether the viewer may save, publish or delete workflows. */
export function useCanManageWorkflows(): boolean {
  const { isAdmin, hasPermission } = useRoleBasedAuth();
  return isAdmin || hasPermission('strategy', 'manage_workflows');
}

/** Read-only: does the Workflow_Definitions list exist and is it usable? */
export function useWorkflowListReadiness() {
  const getService = useWorkflowService();
  return useQuery({
    queryKey: [...KEY, 'readiness'],
    queryFn: async () => (await getService()).readiness(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    meta: { persist: false },
  });
}

/** Saved workflows; only loaded once the list is ready. */
export function useSavedWorkflows(enabled: boolean) {
  const getService = useWorkflowService();
  return useQuery({
    queryKey: [...KEY, 'saved'],
    queryFn: async () => (await getService()).list(),
    enabled,
    staleTime: 60 * 1000,
    meta: { persist: false },
  });
}

export function useWorkflowMutations() {
  const getService = useWorkflowService();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const prepare = useMutation({
    mutationFn: async () => (await getService()).prepare(),
    onSettled: refresh,
  });
  const create = useMutation({
    mutationFn: async (definition: WorkflowDefinition) => (await getService()).create(definition),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ saved, definition }: { saved: SavedWorkflow; definition: WorkflowDefinition }) =>
      (await getService()).update(saved.itemId, saved.revision, definition),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (saved: SavedWorkflow) => (await getService()).remove(saved.itemId, saved.revision),
    onSettled: refresh,
  });

  return { prepare, create, update, remove };
}
