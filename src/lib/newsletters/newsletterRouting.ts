import {
  assert,
  type Assignment,
  hasRole,
  type Role,
  type Routing,
  type Staff,
} from './newsletterWorkflow.ts';
import { canonicalDivision, isOrganizationDivision } from './organizationDivision.ts';

export const routingRoleLabels: Record<Role, string> = {
  division_approver: 'Divisional approver',
  editor: 'Editorial reviewer',
  publication_approver: 'Final publication approver',
  publisher: 'Publisher',
  clearance: 'Specialist clearance reviewer',
};
export interface RoutingAudit {
  version: string;
  at: string;
  actorOid: string;
  reason: string;
  snapshotFile: string;
}
export interface RoutingDocument extends Routing {
  audit?: RoutingAudit[];
}
export interface RoutingAdminView {
  etag: string | null;
  configured: boolean;
  config: RoutingDocument;
  roster: Staff[];
  warnings: string[];
}

const start = (a: Assignment) =>
  a.startsAt ? Date.parse(a.startsAt) : -Infinity;
const end = (a: Assignment) => a.endsAt ? Date.parse(a.endsAt) : Infinity;
const overlaps = (a: Assignment, b: Assignment) =>
  Math.max(start(a), start(b)) < Math.min(end(a), end(b));
const scopesOverlap = (a: Assignment, b: Assignment) =>
  !a.division || !b.division || a.division === b.division;
const guid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Rebuild staff identity from trusted synchronized lists; never accept client-supplied staff or audit data. */
export function validateRoutingEdit(
  input: unknown,
  roster: Staff[],
  previous?: RoutingDocument,
  now = new Date(),
): RoutingDocument {
  assert(input && typeof input === 'object', 'Routing settings are required.');
  const raw = input as Record<string, unknown>;
  assert(
    roster.length > 0,
    'The synchronized staff roster is empty. Resolve staff sync before saving.',
  );
  assert(
    typeof raw.rpDivision === 'string',
    'Choose the Research & Publication division.',
  );
  const rpDivision = canonicalDivision(raw.rpDivision);
  assert(
    isOrganizationDivision(rpDivision) && roster.some((s) => canonicalDivision(s.division) === rpDivision),
    'The R&P division must exist in the synchronized roster.',
  );
  assert(
    typeof raw.reviewDays === 'number' && Number.isInteger(raw.reviewDays) &&
      raw.reviewDays >= 1 && raw.reviewDays <= 30,
    'Review deadline must be between 1 and 30 working days.',
  );
  assert(
    Array.isArray(raw.assignments) && raw.assignments.length <= 150,
    'At most 150 appointments are allowed.',
  );
  const staff = roster.map((s) => ({ ...s, active: true }));
  const currentIds = new Set(staff.map((s) => s.oid));
  for (const old of previous?.staff || []) {
    if (!currentIds.has(old.oid)) staff.push({ ...old, active: false });
  }
  const divisions = new Set(roster.map((s) => canonicalDivision(s.division)).filter(isOrganizationDivision));
  const assignments: Assignment[] = raw.assignments.map((value: unknown) => {
    assert(value && typeof value === 'object', 'Invalid appointment.');
    const row = value as Record<string, unknown>;
    assert(
      typeof row.oid === 'string' && guid.test(row.oid),
      'Choose a synchronized staff member with an Entra identity.',
    );
    assert(
      typeof row.role === 'string' &&
        Object.prototype.hasOwnProperty.call(routingRoleLabels, row.role),
      'Choose a valid newsletter responsibility.',
    );
    const a: Assignment = {
      oid: row.oid.toLowerCase(),
      role: row.role as Role,
    };
    if (row.division) {
      assert(typeof row.division === 'string', 'Invalid appointment division.');
      a.division = canonicalDivision(row.division);
      assert(
        divisions.has(a.division),
        'The appointment division is absent from the current staff roster.',
      );
    }
    assert(
      a.role !== 'division_approver' || !!a.division,
      'Divisional approvers need an explicit division.',
    );
    for (const key of ['startsAt', 'endsAt'] as const) {
      if (row[key]) {
        assert(
          typeof row[key] === 'string' &&
            /(?:Z|[+-]\d{2}:\d{2})$/.test(row[key]) &&
            Number.isFinite(Date.parse(row[key])),
          'Appointment dates need valid timestamps with a timezone.',
        );
        a[key] = new Date(row[key]).toISOString();
      }
    }
    assert(start(a) < end(a), 'An appointment must end after it starts.');
    const person = staff.find((s) => s.oid === a.oid);
    assert(
      person && (person.active || end(a) <= now.getTime()),
      'An appointed officer has left the synchronized roster. End or remove that appointment.',
    );
    return a;
  });
  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i], b = assignments[j];
      if (!overlaps(a, b) || !scopesOverlap(a, b)) {
        continue;
      }
      if (a.role === b.role && (a.role !== 'publisher' || a.oid === b.oid)) {
        throw new Error(
          `Overlapping ${
            routingRoleLabels[a.role].toLowerCase()
          } appointments. End the existing appointment before the replacement starts.`,
        );
      }
      if (
        a.oid === b.oid && [a.role, b.role].includes('editor') &&
        [a.role, b.role].includes('publication_approver')
      ) {
        throw new Error(
          'The same officer cannot be editorial reviewer and final approver for overlapping divisions and dates.',
        );
      }
    }
  }
  const result: RoutingDocument = {
    staff,
    assignments,
    rpDivision,
    reviewDays: Number(raw.reviewDays),
    audit: previous?.audit || [],
  };
  if (raw.escalationOid) {
    assert(
      typeof raw.escalationOid === 'string' &&
        roster.some((s) => s.oid === raw.escalationOid),
      'Choose a current staff member for escalations.',
    );
    result.escalationOid = raw.escalationOid;
  }
  return result;
}

/** Missing coverage is visible while a pilot is being prepared; the workflow still fails closed. */
export function routingWarnings(config: Routing, now = new Date()): string[] {
  const warnings: string[] = config.staff.filter((s) => s.active && !isOrganizationDivision(s.division))
    .map((s) => `${s.name}: division awaiting confirmation (${s.division}). No division was inferred.`);
  const divisions = [
    ...new Set(config.staff.filter((s) => s.active).map((s) => canonicalDivision(s.division)).filter(isOrganizationDivision)),
  ];
  for (const division of divisions) {
    const roles: Role[] = ['editor', 'publication_approver', 'publisher'];
    if (division !== config.rpDivision) roles.unshift('division_approver');
    for (const role of roles) {
      const people = config.staff.filter((s) =>
        s.active && hasRole(config, s.oid, role, division, now)
      );
      if (!people.length) {
        warnings.push(
          `${division}: no current ${routingRoleLabels[role].toLowerCase()}.`,
        );
      }
    }
  }
  for (const person of config.staff.filter((s) => s.active)) {
    for (
      const role of [
        'division_approver',
        'editor',
        'publication_approver',
      ] as Role[]
    ) {
      if (
        role === 'division_approver' && person.division === config.rpDivision
      ) continue;
      if (hasRole(config, person.oid, role, person.division, now)) {
        warnings.push(
          `${person.name}'s own submissions need a different ${
            routingRoleLabels[role].toLowerCase()
          }; arrange a dated replacement before submission.`,
        );
      }
    }
  }
  for (const a of config.assignments) {
    if (
      !config.staff.some((s) => s.oid === a.oid && s.active) &&
      end(a) > now.getTime()
    ) {
      warnings.push(
        'An active appointment belongs to an officer absent from the current staff roster.',
      );
    }
  }
  return warnings;
}

export function assertRoutingVersion(expected: unknown, actual: string | null) {
  assert(
    expected === actual,
    'Newsletter routing changed. Reload the settings before saving.',
  );
}
