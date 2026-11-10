import type { Client } from '@microsoft/microsoft-graph-client';
import { correctRosterIdentity } from '@/lib/staffIdentityCorrections';

export interface RosterStaff {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  unit: string;
  division: string;
  phone: string;
  contactDetails?: {
    businessPhones?: string[]; mobilePhone?: string; companyName?: string;
    givenName?: string; surname?: string; userPrincipalName?: string; preferredLanguage?: string; faxNumber?: string;
    manager?: { id: string; displayName: string; jobTitle?: string; mail?: string };
  };
}

type Fields = Record<string, unknown>;
interface ListItem { id: string; fields: Fields }
interface Column { name: string; displayName?: string }
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const present = (value: string) => !!value && !/^(n\/?a|none|null|undefined|-)$/i.test(value);
const excluded = new Set(['automation', 'allstaff', 'allofficers', 'boardroom']);

async function pages<T>(client: Client, url: string): Promise<T[]> {
  const values: T[] = [];
  const visited = new Set<string>();
  let next: string | undefined = url;
  while (next) {
    if (visited.has(next)) throw new Error('Repeated staff-list pagination link');
    visited.add(next);
    const page = await client.api(next).get();
    if (!Array.isArray(page.value)) throw new Error('Incomplete staff-list response');
    values.push(...page.value);
    next = page['@odata.nextLink'];
  }
  return values;
}

function column(columns: Column[], label: string): string {
  const exact = columns.find(c => c.name === label);
  if (exact) return exact.name;
  const matches = columns.filter(c => clean(c.displayName).toLowerCase() === label.toLowerCase());
  if (matches.length !== 1) throw new Error(`Missing or ambiguous staff column: ${label}`);
  return matches[0].name;
}

/** Read the two lists maintained by the licensed-staff sync. Never use legacy rows as a roster fallback. */
export async function fetchStaffRoster(client: Client): Promise<RosterStaff[]> {
  const site = await client.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').select('id').get();
  const lists = await pages<{ id: string; displayName: string }>(client, `/sites/${site.id}/lists?$select=id,displayName`);
  const read = async (name: string, labels: string[]) => {
    const list = lists.find(l => l.displayName === name);
    if (!list) throw new Error(`Staff list unavailable: ${name}`);
    const base = `/sites/${site.id}/lists/${list.id}`;
    const columns = await pages<Column>(client, `${base}/columns?$select=name,displayName`);
    const keys = Object.fromEntries(labels.map(label => [label, column(columns, label)]));
    const items = await pages<ListItem>(client, `${base}/items?$expand=fields&$top=200`);
    return items.sort((a, b) => Number(a.id) - Number(b.id)).map(item =>
      Object.fromEntries(labels.map(label => [label, clean(item.fields[keys[label]])]))
    );
  };
  const [directory, profiles] = await Promise.all([
    read('SCPNG Staff Directory', ['EntraUserId', 'Title', 'Email', 'Designation', 'Division']),
    read('Employee_Profiles', ['EntraUserId', 'Title', 'Department']),
  ]);
  const byId = new Map<string, Record<string, string>>();
  const byEmail = new Map<string, Record<string, string>>();
  // Reads are sorted by item ID: retain the lowest row consistently during sync cleanup.
  for (const profile of profiles) {
    if (profile.EntraUserId && !byId.has(profile.EntraUserId)) byId.set(profile.EntraUserId, profile);
    const email = profile.Title.toLowerCase();
    if (!byEmail.has(email)) byEmail.set(email, profile);
  }
  const seen = new Set<string>();
  const roster: RosterStaff[] = [];
  for (const row of directory) {
    const email = row.Email.toLowerCase();
    // Stable identity wins. Email matching is only for rows predating the sync's ID column.
    const profile = row.EntraUserId ? byId.get(row.EntraUserId) : byEmail.get(email);
    if (!profile || !present(row.Title) || !present(row.Division) || !present(profile.Department)) continue;
    if (!/^[^@\s]+@scpng\.gov\.pg$/.test(email) || excluded.has(email.split('@')[0])) continue;
    const id = row.EntraUserId || email;
    if (seen.has(id) || seen.has(email)) continue;
    seen.add(id);
    seen.add(email);
    roster.push({ id, name: row.Title, email, jobTitle: row.Designation, unit: profile.Department, division: row.Division, phone: '' });
  }
  // Phone numbers are not mapped by the sync. Enrich only admitted staff; a directory
  // read failure must never replace the roster with all tenant accounts.
  try {
    const users = await pages<NonNullable<RosterStaff['contactDetails']> & { id: string; mail?: string }>(
      client, '/users?$select=id,mail,businessPhones,mobilePhone,companyName,givenName,surname,userPrincipalName,preferredLanguage,faxNumber&$expand=manager($select=id,displayName,jobTitle,mail)&$top=999'
    );
    for (const staff of roster) {
      const user = users.find(u => u.id === staff.id || (!staff.id.includes('@') ? false : clean(u.mail).toLowerCase() === staff.email));
      staff.phone = user?.businessPhones?.[0] || user?.mobilePhone || '';
      if (user) {
        const { id: _id, mail: _mail, ...details } = user;
        staff.contactDetails = details;
      }
    }
  } catch {
    console.warn('[staffRoster] Phone enrichment unavailable; using the synchronized roster.');
  }
  return roster.map(correctRosterIdentity).sort((a, b) => a.name.localeCompare(b.name));
}
