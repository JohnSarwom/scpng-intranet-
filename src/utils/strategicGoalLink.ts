/**
 * Strategic Goal link: Unit Objective → Strategic_Goals.
 *
 * Strategic_Goals is the one official list of organisational goals. A Unit
 * Objective is linked to a goal only through its StrategicGoal lookup column
 * (Graph field StrategicGoalLookupId).
 *
 * The older fields are not goal links:
 * - ParentGoalId is a lookup into Strategic_Objectives, and the framework seed
 *   wrote Unit_Objectives row IDs into it, so its number can't be trusted.
 * - LinkedDeliverable is free text.
 * They are read here only as evidence when proposing the one-time crosswalk,
 * which a person reviews and approves before anything is written.
 *
 * Kept free of runtime imports so the Node test harness can load it directly.
 */

export const STRATEGIC_GOALS_LIST = 'Strategic_Goals';
/** Lookup column on Unit_Objectives that targets Strategic_Goals. */
export const STRATEGIC_GOAL_COLUMN = 'StrategicGoal';
/** Graph field name for the lookup's item ID. */
export const STRATEGIC_GOAL_LOOKUP_FIELD = 'StrategicGoalLookupId';

export interface CorporatePlanGoal {
  number: number;
  title: string;
  description: string;
  icon: string;
}

/** The four Strategic Goals in the SCPNG Corporate Plan 2026–2028 (version 1.0, section 5). */
export const CORPORATE_PLAN_GOALS: CorporatePlanGoal[] = [
  {
    number: 1,
    title: 'Policy Development',
    description: 'Update the PNG capital market legislative framework and encourage additional products in the market.',
    icon: 'Building2',
  },
  {
    number: 2,
    title: 'Enforcement and Compliance',
    description: 'Licensing and supervision of the legislation and rules.',
    icon: 'ShieldCheck',
  },
  {
    number: 3,
    title: 'Education & Awareness',
    description: 'Empower investors, stakeholders and service providers through education and awareness.',
    icon: 'GraduationCap',
  },
  {
    number: 4,
    title: 'Enhance Institutional Performance',
    description: 'Improve capability, capacity and services by the SCPNG.',
    icon: 'Award',
  },
];

export interface GoalOption {
  id: string;
  title: string;
}

const clean = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());
const EMPTY_IDS = new Set(['', 'none', 'null', 'undefined', '0']);

/** A usable goal item ID, or null for empty/placeholder values. */
export function goalLinkId(value: unknown): string | null {
  const id = clean(value);
  return EMPTY_IDS.has(id.toLowerCase()) ? null : id;
}

/** Organisation-level rows in Unit_Objectives (the seeded goals) are not objectives that need a goal. */
export function isOrgLevelGoalType(goalType: unknown): boolean {
  const type = clean(goalType).toLowerCase();
  return type === 'org' || type === 'strategic' || type === 'board';
}

/**
 * Comparable form of a goal title: lowercase, "Strategic Goal 2 —" prefix
 * removed, "&" read as "and", punctuation dropped.
 */
export function goalTitleKey(title: unknown): string {
  return clean(title)
    .toLowerCase()
    .replace(/^strategic\s+goal\s*\d+\s*[:.\-–—]*\s*/, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const STOP_WORDS = new Set(['and', 'the', 'of', 'for', 'to', 'in', 'by']);
const significantWords = (key: string): string[] => key.split(' ').filter(word => word.length > 2 && !STOP_WORDS.has(word));

export interface GoalTitleMatch {
  goal: GoalOption;
  how: 'exact' | 'partial';
}

/**
 * Finds the single goal whose title matches. An exact match on the comparable
 * title wins. Otherwise a goal matches when one title contains the other as
 * whole words and the shorter one has at least two significant words
 * ("Institutional Performance" in "Enhance Institutional Performance").
 * Returns null when nothing matches or more than one goal could.
 */
export function matchGoalByTitle(title: unknown, goals: GoalOption[]): GoalTitleMatch | null {
  const key = goalTitleKey(title);
  if (!key) return null;

  const exact = goals.filter(goal => goalTitleKey(goal.title) === key);
  if (exact.length === 1) return { goal: exact[0], how: 'exact' };
  if (exact.length > 1) return null;

  const partial = goals.filter(goal => {
    const other = goalTitleKey(goal.title);
    if (!other) return false;
    const [shorter, longer] = other.length <= key.length ? [other, key] : [key, other];
    return significantWords(shorter).length >= 2 && ` ${longer} `.includes(` ${shorter} `);
  });
  return partial.length === 1 ? { goal: partial[0], how: 'partial' } : null;
}

/** Corporate Plan goals that have no matching item in Strategic_Goals yet. */
export function missingCorporatePlanGoals(goals: GoalOption[]): CorporatePlanGoal[] {
  return CORPORATE_PLAN_GOALS.filter(planGoal => !matchGoalByTitle(planGoal.title, goals));
}

export interface CrosswalkObjectiveInput {
  id: string | number;
  title?: string;
  goalType?: string | null;
  division?: string | null;
  unit?: string | null;
  parentGoalId?: string | number | null;
  linkedDeliverable?: string | null;
  strategicGoalId?: string | number | null;
  revision?: string;
}

export interface LegacyObjectiveTitle {
  id: string | number;
  title: string;
}

export type CrosswalkBasis =
  /** Already linked through the StrategicGoal column. */
  | 'linked'
  /** LinkedDeliverable text matches a goal title. */
  | 'deliverable-title'
  /** ParentGoalId names an organisation-level row in Unit_Objectives (the framework seed). */
  | 'seeded-goal-row'
  /** ParentGoalId names a Strategic_Objectives item whose title matches a goal. */
  | 'legacy-objective'
  /** ParentGoalId names another Unit Objective; its goal is inherited. */
  | 'parent-objective'
  | 'none';

export type CrosswalkStatus =
  /** Linked to a goal that exists. Nothing to do. */
  | 'linked'
  /** One goal proposed from the evidence; needs approval. */
  | 'proposed'
  /** The evidence points to more than one goal; choose by hand. */
  | 'conflict'
  /** No evidence matches any goal; choose by hand. */
  | 'unresolved';

export interface CrosswalkRow {
  objectiveId: string;
  title: string;
  division: string;
  unit: string;
  goalType: string;
  revision?: string;
  currentGoalId: string | null;
  /** False when the current link points to an item that isn't in Strategic_Goals. */
  currentGoalValid: boolean;
  proposedGoalId: string | null;
  basis: CrosswalkBasis;
  status: CrosswalkStatus;
  evidence: string[];
}

interface Candidate {
  basis: Exclude<CrosswalkBasis, 'linked' | 'parent-objective' | 'none'>;
  label: string;
  text: string;
}

/**
 * Proposes a Strategic_Goals link for every non-organisation Unit Objective.
 * Pure: it never writes, and every proposal must be reviewed before use.
 */
export function proposeGoalCrosswalk(input: {
  objectives: CrosswalkObjectiveInput[];
  goals: GoalOption[];
  legacyObjectives?: LegacyObjectiveTitle[];
}): CrosswalkRow[] {
  const goals = input.goals.map(goal => ({ id: clean(goal.id), title: clean(goal.title) }));
  const goalsById = new Map(goals.map(goal => [goal.id, goal]));
  const objectivesById = new Map(input.objectives.map(objective => [clean(objective.id), objective]));
  const legacyById = new Map((input.legacyObjectives || []).map(item => [clean(item.id), clean(item.title)]));

  const rows: CrosswalkRow[] = [];
  const rowsById = new Map<string, CrosswalkRow>();

  for (const objective of input.objectives) {
    if (isOrgLevelGoalType(objective.goalType)) continue;
    const id = clean(objective.id);
    const currentGoalId = goalLinkId(objective.strategicGoalId);
    const currentGoalValid = !!currentGoalId && goalsById.has(currentGoalId);
    const row: CrosswalkRow = {
      objectiveId: id,
      title: clean(objective.title) || '(untitled)',
      division: clean(objective.division),
      unit: clean(objective.unit),
      goalType: clean(objective.goalType),
      revision: objective.revision,
      currentGoalId,
      currentGoalValid,
      proposedGoalId: null,
      basis: 'none',
      status: 'unresolved',
      evidence: [],
    };
    rows.push(row);
    rowsById.set(id, row);

    if (currentGoalValid) {
      row.proposedGoalId = currentGoalId;
      row.basis = 'linked';
      row.status = 'linked';
      row.evidence.push(`Linked to "${goalsById.get(currentGoalId!)!.title}".`);
      continue;
    }
    if (currentGoalId) {
      row.evidence.push(`Current link points to goal ${currentGoalId}, which is not in Strategic_Goals.`);
    }

    const candidates: Candidate[] = [];
    const deliverable = clean(objective.linkedDeliverable);
    if (deliverable) candidates.push({ basis: 'deliverable-title', label: 'Linked deliverable', text: deliverable });

    const parentId = goalLinkId(objective.parentGoalId);
    if (parentId) {
      const parentRow = objectivesById.get(parentId);
      if (parentRow && isOrgLevelGoalType(parentRow.goalType) && clean(parentRow.title)) {
        candidates.push({ basis: 'seeded-goal-row', label: 'Seeded goal row', text: clean(parentRow.title) });
      }
      const legacyTitle = legacyById.get(parentId);
      if (legacyTitle) candidates.push({ basis: 'legacy-objective', label: 'Strategic_Objectives item', text: legacyTitle });
    }

    const matchedIds = new Set<string>();
    let firstBasis: CrosswalkBasis = 'none';
    for (const candidate of candidates) {
      const match = matchGoalByTitle(candidate.text, goals);
      if (match) {
        matchedIds.add(match.goal.id);
        if (firstBasis === 'none') firstBasis = candidate.basis;
        row.evidence.push(`${candidate.label} "${candidate.text}" matches goal "${match.goal.title}"${match.how === 'partial' ? ' (partial title match)' : ''}.`);
      } else {
        row.evidence.push(`${candidate.label} "${candidate.text}" matches no goal.`);
      }
    }

    if (matchedIds.size === 1) {
      row.proposedGoalId = [...matchedIds][0];
      row.basis = firstBasis;
      row.status = 'proposed';
    } else if (matchedIds.size > 1) {
      row.status = 'conflict';
      row.evidence.push('The evidence points to different goals. Choose one.');
    }
  }

  // Objectives whose ParentGoalId names another Unit Objective (the seed's
  // placeholder initiatives) inherit that objective's goal. Repeat so a short
  // chain resolves; stop after a few rounds so a cycle can't loop forever.
  for (let round = 0; round < 3; round += 1) {
    let changed = false;
    for (const row of rows) {
      if (row.status !== 'unresolved') continue;
      const parentId = goalLinkId(objectivesById.get(row.objectiveId)?.parentGoalId);
      const parentRow = parentId ? rowsById.get(parentId) : undefined;
      if (!parentRow || parentRow === row || !parentRow.proposedGoalId) continue;
      if (parentRow.status !== 'linked' && parentRow.status !== 'proposed') continue;
      row.proposedGoalId = parentRow.proposedGoalId;
      row.basis = 'parent-objective';
      row.status = 'proposed';
      row.evidence.push(`Inherits the goal of parent objective "${parentRow.title}".`);
      changed = true;
    }
    if (!changed) break;
  }

  for (const row of rows) {
    if (row.status === 'unresolved' && row.evidence.length === 0) {
      row.evidence.push('No linked deliverable or parent to match against.');
    }
  }

  return rows.sort((a, b) =>
    a.division.localeCompare(b.division) || a.unit.localeCompare(b.unit) || a.title.localeCompare(b.title));
}

export interface CrosswalkChange {
  objectiveId: string;
  revision?: string;
  fromGoalId: string | null;
  toGoalId: string | null;
}

/**
 * The writes an approved crosswalk needs. `choices` holds the reviewer's pick
 * per objective (a goal ID, or null to clear); objectives without a choice use
 * the proposal. Rows whose link would not change are left out.
 */
export function crosswalkChanges(rows: CrosswalkRow[], choices: Record<string, string | null> = {}): CrosswalkChange[] {
  const changes: CrosswalkChange[] = [];
  for (const row of rows) {
    const chosen = Object.prototype.hasOwnProperty.call(choices, row.objectiveId)
      ? goalLinkId(choices[row.objectiveId])
      : row.proposedGoalId;
    if (chosen === row.currentGoalId) continue;
    if (!chosen && !row.currentGoalId) continue;
    changes.push({ objectiveId: row.objectiveId, revision: row.revision, fromGoalId: row.currentGoalId, toGoalId: chosen });
  }
  return changes;
}
