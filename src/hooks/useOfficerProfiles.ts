import { useQuery } from "@tanstack/react-query";
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "@/services/graphService";
import { OfficerProfile } from "@/components/strategy/OfficerProfileModal";

export const useOfficerProfiles = () => {
    const { instance: msalInstance } = useMsal();

    return useQuery({
        queryKey: ["officerProfiles"],
        queryFn: async () => {
            const graphClient = await getGraphClient(msalInstance);
            if (!graphClient) throw new Error("No Graph Client");

            const site = await graphClient.api("/sites/scpng1.sharepoint.com:/sites/scpngintranet").select("id").get();
            const listCheck = await graphClient.api(`/sites/${site.id}/lists`).filter("displayName eq 'Strategy_Officer_Profiles'").select("id").get();

            if (!listCheck.value || listCheck.value.length === 0) {
                console.warn("[useOfficerProfiles] Strategy_Officer_Profiles list not found in SharePoint.");
                return []; // Return empty array if list hasn't been created yet
            }

            const listId = listCheck.value[0].id;
            // Fetch items
            const response = await graphClient.api(`/sites/${site.id}/lists/${listId}/items?expand=fields`).top(100).get();

            const profiles: OfficerProfile[] = response.value.map((item: any) => {
                const f = item.fields;
                let parsedSkills: string[] = [];
                try {
                    parsedSkills = f.Skills ? JSON.parse(f.Skills) : [];
                } catch (e) {
                    parsedSkills = [];
                }

                return {
                    name: f.Title || 'Unknown',
                    jobTitle: f.JobTitle || '',
                    email: f.Email || '',
                    phone: f.Phone || null,
                    employeeId: f.EmployeeId || '',
                    joinedDate: f.JoinedDate || '',
                    division: f.Division || '',
                    unit: f.Unit || '',
                    summary: f.ProfileSummary || '',
                    skills: parsedSkills,
                    reportsTo: f.ReportsToName ? { name: f.ReportsToName, title: f.ReportsToTitle || '' } : null,
                    directReports: f.DirectReports || 0,
                    officeExtension: f.OfficeExtension || null,
                    timezone: f.Timezone || 'PGT (GMT+10)',
                    statutoryDuty: f.StatutoryDuty || null,
                    profileImageUrl: f.ProfileImageUrl || undefined,
                };
            });
            return profiles;
        },
        enabled: !!msalInstance.getActiveAccount(),
        staleTime: 1000 * 60 * 5, // 5 mins
    });
};
