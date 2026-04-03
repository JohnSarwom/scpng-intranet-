import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Loader2, AlertTriangle } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';

// ─── Site status override ─────────────────────────────────────────────────────
// Set to true to display the maintenance warning instead of the countdown.
// Flip back to false once the domain issue is resolved.
const SHOW_MAINTENANCE_WARNING = true;

function pad(n: number) {
    return String(Math.floor(n)).padStart(2, '0');
}

function formatTimeLeft(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { hours, minutes, seconds };
}

const TimeUnit: React.FC<{ value: number; label: string }> = ({ value, label }) => (
    <div className="flex flex-col items-center">
        <div className="bg-white/15 backdrop-blur-sm rounded-lg px-2 py-1 min-w-[42px] text-center">
            <span className="text-white font-bold text-xl leading-none tabular-nums">
                {pad(value)}
            </span>
        </div>
        <span className="text-white/60 text-[10px] mt-0.5 uppercase tracking-wide">{label}</span>
    </div>
);

const Separator = () => (
    <span className="text-white/50 font-bold text-lg mb-3 select-none">:</span>
);

// Pulsating "launched" banner shown when countdown expires
const LaunchedBanner: React.FC = () => (
    <motion.div
        className="h-full w-full flex flex-col items-center justify-center text-center px-2"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
    >
        <motion.div
            animate={{
                scale: [1, 1.06, 1],
                textShadow: [
                    '0 0 8px #fbbf24, 0 0 20px #f97316',
                    '0 0 16px #ef4444, 0 0 32px #fbbf24',
                    '0 0 8px #fbbf24, 0 0 20px #f97316',
                ],
            }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 35%, #ef4444 60%, #fbbf24 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 900,
                fontSize: '1.05rem',
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
            }}
        >
            Website Officially Launched!
        </motion.div>

        <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="mt-1.5"
        >
            <span
                style={{
                    background: 'linear-gradient(90deg, #34d399, #60a5fa, #a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                }}
            >
                SCPNG Intranet is LIVE
            </span>
        </motion.div>
    </motion.div>
);

// ─── Maintenance / domain warning banner ─────────────────────────────────────

const MaintenanceBanner: React.FC = () => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="h-full w-full flex flex-col items-center justify-center text-center px-3 bg-white/10 rounded-xl border border-amber-400/40 p-3"
    >
        <motion.div
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="flex items-center gap-1.5 mb-2"
        >
            <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0" />
            <span className="text-amber-300 text-[10px] font-bold uppercase tracking-widest">
                Technical Notice
            </span>
        </motion.div>

        <p className="text-white font-semibold text-xs leading-snug mb-1">
            Website temporarily unavailable
        </p>
        <p className="text-white/60 text-[10px] leading-snug">
            We are experiencing a domain name issue. Our team is working to resolve this as quickly as possible.
        </p>
    </motion.div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const LaunchCountdown: React.FC = () => {
    const { timeLeft, isExpired, loading } = useCountdown();

    if (SHOW_MAINTENANCE_WARNING) {
        return <MaintenanceBanner />;
    }

    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
        );
    }

    if (isExpired) {
        return <LaunchedBanner />;
    }

    if (timeLeft !== null && timeLeft > 0) {
        const { hours, minutes, seconds } = formatTimeLeft(timeLeft);
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full w-full flex flex-col items-center justify-center bg-white/10 rounded-xl border border-white/20 p-3 text-center"
            >
                <div className="flex items-center gap-1.5 mb-2">
                    <Rocket className="h-3.5 w-3.5 text-white/70" />
                    <p className="text-white/70 text-xs font-medium uppercase tracking-widest">Website Launch</p>
                </div>

                <div className="flex items-end gap-1.5">
                    <TimeUnit value={hours} label="hrs" />
                    <Separator />
                    <TimeUnit value={minutes} label="min" />
                    <Separator />
                    <TimeUnit value={seconds} label="sec" />
                </div>
            </motion.div>
        );
    }

    return null;
};

export default LaunchCountdown;
