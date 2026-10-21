import { describe, expect, it } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { fetchStaffRoster } from './staffRosterService';
import { rosterProfiles, chartDivision } from '@/lib/staffRosterProfiles';

function fixture(options: { empty?: boolean; broken?: boolean; duplicate?: boolean } = {}) {
  const rows = options.empty ? [] : [{ id: '1', fields: { EntraUserId: 'u1', Title: 'Updated Name', Email: 'new@scpng.gov.pg', Designation: 'New Title', Division: 'Executive Division' } }];
  if (options.duplicate) rows.push({ ...rows[0], id: '2' });
  const routes: Record<string, unknown> = {
    '/sites/scpng1.sharepoint.com:/sites/scpngintranet': { id: 'site' },
    '/sites/site/lists?$select=id,displayName': { value: [{ id: 'd', displayName: 'SCPNG Staff Directory' }, { id: 'p', displayName: 'Employee_Profiles' }] },
    '/sites/site/lists/d/columns?$select=name,displayName': { value: ['EntraUserId', 'Title', 'Email', 'Designation', 'Division'].map(name => ({ name })) },
    '/sites/site/lists/p/columns?$select=name,displayName': { value: [{ name: 'EntraUserId' }, { name: 'Title' }, { name: 'Department0', displayName: 'Department ' }] },
    '/sites/site/lists/d/items?$expand=fields&$top=200': { value: rows, '@odata.nextLink': 'directory-page-2' },
    'directory-page-2': options.broken ? {} : { value: [{ id: '3', fields: { EntraUserId: 'removed', Title: 'Removed Person', Email: 'removed@scpng.gov.pg', Designation: 'Old', Division: 'Corporate Services Division' } }] },
    '/sites/site/lists/p/items?$expand=fields&$top=200': { value: options.empty ? [] : [{ id: '1', fields: { EntraUserId: 'u1', Title: 'old@scpng.gov.pg', Department0: 'Secretariat Unit' } }] },
    '/users?$select=id,mail,businessPhones,mobilePhone,companyName,givenName,surname,userPrincipalName,preferredLanguage,faxNumber&$expand=manager($select=id,displayName,jobTitle,mail)&$top=999': { value: [{ id: 'u1', businessPhones: ['123'] }, { id: 'unlicensed', mail: 'unlicensed@scpng.gov.pg' }] },
  };
  return { api: (url: string) => ({ select() { return this; }, get: async () => {
    if (!(url in routes)) throw new Error(url);
    return routes[url];
  } }) } as unknown as Client;
}

describe('synced staff roster', () => {
  it('joins by stable identity across email changes, resolves column labels and excludes absent staff', async () => {
    const result = await fetchStaffRoster(fixture({ duplicate: true }));
    expect(result).toEqual([{ id: 'u1', name: 'Updated Name', email: 'new@scpng.gov.pg', jobTitle: 'New Title', unit: 'Secretariat Unit', division: 'Executive Division', phone: '123', contactDetails: { businessPhones: ['123'] } }]);
  });
  it('accepts an empty synchronized roster without restoring legacy users', async () => {
    expect(await fetchStaffRoster(fixture({ empty: true }))).toEqual([]);
  });
  it('rejects incomplete pagination instead of publishing a partial roster', async () => {
    await expect(fetchStaffRoster(fixture({ broken: true }))).rejects.toThrow('Incomplete');
  });
  it('uses roster identity and placement even if strategy details are stale', async () => {
    const staff = await fetchStaffRoster(fixture());
    const result = rosterProfiles(staff, []);
    expect(result[0]).toMatchObject({ name: 'Updated Name', jobTitle: 'New Title', division: 'Office of the Chairman', unit: 'Secretariat Unit' });
    expect(rosterProfiles([], result)).toEqual([]);
    expect(rosterProfiles([{ ...staff[0], name: 'Latest', unit: 'New Unit' }], result)[0]).toMatchObject({ name: 'Latest', unit: 'New Unit' });
    expect(chartDivision('Licensing Market & Supervision Division')).toBe('Licensing, Market & Supervision Division');
    expect(chartDivision('New Division')).toBe('New Division');
  });
});
