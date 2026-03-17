import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOpsService } from './useSharePointOps';
import { RegulatoryCase, KPIStats, CaseType, CaseRisk, CaseStatus } from '@/modules/regulatory/types';

const LIST_NAME = 'Regulatory_Intelligence_Cases';

export function useRegulatoryCases() {
    const getService = useOpsService();

    const query = useQuery({
        queryKey: ['sharePoint', 'regulatoryCases'],
        queryFn: async () => {
            try {
                const service = await getService();

                // 1. Resolve List ID
                if (!service.listIds['REGULATORY_CASES']) {
                    const lists = await service.client.api(`/sites/${service.siteId}/lists`).select('id,displayName').get();
                    const targetList = lists.value.find((l: any) => l.displayName === LIST_NAME);
                    if (targetList) {
                        service.listIds['REGULATORY_CASES'] = targetList.id;
                    } else {
                        throw new Error(`SharePoint list ${LIST_NAME} not found.`);
                    }
                }

                // 2. Fetch Items
                const listId = service.listIds['REGULATORY_CASES'];
                const response = await service.client
                    .api(`/sites/${service.siteId}/lists/${listId}/items`)
                    .expand('fields')
                    .get();

                console.log(`✅ [useRegulatoryCases] Fetched ${response.value?.length || 0} items`);

                // 3. Map to RegulatoryCase Type
                const cases: RegulatoryCase[] = response.value.map((item: any) => {
                    const f = item.fields;
                    return {
                        caseId: f.CaseId || `RI-ERR-${item.id}`,
                        type: (f.CaseType as CaseType) || 'enquiry',
                        category: f.Category || 'Uncategorized',
                        risk: (f.RiskLevel as CaseRisk) || 'LOW',
                        status: (f.Status as CaseStatus) || 'RECEIVED',
                        source: f.Source,
                        anonymous: f.Anonymous,
                        title: f.Title,
                        description: f.Description,
                        assignedUnit: f.AssignedUnit || 'Unassigned',
                        assignedOfficer: f.AssignedOfficer,
                        createdAt: f.Created || new Date().toISOString(),
                        lastUpdate: f.LastUpdate || f.Modified,
                        secureToken: f.SecureToken,
                        summary: f.Summary,
                        reporterName: f.ReporterName,
                        reporterContact: f.ReporterContact,
                        attachments: f.Attachements || f.Attachments
                    };
                });

                // 4. Resolve Attachment URLs if they are DriveItem IDs (b!...)
                const resolvedCases = await Promise.all(cases.map(async (c) => {
                    if (c.attachments && c.attachments.startsWith('b!')) {
                        try {
                            // First try to get the drive item directly
                            const driveItem = await service.client
                                .api(`/drives/${c.attachments.split('!')[0]}/items/${c.attachments.split('!')[1]}`)
                                .select('@microsoft.graph.downloadUrl,webUrl')
                                .get();

                            if (driveItem['@microsoft.graph.downloadUrl']) {
                                return { ...c, attachments: driveItem['@microsoft.graph.downloadUrl'] };
                            } else if (driveItem.webUrl) {
                                return { ...c, attachments: driveItem.webUrl };
                            }
                        } catch (e) {
                            console.warn(`[useRegulatoryCases] Could not resolve attachment ID ${c.attachments}`, e);
                        }
                    }
                    return c;
                }));

                // Sort by newest first
                resolvedCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                return resolvedCases;

            } catch (err) {
                console.error('❌ [useRegulatoryCases] Error fetching cases:', err);
                return [];
            }
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });

    // 4. Auto-Calculate KPIs based on the cases
    const cases = query.data || [];

    // Check if status is one of the typically 'open' states
    const openCasesCount = cases.filter(c =>
        ['RECEIVED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED'].includes(c.status)
    ).length;

    const highRiskCount = cases.filter(c => c.risk === 'HIGH').length;
    const criticalAlertsCount = cases.filter(c => c.risk === 'CRITICAL').length;

    const stats: KPIStats = {
        totalReports: cases.length,
        openCases: openCasesCount,
        highRisk: highRiskCount,
        criticalAlerts: criticalAlertsCount
    };

    const queryClient = useQueryClient();

    const updateMutation = useMutation({
        mutationFn: async ({ caseId, updates }: { caseId: string; updates: Partial<RegulatoryCase> }) => {
            const service = await getService();

            if (!service.listIds['REGULATORY_CASES']) {
                const lists = await service.client.api(`/sites/${service.siteId}/lists`).select('id,displayName').get();
                const targetList = lists.value.find((l: any) => l.displayName === LIST_NAME);
                if (targetList) {
                    service.listIds['REGULATORY_CASES'] = targetList.id;
                } else {
                    throw new Error(`SharePoint list ${LIST_NAME} not found.`);
                }
            }

            const listId = service.listIds['REGULATORY_CASES'];

            // Find the SharePoint item ID by CaseId field
            const items = await service.client
                .api(`/sites/${service.siteId}/lists/${listId}/items`)
                .expand('fields')
                .filter(`fields/CaseId eq '${caseId}'`)
                .top(1)
                .get();

            if (!items.value || items.value.length === 0) {
                throw new Error(`Case ${caseId} not found in SharePoint.`);
            }

            const spItemId = items.value[0].id;

            // Map RegulatoryCase fields to SharePoint columns
            const fields: Record<string, any> = {};
            if (updates.category !== undefined) fields.Category = updates.category;
            if (updates.risk !== undefined) fields.RiskLevel = updates.risk;
            if (updates.status !== undefined) fields.Status = updates.status;
            if (updates.assignedUnit !== undefined) fields.AssignedUnit = updates.assignedUnit;
            if (updates.assignedOfficer !== undefined) fields.AssignedOfficer = updates.assignedOfficer;
            if (updates.description !== undefined) fields.Description = updates.description;
            if (updates.summary !== undefined) fields.Summary = updates.summary;
            if (updates.source !== undefined) fields.Source = updates.source;
            if (updates.anonymous !== undefined) fields.Anonymous = updates.anonymous;
            if (updates.reporterName !== undefined) fields.ReporterName = updates.reporterName;
            if (updates.reporterContact !== undefined) fields.ReporterContact = updates.reporterContact;
            fields.LastUpdate = new Date().toISOString();

            await service.client
                .api(`/sites/${service.siteId}/lists/${listId}/items/${spItemId}/fields`)
                .patch(fields);

            return { caseId, updates };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sharePoint', 'regulatoryCases'] });
        },
    });

    return {
        cases,
        stats,
        loading: query.isLoading,
        error: query.error,
        refresh: query.refetch,
        updateCase: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
    };
}
