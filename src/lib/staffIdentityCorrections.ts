import approved from '@/config/staffIdentityCorrections.json';
import type { RosterStaff } from '@/services/staffRosterService';

export const STAFF_CORRECTION_BATCH = 'staff-placement-2026-10-20-v1';
export const STAFF_SYNC_FLOW_ID = 'c94209f3-84ce-44d3-a3c3-ba73bb638fed';
export const STAFF_IDENTITY_CORRECTIONS = approved;
export const identityText = (value: unknown) =>
  typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLowerCase()
    : '';

/** Explicitly approved placements; never admit a new staff member or grant privileges. */
export function correctRosterIdentity(staff: RosterStaff): RosterStaff {
  const match = approved.find((c) =>
    c.email === identityText(staff.email) &&
    identityText(c.name) === identityText(staff.name)
  );
  return match
    ? {
      ...staff,
      name: match.name,
      jobTitle: match.jobTitle,
      division: match.division,
      unit: match.unit,
    }
    : staff;
}

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
export const ORIGINAL_STAFF_SELECT = "@item()?['outputs']";
/** Stable equality tolerates the API reordering object keys, but preserves array order. */
export function definitionFingerprint(value: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
      ? Object.fromEntries(
        Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map((
          [k, item],
        ) => [k, canonical(item)]),
      )
      : v;
  return JSON.stringify(canonical(value));
}
/** The native sync keeps all licence/eligibility metadata and changes only approved placement. */
export function correctedStaffSelect(): string {
  const source = "item()?['outputs']";
  let expression = source;
  for (const c of [...approved].reverse()) {
    const normalizedName =
      `replace(replace(replace(toLower(trim(coalesce(${source}?['displayName'], ''))), '  ', ' '), '  ', ' '), '  ', ' ')`;
    const matches =
      `and(equals(toLower(trim(coalesce(${source}?['mail'], ''))), ${
        quote(c.email)
      }), equals(${normalizedName}, ${quote(c.name.toLowerCase())}))`;
    let corrected = source;
    for (
      const [key, value] of Object.entries({
        officeLocation: c.division,
        department: c.unit,
        jobTitle: c.jobTitle,
      })
    ) corrected = `setProperty(${corrected}, ${quote(key)}, ${quote(value)})`;
    expression = `if(${matches}, ${corrected}, ${expression})`;
  }
  return '@' + expression;
}

export interface StaffSyncFlow {
  name?: string;
  etag?: string;
  properties: {
    displayName: string;
    state?: string;
    definition: {
      actions: Record<
        string,
        { type?: string; inputs?: unknown; [key: string]: unknown }
      >;
      [key: string]: unknown;
    };
    connectionReferences?: Record<string, unknown>;
    [key: string]: unknown;
  };
}
export function correctedSyncFlow(flow: StaffSyncFlow): StaffSyncFlow {
  if (!flow?.properties?.displayName?.startsWith('SCPNG Staff Lists')) {
    throw new Error(
      'The configured flow is not the staff-list synchronisation flow.',
    );
  }
  const select = flow.properties.definition?.actions?.All_profiles;
  const input = select?.inputs as
    | { from?: string; select?: unknown }
    | undefined;
  if (
    select?.type !== 'Select' || !input ||
    input.from !== "@first(body('Profile_results'))?['outputs']" ||
    ![ORIGINAL_STAFF_SELECT, correctedStaffSelect()].includes(
      String(input.select),
    )
  ) {
    throw new Error(
      'The staff sync shape has changed. Review its definition before applying corrections.',
    );
  }
  const result = structuredClone(flow);
  (result.properties.definition.actions.All_profiles.inputs as {
    select: string;
  }).select = correctedStaffSelect();
  return result;
}

export interface RoleInventoryRow {
  id: string;
  fields: Record<string, unknown>;
}
export function reviewRoleInventory(
  rows: RoleInventoryRow[],
  staffEmails: string[],
) {
  const current = new Set(staffEmails.map(identityText));
  const counts = new Map<string, number>();
  for (const row of rows) {
    const email = identityText(row.fields.Title);
    counts.set(email, (counts.get(email) || 0) + 1);
  }
  return rows.filter((row) =>
    !current.has(identityText(row.fields.Title)) ||
    (counts.get(identityText(row.fields.Title)) || 0) > 1
  ).map((row) => ({
    id: row.id,
    email: String(row.fields.Title || ''),
    name: String(row.fields.Name || ''),
    role: String(row.fields.Role || ''),
    reason: !current.has(identityText(row.fields.Title))
      ? 'Not matched to the synchronized staff roster; review service accounts and legacy identities.'
      : 'Duplicate email; compare permissions before deciding what to retain.',
  }));
}
