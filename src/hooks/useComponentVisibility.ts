import { useState, useEffect, useRef } from 'react';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { SharePointOpsService } from '@/services/sharePointOpsService';
import { useRoleBasedAuth } from './useRoleBasedAuth';

export type RoleKey = 'admin' | 'super_admin' | 'manager' | 'staff_member';

export interface ComponentVisibilitySetting {
    id: string;          // SharePoint item ID
    settingKey: string;  // e.g. "strategy-reports"
    page: string;
    component: string;
    description: string;
    visibleTo: RoleKey[];
}

export const VISIBILITY_CACHE_KEY = 'scpng_component_visibility_v3';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEnvelope {
    data: ComponentVisibilitySetting[];
    cachedAt: number;
}

export const DEFAULT_VISIBILITY_SETTINGS: ComponentVisibilitySetting[] = [
    // ── Strategy Page ──────────────────────────────────────────────────────
    {
        id: '',
        settingKey: 'strategy-reports',
        page: 'Strategy',
        component: 'Reports Tab',
        description: 'Reports and data tables tab on the Strategy page',
        visibleTo: ['admin', 'super_admin'],
    },
    {
        id: '',
        settingKey: 'strategy-analytics',
        page: 'Strategy',
        component: 'Analytics Tab',
        description: 'KPI analytics and performance charts on the Strategy page',
        visibleTo: ['admin', 'super_admin', 'manager'],
    },
    // ── Unit Page ──────────────────────────────────────────────────────────
    {
        id: '',
        settingKey: 'unit-staff-metrics',
        page: 'Unit',
        component: 'Staff Metrics Tab',
        description: 'Headcount and staff performance metrics on the Unit page',
        visibleTo: ['admin', 'super_admin', 'manager'],
    },
    // ── HR Profiles Page ───────────────────────────────────────────────────
    {
        id: '',
        settingKey: 'hr-stats-panel',
        page: 'HR Profiles',
        component: 'Stats Panel',
        description: 'Total employees, active count, and contract expiry stats',
        visibleTo: ['admin', 'super_admin', 'manager'],
    },
    {
        id: '',
        settingKey: 'hr-delete-employee',
        page: 'HR Profiles',
        component: 'Delete Employee',
        description: 'Button to permanently remove an employee profile',
        visibleTo: ['admin', 'super_admin'],
    },
    // ── Market Data Page ───────────────────────────────────────────────────
    {
        id: '',
        settingKey: 'market-admin-controls',
        page: 'Market Data',
        component: 'Admin Controls',
        description: 'Data management and upload controls on the Market Data page',
        visibleTo: ['admin', 'super_admin'],
    },
    // ── Strategy Page (continued) ──────────────────────────────────────────
    {
        id: '',
        settingKey: 'strategy-ai-chat',
        page: 'Strategy',
        component: 'Strategy Intelligence',
        description: 'AI-powered strategic analysis and insights panel on the Analytics tab',
        visibleTo: ['admin', 'super_admin', 'manager'],
    },
    // ── Assets Page ────────────────────────────────────────────────────────
    {
        id: '',
        settingKey: 'assets-add-button',
        page: 'Assets',
        component: 'Add Asset Button',
        description: 'Button to register a new asset in the Asset Registry',
        visibleTo: ['admin', 'super_admin', 'manager'],
    },
];

// Read from localStorage cache (used for instant first-render, no flicker).
// Returns DEFAULT_VISIBILITY_SETTINGS if the cache is missing or older than CACHE_TTL_MS,
// ensuring stale admin changes propagate to all users within the TTL window.
export const getCachedSettings = (): ComponentVisibilitySetting[] => {
    try {
        const stored = localStorage.getItem(VISIBILITY_CACHE_KEY);
        if (stored) {
            const envelope: CacheEnvelope = JSON.parse(stored);
            if (Date.now() - envelope.cachedAt < CACHE_TTL_MS) {
                return envelope.data;
            }
            // Cache expired — fall through to defaults so SharePoint fetch runs fresh
        }
    } catch { /* ignore */ }
    return DEFAULT_VISIBILITY_SETTINGS;
};

export const setCachedSettings = (settings: ComponentVisibilitySetting[]) => {
    const envelope: CacheEnvelope = { data: settings, cachedAt: Date.now() };
    localStorage.setItem(VISIBILITY_CACHE_KEY, JSON.stringify(envelope));
};

/**
 * Hook for page components to check visibility.
 * Instantly resolves from localStorage cache, then revalidates from SharePoint in the background.
 */
export const useComponentVisibility = () => {
    const { user, isAdmin } = useRoleBasedAuth();
    const { instance } = useMsal();
    const [settings, setSettings] = useState<ComponentVisibilitySetting[]>(getCachedSettings);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        (async () => {
            try {
                const client = await getGraphClient(instance);
                if (!client) return;
                const service = new SharePointOpsService(client);
                await service.initialize();
                const remote = await service.getComponentVisibilitySettings();
                if (remote.length > 0) {
                    setSettings(remote);
                    setCachedSettings(remote);
                }
            } catch (err) {
                console.warn('[useComponentVisibility] Could not fetch from SharePoint, using cache.', err);
            }
        })();
    }, [instance]);

    const isComponentVisible = (page: string, component: string): boolean => {
        if (!user) return false;
        // Admins always see everything
        if (isAdmin || user.role_name === 'super_admin') return true;

        const setting = settings.find(
            s => s.page.toLowerCase() === page.toLowerCase() &&
                s.component.toLowerCase() === component.toLowerCase()
        );

        // No explicit setting → default visible
        if (!setting) return true;

        return setting.visibleTo.includes(user.role_name as RoleKey);
    };

    return { isComponentVisible, settings };
};

/**
 * Hook for the Admin UI — loads settings and provides save/refresh.
 */
export const useComponentVisibilityAdmin = () => {
    const { instance } = useMsal();
    const [settings, setSettings] = useState<ComponentVisibilitySetting[]>(getCachedSettings);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(false);

    const getService = async () => {
        const client = await getGraphClient(instance);
        if (!client) throw new Error('Graph Client unavailable');
        const service = new SharePointOpsService(client);
        await service.initialize();
        return service;
    };

    const load = async () => {
        setLoading(true);
        try {
            const service = await getService();
            const remote = await service.getComponentVisibilitySettings();
            if (remote.length > 0) {
                setSettings(remote);
                setCachedSettings(remote);
            }
        } catch (err) {
            console.warn('[useComponentVisibilityAdmin] Using cache fallback.', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const updateSetting = async (settingId: string, role: RoleKey, enabled: boolean) => {
        const updated = settings.map(s => {
            if (s.id !== settingId) return s;
            return {
                ...s,
                visibleTo: enabled
                    ? [...s.visibleTo, role]
                    : s.visibleTo.filter(r => r !== role),
            };
        });
        setSettings(updated);
        setCachedSettings(updated);

        try {
            const service = await getService();
            const setting = updated.find(s => s.id === settingId);
            if (setting) await service.updateComponentVisibilitySetting(settingId, setting.visibleTo);
        } catch (err) {
            console.error('[useComponentVisibilityAdmin] Failed to save to SharePoint.', err);
            throw err;
        }
    };

    const initializeList = async () => {
        setInitializing(true);
        try {
            const client = await getGraphClient(instance);
            if (!client) throw new Error('Graph Client unavailable');
            const { SharePointListSetupService } = await import('@/services/sharePointListSetupService');
            const { resetOpsServiceCache } = await import('@/services/sharePointOpsService');
            const site = await client.api('/sites/scpng1.sharepoint.com:/sites/scpngintranet').get();
            const setup = new SharePointListSetupService(client, site.id);
            await setup.createComponentVisibilityList();
            resetOpsServiceCache(); // Force re-resolve so new list ID is picked up
            await load();
        } finally {
            setInitializing(false);
        }
    };

    const addSetting = async (entry: Omit<ComponentVisibilitySetting, 'id'>) => {
        try {
            const service = await getService();
            const created = await service.addComponentVisibilitySetting(entry);
            const updated = [...settings, created];
            setSettings(updated);
            setCachedSettings(updated);
            return created;
        } catch (err) {
            console.error('[useComponentVisibilityAdmin] Failed to add setting.', err);
            throw err;
        }
    };

    const deleteSetting = async (settingId: string) => {
        try {
            const service = await getService();
            await service.deleteComponentVisibilitySetting(settingId);
            const updated = settings.filter(s => s.id !== settingId);
            setSettings(updated);
            setCachedSettings(updated);
        } catch (err) {
            console.error('[useComponentVisibilityAdmin] Failed to delete setting.', err);
            throw err;
        }
    };

    return { settings, loading, initializing, updateSetting, addSetting, deleteSetting, initializeList, refresh: load };
};
