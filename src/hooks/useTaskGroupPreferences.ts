import { useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { getGraphClient } from '@/services/graphService';
import { toast } from 'sonner';

interface TaskGroupPreferences {
    hiddenGroups: string[];
    renamedGroups: Record<string, string>;
    groupOrder?: string[];
    lastUpdated?: string;
}

interface StoredSettings {
    component: string;
    userEmail: string;
    preferences: TaskGroupPreferences;
}

export const useTaskGroupPreferences = () => {
    const { session } = useSupabaseAuth();
    const { instance: msalInstance, accounts } = useMsal();

    // Use Supabase email if available, otherwise fallback to MSAL account username
    const account = msalInstance.getActiveAccount() || accounts[0];
    const userEmail = session?.user?.email || account?.username;

    // Initialize from localStorage if available
    const [preferences, setPreferences] = useState<TaskGroupPreferences>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(`taskGroupPreferences_${userEmail}`);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch (e) {
                    console.error("Failed to parse cached preferences", e);
                }
            }
        }
        return {
            hiddenGroups: [],
            renamedGroups: {}
        };
    });

    // Loading is true only if we didn't get cache
    const [loading, setLoading] = useState(() => {
        if (typeof window !== 'undefined') {
            return !localStorage.getItem(`taskGroupPreferences_${userEmail}`);
        }
        return true;
    });

    const [settingsId, setSettingsId] = useState<string | null>(null);

    // Helper to get authenticated service instance
    const getService = useCallback(async () => {
        const account = msalInstance.getActiveAccount();
        if (!account) throw new Error('No active MSAL account');

        const graphClient = await getGraphClient(msalInstance);
        if (!graphClient) throw new Error('Failed to create Graph client');

        const service = new SharePointOpsService(graphClient);
        await service.initialize();
        return service;
    }, [msalInstance]);

    // Load preferences from SharePoint
    const loadPreferences = useCallback(async () => {
        if (!userEmail) return;

        try {
            // Only set loading true if we don't have data (initial fetch without cache)
            // If we have cache, we silently update in background
            // setLoading(true); // Don't block UI if we have cache!

            const service = await getService();

            // Fetch settings
            const allSettings = await service.getViewSettings();

            const mySetting = allSettings.find((s: any) => {
                if (s.component !== 'TaskGroups') return false;
                try {
                    const parsed = typeof s.settings === 'string' ? JSON.parse(s.settings) : s.settings;
                    return parsed && parsed.userEmail === userEmail;
                } catch (e) { return false; }
            });

            if (mySetting) {
                setSettingsId(mySetting.id);
                try {
                    const parsedPrefs = typeof mySetting.settings === 'string' ? JSON.parse(mySetting.settings) : mySetting.settings;
                    const serverPrefs = parsedPrefs.preferences || { hiddenGroups: [], renamedGroups: {} };

                    // Update state (and thus UI) with server data
                    setPreferences(serverPrefs);

                    // Update Cache
                    localStorage.setItem(`taskGroupPreferences_${userEmail}`, JSON.stringify(serverPrefs));
                } catch (e) {
                    console.error("Failed to parse task group preferences", e);
                }
            } else {
                setSettingsId(null);
            }
        } catch (error) {
            console.error("Error loading task group preferences:", error);
        } finally {
            setLoading(false);
        }
    }, [userEmail, getService]);

    // Initial load
    useEffect(() => {
        loadPreferences();
    }, [loadPreferences]);

    // Save preferences to SharePoint (Background Sync)
    const syncPreferences = async (newPrefs: TaskGroupPreferences) => {
        if (!userEmail) {
            console.warn("Cannot sync preferences: No user email");
            return false;
        }

        try {
            const service = await getService();
            const settingsPayload: StoredSettings = {
                component: 'TaskGroups',
                userEmail: userEmail,
                preferences: {
                    ...newPrefs,
                    lastUpdated: new Date().toISOString()
                }
            };

            const serializedSettings = JSON.stringify(settingsPayload);

            if (settingsId) {
                await service.updateGenericViewSetting(settingsId, serializedSettings);
            } else {
                const newSetting = await service.addViewSetting({
                    page: 'Global',
                    component: 'TaskGroups',
                    scope: 'User',
                    settings: serializedSettings
                });
                if (newSetting && newSetting.id) {
                    setSettingsId(newSetting.id);
                }
            }
            return true;
        } catch (error) {
            console.error("Error syncing preferences:", error);
            toast.error("Failed to save changes to server");
            return false;
        }
    };

    // Hide a group
    const hideGroup = async (groupId: string) => {
        const newHidden = [...preferences.hiddenGroups];
        if (!newHidden.includes(groupId)) {
            newHidden.push(groupId);
            const newPrefs = { ...preferences, hiddenGroups: newHidden };

            // Optimistic Update
            setPreferences(newPrefs);
            localStorage.setItem(`taskGroupPreferences_${userEmail}`, JSON.stringify(newPrefs));

            // Background Sync
            await syncPreferences(newPrefs);
        }
    };

    // Restore a group
    const restoreGroup = async (groupId: string) => {
        const newHidden = preferences.hiddenGroups.filter(id => id !== groupId);
        const newPrefs = { ...preferences, hiddenGroups: newHidden };

        // Optimistic Update
        setPreferences(newPrefs);
        localStorage.setItem(`taskGroupPreferences_${userEmail}`, JSON.stringify(newPrefs));

        // Background Sync
        await syncPreferences(newPrefs);
    };

    // Rename a group
    const renameGroup = async (groupId: string, newTitle: string) => {
        const newRenamed = { ...preferences.renamedGroups, [groupId]: newTitle };
        const newPrefs = { ...preferences, renamedGroups: newRenamed };

        // Optimistic Update
        setPreferences(newPrefs);
        localStorage.setItem(`taskGroupPreferences_${userEmail}`, JSON.stringify(newPrefs));

        // Background Sync
        await syncPreferences(newPrefs);
    };

    // Reset name
    const resetGroupName = async (groupId: string) => {
        const newRenamed = { ...preferences.renamedGroups };
        delete newRenamed[groupId];
        const newPrefs = { ...preferences, renamedGroups: newRenamed };

        // Optimistic Update
        setPreferences(newPrefs);
        localStorage.setItem(`taskGroupPreferences_${userEmail}`, JSON.stringify(newPrefs));

        // Background Sync
        await syncPreferences(newPrefs);
    };

    // Reset all
    const resetToDefaults = async () => {
        const newPrefs = { hiddenGroups: [], renamedGroups: {} };

        // Optimistic Update
        setPreferences(newPrefs);
        localStorage.setItem(`taskGroupPreferences_${userEmail}`, JSON.stringify(newPrefs));

        // Background Sync
        await syncPreferences(newPrefs);
    };

    return {
        preferences,
        loading,
        hideGroup,
        restoreGroup,
        renameGroup,
        resetGroupName,
        resetToDefaults,
        refresh: loadPreferences
    };
};
