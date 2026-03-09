import { useState, useCallback } from 'react';
import { WorkPlan, WorkPlanGoal, WorkPlanActivity } from '@/types/division.types';

function storageKey(divisionId: string) {
  return `scpng_workplans_${divisionId}`;
}

function buildDemoWorkPlan(divisionName: string): WorkPlan {
  const planId = 'wp-demo-1';
  const year = new Date().getFullYear() + 1;
  return {
    id: planId,
    title: `${divisionName} Annual Work Plan ${year}`,
    description: 'Annual strategic deliverables and operational targets.',
    divisionId: 'demo',
    divisionName,
    organization: 'Securities Commission of Papua New Guinea',
    preparedBy: divisionName,
    planningPeriodLabel: `January – December ${year}`,
    mandate: `Provide administrative, financial, human resource, procurement, and ICT support services to ensure the organization operates efficiently, transparently, and in compliance with internal policies and national regulations.`,
    monitoringAndReporting: `Progress against this work plan will be reviewed monthly by the Division Head and reported quarterly to senior management. Key performance indicators will be used to assess completion of activities and identify areas requiring corrective action.`,
    reviewFrequency: 'monthly',
    reportingTo: 'Senior Management',
    status: 'active',
    timePeriod: 'annual',
    year,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    goals: [
      {
        id: 'g-demo-1',
        workPlanId: planId,
        title: 'Strengthen financial management and accountability',
        description: '',
        responsibleUnitIds: ['finance'],
        responsibleUnitNames: ['Finance Unit'],
        activities: [
          {
            id: 'a-demo-1',
            goalId: 'g-demo-1',
            title: 'Prepare annual financial statements',
            description: '',
            assignedUnitId: 'finance',
            assignedUnitName: 'Finance Unit',
            responsiblePersonName: 'Finance Manager',
            startDate: `${year}-01-01`,
            endDate: `${year}-03-31`,
            expectedOutput: 'Audited financial report',
            kpiDescription: 'Report submitted before deadline',
            resourcesRequired: 'Finance staff, accounting software',
            linkedTaskIds: [],
            status: 'not-started',
            progress: 0,
            order: 0,
          } as WorkPlanActivity,
        ],
        progress: 0,
        status: 'not-started',
        order: 0,
      } as WorkPlanGoal,
      {
        id: 'g-demo-2',
        workPlanId: planId,
        title: 'Improve human resource management and staff development',
        description: '',
        responsibleUnitIds: ['hr'],
        responsibleUnitNames: ['HR Unit'],
        activities: [
          {
            id: 'a-demo-2',
            goalId: 'g-demo-2',
            title: 'Conduct staff training program',
            description: '',
            assignedUnitId: 'hr',
            assignedUnitName: 'HR Unit',
            responsiblePersonName: 'HR Manager',
            startDate: `${year}-04-01`,
            endDate: `${year}-08-31`,
            expectedOutput: '3 training workshops completed',
            kpiDescription: 'At least 80% staff participation',
            resourcesRequired: 'Training budget, external trainers',
            linkedTaskIds: [],
            status: 'not-started',
            progress: 0,
            order: 0,
          } as WorkPlanActivity,
        ],
        progress: 0,
        status: 'not-started',
        order: 1,
      } as WorkPlanGoal,
    ],
    overallProgress: 0,
    createdBy: 'System',
    createdByEmail: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function useWorkPlans(divisionId: string, divisionName: string) {
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>(() => {
    if (!divisionId) return [];
    try {
      const raw = localStorage.getItem(storageKey(divisionId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [buildDemoWorkPlan(divisionName)];
  });

  const persist = useCallback(
    (plans: WorkPlan[]) => {
      setWorkPlans(plans);
      if (divisionId) {
        try {
          localStorage.setItem(storageKey(divisionId), JSON.stringify(plans));
        } catch {
          // ignore quota errors
        }
      }
    },
    [divisionId],
  );

  const addWorkPlan = useCallback(
    (plan: WorkPlan) => persist([plan, ...workPlans]),
    [workPlans, persist],
  );

  const updateWorkPlan = useCallback(
    (id: string, updates: Partial<WorkPlan>) =>
      persist(
        workPlans.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
        ),
      ),
    [workPlans, persist],
  );

  const deleteWorkPlan = useCallback(
    (id: string) => persist(workPlans.filter(p => p.id !== id)),
    [workPlans, persist],
  );

  const getWorkPlan = useCallback(
    (id: string) => workPlans.find(p => p.id === id) ?? null,
    [workPlans],
  );

  return { workPlans, addWorkPlan, updateWorkPlan, deleteWorkPlan, getWorkPlan };
}
