import { useState, useEffect, useRef } from 'react';

// Countdown target: 48 hours from April 2 2026 12:00 PM PNG time (UTC+10)
// = April 4 2026 12:00:00 PM PNG time
const TARGET_ISO = '2026-04-04T12:00:00+10:00';
const TARGET_MS = new Date(TARGET_ISO).getTime();

const WORLDTIME_API = 'https://worldtimeapi.org/api/timezone/Pacific/Port_Moresby';

export interface CountdownState {
    timeLeft: number | null; // ms remaining; 0 = expired; null = not loaded yet
    isExpired: boolean;
    loading: boolean;
}

export function useCountdown(): CountdownState {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const offsetRef = useRef<number>(0); // serverTime - clientTime (ms)
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function init() {
            try {
                const res = await fetch(WORLDTIME_API);
                const data = await res.json();
                // data.unixtime is seconds since epoch
                const serverMs = (data.unixtime as number) * 1000;
                offsetRef.current = serverMs - Date.now();
            } catch {
                // API failed — fall back to device clock (offset stays 0)
                console.warn('[useCountdown] WorldTimeAPI unavailable, using device clock.');
            }

            if (cancelled) return;

            // Compute now and kick off the local tick
            const tick = () => {
                const now = Date.now() + offsetRef.current;
                const remaining = Math.max(0, TARGET_MS - now);
                setTimeLeft(remaining);
            };

            tick();
            tickRef.current = setInterval(tick, 1000);
            setLoading(false);
        }

        init();

        return () => {
            cancelled = true;
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, []);

    const isExpired = timeLeft !== null && timeLeft === 0;

    return { timeLeft, isExpired, loading };
}
