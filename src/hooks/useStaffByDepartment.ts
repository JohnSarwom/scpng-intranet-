import { useMemo } from 'react';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { StaffMember } from '@/types/staff';
import DivisionStaffMap from '@/utils/divisionStaffMap';

const SERVICE_KEYWORDS = ['service account', 'facility', 'information service', 'boardroom', 'enquiries'];

const isServiceAccount = (name: string, title: string, email: string) =>
  SERVICE_KEYWORDS.some(kw =>
    title?.toLowerCase().includes(kw) ||
    name?.toLowerCase().includes(kw) ||
    email?.toLowerCase().includes(kw)
  );

export function useStaffByDepartment() {
  const { user } = useSupabaseAuth();
  const { data: profiles = [], isLoading } = useOfficerProfiles();

  const userEmail = user?.email?.toLowerCase() || '';

  // Find the current user's profile to determine their division
  const userProfile = useMemo(() =>
    profiles.find(p => p.email?.toLowerCase() === userEmail),
    [profiles, userEmail]
  );

  const currentUserDepartment = userProfile?.division || user?.user_metadata?.divisionName || null;

  const staffMembers: StaffMember[] = useMemo(() => {
    // Primary: use live SharePoint officer profiles
    if (profiles.length > 0) {
      return profiles
        .filter(p => !isServiceAccount(p.name || '', p.jobTitle || '', p.email || ''))
        .map(p => ({
          id: p.id || p.email,
          name: p.name,
          email: p.email,
          jobTitle: p.jobTitle,
          department: p.unit,       // unit is what consumers call "department"
          mobile: p.phone || '',
          businessPhone: p.officeExtension || '',
          officeLocation: p.division,
          divisionId: p.division?.toLowerCase().replace(/\s+/g, '-') || '',
        }));
    }

    // Fallback: static map
    return DivisionStaffMap.getAllStaff()
      .filter(s => !isServiceAccount(s.name || '', s.job_title || '', s.email || ''))
      .map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        jobTitle: s.job_title,
        department: s.unit,
        mobile: s.mobile,
        businessPhone: s.business_phone,
        officeLocation: s.office_location,
        divisionId: s.division_id,
      }));
  }, [profiles]);

  return {
    staffMembers,
    loading: isLoading,
    currentUserDepartment,
    isEmpty: staffMembers.length === 0 && !isLoading,
  };
}

export default useStaffByDepartment;
