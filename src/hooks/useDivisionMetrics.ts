import { useMemo } from 'react';
import { Task, Project, KRA } from '@/types';
import { DivisionMetrics, UnitComparisonData } from '@/types/division.types';
import { UseDivisionDataReturn } from './useDivisionData';

export function useDivisionMetrics(data: UseDivisionDataReturn): DivisionMetrics {
  return useMemo(() => {
    const { tasks, projects, combinedKras: kras, kpis, staff, division } = data;

    // Task metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const overdueTasks = tasks.filter(t => {
      if (t.status === 'completed' || t.status === 'done') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    }).length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // KRA metrics
    const activeKRAs = kras.filter(k => k.status === 'in-progress' || k.status === 'open').length;
    const completedKRAs = kras.filter(k => k.status === 'closed').length;
    const atRiskKRAs = kras.filter(k => {
      const s = (k as any).status?.toLowerCase?.() || k.status;
      return s === 'at-risk' || s === 'off-track';
    }).length;

    // KPI metrics
    const totalKPIs = kpis.length;
    const onTrackKPIs = kpis.filter(k =>
      k.status === 'on-track' || k.status === 'completed' || k.status === 'in-progress'
    ).length;
    const kpiOnTrackPercentage = totalKPIs > 0 ? Math.round((onTrackKPIs / totalKPIs) * 100) : 0;

    // Project metrics
    const activeProjects = projects.filter(p => p.status === 'in-progress' || p.status === 'planned').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const overdueProjects = projects.filter(p => {
      if (p.status === 'completed') return false;
      return new Date(p.endDate) < new Date();
    }).length;

    // Staff metrics
    const staffCount = staff.length || division?.staffCount || 0;
    const averageTasksPerPerson = staffCount > 0 ? Math.round(totalTasks / staffCount) : 0;

    // Strategic alignment: percentage of KRAs that have an objective linked
    const krasWithObjective = kras.filter(k => k.objectiveId && k.objectiveId !== '').length;
    const strategicAlignmentScore = kras.length > 0 ? Math.round((krasWithObjective / kras.length) * 100) : 0;

    // Overall performance score (weighted average)
    const overallPerformanceScore = Math.round(
      (taskCompletionRate * 0.3) +
      (kpiOnTrackPercentage * 0.3) +
      (strategicAlignmentScore * 0.2) +
      ((activeProjects > 0 ? ((completedProjects / (activeProjects + completedProjects)) * 100) : 0) * 0.2)
    );

    // Unit comparisons
    const unitNames = division?.unitNames || [];
    const unitComparisons: UnitComparisonData[] = unitNames.map(unitName => {
      const unitStaff = staff.filter(s => s.unit === unitName);
      const unitTasks = tasks.filter(t => {
        // Match by assignee emails from this unit
        const unitEmails = unitStaff.map(s => s.email.toLowerCase());
        const assigneeEmail = t.assignee?.toLowerCase() || t.assignedTo?.toLowerCase() || '';
        return unitEmails.includes(assigneeEmail) ||
          t.assignees?.some(a => unitEmails.includes(a.email?.toLowerCase() || ''));
      });
      const unitKras = kras.filter(k => {
        const kraUnit = (k as any).unit?.toLowerCase() || k.department?.toLowerCase() || '';
        return kraUnit.includes(unitName.toLowerCase()) || unitName.toLowerCase().includes(kraUnit);
      });

      const unitCompletedTasks = unitTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
      const unitTaskCompletion = unitTasks.length > 0 ? Math.round((unitCompletedTasks / unitTasks.length) * 100) : 0;
      const unitKraProgress = unitKras.length > 0
        ? Math.round(unitKras.reduce((sum, k) => sum + (k.progress || 0), 0) / unitKras.length)
        : 0;

      return {
        unitId: unitName.toLowerCase().replace(/\s+/g, '-'),
        unitName,
        taskCompletion: unitTaskCompletion,
        kraProgress: unitKraProgress,
        kpiOnTrack: kpiOnTrackPercentage, // Approximation at division level
        projectHealth: 75, // Placeholder - would need per-unit project data
        staffCount: unitStaff.length,
        overallScore: Math.round((unitTaskCompletion + unitKraProgress) / 2),
      };
    });

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      taskCompletionRate,
      activeKRAs,
      completedKRAs,
      atRiskKRAs,
      kpiOnTrackPercentage,
      totalKPIs,
      activeProjects,
      completedProjects,
      overdueProjects,
      staffCount,
      staffOnLeave: 0, // Would need HR data
      averageTasksPerPerson,
      strategicAlignmentScore,
      overallPerformanceScore,
      unitComparisons,
    };
  }, [data]);
}
