import { useMemo } from 'react';
import { useStaffRoster } from './useStaffRoster';
import { toStaffMember, staffInDivision } from '@/lib/staffDirectory';

export function useStaffMembers(divisionId?: string) {
  const roster = useStaffRoster();
  const staffMembers = useMemo(() => (roster.data || [])
    .filter(s => !divisionId || staffInDivision(s.division, divisionId)).map(toStaffMember), [roster.data, divisionId]);
  return {
    staffMembers, loading: roster.isLoading, error: roster.error,
    refreshStaffMembers: async () => { await roster.refetch(); },
  };
}
