import { useMemo } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useOfficerProfiles } from '@/hooks/useOfficerProfiles';
import DivisionStaffMap from '../utils/divisionStaffMap';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  job_title: string;
  department: string;
  mobile: string;
  business_phone: string;
  office_location: string;
  division_id: string;
}

export function useDivisionStaff() {
  const { user } = useSupabaseAuth();
  const { data: profiles = [], isLoading: loading } = useOfficerProfiles();

  const staffMembers = useMemo<StaffMember[]>(() => {
    if (profiles.length > 0) {
      // Find the user's division from their profile
      const userProfile = profiles.find(p => p.email?.toLowerCase() === user?.email?.toLowerCase());
      const userDivision = userProfile?.division?.toLowerCase() || '';

      const relevant = userDivision
        ? profiles.filter(p => p.division?.toLowerCase() === userDivision)
        : profiles;

      return relevant.map(p => ({
        id: p.id || p.email,
        name: p.name,
        email: p.email,
        job_title: p.jobTitle,
        department: p.unit,
        mobile: p.phone || '',
        business_phone: p.officeExtension || '',
        office_location: p.division,
        division_id: p.division?.toLowerCase().replace(/\s+/g, '-') || '',
      }));
    }

    // Fallback: static map
    const staff = user?.email
      ? DivisionStaffMap.getStaffForUserDivision(user.email)
      : DivisionStaffMap.getAllStaff();

    return (staff.length > 0 ? staff : DivisionStaffMap.getAllStaff()).map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      job_title: s.job_title,
      department: s.unit,
      mobile: s.mobile,
      business_phone: s.business_phone,
      office_location: s.office_location,
      division_id: s.division_id,
    }));
  }, [profiles, user?.email]);

  return { staffMembers, loading };
}

export default useDivisionStaff;
