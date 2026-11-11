import { assert, type Staff } from './newsletterWorkflow.ts';
import { canonicalDivision } from './organizationDivision.ts';
type JsonGraph = (path: string) => Promise<Record<string, unknown>>;
type Row = { id: string; fields: Record<string, unknown> };
type Column = { name: string; displayName?: string };
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const valid = (value: string) =>
  !!value && !/^(n\/?a|none|null|undefined|-)$/i.test(value);
const guid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Same two synchronized lists as staffRosterService; never trust browser-supplied identities. */
export async function newsletterStaff(
  graph: JsonGraph,
  siteId: string,
): Promise<Staff[]> {
  assert(/^[a-zA-Z0-9,.-]+$/.test(siteId), 'Invalid staff-site configuration.');
  async function pages<T>(url: string): Promise<T[]> {
    const rows: T[] = [];
    const seen = new Set<string>();
    let next: string | undefined = url;
    while (next) {
      assert(!seen.has(next), 'Repeated staff pagination link.');
      seen.add(next);
      const page = await graph(next);
      assert(
        Array.isArray(page.value),
        'Incomplete synchronized staff response.',
      );
      rows.push(...page.value as T[]);
      next = page['@odata.nextLink'] as string | undefined;
    }
    return rows;
  }
  const lists = await pages<{ id: string; displayName: string }>(
    `/sites/${siteId}/lists?$select=id,displayName`,
  );
  async function read(name: string, labels: string[]) {
    const matches = lists.filter((l) => l.displayName === name);
    assert(
      matches.length === 1,
      `Missing or ambiguous synchronized staff list: ${name}.`,
    );
    const base = `/sites/${siteId}/lists/${matches[0].id}`;
    const columns = await pages<Column>(
      `${base}/columns?$select=name,displayName`,
    );
    const keys = Object.fromEntries(labels.map((label) => {
      const exact = columns.find((c) => c.name === label);
      const found = exact
        ? [exact]
        : columns.filter((c) =>
          clean(c.displayName).toLowerCase() === label.toLowerCase()
        );
      assert(
        found.length === 1,
        `Missing or ambiguous staff field: ${name}/${label}.`,
      );
      return [label, found[0].name];
    }));
    return (await pages<Row>(`${base}/items?$expand=fields&$top=200`)).sort((
      a,
      b,
    ) => Number(a.id) - Number(b.id)).map((row) =>
      Object.fromEntries(
        labels.map((label) => [label, clean(row.fields[keys[label]])]),
      )
    );
  }
  const [directory, profiles] = await Promise.all([
    read('SCPNG Staff Directory', [
      'EntraUserId',
      'Title',
      'Email',
      'Division',
    ]),
    read('Employee_Profiles', ['EntraUserId', 'Title', 'Department']),
  ]);
  const result: Staff[] = [];
  const seen = new Set<string>();
  for (const row of directory) {
    const oid = row.EntraUserId.toLowerCase();
    const email = row.Email.toLowerCase();
    const profile = profiles.find((p) => p.EntraUserId.toLowerCase() === oid);
    if (
      !guid.test(oid) || !profile || !valid(row.Title) ||
      !valid(row.Division) || !valid(profile.Department)
    ) continue;
    if (
      !/^[^@\s]+@scpng\.gov\.pg$/.test(email) ||
      ['automation', 'allstaff', 'allofficers', 'boardroom'].includes(
        email.split('@')[0],
      )
    ) continue;
    if (seen.has(oid) || seen.has(email)) continue;
    seen.add(oid);
    seen.add(email);
    result.push({
      oid,
      email,
      name: row.Title,
      division: canonicalDivision(row.Division),
      active: true,
    });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
