import { useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useGraphProfile } from '@/hooks/useGraphProfile';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useDivisions } from '@/hooks/useDivisions';
import {
  useSharePointKRAs,
  useSharePointKPIs,
  useSharePointProjects,
  useSharePointTasks,
  useSharePointObjectives,
} from '@/hooks/useSharePointOps';
import { useStrategySharePoint } from '@/hooks/useStrategySharePoint';
import { Objective, Kra, Kpi, KRA, KPI, Task, Project, UserContext, FilterScope } from '@/types';
import DivisionStaffMap from '@/utils/divisionStaffMap';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { divisions as staticDivisions } from '@/data/divisions';

export interface DivisionInfo {
  id: string;
  name: string;
  code: string;
  description?: string;
  director?: string;
  directorEmail?: string;
  staffCount: number;
  unitNames: string[];
}

export interface UseDivisionDataReturn {
  division: DivisionInfo | null;
  userContext: UserContext;
  tasks: Task[];
  projects: Project[];
  kras: Kra[];
  kpis: Kpi[];
  objectives: Objective[];
  combinedKras: KRA[];
  staff: { name: string; email: string; unit: string; jobTitle: string }[];
  strategicObjectives: { id: string | number; title: string; description?: string; linkedDeliverable?: string }[];
  loading: boolean;
  error: Error | null;
  canEditStrategy: boolean;
  canViewStaffMetrics: boolean;
  refresh: () => void;
}

export function useDivisionData(divisionIdParam?: string): UseDivisionDataReturn {
  const { user } = useSupabaseAuth();
  const { profile: graphProfile } = useGraphProfile();
  const { user: roleUser } = useRoleBasedAuth();

  // Build user context (same as Unit.tsx)
  const userContext = useMemo<UserContext>(() => ({
    division: graphProfile?.officeLocation || user?.user_metadata?.divisionName || roleUser?.division_name || 'General',
    unit: graphProfile?.department || user?.user_metadata?.unitName || roleUser?.unit_name || 'General',
    email: graphProfile?.mail || user?.email || '',
    name: graphProfile?.displayName || user?.user_metadata?.full_name || user?.email || '',
    role: roleUser?.role_name,
  }), [user, graphProfile, roleUser]);

  // Resolve target division
  const targetDivisionName = divisionIdParam || userContext.division;

  // Build a division-scoped context for fetching
  const divisionContext = useMemo<UserContext>(() => ({
    ...userContext,
    division: targetDivisionName,
  }), [userContext, targetDivisionName]);

  // Live officer profiles — single source of truth for staff roster
  const { data: officerProfiles = [] } = useOfficerProfiles();

  // Fetch data with Division scope using existing hooks
  const taskState = useSharePointTasks(targetDivisionName, 'Division' as FilterScope, divisionContext);
  const projectState = useSharePointProjects(targetDivisionName, 'Division' as FilterScope, divisionContext);
  const kraState = useSharePointKRAs(targetDivisionName, 'Division' as FilterScope, divisionContext);
  const kpiState = useSharePointKPIs(targetDivisionName, divisionContext);
  const objectivesState = useSharePointObjectives(targetDivisionName, 'Division' as FilterScope, divisionContext);
  const { strategyData } = useStrategySharePoint();

  // Resolve division info from live profiles + static metadata
  const division = useMemo<DivisionInfo | null>(() => {
    const normalized = targetDivisionName?.toLowerCase() || '';
    const staticDiv = staticDivisions.find(d =>
      d.name.toLowerCase() === normalized ||
      d.name.toLowerCase().includes(normalized) ||
      normalized.includes(d.name.toLowerCase().replace(' division', ''))
    );

    // Prefer live profiles; fall back to static map
    const liveStaff = officerProfiles.filter(p => {
      const div = p.division?.toLowerCase() || '';
      return div.includes(normalized) || normalized.includes(div.replace(' division', ''));
    });

    const fallbackStaff = liveStaff.length === 0
      ? DivisionStaffMap.getAllStaff().filter(s => {
          const loc = s.office_location?.toLowerCase() || '';
          return loc.includes(normalized) || normalized.includes(loc.replace(' division', ''));
        })
      : [];

    const hasFallback = fallbackStaff.length > 0;

    const unitNames = Array.from(new Set(
      (hasFallback ? fallbackStaff.map(s => s.unit) : liveStaff.map(p => p.unit))
        .filter(u => u && u.toLowerCase().includes('unit'))
    )).sort();

    const isDirector = (title: string) =>
      title?.toLowerCase().includes('director') || title?.toLowerCase().includes('acting director');

    const director = hasFallback
      ? (() => { const s = fallbackStaff.find(x => isDirector(x.job_title)); return s ? { name: s.name, email: s.email } : undefined; })()
      : liveStaff.find(p => isDirector(p.jobTitle));

    const staffCount = hasFallback ? fallbackStaff.length : liveStaff.length;
    if (!staticDiv && staffCount === 0) return null;

    return {
      id: staticDiv?.id || targetDivisionName.toLowerCase().replace(/\s+/g, '-'),
      name: staticDiv?.name || targetDivisionName,
      code: staticDiv?.code || targetDivisionName.substring(0, 4).toUpperCase(),
      description: staticDiv?.description,
      director: director?.name,
      directorEmail: director?.email,
      staffCount,
      unitNames,
    };
  }, [targetDivisionName, officerProfiles]);

  // Get staff list for this division — live profiles first, static map as fallback
  const staff = useMemo(() => {
    const normalized = targetDivisionName?.toLowerCase() || '';

    const liveStaff = officerProfiles.filter(p => {
      const div = p.division?.toLowerCase() || '';
      return div.includes(normalized) || normalized.includes(div.replace(' division', ''));
    });

    if (liveStaff.length > 0) {
      return liveStaff.map(p => ({
        name: p.name,
        email: p.email,
        unit: p.unit,
        jobTitle: p.jobTitle,
      }));
    }

    // Fallback to static map
    return DivisionStaffMap.getAllStaff()
      .filter(s => {
        const loc = s.office_location?.toLowerCase() || '';
        return loc.includes(normalized) || normalized.includes(loc.replace(' division', ''));
      })
      .map(s => ({
        name: s.name,
        email: s.email,
        unit: s.unit,
        jobTitle: s.job_title,
      }));
  }, [targetDivisionName, officerProfiles]);

  // Combine KRAs and KPIs for Overview charts (same pattern as Unit.tsx)
  const combinedKras = useMemo<KRA[]>(() => {
    const kras = kraState.data || [];
    const kpis = kpiState.data || [];
    const objectives = objectivesState.data || [];

    const kpisByKraId = kpis.reduce((acc, kpi) => {
      const kraId = kpi.kra_id;
      if (kraId) {
        if (!acc[kraId]) acc[kraId] = [];
        acc[kraId].push(kpi);
      }
      return acc;
    }, {} as Record<string | number, Kpi[]>);

    return kras.map((kra): KRA => {
      const objective = objectives.find(o => String(o.id) === String(kra.objective_id));
      const kraKpis = kpisByKraId[kra.id] || [];

      let mappedStatus: 'open' | 'in-progress' | 'closed' = 'open';
      const normalizedStatus = kra.status?.toLowerCase() || '';
      if (['completed', 'closed', 'done'].includes(normalizedStatus)) mappedStatus = 'closed';
      else if (['on-track', 'at-risk', 'off-track', 'in-progress'].includes(normalizedStatus)) mappedStatus = 'in-progress';

      return {
        id: kra.id.toString(),
        name: kra.title,
        objectiveId: kra.objective_id?.toString() ?? '',
        objectiveName: objective?.title ?? 'N/A',
        department: kra.department ?? 'N/A',
        responsible: kra.owner?.name ?? 'N/A',
        startDate: kra.startDate ? new Date(kra.startDate) : new Date(),
        endDate: kra.targetDate ? new Date(kra.targetDate) : new Date(),
        progress: (kra as any).progress || 0,
        status: mappedStatus,
        kpis: kraKpis.map(k => ({
          ...k,
          id: k.id.toString(),
          date: k.startDate ? new Date(k.startDate) : new Date(),
          notes: k.comments || '',
          target: k.target.toString(),
          actual: k.actual?.toString() || '0',
          status: (['on-track', 'at-risk', 'behind', 'completed'].includes(k.status)) ? k.status as 'on-track' | 'at-risk' | 'behind' | 'completed' : 'on-track',
        })) as unknown as KPI[],
        createdAt: kra.createdAt ?? new Date().toISOString(),
        updatedAt: kra.updatedAt ?? new Date().toISOString(),
        title: kra.title,
        objective_id: kra.objective_id,
        unit: kra.unit,
        unitId: kra.unitId,
        targetDate: kra.targetDate,
        unitKpis: kraKpis,
        owner: kra.owner,
        ownerId: kra.ownerId,
        unitObjectives: objective ? { title: objective.title } : null,
      };
    });
  }, [kraState.data, kpiState.data, objectivesState.data]);

  // Strategic objectives for dropdowns
  const strategicObjectives = useMemo(() => {
    return (strategyData.objectives || []).map(obj => ({
      id: obj.id,
      title: obj.title,
      description: obj.description,
      linkedDeliverable: (obj as any).linkedDeliverable as string | undefined,
    }));
  }, [strategyData.objectives]);

  // Permissions
  const canEditStrategy = useMemo(() => {
    const role = roleUser?.role_name?.toLowerCase();
    return roleUser?.is_admin || role === 'super_admin' || role === 'admin' || role === 'manager';
  }, [roleUser]);

  const canViewStaffMetrics = useMemo(() => {
    const role = roleUser?.role_name?.toLowerCase();
    return roleUser?.is_admin || role === 'super_admin' || role === 'admin' || role === 'manager';
  }, [roleUser]);

  // Loading & Error
  const loading = objectivesState.loading || taskState.loading || projectState.loading || kraState.loading || kpiState.loading;
  const error = objectivesState.error || taskState.error || projectState.error || kraState.error || kpiState.error;

  // Refresh
  const refresh = () => {
    objectivesState.refresh();
    kraState.refresh?.();
    kpiState.refresh?.();
    taskState.refresh?.();
    projectState.refresh?.();
  };

  return {
    division,
    userContext: divisionContext,
    tasks: taskState.data || [],
    projects: projectState.data || [],
    kras: kraState.data || [],
    kpis: kpiState.data || [],
    objectives: objectivesState.data || [],
    combinedKras,
    staff,
    strategicObjectives,
    loading,
    error,
    canEditStrategy,
    canViewStaffMetrics,
    refresh,
  };
}
