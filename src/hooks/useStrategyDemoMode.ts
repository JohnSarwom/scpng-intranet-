import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'scpng:strategy-demo-mode';

/**
 * Strategy page demo mode.
 *
 * Purely presentational: when enabled, Strategy.tsx layers generated demo
 * KRAs/KPIs over the live SharePoint results so progress is visible during a
 * demonstration. Turning it off restores the real data immediately — no
 * SharePoint writes are involved either way.
 *
 * Persisted in localStorage so a page refresh mid-demo doesn't drop back to
 * empty progress bars.
 */
export function useStrategyDemoMode() {
    const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            if (isDemoMode) {
                localStorage.setItem(STORAGE_KEY, 'true');
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            // localStorage unavailable (private mode) — demo mode still works for this session
        }
    }, [isDemoMode]);

    const enableDemoMode = useCallback(() => setIsDemoMode(true), []);
    const disableDemoMode = useCallback(() => setIsDemoMode(false), []);
    const toggleDemoMode = useCallback(() => setIsDemoMode(prev => !prev), []);

    return { isDemoMode, enableDemoMode, disableDemoMode, toggleDemoMode };
}
