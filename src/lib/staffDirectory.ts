import type { RosterStaff } from '@/services/staffRosterService';
import type { StaffMember } from '@/types/staff';
import { chartDivision } from './staffRosterProfiles';

export const staffEmailKey = (email?: string) => (email || '').trim().toLowerCase();

/** Stable legacy division IDs used by forms, assets and division navigation. */
export function staffDivisionId(division: string): string {
  const name = chartDivision(division);
  const known: Record<string, string> = {
    'Office of the Chairman': 'executive-division',
    'Corporate Services Division': 'corporate-services-division',
    'Licensing, Market & Supervision Division': 'licensing-market-supervision-division',
    'Legal Services Division': 'legal-services-division',
    'Research & Publication Division': 'research-publication-division',
  };
  return known[name] || division.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function staffInDivision(division: string, requested: string): boolean {
  return !!requested && (staffDivisionId(division) === staffDivisionId(requested)
    || staffDivisionId(division) === requested.toLowerCase().trim());
}

export function toStaffMember(staff: RosterStaff): StaffMember {
  return {
    id: staff.id, name: staff.name, email: staff.email, jobTitle: staff.jobTitle,
    department: staff.unit, mobile: staff.contactDetails?.mobilePhone || '',
    businessPhone: staff.contactDetails?.businessPhones?.[0] || staff.phone,
    officeLocation: staff.division, divisionId: staffDivisionId(staff.division),
  };
}

export function findRosterStaff(roster: RosterStaff[], identity: string) {
  const key = staffEmailKey(identity);
  return roster.find(s => s.id === identity || staffEmailKey(s.email) === key);
}

/** Overlay current identity without changing an HR record's payroll ID or historical data. */
export function applyStaffIdentity<T extends { email: string }>(record: T, roster: RosterStaff[]) {
  const staff = findRosterStaff(roster, record.email);
  if (!staff) return record;
  const [firstName, ...rest] = staff.name.split(' ');
  return { ...record, email: staff.email, firstName, lastName: rest.join(' '), fullName: staff.name,
    jobTitle: staff.jobTitle, department: staff.unit, unit: staff.unit, officeLocation: staff.division };
}

type StaffIdentity = Pick<RosterStaff, 'id' | 'name' | 'email'>;

/** Resolve display names by ID/email; saved audit records are never changed. */
export function withCurrentStaffNames<T extends object>(record: T, staff: StaffIdentity[]): T {
  const result: Record<string, unknown> = { ...(record as Record<string, unknown>) };
  const match = (identity: unknown) => typeof identity === 'string'
    ? staff.find(s => s.id === identity || staffEmailKey(s.email) === staffEmailKey(identity)) : undefined;
  const person = (value: unknown) => {
    if (!value || typeof value !== 'object') return value;
    const reference = value as Record<string, unknown>;
    const current = match(reference.email) || match(reference.id);
    return current ? { ...reference, name: current.name, ...('displayName' in reference ? { displayName: current.name } : {}) } : value;
  };
  if (Array.isArray(result.assignees)) result.assignees = result.assignees.map(person);
  if (result.owner && typeof result.owner === 'object') result.owner = person(result.owner);
  for (const [name, email] of [['owner', 'ownerEmail'], ['createdBy', 'createdByEmail'], ['assigned_to', 'assigned_to_email']]) {
    const current = match(result[email]);
    if (current && typeof result[name] === 'string') result[name] = current.name;
  }
  return result as T;
}
