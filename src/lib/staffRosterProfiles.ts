import type { OfficerProfile } from '@/components/strategy/OfficerProfileModal';
import type { RosterStaff } from '@/services/staffRosterService';

import { canonicalDivision as chartDivision } from './newsletters/organizationDivision';
export { chartDivision };

export function rosterProfiles(roster: RosterStaff[], details: OfficerProfile[]): OfficerProfile[] {
  return roster.map(staff => {
    const extra = details.find(p => p.email.trim().toLowerCase() === staff.email);
    return {
      ...extra,
      // The roster always owns identity and placement; strategy data only supplies optional detail.
      id: staff.id,
      name: staff.name,
      email: staff.email,
      jobTitle: staff.jobTitle,
      division: chartDivision(staff.division),
      unit: staff.unit,
      phone: staff.phone || extra?.phone || null,
      employeeId: extra?.employeeId || '',
      joinedDate: extra?.joinedDate || '',
      summary: extra?.summary || '',
      skills: extra?.skills || [],
      reportsTo: extra?.reportsTo || null,
      directReports: extra?.directReports || 0,
      officeExtension: extra?.officeExtension || null,
      timezone: extra?.timezone || 'PGT (GMT+10)',
    };
  });
}
