import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { UserSharePointService, UserRole } from '@/services/userSharePointService';
import { UserContext } from '@/types';
import DivisionStaffMap from '@/utils/divisionStaffMap';

/**
 * Fetches the live unit staff roster from the SharePoint UserRoles list.
 * Falls back to DivisionStaffMap entries for the unit if the fetch fails.
 *
 * Used by OverviewTab (staff performance cards) and useSharePointTasks
 * (manager task-visibility filter) so that adding / removing a person in
 * the Admin console is immediately reflected everywhere — no code change needed.
 */
export function useUnitRoster(userContext?: UserContext) {
    const { instance } = useMsal();
    const unitName = userContext?.unit || '';

    const query = useQuery<UserRole[]>({
        queryKey: ['unitRoster', unitName],
        queryFn: async () => {
            if (!unitName) return [];

            try {
                const graphClient = await getGraphClient(instance);
                if (!graphClient) throw new Error('No graph client');

                const service = new UserSharePointService(graphClient);
                await service.initialize();
                const allUsers = await service.getUsers();

                const roster = allUsers.filter(
                    u => u.unit_name?.toLowerCase() === unitName.toLowerCase()
                );

                console.log(`✅ [useUnitRoster] Unit "${unitName}" roster: ${roster.length} members`);
                return roster;
            } catch (err) {
                console.warn('[useUnitRoster] SharePoint fetch failed, falling back to DivisionStaffMap:', err);

                // Graceful fallback: convert static map entries to UserRole shape
                const fallback = DivisionStaffMap.getAllStaff()
                    .filter(s => s.unit?.toLowerCase() === unitName.toLowerCase())
                    .map(s => ({
                        user_email: s.email,
                        user_name: s.name,
                        role_name: 'staff_member',
                        unit_name: s.unit,
                        division_name: s.office_location,
                        is_admin: false,
                    } as UserRole));

                console.log(`⚠️ [useUnitRoster] Fallback DivisionStaffMap — ${fallback.length} members for "${unitName}"`);
                return fallback;
            }
        },
        enabled: !!unitName,
        staleTime: 1000 * 60 * 5,   // 5 min — roster doesn't change often
        gcTime:    1000 * 60 * 10,  // keep in cache 10 min
    });

    const roster = query.data || [];

    return {
        unitRoster: roster,
        /** Lower-cased email set, ready for O(1) lookups */
        unitRosterEmails: roster.map(u => u.user_email.toLowerCase()),
        loading: query.isLoading,
        error: query.error as Error | null,
    };
}
