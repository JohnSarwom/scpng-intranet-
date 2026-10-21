import { describe, expect, it } from 'vitest';
import { applyStaffIdentity, findRosterStaff, staffDivisionId, staffInDivision, toStaffMember, withCurrentStaffNames } from './staffDirectory';
import type { RosterStaff } from '@/services/staffRosterService';

const staff: RosterStaff = { id: 'entra-1', name: 'New Full Name', email: 'new@scpng.gov.pg',
  jobTitle: 'Current Title', unit: 'IT Unit', division: 'Corporate Services Division', phone: '123' };

describe('shared staff identity adapters', () => {
  it('uses stable division IDs across chart headings, directory labels and existing form IDs', () => {
    expect(staffDivisionId('Office of the Chairman')).toBe('executive-division');
    expect(staffInDivision('Executive Division', 'Office of the Chairman')).toBe(true);
    expect(staffInDivision('Licensing Market & Supervision Division', 'licensing-market-supervision-division')).toBe(true);
    expect(staffInDivision('Research & Publication Division', 'research-publication-division')).toBe(true);
    expect(staffInDivision('Legal Services Division', 'Corporate Services Division')).toBe(false);
    expect(staffInDivision('New Division', 'new-division')).toBe(true);
  });
  it('keeps IDs/email as identity and maps current metadata to all staff-member consumers', () => {
    expect(findRosterStaff([staff], ' NEW@SCPNG.GOV.PG ')).toBe(staff);
    expect(findRosterStaff([staff], 'entra-1')).toBe(staff);
    expect(findRosterStaff([staff], 'New Full Name')).toBeUndefined();
    expect(toStaffMember(staff)).toMatchObject({ id: 'entra-1', name: 'New Full Name', department: 'IT Unit', divisionId: 'corporate-services-division' });
  });
  it('overlays HR identity while preserving payroll IDs, sensitive details and historical records', () => {
    const hr = { email: staff.email, employeeId: 'PAY-99', firstName: 'Old', lastName: 'Name', bankAccount: 'unchanged' };
    expect(applyStaffIdentity(hr, [staff])).toMatchObject({ firstName: 'New', lastName: 'Full Name', fullName: staff.name, employeeId: 'PAY-99', bankAccount: 'unchanged' });
    expect(hr.firstName).toBe('Old');
    expect(applyStaffIdentity(hr, [])).toBe(hr);
  });
  it('resolves names on work records and assets without changing saved references or audit history', () => {
    const task = { id: 'task-1', assignees: [{ id: 'entra-1', email: staff.email, name: 'Old Name' }], owner: { email: staff.email, name: 'Old Name' }, createdByEmail: staff.email, createdBy: 'Old Name', comments: [{ actorName: 'Old Name' }] };
    const current = withCurrentStaffNames(task, [staff]);
    expect(current.assignees[0].name).toBe(staff.name);
    expect(current.owner.name).toBe(staff.name);
    expect(current.createdBy).toBe(staff.name);
    expect(current.comments).toBe(task.comments);
    expect(task.assignees[0].name).toBe('Old Name');
    expect(withCurrentStaffNames({ assigned_to: 'Old Name', assigned_to_email: staff.email }, [staff]).assigned_to).toBe(staff.name);
    expect(withCurrentStaffNames(task, []).assignees[0].name).toBe('Old Name');
  });
});
