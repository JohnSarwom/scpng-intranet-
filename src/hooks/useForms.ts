/**
 * useForms Hook
 * Manages fetching and updating forms and groups from SharePoint
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { FormsSharePointService, FormGroup, FormRegistration } from '@/services/formsSharePointService';
import { Logger } from '@/utils/logger';

export function useForms() {
    const { client } = useMicrosoftGraph();
    const [service, setService] = useState<FormsSharePointService | null>(null);
    const [groups, setGroups] = useState<FormGroup[]>([]);
    const [registrations, setRegistrations] = useState<FormRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const provisionedRef = useRef(false);

    useEffect(() => {
        if (client) {
            setService(new FormsSharePointService(client));
        }
    }, [client]);

    // Auto-provision Website Feedback SharePoint resources on first load
    useEffect(() => {
        if (!client || provisionedRef.current) return;
        provisionedRef.current = true;

        (async () => {
            try {
                const { SharePointListSetupService } = await import('@/services/sharePointListSetupService');
                const site = await client.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
                const setup = new SharePointListSetupService(client, site.id);
                await setup.setupWebsiteFeedbackResources();
                Logger.info('✅ [useForms] Website Feedback resources provisioned');
            } catch (e) {
                Logger.error('⚠️ [useForms] Website Feedback provisioning silently failed', e);
            }
        })();
    }, [client]);

    const fetchData = useCallback(async () => {
        if (!service) return;

        setLoading(true);
        setError(null);
        try {
            const [fetchedGroups, fetchedRegistrations] = await Promise.all([
                service.getGroups(),
                service.getRegistrations()
            ]);
            setGroups(fetchedGroups);
            setRegistrations(fetchedRegistrations);
        } catch (err: any) {
            Logger.error('❌ [useForms] Failed to fetch forms data', err);
            setError(err.message || 'Failed to fetch forms data');
        } finally {
            setLoading(false);
        }
    }, [service]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addGroup = async (group: Partial<FormGroup>) => {
        if (!service) return;
        try {
            const newGroup = await service.addGroup(group);
            setGroups(prev => [...prev, newGroup]);
            return newGroup;
        } catch (err: any) {
            Logger.error('❌ [useForms] addGroup failed', err);
            throw err;
        }
    };

    const addForm = async (form: Partial<FormRegistration>) => {
        if (!service) return;
        try {
            const newForm = await service.addRegistration(form);
            setRegistrations(prev => [...prev, newForm]);
            return newForm;
        } catch (err: any) {
            Logger.error('❌ [useForms] addForm failed', err);
            throw err;
        }
    };

    return {
        groups,
        registrations,
        loading,
        error,
        addGroup,
        addForm,
        refresh: fetchData
    };
}
