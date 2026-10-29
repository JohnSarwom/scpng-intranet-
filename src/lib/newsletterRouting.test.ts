import { describe, expect, it } from 'vitest';
import {
  assertRoutingVersion,
  routingWarnings,
  validateRoutingEdit,
} from './newsletters/newsletterRouting';
import { newsletterStaff } from './newsletters/newsletterStaff';
import { hasRole, type Routing, type Staff } from '@/types/newsletter';
const ids = [1, 2, 3, 4, 5].map((i) =>
  `11111111-1111-1111-1111-11111111111${i}`
);
const now = new Date('2026-10-20T00:00:00Z');
const roster: Staff[] = ids.map((oid, i) => ({
  oid,
  name: `Officer ${i}`,
  email: `officer${i}@scpng.gov.pg`,
  division: i === 0
    ? 'Corporate Services Division'
    : 'Research & Publication Division',
  active: true,
}));
function config(): Routing {
  return {
    staff: roster,
    rpDivision: 'Research & Publication Division',
    reviewDays: 2,
    assignments: [
      {
        oid: ids[0],
        role: 'division_approver',
        division: 'Corporate Services Division',
      },
      { oid: ids[1], role: 'editor' },
      { oid: ids[2], role: 'publication_approver' },
      { oid: ids[1], role: 'publisher' },
    ],
  };
}
describe('newsletter routing administration policy', () => {
  it('requires the reviewed settings version and supports first-time creation', () => {
    expect(() => assertRoutingVersion('old', 'new')).toThrow('changed');
    expect(() => assertRoutingVersion(undefined, null)).toThrow('changed');
    expect(() => assertRoutingVersion(null, null)).not.toThrow();
    expect(() => assertRoutingVersion('same', 'same')).not.toThrow();
  });
  it('allows an editor to publish while retaining independent final approval', () => {
    expect(validateRoutingEdit(config(), roster, undefined, now).assignments)
      .toEqual(config().assignments);
  });
  it('ignores forged staff identity, access privileges and audit history', () => {
    const input = {
      ...config(),
      staff: [{ ...roster[0], name: 'Forged admin', active: true }],
      audit: [{ actorOid: 'forged' }],
      isAdmin: true,
    };
    const result = validateRoutingEdit(input, roster, undefined, now);
    expect(result.staff).toEqual(roster);
    expect(result.audit).toEqual([]);
    expect(result).not.toHaveProperty('isAdmin');
  });
  it('retains departed staff as inactive historical identities', () => {
    const old = { ...roster[4], oid: '22222222-2222-2222-2222-222222222222' };
    const result = validateRoutingEdit(config(), roster, {
      ...config(),
      staff: [...roster, old],
    }, now);
    expect(result.staff.find((s) => s.oid === old.oid)?.active).toBe(false);
  });
  it.each([
    'unknown officer',
    'missing division',
    'invalid role',
    'invalid date',
    'reversed dates',
    'deadline',
    'empty roster',
  ])('rejects %s', (kind) => {
    const draft = config();
    if (kind === 'unknown officer') {
      draft.assignments[0].oid = '33333333-3333-3333-3333-333333333333';
    }
    if (kind === 'missing division') delete draft.assignments[0].division;
    if (kind === 'invalid role') {
      Object.assign(draft.assignments[0], { role: 'super_admin' });
    }
    if (kind === 'invalid date') {
      draft.assignments[0].startsAt = '2026-10-20T00:00';
    }
    if (kind === 'reversed dates') {
      Object.assign(draft.assignments[0], {
        startsAt: '2026-10-25T00:00:00Z',
        endsAt: '2026-10-24T00:00:00Z',
      });
    }
    if (kind === 'deadline') draft.reviewDays = 31;
    expect(() =>
      validateRoutingEdit(
        draft,
        kind === 'empty roster' ? [] : roster,
        undefined,
        now,
      )
    ).toThrow();
  });
  it('rejects overlapping replacements, including future appointments', () => {
    const draft = config();
    draft.assignments.push({
      oid: ids[3],
      role: 'editor',
      startsAt: '2026-12-01T00:00:00Z',
    });
    expect(() => validateRoutingEdit(draft, roster, undefined, now)).toThrow(
      'Overlapping',
    );
  });
  it('allows adjacent dated replacements with no overlapping authority', () => {
    const draft = config();
    draft.assignments[1].endsAt = '2026-10-21T00:00:00Z';
    draft.assignments.push({
      oid: ids[3],
      role: 'editor',
      startsAt: '2026-10-21T00:00:00Z',
    });
    const result = validateRoutingEdit(draft, roster, undefined, now);
    const change = new Date('2026-10-21T00:00:00Z');
    expect(hasRole(result, ids[1], 'editor', roster[0].division, change)).toBe(
      false,
    );
    expect(hasRole(result, ids[3], 'editor', roster[0].division, change)).toBe(
      true,
    );
  });
  it('rejects an editor acting as final approver for the same division and dates', () => {
    const draft = config();
    draft.assignments[2].oid = ids[1];
    expect(() => validateRoutingEdit(draft, roster, undefined, now)).toThrow(
      'same officer',
    );
  });
  it('allows independent division scopes but rejects overlapping global appointments', () => {
    const draft = config();
    draft.assignments[1].division = roster[0].division;
    draft.assignments.push({
      oid: ids[3],
      role: 'editor',
      division: roster[1].division,
    });
    expect(() => validateRoutingEdit(draft, roster, undefined, now)).not
      .toThrow();
    delete draft.assignments[1].division;
    expect(() => validateRoutingEdit(draft, roster, undefined, now)).toThrow(
      'Overlapping',
    );
  });
  it('normalizes division aliases consistently with existing workflow decisions', () => {
    const draft = config();
    draft.rpDivision = 'Research and Publication';
    draft.assignments[1].division = 'Research & Publication';
    const result = validateRoutingEdit(draft, roster, undefined, now);
    expect(result.rpDivision).toBe(roster[1].division);
    expect(
      hasRole(
        result,
        ids[1],
        'editor',
        'Research and Publication Division',
        now,
      ),
    ).toBe(true);
  });
  it('shows missing pilot coverage and author independence requirements', () => {
    const warnings = routingWarnings(config(), now);
    expect(warnings.some((w) => w.includes('own submissions'))).toBe(true);
    const empty = { ...config(), assignments: [] };
    expect(
      routingWarnings(empty, now).some((w) =>
        w.includes('no current editorial reviewer')
      ),
    ).toBe(true);
  });
  it('blocks a departed officer until their appointment is ended or removed', () => {
    const draft = config();
    const previous = structuredClone(draft);
    const current = roster.filter((s) => s.oid !== ids[1]);
    expect(() => validateRoutingEdit(draft, current, previous, now)).toThrow(
      'left',
    );
    draft.assignments.filter((a) => a.oid === ids[1]).forEach((a) => {
      a.endsAt = '2026-10-19T00:00:00Z';
    });
    expect(() => validateRoutingEdit(draft, current, previous, now)).not
      .toThrow();
  });
});

describe('trusted synchronized roster for routing', () => {
  function graphFixture(broken = false) {
    const fields = ['EntraUserId', 'Title', 'Email', 'Division', 'Department'];
    const routes: Record<string, unknown> = {
      '/sites/staff/lists?$select=id,displayName': {
        value: [{ id: 'd', displayName: 'SCPNG Staff Directory' }, {
          id: 'p',
          displayName: 'Employee_Profiles',
        }],
      },
      '/sites/staff/lists/d/columns?$select=name,displayName': {
        value: fields.map((name) => ({ name })),
      },
      '/sites/staff/lists/p/columns?$select=name,displayName': {
        value: fields.map((name) => ({
          name: name === 'Department' ? 'Department0' : name,
          displayName: name,
        })),
      },
      '/sites/staff/lists/d/items?$expand=fields&$top=200': {
        value: [{
          id: '1',
          fields: {
            EntraUserId: ids[0],
            Title: 'Current Name',
            Email: 'current@scpng.gov.pg',
            Division: 'Research and Publication',
          },
        }, {
          id: '2',
          fields: {
            EntraUserId: ids[1],
            Title: 'Excluded person',
            Email: 'excluded@scpng.gov.pg',
            Division: 'Old',
          },
        }],
        '@odata.nextLink': '/directory-next',
      },
      '/directory-next': broken ? {} : { value: [] },
      '/sites/staff/lists/p/items?$expand=fields&$top=200': {
        value: [{
          id: '1',
          fields: {
            EntraUserId: ids[0],
            Title: 'previous@scpng.gov.pg',
            Department0: 'Research Unit',
          },
        }],
      },
    };
    return async (path: string) => {
      if (!routes[path]) throw new Error(path);
      return routes[path] as Record<string, unknown>;
    };
  }
  it('joins stable IDs across email changes, pages completely and excludes unmatched people', async () => {
    expect(await newsletterStaff(graphFixture(), 'staff')).toEqual([{
      oid: ids[0],
      email: 'current@scpng.gov.pg',
      name: 'Current Name',
      division: 'Research & Publication Division',
      active: true,
    }]);
  });
  it('refuses an incomplete roster instead of authorizing a partial staff list', async () => {
    await expect(newsletterStaff(graphFixture(true), 'staff')).rejects.toThrow(
      'Incomplete',
    );
  });
});
