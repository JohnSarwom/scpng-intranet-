import { describe, expect, it } from 'vitest';
import { canonicalDivision, isOrganizationDivision } from './organizationDivision';
import { routingWarnings, validateRoutingEdit } from './newsletterRouting';
import type { Routing, Staff } from './newsletterWorkflow';

describe('newsletter division resolution', () => {
  it.each([
    ['Finance Unit', 'Corporate Services Division'],
    ['Supervision Unit', 'Licensing, Market & Supervision Division'],
    ['Legal Advisory Division', 'Legal Services Division'],
    ['Legal Advisory Unit', 'Legal Services Division'],
  ])('routes %s under its documented parent division', (raw, expected) => {
    expect(canonicalDivision(raw)).toBe(expected);
  });
  it('preserves and flags an unresolved placement without inventing a division', () => {
    const staff: Staff = { oid: '11111111-1111-1111-1111-111111111111', name: 'Monica Abau-Sapulai', email: 'monica@scpng.gov.pg', active: true, division: 'Securities Commission of Papua New Guinea' };
    expect(canonicalDivision(staff.division)).toBe(staff.division);
    expect(isOrganizationDivision(staff.division)).toBe(false);
    const config: Routing = { staff: [staff], assignments: [], reviewDays: 2, rpDivision: 'Research & Publication Division' };
    expect(routingWarnings(config)).toEqual([expect.stringContaining('Monica Abau-Sapulai: division awaiting confirmation')]);
    expect(() => validateRoutingEdit({ ...config, rpDivision: staff.division }, [staff])).toThrow('R&P division');
  });
});
