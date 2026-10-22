import aliases from '@/config/newsletterDivisionAliases.json';

export const organizationDivisions = [
  'Office of the Chairman', 'Corporate Services Division',
  'Licensing, Market & Supervision Division', 'Legal Services Division',
  'Research & Publication Division',
] as const;

export function isOrganizationDivision(value: string): boolean {
  return (organizationDivisions as readonly string[]).includes(canonicalDivision(value));
}

/** Canonical headings shared by the roster presentation and newsletter routing. */
export function canonicalDivision(value: string): string {
  const key = value.toLowerCase().replace(/&/g, 'and').replace(
    /[^a-z0-9]/g,
    '',
  );
  const parent = (aliases as Record<string, string>)[key];
  if (parent) return parent;
  if (['executivedivision', 'officeofthechairman', 'executive'].includes(key)) {
    return 'Office of the Chairman';
  }
  if (key.startsWith('corporateservice')) return 'Corporate Services Division';
  if (key.startsWith('licensing') && key.includes('supervision')) {
    return 'Licensing, Market & Supervision Division';
  }
  if (key.startsWith('legalservice')) return 'Legal Services Division';
  if (key.startsWith('research') && key.includes('publication')) {
    return 'Research & Publication Division';
  }
  return value.trim();
}
