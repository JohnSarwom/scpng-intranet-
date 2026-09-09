/**
 * useStrategyExecutionGraph (Phase 3)
 *
 * Thin hook that assembles the inputs the existing SharePoint hooks already fetch
 * and memoizes a single `StrategyExecutionGraph`. The hook does no relationship
 * work itself — that lives in `strategyExecutionGraphService` (pure + tested).
 *
 * Corporate scope is the default. Personal, unit, and division callers must pass
 * their matching context; both the fetches and the pure graph builder then enforce
 * that scope so a label change can never expose a corporate graph accidentally.
 */

import { useMemo } from 'react';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';
import {
  useSharePointKRAs,
  useSharePointKPIs,
  useSharePointObjectives,
  useSharePointTasks,
} from '@/hooks/useSharePointOps';
import {
  buildStrategyExecutionGraph,
  type GraphInput,
} from '@/services/strategyExecutionGraphService';
import type { StrategyExecutionGraph, ProgressScope } from '@/types/strategyExecution';
import type { FilterScope, StrategicGoal, UserContext } from '@/types';

export interface UseStrategyExecutionGraphOptions {
  scope?: ProgressScope;
  ownerEmail?: string;
  ownerName?: string;
  division?: string;
  unit?: string;
  role?: string;
}

interface UseStrategyExecutionGraphResult {
  graph: StrategyExecutionGraph;
  isLoading: boolean;
  error: Error | null;
}

// Corporate-wide fetch context (mirrors Strategy.tsx).
const CORPORATE_CONTEXT = {
  division: '',
  unit: '',
  email: '',
  name: '',
  role: 'super_admin' as const,
};

export function useStrategyExecutionGraph(
  options?: UseStrategyExecutionGraphOptions,
): UseStrategyExecutionGraphResult {
  const scope: ProgressScope = options?.scope ?? 'corporate';
  const fetchScope: FilterScope =
    scope === 'personal' ? 'Individual' : scope === 'unit' ? 'Unit' : scope === 'division' ? 'Division' : 'All';
  const queryContext: UserContext = {
    division: options?.division || '',
    unit: options?.unit || '',
    email: options?.ownerEmail || '',
    name: options?.ownerName || '',
    role: options?.role ||
      (scope === 'corporate' || scope === 'audit'
        ? 'super_admin'
        : scope === 'personal'
          ? 'staff_member'
          : 'manager'),
  };
  const department = options?.division || undefined;

  const { strategyData, isLoading: loadingStrategy, error: strategyError } = useStrategySharePoint();
  const { data: allObjectives, loading: loadingObjectives, error: objectivesError } = useSharePointObjectives(
    department,
    fetchScope,
    scope === 'corporate' || scope === 'audit' ? CORPORATE_CONTEXT : queryContext,
  );
  const { data: allKras, loading: loadingKras, error: krasError } = useSharePointKRAs(
    department,
    fetchScope,
    scope === 'corporate' || scope === 'audit' ? CORPORATE_CONTEXT : queryContext,
  );
  const { data: allKpis, loading: loadingKpis, error: kpisError } = useSharePointKPIs(
    department,
    scope === 'corporate' || scope === 'audit' ? undefined : queryContext,
  );
  const { data: allTasks, loading: loadingTasks, error: tasksError } = useSharePointTasks(
    department,
    fetchScope,
    scope === 'corporate' || scope === 'audit' ? CORPORATE_CONTEXT : queryContext,
  );

  const graph = useMemo(() => {
    const strategicGoals: StrategicGoal[] = (strategyData?.strategicGoals || []).map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
    }));
    const divisionStructure: Record<string, string[]> =
      ((strategyData as any)?.hierarchy as Record<string, string[]>) || {};

    // Legacy interim: the service adapts the existing 3 lists into unified
    // PerformanceRecords. After migration, pass `performanceRecords` directly.
    const input: GraphInput = {
      scope,
      scopeContext: {
        ownerEmail: options?.ownerEmail,
        ownerName: options?.ownerName,
        division: options?.division,
        unit: options?.unit,
      },
      strategicGoals,
      unitObjectives: allObjectives || [],
      performanceKras: allKras || [],
      kpis: allKpis || [],
      tasks: allTasks || [],
      divisionStructure,
    };
    return buildStrategyExecutionGraph(input);
  }, [
    strategyData,
    allObjectives,
    allKras,
    allKpis,
    allTasks,
    scope,
    options?.ownerEmail,
    options?.ownerName,
    options?.division,
    options?.unit,
  ]);

  return {
    graph,
    isLoading: loadingStrategy || loadingObjectives || loadingKras || loadingKpis || loadingTasks,
    error: (strategyError as Error | null) || objectivesError || krasError || kpisError || tasksError,
  };
}
