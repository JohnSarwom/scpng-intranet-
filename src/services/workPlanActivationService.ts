import type { KpiMeasurementDefinition } from '../types';
import type {
  WorkPlan, WorkPlanGoal, WorkPlanActivity, WorkPlanKra, WorkPlanTarget, WorkPlanRetirementAction,
  WorkPlanRetirementImpact, WorkPlanRetirementRecord, WorkPlanRetirementRequest,
  WorkPlanStructureKind, WorkPlanStructureRetirementImpact, WorkPlanStructureRetirementRecord,
  WorkPlanStructureRetirementRequest,
} from '../types/division.types';
import { WorkPlanStorageService } from './workPlanStorageService';

type Item = { id: string; eTag?: string; fields: Record<string, any> };
type Lists = Record<string, string>;
type Journal = { version: 1; token: string; signature: string; state: 'running' | 'failed' | 'complete'; leaseUntil: number; error?: string };
type RetirementOperation = {
  version: 1;
  entityKind: 'activity';
  operationId: string;
  signature: string;
  state: 'running' | 'failed';
  leaseUntil: number;
  completedSteps: string[];
  reason: string;
  impact: WorkPlanRetirementImpact;
  activitySnapshot: WorkPlanActivity;
  performedBy?: WorkPlanRetirementRequest['performedBy'];
  error?: string;
};
type StructureRetirementOperation = {
  version: 1;
  entityKind: WorkPlanStructureKind;
  operationId: string;
  signature: string;
  state: 'running' | 'failed';
  leaseUntil: number;
  completedSteps: string[];
  reason: string;
  impact: WorkPlanStructureRetirementImpact;
  sourceSnapshot: WorkPlanGoal | WorkPlanKra;
  performedBy?: WorkPlanStructureRetirementRequest['performedBy'];
  error?: string;
};
type RetirementStore = {
  version: 1;
  history: Array<WorkPlanRetirementRecord | WorkPlanStructureRetirementRecord>;
  operation?: RetirementOperation | StructureRetirementOperation;
};
const KEY = 'WorkPlanOperationKey';
const META = 'WorkPlanMetadataJSON';
const MEASUREMENT_DEFINITION = 'MeasurementDefinitionJSON';
const MEASUREMENT_EVIDENCE = 'MeasurementEvidenceJSON';
const STATE = 'ActivationJSON';
const RETIREMENT = 'RetirementJSON';
const RETIRED = 'IsRetired';
const NAMES = { plans: 'Division_WorkPlans', objectives: 'Unit_Objectives', kras: 'Performance_KRAs', kpis: 'Performance_KPIs', tasks: 'Operations_Tasks', legacy: 'Strategic_Objectives', corporate: 'Strategic_Goals' };
export interface WorkPlanMappingOptions {
  goals: Array<{ id: string; title: string; list: 'Strategic_Goals' | 'Strategic_Objectives' }>;
  objectives: Array<{ id: string; title: string; parentId: string }>;
  kras: Array<{ id: string; title: string; objectiveId: string }>;
  tasks: Array<{ id: string; title: string; kpiId?: string }>;
}

/** All writes are called behind SharePointOpsService's authoritative access check. */
export class WorkPlanActivationService {
  private lists: Lists = {};
  private storage: WorkPlanStorageService;
  constructor(private client: any, private siteId: string) { this.storage = new WorkPlanStorageService(client, siteId); }
  private url(list: string, suffix = '') { return `/sites/${this.siteId}/lists/${this.lists[list]}${suffix}`; }
  private async all(url: string): Promise<any[]> {
    const result: any[] = [];
    const seen = new Set<string>();
    while (url) {
      if (seen.has(url)) throw new Error('Repeated SharePoint continuation link.');
      seen.add(url);
      const page = await this.client.api(url).get();
      result.push(...(page.value || []));
      url = page['@odata.nextLink'];
    }
    return result;
  }
  private async discover() {
    const lists = await this.all(`/sites/${this.siteId}/lists?$select=id,displayName`);
    for (const [key, name] of Object.entries(NAMES)) {
      const matches = lists.filter(list => list.displayName === name);
      if (matches.length !== 1 && key !== 'corporate') throw new Error(`Expected exactly one ${name} list.`);
      if (matches.length === 1) this.lists[key] = matches[0].id;
    }
  }
  private async item(list: string, id: string): Promise<Item> {
    if (!this.lists[list] || !/^[1-9]\d*$/.test(String(id))) throw new Error(`Invalid ${list} reference: ${id}`);
    return this.client.api(this.url(list, `/items/${id}?$expand=fields`)).get();
  }
  private etag(item: Item) {
    if (!item.eTag) throw new Error('SharePoint did not return an item version. Reload before writing.');
    return item.eTag;
  }
  private async patch(list: string, item: Item, fields: Record<string, any>) {
    await this.client.api(this.url(list, `/items/${item.id}/fields`)).header('If-Match', this.etag(item)).patch(fields);
    return this.item(list, item.id);
  }
  private json<T>(text: string | undefined, fallback: T): T {
    if (!text) return fallback;
    try { return JSON.parse(text); } catch { throw new Error('Work-plan JSON is invalid; repair it before activation.'); }
  }
  private norm(value: unknown) { return String(value || '').trim().toLowerCase(); }
  private measurementDefinition(target: WorkPlanTarget): KpiMeasurementDefinition {
    const frequency = this.norm(target.frequency || target.rawText);
    const unit = this.norm(target.unit);
    const mode = target.measurementMode ||
      (target.serviceLevel ? 'service-level' :
        target.population ? 'population' :
          target.milestoneWindow ? 'milestone' :
            frequency.includes('as required') ? 'as-required' :
              frequency.includes('continuous') ? 'continuous' :
                target.timeAllowance || (target.operator === 'at-most' && /(day|hour|minute|week)/.test(unit)) ? 'duration-at-most' :
                  target.frequency && target.quantity !== undefined ? 'recurrence' :
                    /%|percent/.test(unit) ? 'percentage' : 'count');
    return {
      mode,
      rawTarget: target.rawText,
      operator: target.operator,
      target: target.quantity,
      unit: target.unit,
      population: target.population,
      frequency: target.frequency,
      serviceLevel: target.serviceLevel,
      timeAllowance: target.timeAllowance,
      milestoneWindow: target.milestoneWindow,
    };
  }
  private definitions(list: string): any[] {
    const text = (name: string, multiline = false) => ({ name, text: { allowMultipleLines: multiline, maxLength: multiline ? undefined : 255 } });
    return list === 'plans' ? [text(STATE, true), text(RETIREMENT, true), text('GoalsJSON', true), { ...text('LegacyImportKey'), indexed: true, enforceUniqueValues: true }] : [
      { ...text(KEY), indexed: true, enforceUniqueValues: true }, text(META, true), text(RETIREMENT, true), { name: RETIRED, boolean: {} },
      ...(list === 'kpis' ? [text('KpiOwner', true), text('Assignees', true), text(MEASUREMENT_DEFINITION, true), text(MEASUREMENT_EVIDENCE, true)] : []),
      ...(list === 'kras' ? [text('Unit'), text('Division')] : []),
      ...(list === 'tasks' ? [text('Assignees', true)] : []),
    ];
  }

  /** Read-only readiness, including actual lookup targets. No automatic provisioning. */
  async readiness(): Promise<string[]> {
    await this.discover();
    const errors: string[] = [];
    const columns: Record<string, any[]> = {};
    for (const list of ['plans', 'objectives', 'kras', 'kpis', 'tasks']) {
      columns[list] = await this.all(this.url(list, '/columns'));
      for (const expected of this.definitions(list)) {
        const actual = columns[list].find(column => column.name === expected.name);
        if (!actual || (expected.text && (!actual.text || (expected.text.allowMultipleLines && !actual.text.allowMultipleLines))) ||
            (expected.boolean && !actual.boolean) ||
            (expected.enforceUniqueValues && (!actual.enforceUniqueValues || !actual.indexed))) {
          errors.push(`${NAMES[list as keyof typeof NAMES]}.${expected.name} requires schema preparation.`);
        }
      }
    }
    const required: Record<string, string[]> = {
      plans: ['GoalsJSON', 'Status', 'DivisionName'],
      objectives: ['Title', 'Description', 'Division', 'Unit', 'GoalType', 'Status', 'Progress', 'Year', 'StartDate', 'EndDate'],
      kras: ['Title', 'Description', 'Division', 'Unit', 'Status', 'Progress'],
      kpis: ['Title', 'Description', 'Metric', 'TargetValue', 'ActualValue', 'Status', 'CalculationType', 'KpiOwner', 'Assignees'],
      tasks: ['Title', 'Description', 'Status', 'Priority', 'Department', 'Assignees', 'StartDate', 'DueDate'],
    };
    for (const [list, names] of Object.entries(required)) for (const name of names) {
      if (!columns[list].some(column => column.name === name)) errors.push(`${NAMES[list as keyof typeof NAMES]}.${name} is missing.`);
    }
    for (const [list, field] of [['objectives', 'Progress'], ['kras', 'Progress'], ['kpis', 'TargetValue'], ['kpis', 'ActualValue']]) {
      if (!columns[list].find(column => column.name === field)?.number) errors.push(`${NAMES[list as keyof typeof NAMES]}.${field} must be numeric.`);
    }
    for (const [list, field, parent] of [['objectives', 'ParentGoalId', 'legacy'], ['kras', 'UnitObjective', 'objectives'], ['kpis', 'RelatedKRA', 'kras'], ['tasks', 'RelatedKPI', 'kpis'], ['tasks', 'RelatedKRA', 'kras']]) {
      const lookup = columns[list].find(column => column.name === field)?.lookup;
      if (!lookup || this.norm(lookup.listId) !== this.norm(this.lists[parent]) || lookup.allowMultipleValues) errors.push(`${NAMES[list as keyof typeof NAMES]}.${field} has the wrong lookup target or cardinality.`);
    }
    for (const [list, choices] of [['objectives', ['Not Started']], ['kras', ['Open']], ['kpis', ['Not Started']], ['tasks', ['Not Started']]] as const) {
      const actual = columns[list].find(column => column.name === 'Status')?.choice?.choices || [];
      if (choices.some(choice => !actual.includes(choice))) errors.push(`${NAMES[list]}.Status lacks ${choices.join(', ')}.`);
    }
    return [...errors, ...await this.storage.readiness()];
  }

  /** Explicit admin operation; adds only engine columns and missing status choices. */
  async prepareSchema(): Promise<string[]> {
    await this.discover();
    for (const list of ['plans', 'objectives', 'kras', 'kpis', 'tasks']) {
      const columns = await this.all(this.url(list, '/columns'));
      for (const definition of this.definitions(list)) {
        if (!columns.some(column => column.name === definition.name)) {
          await this.client.api(this.url(list, '/columns')).post(definition);
        }
      }
      const status = columns.find(column => column.name === 'Status');
      const required = list === 'kras' ? 'Open' : 'Not Started';
      if (list !== 'plans' && status?.choice && !status.choice.choices.includes(required)) {
        await this.client.api(this.url(list, `/columns/${status.id}`)).patch({ choice: { ...status.choice, choices: [...status.choice.choices, required] } });
      }
    }
    await this.storage.prepare();
    return this.readiness();
  }

  private key(planId: string, kind: string, id: string) {
    const key = `wp:${planId}:${kind}:${encodeURIComponent(id)}`;
    if (key.length > 255) throw new Error('A source identifier is too long for a durable activation key.');
    return key;
  }
  private async signature(plan: WorkPlan) {
    const ignored = new Set(['linkedObjectiveId', 'linkedObjectiveTitle', 'executionObjectiveRef', 'linkedKraId', 'linkedKpiId', 'linkedTaskIds', 'workPlanId', 'progress', 'status', 'updatedAt']);
    const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().filter(key => !ignored.has(key)).map(key => [key, canonical(value[key])])) : value;
    // Task links are intent, except the task generated by this engine.
    const tasks = plan.goals.flatMap(goal => goal.activities.map(activity => [activity.id, activity.taskPolicy === 'create-task' ? [] : activity.linkedTaskIds]));
    const bytes = new TextEncoder().encode(JSON.stringify({ year: plan.year, division: plan.divisionName, start: plan.startDate, end: plan.endDate, goals: canonical(plan.goals), tasks }));
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  private async validate(plan: WorkPlan, previous: WorkPlanGoal[]) {
    if (!plan.goals.length) throw new Error('Add at least one divisional goal.');
    if (!Number.isFinite(Date.parse(plan.startDate)) || !Number.isFinite(Date.parse(plan.endDate)) || Date.parse(plan.startDate) > Date.parse(plan.endDate)) throw new Error('Set a valid work-plan date range.');
    const seen = new Set<string>();
    const executionIds = new Set<string>();
    const execution = (kind: string, id?: string) => {
      if (!id) return;
      const key = `${kind}:${id}`;
      if (executionIds.has(key)) throw new Error(`Execution record ${key} is mapped more than once.`);
      executionIds.add(key);
    };
    const unique = (kind: string, id: string) => {
      if (!id || seen.has(`${kind}:${id}`)) throw new Error(`Missing or duplicate ${kind} identifier: ${id}`);
      seen.add(`${kind}:${id}`);
      this.key(plan.id, kind, id);
    };
    const taskIds = new Set<string>();
    for (const goal of plan.goals) {
      unique('goal', goal.id);
      execution('objective', goal.linkedObjectiveId);
      const reference = goal.organizationalGoalRef;
      if (!reference) throw new Error(`Map organizational parent for ${goal.title}.`);
      const parent = reference.list === 'Strategic_Objectives' ? reference.id : goal.legacyStrategicObjectiveId;
      if (!parent) throw new Error(`Select an explicit legacy compatibility objective for ${goal.title}.`);
      await this.item('legacy', parent);
      if (reference.list === 'Strategic_Goals') await this.item('corporate', reference.id);
      if (goal.linkedObjectiveId) {
        if (goal.executionObjectiveRef?.id !== goal.linkedObjectiveId || goal.executionObjectiveRef.list !== 'Unit_Objectives') throw new Error(`Verify the execution objective for ${goal.title}.`);
        const objective = await this.item('objectives', goal.linkedObjectiveId);
        if (this.norm(objective.fields.Division) !== this.norm(plan.divisionName) || String(objective.fields.ParentGoalIdLookupId) !== parent) throw new Error(`Execution objective scope/parent mismatch for ${goal.title}.`);
      }
      if (!goal.kras?.length) throw new Error(`Define the source KRA sections for ${goal.title}; activities cannot be used as KRAs.`);
      for (const kra of goal.kras) {
        unique('kra', kra.id);
        execution('kra', kra.linkedKraId);
        if (!kra.title.trim()) throw new Error('A source KRA needs a title.');
        if (kra.linkedKraId) {
          const record = await this.item('kras', kra.linkedKraId);
          if (!goal.linkedObjectiveId || String(record.fields.UnitObjectiveLookupId) !== goal.linkedObjectiveId) throw new Error(`KRA parent mismatch: ${kra.title}.`);
        }
      }
      for (const activity of goal.activities) {
        unique('activity', activity.id);
        execution('kpi', activity.linkedKpiId);
        const kra = goal.kras.find(kra => kra.id === activity.sourceKraId);
        if (!kra || !activity.title.trim() || !activity.kpiDescription?.trim() || !activity.annualTarget?.rawText.trim()) throw new Error(`Complete the source KRA, activity, KPI and raw target for ${activity.id}.`);
        if (activity.annualTarget.quantity !== undefined && !Number.isFinite(activity.annualTarget.quantity)) throw new Error(`Invalid target quantity: ${activity.id}.`);
        if (activity.linkedKraId && activity.linkedKraId !== kra.linkedKraId) throw new Error(`Activity ${activity.id} requires an explicit KRA regrouping migration.`);
        if (activity.linkedKpiId) {
          const record = await this.item('kpis', activity.linkedKpiId);
          if (!kra.linkedKraId || String(record.fields.RelatedKRALookupId) !== kra.linkedKraId) throw new Error(`KPI parent mismatch: ${activity.id}.`);
          if (record.fields.TargetValue > 0 && activity.annualTarget.quantity !== record.fields.TargetValue) throw new Error(`Changing the active target for ${activity.id} requires a percentage-impact review.`);
        }
        if (!activity.linkedTaskIds.length && activity.taskPolicy !== 'create-task') throw new Error(`Link existing Tasks or choose Create Task for ${activity.id}.`);
        for (const taskId of activity.linkedTaskIds) {
          if (taskIds.has(taskId)) throw new Error(`Task ${taskId} is mapped to more than one activity.`);
          taskIds.add(taskId);
          const task = await this.item('tasks', taskId);
          if (task.fields.RelatedKPILookupId && String(task.fields.RelatedKPILookupId) !== activity.linkedKpiId) throw new Error(`Task ${taskId} already belongs to another KPI.`);
          if (task.fields.RelatedKRALookupId && String(task.fields.RelatedKRALookupId) !== kra.linkedKraId) throw new Error(`Task ${taskId} already belongs to another KRA.`);
        }
      }
    }
    // Retirements need a migration preview; never discard an activated record silently.
    for (const goal of previous) {
      if (goal.linkedObjectiveId && !plan.goals.some(next => next.id === goal.id)) throw new Error('Removing an activated goal requires a retirement review.');
      const next = plan.goals.find(next => next.id === goal.id);
      for (const kra of goal.kras || []) if (kra.linkedKraId && !next?.kras?.some(candidate => candidate.id === kra.id)) throw new Error('Removing an activated KRA requires a retirement review.');
      for (const activity of goal.activities) if ((activity.linkedKpiId || activity.linkedTaskIds.length) && !next?.activities.some(candidate => candidate.id === activity.id)) throw new Error('Removing or moving linked activity work requires a retirement review.');
      for (const activity of goal.activities) {
        const candidate = next?.activities.find(candidate => candidate.id === activity.id);
        if (candidate && activity.linkedTaskIds.some(id => !candidate.linkedTaskIds.includes(id))) throw new Error('Removing linked Tasks requires an unlinking review.');
      }
    }
  }

  async preview(plan: WorkPlan) {
    const errors = await this.readiness();
    if (errors.length) throw new Error(errors.join('\n'));
    const stored = await this.item('plans', plan.id);
    const previous = await this.storage.decode(stored.fields.GoalsJSON);
    await this.validate(plan, previous);
    return {
      goals: plan.goals.length,
      kras: plan.goals.reduce((n, goal) => n + (goal.kras?.length || 0), 0),
      activityKpis: plan.goals.reduce((n, goal) => n + goal.activities.length, 0),
      goalMeasures: plan.goals.reduce((n, goal) => n + (goal.goalMeasures?.length || 0), 0),
      tasksToCreate: plan.goals.flatMap(goal => goal.activities).filter(activity => !activity.linkedTaskIds.length && activity.taskPolicy === 'create-task').length,
      taskLinks: plan.goals.flatMap(goal => goal.activities).reduce((n, activity) => n + activity.linkedTaskIds.length, 0),
    };
  }

  async mappingOptions(divisionName: string): Promise<WorkPlanMappingOptions> {
    await this.discover();
    const read = (list: string) => this.lists[list] ? this.all(this.url(list, '/items?$expand=fields')) : Promise.resolve([]);
    const [legacy, corporate, objectives, kras, tasks] = await Promise.all(['legacy', 'corporate', 'objectives', 'kras', 'tasks'].map(read));
    const inDivision = (item: Item) => this.norm(item.fields.Division) === this.norm(divisionName);
    const scopedObjectives = objectives.filter(item => item.fields[RETIRED] !== true).filter(inDivision);
    const scopedKras = kras.filter(item => item.fields[RETIRED] !== true).filter(inDivision);
    const units = new Set([divisionName, ...scopedObjectives.map(item => item.fields.Unit), ...scopedKras.map(item => item.fields.Unit)].filter(Boolean).map(value => this.norm(value)));
    return {
      goals: [...legacy.map(item => ({ id: item.id, title: item.fields.Title, list: 'Strategic_Objectives' as const })), ...corporate.map(item => ({ id: item.id, title: item.fields.Title, list: 'Strategic_Goals' as const }))],
      objectives: scopedObjectives.map(item => ({ id: item.id, title: item.fields.Title, parentId: String(item.fields.ParentGoalIdLookupId || '') })),
      kras: scopedKras.map(item => ({ id: item.id, title: item.fields.Title, objectiveId: String(item.fields.UnitObjectiveLookupId || '') })),
      tasks: tasks.filter(item => units.has(this.norm(item.fields.Department))).map(item => ({ id: item.id, title: item.fields.Title, kpiId: item.fields.RelatedKPILookupId?.toString() })),
    };
  }

  private async digest(value: unknown) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(part => part.toString(16).padStart(2, '0')).join('');
  }

  private retirementStore(item: Item): RetirementStore {
    return this.json<RetirementStore>(item.fields[RETIREMENT], { version: 1, history: [] });
  }

  private completed(fields: Record<string, any>) {
    return ['completed', 'achieved', 'done'].includes(this.norm(fields.Status));
  }

  private kraProgress(items: Item[]) {
    return items.length ? Math.round(items.filter(item => this.completed(item.fields)).length / items.length * 100) : 0;
  }

  private evidenceCount(raw: unknown): number {
    if (!raw) return 0;
    let value: any = raw;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { return 1; }
    }
    const refs = new Set<string>();
    const visit = (entry: any) => {
      if (!entry) return;
      if (Array.isArray(entry)) return entry.forEach(visit);
      if (typeof entry !== 'object') return;
      for (const [key, child] of Object.entries(entry)) {
        if (/evidence(ref|refs)$/i.test(key)) {
          for (const ref of Array.isArray(child) ? child : [child]) if (ref) refs.add(String(ref));
        } else visit(child);
      }
    };
    visit(value);
    return refs.size || 1;
  }

  /**
   * Computes the exact impact of removing one activated activity. This is read-only:
   * callers must present this result to an operator before executeActivityRetirement.
   */
  async previewActivityRetirement(
    planId: string,
    activityId: string,
    action: WorkPlanRetirementAction,
    targetKraId?: string,
  ): Promise<WorkPlanRetirementImpact> {
    const errors = await this.readiness();
    if (errors.length) throw new Error(errors.join('\n'));
    if (!['retire', 'clear-links', 'reassign'].includes(action)) throw new Error('Choose a supported retirement action.');
    const stored = await this.item('plans', planId);
    const pending = this.retirementStore(stored).operation;
    if (pending?.entityKind === 'activity' && pending.impact.activityId === activityId && pending.impact.action === action &&
        pending.impact.targetKra?.id === targetKraId) {
      return pending.impact;
    }
    if (pending) throw new Error('Recover the interrupted retirement before reviewing another operation.');
    const goals = await this.storage.decode(stored.fields.GoalsJSON);
    const matches = goals.flatMap(goal => goal.activities.map(activity => ({ goal, activity })))
      .filter(candidate => candidate.activity.id === activityId);
    if (matches.length !== 1) throw new Error(`Expected exactly one activity ${activityId} in this work plan.`);
    const { activity } = matches[0];
    if (!activity.linkedKpiId || !activity.linkedKraId) throw new Error('Only an activated activity needs a retirement review.');
    const [sourceKra, kpi, allKpis, allTasks] = await Promise.all([
      this.item('kras', activity.linkedKraId),
      this.item('kpis', activity.linkedKpiId),
      this.all(this.url('kpis', '/items?$expand=fields')),
      this.all(this.url('tasks', '/items?$expand=fields')),
    ]);
    if (String(kpi.fields.RelatedKRALookupId) !== activity.linkedKraId) throw new Error('The KPI parent changed. Reload and reconcile before retirement.');
    if (this.norm(sourceKra.fields.Division) !== this.norm(stored.fields.DivisionName)) throw new Error('The source KRA is outside this work plan division.');

    let targetKra: Item | undefined;
    if (action === 'reassign') {
      if (!targetKraId || targetKraId === activity.linkedKraId) throw new Error('Choose a different target KRA for reassignment.');
      targetKra = await this.item('kras', targetKraId);
      if (this.norm(targetKra.fields.Division) !== this.norm(stored.fields.DivisionName)) throw new Error('The target KRA is outside this work plan division.');
    } else if (targetKraId) {
      throw new Error('A target KRA is valid only for reassignment.');
    }

    const activeFor = (kraId: string) => allKpis.filter(item =>
      String(item.fields.RelatedKRALookupId) === kraId && item.fields[RETIRED] !== true);
    const sourceMembers = activeFor(activity.linkedKraId);
    const targetMembers = targetKra ? activeFor(targetKra.id) : [];
    const afterSource = sourceMembers.filter(item => item.id !== kpi.id);
    const afterTarget = targetKra ? [...targetMembers.filter(item => item.id !== kpi.id), kpi] : [];
    const linkedTasks = allTasks.filter(item =>
      String(item.fields.RelatedKPILookupId || '') === kpi.id || activity.linkedTaskIds.includes(item.id));
    const unexpected = linkedTasks.filter(item =>
      item.fields.RelatedKPILookupId && String(item.fields.RelatedKPILookupId) !== kpi.id);
    if (unexpected.length) throw new Error('A recorded Task now belongs to another KPI. Reconcile the Task before retirement.');

    const taskRevisions = linkedTasks.map(item => [item.id, item.eTag]).sort();
    const signature = await this.digest({
      plan: [stored.id, stored.eTag],
      activity: activity.id,
      action,
      target: targetKra ? [targetKra.id, targetKra.eTag] : null,
      source: [sourceKra.id, sourceKra.eTag],
      kpi: [kpi.id, kpi.eTag],
      tasks: taskRevisions,
    });
    const warnings = [
      action === 'retire'
        ? 'The KPI will be retired but retained; Tasks keep their evidence links to it.'
        : action === 'clear-links'
          ? 'The KPI will be retired and Task strategy lookups cleared; Task records and evidence remain.'
          : 'The KPI and every linked Task will move together to the target KRA.',
      'Existing KPI measurement definitions, measurement evidence, actuals, statuses and Task evidence are not overwritten.',
    ];
    return {
      version: 1,
      operationId: crypto.randomUUID(),
      signature,
      planId: stored.id,
      activityId,
      action,
      revisions: {
        sourceKra: this.etag(sourceKra),
        ...(targetKra ? { targetKra: this.etag(targetKra) } : {}),
        kpi: this.etag(kpi),
        tasks: Object.fromEntries(linkedTasks.map(item => [item.id, this.etag(item)])),
      },
      planRevision: this.etag(stored),
      activityTitle: activity.title,
      sourceKra: {
        id: sourceKra.id,
        title: sourceKra.fields.Title || sourceKra.id,
        progress: this.kraProgress(sourceMembers),
        projectedProgress: this.kraProgress(afterSource),
        activeKpiCount: sourceMembers.length,
      },
      ...(targetKra ? {
        targetKra: {
          id: targetKra.id,
          title: targetKra.fields.Title || targetKra.id,
          progress: this.kraProgress(targetMembers),
          projectedProgress: this.kraProgress(afterTarget),
          activeKpiCount: targetMembers.length,
        },
      } : {}),
      kpi: {
        id: kpi.id,
        title: kpi.fields.Title || kpi.id,
        status: kpi.fields.Status || '',
        measurementEvidenceCount: this.evidenceCount(kpi.fields[MEASUREMENT_EVIDENCE]),
        hasMeasurementDefinition: Boolean(kpi.fields[MEASUREMENT_DEFINITION]),
        hasChecklistEvidence: Boolean(kpi.fields.ChecklistJSON),
      },
      tasks: linkedTasks.map(item => ({ id: item.id, title: item.fields.Title || item.id, status: item.fields.Status || '' })),
      warnings,
    };
  }

  /** Read-only impact review for a complete source KRA or goal execution subtree. */
  async previewStructureRetirement(
    planId: string,
    entityKind: WorkPlanStructureKind,
    sourceId: string,
    action: WorkPlanRetirementAction,
    targetExecutionId?: string,
  ): Promise<WorkPlanStructureRetirementImpact> {
    const errors = await this.readiness();
    if (errors.length) throw new Error(errors.join('\n'));
    if (!['kra', 'goal'].includes(entityKind)) throw new Error('Choose a goal or source KRA.');
    if (!['retire', 'clear-links', 'reassign'].includes(action)) throw new Error('Choose a supported retirement action.');
    const stored = await this.item('plans', planId);
    const pending = this.retirementStore(stored).operation;
    if (pending && pending.entityKind === entityKind && pending.impact.sourceId === sourceId &&
        pending.impact.action === action && pending.impact.target?.id === targetExecutionId) {
      return pending.impact;
    }
    if (pending) throw new Error('Recover the interrupted retirement before reviewing another operation.');
    const goals = await this.storage.decode(stored.fields.GoalsJSON);
    const all = async (list: string) => this.all(this.url(list, '/items?$expand=fields'));
    const [objectives, kras, kpis, tasks] = await Promise.all([
      all('objectives'), all('kras'), all('kpis'), all('tasks'),
    ]);
    const active = (item: Item) => item.fields[RETIRED] !== true;
    const byId = (items: Item[], id: string, label: string) => {
      const matches = items.filter(item => item.id === id);
      if (matches.length !== 1) throw new Error(`Expected exactly one ${label} ${id}.`);
      return matches[0];
    };
    const scoped = (item: Item, label: string) => {
      if (this.norm(item.fields.Division) !== this.norm(stored.fields.DivisionName)) {
        throw new Error(`The ${label} is outside this work plan division.`);
      }
    };
    const versionMap = (items: Item[]) => Object.fromEntries(items.map(item => [item.id, this.etag(item)]));
    const average = (values: number[]) => values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;
    const objectiveProgress = (
      objectiveId: string,
      excludedKraIds = new Set<string>(),
      overrides = new Map<string, number>(),
      additions: Item[] = [],
    ) => {
      const members = [
        ...kras.filter(item => active(item) && String(item.fields.UnitObjectiveLookupId) === objectiveId &&
          !excludedKraIds.has(item.id)),
        ...additions.filter(item => !kras.some(existing => existing.id === item.id)),
      ];
      return {
        progress: average(members.map(item => overrides.get(item.id) ?? Number(item.fields.Progress || 0))),
        count: members.length,
      };
    };

    let sourceTitle = '';
    let sourceExecutionId = '';
    let sourceSnapshot: WorkPlanGoal | WorkPlanKra;
    let affectedObjectives: Item[] = [];
    let affectedKras: Item[] = [];
    let affectedKpis: Item[] = [];
    let affectedTasks: Item[] = [];
    let target: Item | undefined;
    const progress: WorkPlanStructureRetirementImpact['progress'] = [];

    if (entityKind === 'kra') {
      const matches = goals.flatMap(goal => (goal.kras || []).map(kra => ({ goal, kra })))
        .filter(candidate => candidate.kra.id === sourceId);
      if (matches.length !== 1 || !matches[0].kra.linkedKraId) throw new Error('Expected exactly one activated source KRA.');
      const source = byId(kras, matches[0].kra.linkedKraId!, 'execution KRA');
      if (!active(source)) throw new Error('The source KRA is already retired. Reload the work plan.');
      scoped(source, 'source KRA');
      sourceSnapshot = structuredClone(matches[0].kra);
      sourceTitle = matches[0].kra.title;
      sourceExecutionId = source.id;
      const sourceObjective = byId(objectives, String(source.fields.UnitObjectiveLookupId || ''), 'source objective');
      if (matches[0].goal.linkedObjectiveId !== sourceObjective.id) {
        throw new Error('The source KRA ancestry changed. Reload and reconcile the work plan before retirement.');
      }
      if (!active(sourceObjective)) throw new Error('The source objective is already retired. Reload the work plan.');
      scoped(sourceObjective, 'source objective');
      affectedKpis = kpis.filter(item => active(item) && String(item.fields.RelatedKRALookupId) === source.id);
      const kpiIds = new Set(affectedKpis.map(item => item.id));
      affectedTasks = tasks.filter(item =>
        kpiIds.has(String(item.fields.RelatedKPILookupId || '')) ||
        String(item.fields.RelatedKRALookupId || '') === source.id);
      affectedKras = [source];
      affectedObjectives = [sourceObjective];

      let targetMembers: Item[] = [];
      if (action === 'reassign') {
        if (!targetExecutionId || targetExecutionId === source.id) throw new Error('Choose a different target KRA.');
        target = byId(kras, targetExecutionId, 'target KRA');
        if (!active(target)) throw new Error('Choose an active target KRA.');
        scoped(target, 'target KRA');
        targetMembers = kpis.filter(item => active(item) && String(item.fields.RelatedKRALookupId) === target!.id);
        const targetObjective = byId(objectives, String(target.fields.UnitObjectiveLookupId || ''), 'target objective');
        if (!active(targetObjective)) throw new Error('The target objective is retired. Choose another KRA.');
        scoped(targetObjective, 'target objective');
        affectedObjectives = [...new Map([...affectedObjectives, targetObjective].map(item => [item.id, item])).values()];
      } else if (targetExecutionId) throw new Error('A target is valid only for reassignment.');

      const sourceProgress = this.kraProgress(affectedKpis);
      progress.push({
        kind: 'kra', id: source.id, title: source.fields.Title || sourceTitle,
        progress: sourceProgress, projectedProgress: 0,
        activeMemberCount: affectedKpis.length, projectedMemberCount: 0,
      });
      const targetProgress = target ? this.kraProgress(targetMembers) : 0;
      const projectedTargetProgress = target ? this.kraProgress([...targetMembers, ...affectedKpis]) : 0;
      if (target) progress.push({
        kind: 'kra', id: target.id, title: target.fields.Title || target.id,
        progress: targetProgress, projectedProgress: projectedTargetProgress,
        activeMemberCount: targetMembers.length,
        projectedMemberCount: targetMembers.length + affectedKpis.length,
      });
      for (const objective of affectedObjectives) {
        const beforeOverrides = new Map<string, number>([[source.id, sourceProgress]]);
        if (target) beforeOverrides.set(target.id, targetProgress);
        const before = objectiveProgress(objective.id, new Set(), beforeOverrides);
        const afterOverrides = new Map(beforeOverrides);
        if (target) afterOverrides.set(target.id, projectedTargetProgress);
        const after = objectiveProgress(objective.id, new Set([source.id]), afterOverrides);
        progress.push({
          kind: 'objective', id: objective.id, title: objective.fields.Title || objective.id,
          progress: before.progress, projectedProgress: after.progress,
          activeMemberCount: before.count, projectedMemberCount: after.count,
        });
      }
    } else {
      const matches = goals.filter(goal => goal.id === sourceId);
      if (matches.length !== 1 || !matches[0].linkedObjectiveId) throw new Error('Expected exactly one activated work-plan goal.');
      sourceSnapshot = structuredClone(matches[0]);
      sourceTitle = matches[0].title;
      sourceExecutionId = matches[0].linkedObjectiveId!;
      const source = byId(objectives, sourceExecutionId, 'source objective');
      if (!active(source)) throw new Error('The source objective is already retired. Reload the work plan.');
      scoped(source, 'source objective');
      for (const localKra of matches[0].kras || []) {
        if (!localKra.linkedKraId) continue;
        const executionKra = byId(kras, localKra.linkedKraId, 'work-plan KRA');
        if (String(executionKra.fields.UnitObjectiveLookupId || '') !== source.id) {
          throw new Error('A work-plan KRA no longer belongs to the source objective. Reload and reconcile before retirement.');
        }
      }
      affectedKras = kras.filter(item => active(item) && String(item.fields.UnitObjectiveLookupId) === source.id);
      const kraIds = new Set(affectedKras.map(item => item.id));
      affectedKpis = kpis.filter(item => active(item) && kraIds.has(String(item.fields.RelatedKRALookupId || '')));
      const kpiIds = new Set(affectedKpis.map(item => item.id));
      affectedTasks = tasks.filter(item =>
        kpiIds.has(String(item.fields.RelatedKPILookupId || '')) ||
        kraIds.has(String(item.fields.RelatedKRALookupId || '')));
      affectedObjectives = [source];

      let targetKras: Item[] = [];
      if (action === 'reassign') {
        if (!targetExecutionId || targetExecutionId === source.id) throw new Error('Choose a different target objective.');
        target = byId(objectives, targetExecutionId, 'target objective');
        if (!active(target)) throw new Error('Choose an active target objective.');
        scoped(target, 'target objective');
        targetKras = kras.filter(item => active(item) && String(item.fields.UnitObjectiveLookupId) === target!.id);
        affectedObjectives.push(target);
      } else if (targetExecutionId) throw new Error('A target is valid only for reassignment.');

      const sourceProgress = average(affectedKras.map(item => Number(item.fields.Progress || 0)));
      progress.push({
        kind: 'objective', id: source.id, title: source.fields.Title || sourceTitle,
        progress: sourceProgress, projectedProgress: 0,
        activeMemberCount: affectedKras.length, projectedMemberCount: 0,
      });
      if (target) {
        const before = average(targetKras.map(item => Number(item.fields.Progress || 0)));
        const afterMembers = [...targetKras, ...affectedKras];
        progress.push({
          kind: 'objective', id: target.id, title: target.fields.Title || target.id,
          progress: before,
          projectedProgress: average(afterMembers.map(item => Number(item.fields.Progress || 0))),
          activeMemberCount: targetKras.length,
          projectedMemberCount: afterMembers.length,
        });
      }
    }

    const evidence = {
      measurementDefinitions: affectedKpis.filter(item => Boolean(item.fields[MEASUREMENT_DEFINITION])).length,
      measurementEvidenceRefs: affectedKpis.reduce((sum, item) => sum + this.evidenceCount(item.fields[MEASUREMENT_EVIDENCE]), 0),
      checklists: affectedKpis.filter(item => Boolean(item.fields.ChecklistJSON)).length,
      tasks: affectedTasks.length,
    };
    const signatureBody = {
      plan: [stored.id, stored.eTag],
      entityKind, sourceId, sourceExecutionId, action, target: target ? [target.id, target.eTag] : null,
      objectives: versionMap(affectedObjectives),
      kras: versionMap(affectedKras),
      kpis: versionMap(affectedKpis),
      tasks: versionMap(affectedTasks),
    };
    return {
      version: 1,
      entityKind,
      operationId: crypto.randomUUID(),
      signature: await this.digest(signatureBody),
      planId: stored.id,
      planRevision: this.etag(stored),
      sourceId,
      sourceExecutionId,
      sourceTitle,
      action,
      ...(target ? { target: { id: target.id, title: target.fields.Title || target.id } } : {}),
      affected: {
        objectiveIds: [...new Set(affectedObjectives.map(item => item.id))],
        kraIds: [...new Set(affectedKras.map(item => item.id))],
        kpiIds: [...new Set(affectedKpis.map(item => item.id))],
        taskIds: [...new Set(affectedTasks.map(item => item.id))],
      },
      progress,
      evidence,
      revisions: {
        objectives: versionMap(affectedObjectives),
        kras: versionMap(affectedKras),
        kpis: versionMap(affectedKpis),
        tasks: versionMap(affectedTasks),
      },
      warnings: [
        action === 'reassign'
          ? `Existing ${entityKind === 'goal' ? 'KRAs and their descendants' : 'KPIs and Tasks'} move to the reviewed target without new IDs.`
          : action === 'clear-links'
            ? 'Execution records are retained and retired; Task strategy lookups are cleared.'
            : 'Execution records are retained and retired; Task evidence links remain for audit.',
        'No KPI or Task evidence, status, actual, checklist, comment or attachment is overwritten.',
      ],
    };
  }

  private async syncRetirementRollups(kraIds: string[]) {
    const allKpis = await this.all(this.url('kpis', '/items?$expand=fields'));
    const objectiveIds = new Set<string>();
    for (const kraId of [...new Set(kraIds)]) {
      const kra = await this.item('kras', kraId);
      const members = allKpis.filter(item =>
        String(item.fields.RelatedKRALookupId) === kraId && item.fields[RETIRED] !== true);
      const progress = this.kraProgress(members);
      await this.patch('kras', kra, { Progress: progress, Status: progress === 100 && members.length ? 'Closed' : 'Open' });
      if (kra.fields.UnitObjectiveLookupId) objectiveIds.add(String(kra.fields.UnitObjectiveLookupId));
    }
    await this.syncObjectiveRollups([...objectiveIds]);
  }

  private async syncObjectiveRollups(objectiveIds: string[]) {
    const allKras = await this.all(this.url('kras', '/items?$expand=fields'));
    for (const objectiveId of [...new Set(objectiveIds)]) {
      const objective = await this.item('objectives', objectiveId);
      const members = allKras.filter(item =>
        String(item.fields.UnitObjectiveLookupId) === objectiveId && item.fields[RETIRED] !== true);
      const progress = members.length
        ? Math.round(members.reduce((sum, item) => sum + Number(item.fields.Progress || 0), 0) / members.length)
        : 0;
      await this.patch('objectives', objective, {
        Progress: progress,
        Status: progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started',
      });
    }
  }

  /**
   * Executes an operator-approved preview with CAS checkpoints. Retrying the same
   * operation resumes its completed steps; a different intent is rejected.
   */
  async executeActivityRetirement(request: WorkPlanRetirementRequest): Promise<Item> {
    if (!request.reason?.trim()) throw new Error('Record a retirement or reassignment reason.');
    const errors = await this.readiness();
    if (errors.length) throw new Error(errors.join('\n'));
    let stored = await this.item('plans', request.impact.planId);
    let store = this.retirementStore(stored);
    if (store.history.some(record => record.operationId === request.impact.operationId)) return stored;
    let operation = store.operation;
    if (operation && operation.entityKind !== 'activity') {
      throw new Error('Recover the interrupted structural retirement before retiring an activity.');
    }
    if (operation && operation.operationId !== request.impact.operationId) {
      throw new Error('Recover the interrupted retirement before starting another operation.');
    }
    if (!operation) {
      if (request.impact.planRevision !== stored.eTag) throw new Error('This work plan changed after the impact preview. Review it again.');
      const fresh = await this.previewActivityRetirement(
        request.impact.planId,
        request.impact.activityId,
        request.impact.action,
        request.impact.targetKra?.id,
      );
      if (fresh.signature !== request.impact.signature) throw new Error('Execution links changed after the impact preview. Review it again.');
      const goals = await this.storage.decode(stored.fields.GoalsJSON);
      const activities = goals.flatMap(goal => goal.activities).filter(activity => activity.id === request.impact.activityId);
      if (activities.length !== 1) throw new Error('The source activity is no longer unique.');
      operation = {
        version: 1,
        entityKind: 'activity',
        operationId: request.impact.operationId,
        signature: request.impact.signature,
        state: 'running',
        leaseUntil: Date.now() + 120000,
        completedSteps: [],
        reason: request.reason.trim(),
        impact: request.impact,
        activitySnapshot: structuredClone(activities[0]),
        performedBy: request.performedBy ? structuredClone(request.performedBy) : undefined,
      };
      store = { ...store, operation };
      stored = await this.patch('plans', stored, { [RETIREMENT]: JSON.stringify(store) });
    } else {
      if (operation.signature !== request.impact.signature) throw new Error('The interrupted retirement has a different reviewed impact.');
      if (operation.state === 'running' && operation.leaseUntil > Date.now()) throw new Error('Retirement is already running. Reload after it finishes.');
      operation.state = 'running';
      operation.leaseUntil = Date.now() + 120000;
    }
    const activityOperation = operation as RetirementOperation;

    const checkpoint = async (step?: string) => {
      if (step && !activityOperation.completedSteps.includes(step)) activityOperation.completedSteps.push(step);
      activityOperation.leaseUntil = Date.now() + 120000;
      activityOperation.state = 'running';
      store.operation = activityOperation;
      stored = await this.patch('plans', stored, { [RETIREMENT]: JSON.stringify(store) });
    };
    const done = (step: string) => activityOperation.completedSteps.includes(step);
    const impact = activityOperation.impact;
    try {
      if (!done('kpi')) {
        const kpi = await this.item('kpis', impact.kpi.id);
        let priorAudit: any;
        try { priorAudit = JSON.parse(kpi.fields[RETIREMENT] || '{}'); } catch { priorAudit = {}; }
        const kpiAlreadyWritten = priorAudit.operationId === impact.operationId &&
          (impact.action === 'reassign'
            ? String(kpi.fields.RelatedKRALookupId) === impact.targetKra?.id && kpi.fields[RETIRED] === false
            : kpi.fields[RETIRED] === true);
        if (kpiAlreadyWritten) {
          await checkpoint('kpi');
        } else {
          if (kpi.eTag !== impact.revisions.kpi) throw new Error('The KPI changed after review. Review the impact again.');
          const audit = JSON.stringify({
            version: 1,
            operationId: impact.operationId,
            action: impact.action,
          reason: activityOperation.reason,
            occurredAt: new Date().toISOString(),
            oldParentKraId: impact.sourceKra.id,
            newParentKraId: impact.targetKra?.id,
            measurementDefinitionPreserved: Boolean(kpi.fields[MEASUREMENT_DEFINITION]),
            measurementEvidencePreserved: Boolean(kpi.fields[MEASUREMENT_EVIDENCE]),
          });
          await this.patch('kpis', kpi, impact.action === 'reassign'
            ? { RelatedKRALookupId: Number(impact.targetKra!.id), [RETIRED]: false, [RETIREMENT]: audit }
            : { [RETIRED]: true, [RETIREMENT]: audit });
          await checkpoint('kpi');
        }
      }
      for (const task of impact.tasks) {
        const step = `task:${task.id}`;
        if (done(step)) continue;
        const item = await this.item('tasks', task.id);
        if (impact.action === 'retire') {
          if (item.eTag !== impact.revisions.tasks[task.id]) throw new Error(`Task ${task.id} changed after review. Review the impact again.`);
          continue;
        }
        const taskAlreadyWritten = impact.action === 'reassign'
          ? String(item.fields.RelatedKPILookupId) === impact.kpi.id &&
            String(item.fields.RelatedKRALookupId) === impact.targetKra?.id
          : !item.fields.RelatedKPILookupId && !item.fields.RelatedKRALookupId;
        if (taskAlreadyWritten) {
          await checkpoint(step);
          continue;
        }
        if (item.eTag !== impact.revisions.tasks[task.id]) throw new Error(`Task ${task.id} changed after review. Review the impact again.`);
        await this.patch('tasks', item, impact.action === 'reassign'
          ? { RelatedKPILookupId: Number(impact.kpi.id), RelatedKRALookupId: Number(impact.targetKra!.id) }
          : { RelatedKPILookupId: null, RelatedKRALookupId: null });
        await checkpoint(step);
      }
      if (!done('plan')) {
        const goals = await this.storage.decode(stored.fields.GoalsJSON);
        let removed = 0;
        for (const goal of goals) {
          const before = goal.activities.length;
          goal.activities = goal.activities.filter(activity => activity.id !== impact.activityId);
          removed += before - goal.activities.length;
        }
        if (removed > 1) throw new Error('Retirement would remove more than one source activity.');
        await checkpoint();
        stored = await this.patch('plans', stored, { GoalsJSON: await this.storage.encode(goals) });
        await checkpoint('plan');
      }
      if (!done('rollups')) {
        await this.syncRetirementRollups([impact.sourceKra.id, ...(impact.targetKra ? [impact.targetKra.id] : [])]);
        await checkpoint('rollups');
      }
      const record: WorkPlanRetirementRecord = {
        operationId: impact.operationId,
        action: impact.action,
        reason: activityOperation.reason,
        activityId: impact.activityId,
        activitySnapshot: activityOperation.activitySnapshot,
        impact,
        sourceKraId: impact.sourceKra.id,
        targetKraId: impact.targetKra?.id,
        taskIds: impact.tasks.map(task => task.id),
        kpiId: impact.kpi.id,
        completedAt: new Date().toISOString(),
        performedBy: activityOperation.performedBy ? structuredClone(activityOperation.performedBy) : undefined,
      };
      store.history = [...store.history.filter(item => item.operationId !== record.operationId), record];
      delete store.operation;
      stored = await this.patch('plans', stored, { [RETIREMENT]: JSON.stringify(store) });
      return stored;
    } catch (error) {
      activityOperation.state = 'failed';
      activityOperation.leaseUntil = 0;
      activityOperation.error = error instanceof Error ? error.message : String(error);
      store.operation = activityOperation;
      try { stored = await this.patch('plans', stored, { [RETIREMENT]: JSON.stringify(store) }); } catch { /* a stale writer cannot overwrite a newer checkpoint */ }
      throw error;
    }
  }

  async executeStructureRetirement(request: WorkPlanStructureRetirementRequest): Promise<Item> {
    if (!request.reason?.trim()) throw new Error('Record a retirement or reassignment reason.');
    const errors = await this.readiness();
    if (errors.length) throw new Error(errors.join('\n'));
    let stored = await this.item('plans', request.impact.planId);
    let store = this.retirementStore(stored);
    if (store.history.some(record => record.operationId === request.impact.operationId)) return stored;
    let operation = store.operation;
    if (operation && operation.entityKind === 'activity') {
      throw new Error('Recover the interrupted activity retirement before starting another operation.');
    }
    if (operation && operation.operationId !== request.impact.operationId) {
      throw new Error('Recover the interrupted retirement before starting another operation.');
    }
    if (!operation) {
      if (request.impact.planRevision !== stored.eTag) throw new Error('This work plan changed after the impact preview. Review it again.');
      const fresh = await this.previewStructureRetirement(
        request.impact.planId,
        request.impact.entityKind,
        request.impact.sourceId,
        request.impact.action,
        request.impact.target?.id,
      );
      if (fresh.signature !== request.impact.signature) throw new Error('Execution descendants changed after the impact preview. Review it again.');
      const goals = await this.storage.decode(stored.fields.GoalsJSON);
      const matches: Array<WorkPlanGoal | WorkPlanKra> = request.impact.entityKind === 'goal'
        ? goals.filter(goal => goal.id === request.impact.sourceId)
        : goals.flatMap(goal => goal.kras || []).filter(kra => kra.id === request.impact.sourceId);
      if (matches.length !== 1) throw new Error('The reviewed source is no longer unique.');
      operation = {
        version: 1,
        entityKind: request.impact.entityKind,
        operationId: request.impact.operationId,
        signature: request.impact.signature,
        state: 'running',
        leaseUntil: Date.now() + 120000,
        completedSteps: [],
        reason: request.reason.trim(),
        impact: request.impact,
        sourceSnapshot: structuredClone(matches[0]),
        performedBy: request.performedBy ? structuredClone(request.performedBy) : undefined,
      };
      store = { ...store, operation };
      stored = await this.patch('plans', stored, { [RETIREMENT]: JSON.stringify(store) });
    } else {
      if (operation.signature !== request.impact.signature) throw new Error('The interrupted retirement has a different reviewed impact.');
      if (operation.state === 'running' && operation.leaseUntil > Date.now()) throw new Error('Retirement is already running. Reload after it finishes.');
      operation.state = 'running';
      operation.leaseUntil = Date.now() + 120000;
    }
    const structureOperation = operation as StructureRetirementOperation;

    const checkpoint = async (step?: string) => {
      if (step && !structureOperation.completedSteps.includes(step)) structureOperation.completedSteps.push(step);
      structureOperation.leaseUntil = Date.now() + 120000;
      structureOperation.state = 'running';
      store.operation = structureOperation;
      stored = await this.patch('plans', stored, { [RETIREMENT]: JSON.stringify(store) });
    };
    const done = (step: string) => structureOperation.completedSteps.includes(step);
    const impact = structureOperation.impact;
    const audit = (kind: string, id: string) => ({
      version: 1,
      operationId: impact.operationId,
      entityKind: impact.entityKind,
      sourceId: impact.sourceId,
      action: impact.action,
      reason: structureOperation.reason,
      occurredAt: new Date().toISOString(),
      oldParentId: impact.sourceExecutionId,
      newParentId: impact.target?.id,
      affectedKind: kind,
      affectedId: id,
    });
    const revisionFor = (list: 'objectives' | 'kras' | 'kpis' | 'tasks', id: string) =>
      impact.revisions[list][id];
    const auditedPatch = async (
      list: 'objectives' | 'kras' | 'kpis' | 'tasks',
      id: string,
      fields: Record<string, any>,
    ) => {
      const step = `${list}:${id}`;
      if (done(step)) return;
      const item = await this.item(list, id);
      let prior: any;
      try { prior = JSON.parse(item.fields[RETIREMENT] || '{}'); } catch { prior = {}; }
      const alreadyWritten = prior.operationId === impact.operationId &&
        Object.entries(fields).every(([field, value]) => String(item.fields[field] ?? '') === String(value ?? ''));
      if (!alreadyWritten) {
        if (item.eTag !== revisionFor(list, id)) throw new Error(`${list} item ${id} changed after review. Review the impact again.`);
        await this.patch(list, item, { ...fields, [RETIREMENT]: JSON.stringify(audit(list, id)) });
      }
      await checkpoint(step);
    };
    const verifyUntouched = async (list: 'kpis' | 'tasks', ids: string[]) => {
      for (const id of ids) {
        const item = await this.item(list, id);
        if (item.eTag !== revisionFor(list, id)) throw new Error(`${list} item ${id} changed after review. Review the impact again.`);
      }
    };

    try {
      if (impact.entityKind === 'kra') {
        for (const id of impact.affected.kpiIds) {
          await auditedPatch('kpis', id, impact.action === 'reassign'
            ? { RelatedKRALookupId: Number(impact.target!.id), [RETIRED]: false }
            : { [RETIRED]: true });
        }
        if (impact.action === 'retire') {
          await verifyUntouched('tasks', impact.affected.taskIds);
        } else {
          for (const id of impact.affected.taskIds) {
            const task = await this.item('tasks', id);
            const fields = impact.action === 'reassign'
              ? {
                  RelatedKRALookupId: Number(impact.target!.id),
                  RelatedKPILookupId: task.fields.RelatedKPILookupId || null,
                }
              : { RelatedKRALookupId: null, RelatedKPILookupId: null };
            await auditedPatch('tasks', id, fields);
          }
        }
        await auditedPatch('kras', impact.sourceExecutionId, { [RETIRED]: true });
      } else {
        if (impact.action === 'reassign') {
          await verifyUntouched('kpis', impact.affected.kpiIds);
          await verifyUntouched('tasks', impact.affected.taskIds);
          for (const id of impact.affected.kraIds) {
            await auditedPatch('kras', id, {
              UnitObjectiveLookupId: Number(impact.target!.id),
              [RETIRED]: false,
            });
          }
        } else {
          for (const id of impact.affected.kpiIds) await auditedPatch('kpis', id, { [RETIRED]: true });
          for (const id of impact.affected.kraIds) await auditedPatch('kras', id, { [RETIRED]: true });
          if (impact.action === 'retire') {
            await verifyUntouched('tasks', impact.affected.taskIds);
          } else {
            for (const id of impact.affected.taskIds) {
              await auditedPatch('tasks', id, { RelatedKRALookupId: null, RelatedKPILookupId: null });
            }
          }
        }
        await auditedPatch('objectives', impact.sourceExecutionId, { [RETIRED]: true });
      }

      if (!done('plan')) {
        const goals = await this.storage.decode(stored.fields.GoalsJSON);
        if (impact.entityKind === 'goal') {
          const remaining = goals.filter(goal => goal.id !== impact.sourceId);
          if (remaining.length !== goals.length - 1) throw new Error('Retirement must remove exactly one source goal.');
          await checkpoint();
          stored = await this.patch('plans', stored, { GoalsJSON: await this.storage.encode(remaining) });
        } else {
          let removed = 0;
          for (const goal of goals) {
            const before = (goal.kras || []).length;
            goal.kras = (goal.kras || []).filter(kra => kra.id !== impact.sourceId);
            removed += before - goal.kras.length;
            goal.activities = goal.activities.filter(activity => activity.sourceKraId !== impact.sourceId);
          }
          if (removed !== 1) throw new Error('Retirement must remove exactly one source KRA.');
          await checkpoint();
          stored = await this.patch('plans', stored, { GoalsJSON: await this.storage.encode(goals) });
        }
        await checkpoint('plan');
      }

      if (!done('rollups')) {
        if (impact.entityKind === 'kra') {
          await this.syncRetirementRollups([
            impact.sourceExecutionId,
            ...(impact.target ? [impact.target.id] : []),
          ]);
        } else if (impact.action !== 'reassign') {
          await this.syncRetirementRollups(impact.affected.kraIds);
        }
        await this.syncObjectiveRollups(impact.affected.objectiveIds);
        await checkpoint('rollups');
      }

      const record: WorkPlanStructureRetirementRecord = {
        operationId: impact.operationId,
        entityKind: impact.entityKind,
        sourceId: impact.sourceId,
        sourceExecutionId: impact.sourceExecutionId,
        action: impact.action,
        reason: structureOperation.reason,
        completedAt: new Date().toISOString(),
        targetExecutionId: impact.target?.id,
        impact,
        sourceSnapshot: structureOperation.sourceSnapshot,
        performedBy: structureOperation.performedBy ? structuredClone(structureOperation.performedBy) : undefined,
      };
      store.history = [...store.history.filter(item => item.operationId !== record.operationId), record];
      delete store.operation;
      stored = await this.patch('plans', stored, { [RETIREMENT]: JSON.stringify(store) });
      return stored;
    } catch (error) {
      structureOperation.state = 'failed';
      structureOperation.leaseUntil = 0;
      structureOperation.error = error instanceof Error ? error.message : String(error);
      store.operation = structureOperation;
      try { stored = await this.patch('plans', stored, { [RETIREMENT]: JSON.stringify(store) }); } catch { /* stale writer stops */ }
      throw error;
    }
  }

  async execute(plan: WorkPlan): Promise<Item> {
    const errors = await this.readiness();
    if (errors.length) throw new Error(errors.join('\n'));
    let stored = await this.item('plans', plan.id);
    if (this.retirementStore(stored).operation) throw new Error('Recover the interrupted retirement before activation.');
    const oldState = this.json<Journal | null>(stored.fields[STATE], null);
    if ((!oldState || oldState.state === 'complete') && plan.revision && plan.revision !== stored.eTag) throw new Error('This plan changed since it was opened. Reload before activation.');
    if (oldState?.state === 'running' && oldState.leaseUntil > Date.now()) throw new Error('Activation is already running. Reload after it finishes.');
    const signature = await this.signature(plan);
    if (oldState && oldState.state !== 'complete' && oldState.signature !== signature) throw new Error('Recover the interrupted activation before changing its plan.');
    const previous = await this.storage.decode(stored.fields.GoalsJSON);
    const goals = structuredClone(plan.goals);
    // Recover IDs checkpointed by a prior attempt even if the caller still has a stale form.
    for (const goal of goals) {
      goal.workPlanId = plan.id;
      const old = previous.find(candidate => candidate.id === goal.id);
      if (old?.linkedObjectiveId) {
        if (goal.linkedObjectiveId && goal.linkedObjectiveId !== old.linkedObjectiveId) throw new Error('Changing an existing execution objective requires a migration review.');
        goal.linkedObjectiveId = old.linkedObjectiveId;
        goal.executionObjectiveRef ||= old.executionObjectiveRef;
      }
      for (const kra of goal.kras || []) kra.linkedKraId ||= old?.kras?.find(candidate => candidate.id === kra.id)?.linkedKraId;
      for (const activity of goal.activities) {
        const prior = old?.activities.find(candidate => candidate.id === activity.id);
        activity.linkedKraId ||= prior?.linkedKraId;
        activity.linkedKpiId ||= prior?.linkedKpiId;
        if (activity.taskPolicy === 'create-task' && prior?.linkedTaskIds.length) activity.linkedTaskIds = prior.linkedTaskIds;
      }
    }
    await this.validate({ ...plan, goals }, previous);
    const journal: Journal = { version: 1, token: crypto.randomUUID(), signature, state: 'running', leaseUntil: Date.now() + 120000 };
    const checkpoint = async () => {
      journal.leaseUntil = Date.now() + 120000;
      const goalsJson = await this.storage.encode(goals);
      stored = await this.patch('plans', stored, { GoalsJSON: goalsJson, [STATE]: JSON.stringify(journal) });
      if (this.json<Journal | null>(stored.fields[STATE], null)?.token !== journal.token || stored.fields.GoalsJSON !== goalsJson) throw new Error('Activation lost its work-plan lease. Reload before retrying.');
    };
    await checkpoint(); // CAS acquires the lease before the first entity write.
    const upsert = async (list: string, localId: string, existingId: string | undefined, create: Record<string, any>, update: Record<string, any>) => {
      await checkpoint();
      const key = this.key(plan.id, list, localId);
      const find = async () => {
        const filter = encodeURIComponent(`fields/${KEY} eq '${key.replace(/'/g, "''")}'`);
        const items = await this.all(this.url(list, `/items?$expand=fields&$filter=${filter}`));
        if (items.length > 1) throw new Error(`Duplicate activation key ${key}.`);
        return items[0] as Item | undefined;
      };
      let item = existingId ? await this.item(list, existingId) : await find();
      if (!item) {
        await checkpoint();
        try { item = await this.client.api(this.url(list, '/items')).post({ fields: { ...create, [KEY]: key } }); }
        catch (error) { item = await find(); if (!item) throw error; }
      }
      // A unique key resolves an uncertain create response; do not retry blind POSTs.
      if (!item?.id) throw new Error(`Activation could not resolve ${key}.`);
      item = await this.item(list, item.id);
      if (Object.entries(update).some(([field, value]) => JSON.stringify(item!.fields[field]) !== JSON.stringify(value))) {
        await checkpoint();
        item = await this.patch(list, item, update);
      }
      return item.id;
    };
    try {
      for (const goal of goals) {
        const parent = goal.organizationalGoalRef!.list === 'Strategic_Objectives' ? goal.organizationalGoalRef!.id : goal.legacyStrategicObjectiveId!;
        const objectiveMetadata = { title: goal.title, source: goal.source, sourceCode: goal.sourceCode, organizationalGoalRef: goal.organizationalGoalRef, goalMeasures: goal.goalMeasures, expectedOutcomes: goal.expectedOutcomes, policyAlignment: goal.policyAlignment };
        const objectiveFields = { Title: goal.title.slice(0, 255), Description: goal.strategicObjective || goal.description, [META]: JSON.stringify(objectiveMetadata) };
        goal.linkedObjectiveId = await upsert('objectives', goal.id, goal.linkedObjectiveId, { ...objectiveFields, Division: plan.divisionName, Unit: goal.responsibleUnitNames[0] || '', GoalType: 'Division', Status: 'Not Started', Progress: 0, Year: String(plan.year), ParentGoalIdLookupId: Number(parent), StartDate: plan.startDate || null, EndDate: plan.endDate || null }, objectiveFields);
        goal.executionObjectiveRef = { list: 'Unit_Objectives', id: goal.linkedObjectiveId };
        await checkpoint();
        for (const kra of goal.kras!) {
          const fields = { Title: kra.title.slice(0, 255), Description: kra.objective || '', [META]: JSON.stringify({ title: kra.title, source: kra.source, code: kra.code }) };
          kra.linkedKraId = await upsert('kras', kra.id, kra.linkedKraId, { ...fields, Division: plan.divisionName, Unit: goal.responsibleUnitNames[0] || '', UnitObjectiveLookupId: Number(goal.linkedObjectiveId), Status: 'Open', Progress: 0 }, fields);
          await checkpoint();
        }
        for (const activity of goal.activities) {
          activity.linkedKraId = goal.kras!.find(kra => kra.id === activity.sourceKraId)!.linkedKraId;
          const target = activity.annualTarget!;
          const measurementDefinition = this.measurementDefinition(target);
          // Only simple quantities can use the existing actual/target percentage engine.
          const ratioCompatible = target.quantity !== undefined && target.quantity > 0 && target.operator !== 'at-most' && !target.serviceLevel && !target.population;
          const metadata = { ...activity, linkedTaskIds: undefined, linkedKraId: undefined, linkedKpiId: undefined, measurementLevel: 'activity', ratioCompatible };
          const fields = { Title: activity.kpiDescription!.slice(0, 255), Description: `${activity.kpiDescription}\nAnnual target: ${target.rawText}`, [META]: JSON.stringify(metadata), [MEASUREMENT_DEFINITION]: JSON.stringify(measurementDefinition) };
          const owner = activity.responsiblePersonEmail ? { id: activity.responsiblePersonEmail, name: activity.responsiblePersonName || activity.responsiblePersonEmail, email: activity.responsiblePersonEmail } : undefined;
          activity.linkedKpiId = await upsert('kpis', activity.id, activity.linkedKpiId, { ...fields, RelatedKRALookupId: Number(activity.linkedKraId), Metric: (target.unit || target.rawText).slice(0, 255), TargetValue: ratioCompatible ? target.quantity : null, ActualValue: 0, Status: 'Not Started', CalculationType: 'manual', ...(owner ? { KpiOwner: JSON.stringify(owner), Assignees: JSON.stringify([owner]) } : {}) }, fields);
          await checkpoint();
          if (!activity.linkedTaskIds.length && activity.taskPolicy === 'create-task') {
            const taskId = await upsert('tasks', activity.id, undefined, {
              Title: activity.title.slice(0, 255), Description: `${activity.title}\n${activity.description || activity.expectedOutput}\nSource: ${activity.source?.reference || activity.id}`,
              Status: 'Not Started', Priority: 'Medium', Department: activity.assignedUnitName || plan.divisionName,
              StartDate: activity.startDate || plan.startDate || null, DueDate: activity.endDate || plan.endDate || null,
              Assignees: JSON.stringify(activity.responsiblePersonEmail ? [{ id: activity.responsiblePersonEmail, name: activity.responsiblePersonName || activity.responsiblePersonEmail, email: activity.responsiblePersonEmail }] : []),
              RelatedKPILookupId: Number(activity.linkedKpiId), RelatedKRALookupId: Number(activity.linkedKraId),
              [META]: JSON.stringify({ source: activity.source, responsiblePosition: activity.responsiblePosition, supervisorPosition: activity.supervisorPosition }),
            }, {});
            activity.linkedTaskIds = [taskId];
            await checkpoint();
          }
          for (const taskId of activity.linkedTaskIds) {
            const task = await this.item('tasks', taskId);
            if ((task.fields.RelatedKPILookupId && String(task.fields.RelatedKPILookupId) !== activity.linkedKpiId) ||
                (task.fields.RelatedKRALookupId && String(task.fields.RelatedKRALookupId) !== activity.linkedKraId)) throw new Error(`Task ${taskId} changed its links during activation.`);
            if (String(task.fields.RelatedKPILookupId) !== activity.linkedKpiId || String(task.fields.RelatedKRALookupId) !== activity.linkedKraId) {
              await checkpoint();
              await this.patch('tasks', task, { RelatedKPILookupId: Number(activity.linkedKpiId), RelatedKRALookupId: Number(activity.linkedKraId) });
            }
          }
        }
      }
      journal.state = 'complete';
      journal.leaseUntil = 0;
      stored = await this.patch('plans', stored, { GoalsJSON: await this.storage.encode(goals), [STATE]: JSON.stringify(journal), Status: 'active' });
      return stored;
    } catch (error) {
      journal.state = 'failed'; journal.leaseUntil = 0;
      journal.error = error instanceof Error ? error.message : String(error);
      // Never overwrite another worker after a lost lease or concurrent edit.
      try { await this.patch('plans', stored, { GoalsJSON: await this.storage.encode(goals), [STATE]: JSON.stringify(journal) }); } catch { /* stale writer must stop */ }
      throw error;
    }
  }
}
