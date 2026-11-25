import React, { forwardRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import logoUrl from './assets/scpng-logo.webp';
import { CHRISTMAS_EVENT } from './config';

export type EnvelopePhase = 'intro' | 'idle' | 'opening' | 'zoom';

interface Props {
  phase: EnvelopePhase;
  reducedMotion: boolean;
  onLanded: () => void;
  onOpen: () => void;
  onOpened: () => void;
}

const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_IN: [number, number, number, number] = [0.55, 0, 1, 0.45];
/** Let the backdrop settle before the envelope arrives. */
const FLY_DELAY = 0.6;

/** Wax blob outline: a circle with a soft, irregular edge. */
function waxPath() {
  const pts: string[] = [];
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 46 + 2.6 * Math.sin(7 * t) + 1.6 * Math.sin(13 * t + 1.2) + 1.1 * Math.cos(5 * t + 0.4);
    pts.push(`${(50 + r * Math.cos(t)).toFixed(2)},${(50 + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const Seal = forwardRef<HTMLSpanElement>(function Seal(_, ref) {
  const d = useMemo(waxPath, []);
  return (
    <>
      <svg className="xmas-seal-wax" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <radialGradient id="xmas-wax" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#c42a3e" />
            <stop offset="45%" stopColor="#8e1022" />
            <stop offset="100%" stopColor="#4a040d" />
          </radialGradient>
        </defs>
        <path d={d} fill="url(#xmas-wax)" />
        <circle cx="50" cy="50" r="37" fill="none" stroke="rgba(30,0,4,.35)" strokeWidth="3" />
        <path d="M24 34 A30 30 0 0 1 46 18" stroke="rgba(255,190,190,.45)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
      <span ref={ref} className="xmas-seal-disc">
        <img src={logoUrl} alt="" draggable={false} />
      </span>
    </>
  );
});

/**
 * A gold foil envelope with a wax seal. It flies in, floats, and on click
 * breaks the seal, opens the flap and raises the invitation card.
 */
const GoldenEnvelope = forwardRef<HTMLSpanElement, Props>(function GoldenEnvelope(
  { phase, reducedMotion, onLanded, onOpen, onOpened },
  sealRef,
) {
  const [flapBehind, setFlapBehind] = useState(false);
  const opened = phase === 'opening' || phase === 'zoom';
  const zooming = phase === 'zoom';
  const t = (s: number) => (reducedMotion ? Math.min(s, 0.25) : s);

  const flyIn = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4 } }
    : {
        initial: { x: '-72vw', y: '38vh', rotate: -26, rotateY: 55, scale: 0.42, opacity: 0 },
        animate: { x: 0, y: 0, rotate: 0, rotateY: 0, scale: 1, opacity: 1 },
        transition: {
          x: { delay: FLY_DELAY, duration: 2.1, ease: [0.33, 1, 0.68, 1] },
          y: { delay: FLY_DELAY, duration: 2.1, ease: EASE_IN_OUT },
          rotate: { delay: FLY_DELAY, duration: 2.3, ease: EASE_IN_OUT },
          rotateY: { delay: FLY_DELAY, duration: 2.3, ease: EASE_IN_OUT },
          scale: { delay: FLY_DELAY, duration: 2.1, ease: EASE_IN_OUT },
          opacity: { delay: FLY_DELAY, duration: 0.7, ease: 'easeOut' },
        },
      };

  const floatAnim =
    phase === 'idle' && !reducedMotion
      ? {
          y: [0, -12, 0],
          rotate: [-0.8, 0.8, -0.8],
          transition: { duration: 5.2, repeat: Infinity, ease: 'easeInOut' as const },
        }
      : opened
        ? { y: '25%', rotate: 0, transition: { delay: t(1.1), duration: t(1.0), ease: EASE_IN_OUT } }
        : { y: 0, rotate: 0 };

  const activate = () => {
    if (phase === 'idle') onOpen();
  };

  return (
    <motion.div
      className="xmas-env-wrap"
      style={{ transformPerspective: 1400 }}
      {...flyIn}
      onAnimationComplete={() => phase === 'intro' && onLanded()}
    >
      <motion.div animate={floatAnim}>
        <motion.div
          className="xmas-env"
          role="button"
          tabIndex={phase === 'idle' ? 0 : -1}
          aria-label="Open your invitation"
          aria-disabled={phase !== 'idle'}
          onClick={activate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              activate();
            }
          }}
          whileHover={phase === 'idle' && !reducedMotion ? { scale: 1.02 } : undefined}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        >
          <motion.div
            className="xmas-env-shadow"
            animate={{ opacity: zooming ? 0 : 1 }}
            transition={{ duration: t(0.4) }}
          />
          <motion.div
            className="xmas-env-back"
            animate={{ opacity: zooming ? 0 : 1 }}
            transition={{ duration: t(0.45) }}
          />

          {/* The invitation card */}
          <motion.div
            className="xmas-card"
            style={{ zIndex: zooming ? 6 : 2 }}
            initial={false}
            animate={
              zooming
                ? { y: '-55%', scale: reducedMotion ? 1 : 3.4, opacity: 0, filter: 'blur(6px)' }
                : opened
                  ? { y: '-55%', scale: 1, opacity: 1, filter: 'blur(0px)' }
                  : { y: '0%', scale: 1, opacity: 1, filter: 'blur(0px)' }
            }
            transition={
              zooming
                ? { duration: t(1.0), ease: EASE_IN }
                : { delay: t(1.15), duration: t(1.05), ease: EASE_OUT }
            }
            onAnimationComplete={() => {
              if (phase === 'opening') window.setTimeout(onOpened, reducedMotion ? 100 : 650);
            }}
          >
            <img className="xmas-card-logo" src={logoUrl} alt="" draggable={false} />
            <div className="xmas-card-kicker">You are cordially invited to the</div>
            <div className="xmas-card-title">CHRISTMAS CLOSING EVENT</div>
            <div className="xmas-card-year">{CHRISTMAS_EVENT.year}</div>
            <div className="xmas-card-rule" />
            <div className="xmas-card-meta">
              {CHRISTMAS_EVENT.eventDateLabel} &middot; {CHRISTMAS_EVENT.venue}
            </div>
          </motion.div>

          {/* Gold foil front */}
          <motion.div
            className="xmas-pocket"
            animate={{ opacity: zooming ? 0 : 1, y: zooming && !reducedMotion ? 40 : 0 }}
            transition={{ duration: t(0.5), ease: EASE_IN }}
          >
            <div className="xmas-foil xmas-pocket-left" />
            <div className="xmas-foil xmas-pocket-right" />
            <div className="xmas-pocket-bottom-wrap">
              <div className="xmas-foil xmas-pocket-bottom" />
            </div>
            <div className="xmas-pocket-edge" />
            {!reducedMotion && <div className="xmas-sheen xmas-sheen-pocket" />}
          </motion.div>

          {/* Top flap */}
          <motion.div
            className="xmas-flap"
            style={{ zIndex: flapBehind ? 1 : 4, transformPerspective: 1100 }}
            initial={false}
            animate={{ rotateX: opened ? 180 : 0, opacity: zooming ? 0 : 1 }}
            transition={{
              rotateX: { delay: t(0.35), duration: t(0.9), ease: EASE_IN_OUT },
              opacity: { duration: t(0.4) },
            }}
            onUpdate={(v) => {
              if (!flapBehind && Number(v.rotateX) > 90) setFlapBehind(true);
            }}
          >
            <div className="xmas-flap-face xmas-flap-front">
              <div className="xmas-foil" />
            </div>
            {!reducedMotion && <div className="xmas-flap-face xmas-sheen xmas-sheen-flap" />}
            <div className="xmas-flap-face xmas-flap-back">
              <div />
            </div>
          </motion.div>

          {/* Wax seal */}
          <motion.span
            className="xmas-seal"
            initial={false}
            animate={
              opened
                ? { scale: [1, 1.2, 0], rotate: [0, -10, 28], opacity: [1, 1, 0] }
                : { scale: 1, rotate: 0, opacity: 1 }
            }
            transition={{ duration: t(0.55), ease: 'easeInOut', times: [0, 0.35, 1] }}
            style={{ x: '-50%', y: '-50%' }}
          >
            <Seal ref={sealRef} />
          </motion.span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
});

export default GoldenEnvelope;
