import { describe, expect, it } from 'vitest';
import {
  canCreateAsset,
  canModifyAsset,
  canViewAsset,
  type AssetAccessRecord,
  type AssetAccessViewer,
} from './assetAccessPolicy';

const financeAsset: AssetAccessRecord = {
  id: 'finance-1',
  unit: 'Finance Unit',
  division: 'Corporate Services Division',
  assigned_to_email: 'assignee@scpng.gov.pg',
  created_by: 'creator@scpng.gov.pg',
};

const itAsset: AssetAccessRecord = {
  id: 'it-1',
  unit: 'IT Unit',
  division: 'Corporate Services Division',
};

const financeStaff: AssetAccessViewer = {
  email: 'staff@scpng.gov.pg',
  unitName: 'Finance Unit',
  divisionName: 'Corporate Services Division',
  roleName: 'staff_member',
};

describe('asset access policy', () => {
  it('keeps IT assets private from non-IT users in the same division', () => {
    expect(canViewAsset(itAsset, financeStaff)).toBe(false);
    expect(canViewAsset(itAsset, { ...financeStaff, unitName: 'IT Unit' })).toBe(true);
  });

  it('isolates units inside the same division while allowing division directors', () => {
    const adminUnitAsset = {
      unit: 'Administrative Services',
      division: 'Corporate Services Division',
    };
    expect(canViewAsset(adminUnitAsset, financeStaff)).toBe(false);
    expect(canViewAsset(adminUnitAsset, {
      ...financeStaff,
      roleName: 'director',
      jobTitle: 'Director Corporate Services',
    })).toBe(true);
  });

  it('lets an assignee view an out-of-scope asset without modifying it', () => {
    const assignee = { ...financeStaff, email: 'assignee@scpng.gov.pg', divisionName: 'Other Division' };
    expect(canViewAsset(financeAsset, assignee)).toBe(true);
    expect(canModifyAsset(financeAsset, assignee)).toBe(false);
  });

  it('lets the creator update or delete their own asset', () => {
    const creator = { ...financeStaff, email: 'creator@scpng.gov.pg', divisionName: 'Other Division' };
    expect(canViewAsset(financeAsset, creator)).toBe(true);
    expect(canModifyAsset(financeAsset, creator)).toBe(true);
  });

  it('allows managers and admin officers to manage only assets in their org scope', () => {
    const manager = { ...financeStaff, roleName: 'division_manager' };
    const adminOfficer = { ...financeStaff, jobTitle: 'Admin Officer' };
    expect(canModifyAsset(financeAsset, manager)).toBe(true);
    expect(canCreateAsset(adminOfficer)).toBe(true);
    expect(canModifyAsset(itAsset, manager)).toBe(false);
  });
});
