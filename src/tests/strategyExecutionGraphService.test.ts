import { describe, it, expect } from 'vitest';
import {
  buildStrategyExecutionGraph,
  legacyToPerformanceRecords,
  selectDivisionFirst,
  selectDiagnostics,
  performanceLabel,
  remapDivisionUnit,
  UNLINKED_GOAL_ID,
} from '../services/strategyExecutionGraphService';
import type { PerformanceRecord, StrategyGoalNode } from '../types/strategyExecution';
import type { StrategicGoal, Task } from '../types';

// --- fixtures --------------------------------------------------------------

const goal = (id: string, title: string, extra: Partial<StrategicGoal> = {}): StrategicGoal => ({
  id,
  title,
  ...extra,
});

const rec = (id: string, extra: Partial<PerformanceRecord> = {}): PerformanceRecord => ({
  id,
  title: `Record ${id}`,
  ...extra,
});

const task = (id: string, kpiId: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: `Task ${id}`,
  description: '',
  status: 'todo',
  priority: 'medium',
  assignee: 'A',
  dueDate: '2026-01-01',
  kpi_id: kpiId,
  ...extra,
});

// Find a node in the recursive tree by id.
function findNode(goals: StrategyGoalNode[], id: string): any {
  const walk = (nodes: any[]): any => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const hit = walk(n.children || []);
      if (hit) return hit;
    }
    return null;
  };
  for (const g of goals) {
    const hit = walk(g.performanceRoots || []);
    if (hit) return hit;
  }
  return null;
}

describe('strategyExecutionGraphService (role-recursive)', () => {
  it('builds the role-recursive chain Goal -> Director -> Manager -> Officer -> Task', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Improve Regulatory Compliance')],
      performanceRecords: [
        rec('d1', { ownerEmail: 'director@x', ownerRole: 'director', parentStrategicGoalId: 'g1', division: 'Legal', unit: 'Compliance' }),
        rec('m1', { ownerEmail: 'manager@x', ownerRole: 'manager', parentId: 'd1' }),
        rec('o1', { ownerEmail: 'officer@x', ownerRole: 'officer', parentId: 'm1', calculationType: 'task-completion' }),
      ],
      tasks: [task('t1', 'o1', { status: 'completed', completed: true })],
    });

    const g = graph.goals.find((x) => x.id === 'g1')!;
    const director = g.performanceRoots![0];
    expect(director.id).toBe('d1');
    const manager = director.children[0];
    expect(manager.id).toBe('m1');
    const officer = manager.children[0];
    expect(officer.id).toBe('o1');
    expect(officer.tasks[0].id).toBe('t1');

    // 1/1 task done rolls all the way up to the goal
    expect(officer.progress?.value).toBe(100);
    expect(manager.progress?.value).toBe(100);
    expect(director.progress?.value).toBe(100);
    expect(g.progress?.value).toBe(100);
  });

  it('derives the KRA/KPI label from the viewer (duality)', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [
        rec('m1', { ownerEmail: 'manager@x', ownerRole: 'manager', parentStrategicGoalId: 'g1' }),
        rec('o1', { ownerEmail: 'officer@x', ownerRole: 'officer', parentId: 'm1' }),
      ],
    });
    const manager = findNode(graph.goals, 'm1');
    const officer = findNode(graph.goals, 'o1');

    // The officer record: KPI to the officer, KRA to the manager who assigned it.
    expect(performanceLabel(officer, 'officer@x', manager)).toBe('KPI');
    expect(performanceLabel(officer, 'manager@x', manager)).toBe('KRA');
    expect(performanceLabel(officer, 'someone@else', manager)).toBe('KRA/KPI');
  });

  it('flags officers that wrongly have child KRAs (hard stop)', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [
        rec('o1', { ownerRole: 'officer', parentStrategicGoalId: 'g1' }),
        rec('x1', { ownerRole: 'officer', parentId: 'o1' }), // illegal child under an officer
      ],
    });
    expect(graph.diagnostics.some((d) => d.id === 'officer-with-children:o1')).toBe(true);
  });

  it('distinguishes 0% no_linked_data from 0% not_started', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [
        rec('a', { ownerRole: 'officer', parentStrategicGoalId: 'g1', calculationType: 'task-completion' }),
        rec('b', { ownerRole: 'officer', parentStrategicGoalId: 'g1', calculationType: 'task-completion' }),
      ],
      tasks: [task('t1', 'a', { status: 'todo' })], // linked but not done -> not_started
    });
    const withData = findNode(graph.goals, 'a');
    expect(withData.progress?.value).toBe(0);
    expect(withData.progress?.statusBand).toBe('not_started');
    expect(withData.progress?.hasLinkedData).toBe(true);

    const noData = findNode(graph.goals, 'b'); // no tasks -> no_linked_data
    expect(noData.progress?.statusBand).toBe('no_linked_data');
    expect(noData.progress?.hasLinkedData).toBe(false);
  });

  it('surfaces broken parent links and records without a goal', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [
        rec('a', { ownerRole: 'manager', parentId: 'ghost' }), // parent missing
        rec('b', { ownerRole: 'director' }), // no goal, no parent
      ],
    });
    const unlinked = graph.goals.find((g) => g.id === UNLINKED_GOAL_ID)!;
    expect(unlinked.performanceRoots!.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(graph.diagnostics.some((d) => d.id === 'broken-parent:a')).toBe(true);
    expect(graph.diagnostics.some((d) => d.id === 'record-without-goal:b')).toBe(true);
  });

  it('uses weighted rollup when child weights exist', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [
        rec('m1', { ownerRole: 'manager', parentStrategicGoalId: 'g1' }),
        rec('o1', { ownerRole: 'officer', parentId: 'm1', weight: 3, status: 'completed' }), // 100
        rec('o2', { ownerRole: 'officer', parentId: 'm1', weight: 1, calculationType: 'task-completion' }), // 0 (no tasks)
      ],
    });
    const manager = findNode(graph.goals, 'm1');
    // weighted: (100*3 + 0*1)/4 = 75
    expect(manager.progress?.value).toBe(75);
    expect(manager.progress?.source).toBe('weighted');
  });

  it('applies the Executive Division -> Office of the Chairman remap', () => {
    expect(remapDivisionUnit('Executive Division', '')).toEqual({
      division: 'Office of the Chairman',
      unit: 'Executive Division',
    });
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [rec('d1', { ownerRole: 'director', parentStrategicGoalId: 'g1', division: 'Executive Division' })],
    });
    const divisions = selectDivisionFirst(graph);
    expect(divisions.some((d) => d.title === 'Office of the Chairman')).toBe(true);
    expect(divisions.some((d) => d.title === 'Executive Division')).toBe(false);
  });

  it('pre-seeds empty divisions/units from the structure', () => {
    const graph = buildStrategyExecutionGraph({
      divisionStructure: { 'Corporate Services': ['Finance', 'HR'] },
    });
    const div = selectDivisionFirst(graph).find((d) => d.title === 'Corporate Services')!;
    expect(div.units.map((u) => u.title).sort()).toEqual(['Finance', 'HR']);
    expect(div.progress?.statusBand).toBe('no_linked_data');
  });

  it('legacy adapter maps the 3 lists into a parentId chain', () => {
    const records = legacyToPerformanceRecords({
      strategicGoals: [goal('g1', 'Goal')],
      unitObjectives: [{ id: 'o1', title: 'Obj', goalType: 'unit', parentGoalId: 'g1', division: 'D', unit: 'U' } as any],
      performanceKras: [{ id: 'k1', title: 'KRA', objective_id: 'o1' } as any],
      kpis: [{ id: 'p1', name: 'KPI', kra_id: 'k1', target: 100, status: 'in-progress', level: 'staff' } as any],
    });
    const byId = Object.fromEntries(records.map((r) => [r.id, r]));
    expect(byId['obj:o1'].parentStrategicGoalId).toBe('g1');
    expect(byId['kra:k1'].parentId).toBe('obj:o1');
    expect(byId['kpi:p1'].parentId).toBe('kra:k1');
    expect(byId['kpi:p1'].ownerRole).toBe('officer'); // staff -> officer
    expect(byId['obj:o1'].rolesInferred).toBe(true);
  });

  it('normalizes "none"/null parent ids (no false links)', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [
        rec('a', { ownerRole: 'director', parentStrategicGoalId: 'g1' }),
        rec('b', { ownerRole: 'manager', parentId: 'none' as any }),
        rec('c', { ownerRole: 'manager', parentId: null }),
      ],
    });
    // b and c are treated as roots (no valid parent), not children of anything
    expect(findNode(graph.goals, 'a').children).toHaveLength(0);
    const unlinked = graph.goals.find((g) => g.id === UNLINKED_GOAL_ID)!;
    expect(unlinked.performanceRoots!.map((n) => n.id).sort()).toEqual(['b', 'c']);
  });

  it('places every performance node and task in the lookups', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [
        rec('d1', { ownerRole: 'director', parentStrategicGoalId: 'g1' }),
        rec('o1', { ownerRole: 'officer', parentId: 'd1', calculationType: 'task-completion' }),
      ],
      tasks: [task('t1', 'o1')],
    });
    expect(Object.keys(graph.lookups.goalsById)).toContain('g1');
    expect(Object.keys(graph.lookups.performanceRecordsById!)).toEqual(expect.arrayContaining(['d1', 'o1']));
    expect(Object.keys(graph.lookups.tasksById)).toContain('t1');
  });

  it('filters diagnostics by minimum severity', () => {
    const graph = buildStrategyExecutionGraph({
      strategicGoals: [goal('g1', 'Goal')],
      performanceRecords: [rec('a', { ownerRole: 'manager', parentId: 'ghost' })],
    });
    const warnings = selectDiagnostics(graph, 'warning');
    expect(warnings.every((d) => d.severity === 'warning' || d.severity === 'error')).toBe(true);
    expect(selectDiagnostics(graph, 'info').length).toBeGreaterThanOrEqual(warnings.length);
  });
});
