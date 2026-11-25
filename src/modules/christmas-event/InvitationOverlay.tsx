import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import './christmasEvent.css';
import logoUrl from './assets/scpng-logo.webp';
import GoldenEnvelope from './GoldenEnvelope';
import ChristmasEventForm from './ChristmasEventForm';
import { createGoldConfetti, type GoldConfetti } from './goldConfetti';
import { CHRISTMAS_EVENT } from './config';
import type { ChristmasResponse, ChristmasResponseStore } from './christmasEventService';

type Phase = 'intro' | 'idle' | 'opening' | 'zoom' | 'form' | 'thanks';

interface Props {
  store: ChristmasResponseStore;
  initial: ChristmasResponse;
  isUpdate: boolean;
  /** Skip the envelope and go straight to the form (used when reopening to edit). */
  startAtForm?: boolean;
  onSaved: (r: ChristmasResponse) => void;
  onClose: (reason: 'later' | 'done') => void;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function InvitationOverlay({ store, initial, isUpdate, startAtForm, onSaved, onClose }: Props) {
  const reducedMotion = !!useReducedMotion();
  const [phase, setPhase] = useState<Phase>(startAtForm ? 'form' : 'intro');
  const [savedName, setSavedName] = useState('');
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sealRef = useRef<HTMLSpanElement>(null);
  const confettiRef = useRef<GoldConfetti | null>(null);
  const envelopeVisible = phase === 'intro' || phase === 'idle' || phase === 'opening' || phase === 'zoom';
  const cinematic = envelopeVisible;

  // Confetti canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const c = createGoldConfetti(canvasRef.current);
    confettiRef.current = c;
    return () => c.reset();
  }, []);

  // Lock the page behind the overlay.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  // Keep keyboard focus inside the overlay; Escape means "not now" once the envelope has landed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'intro' && phase !== 'opening' && phase !== 'zoom') {
        e.preventDefault();
        onClose(phase === 'thanks' ? 'done' : 'later');
        return;
      }
      if (e.key !== 'Tab' || !rootRef.current) return;
      const items = Array.from(rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!rootRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const handleLanded = useCallback(() => {
    setPhase('idle');
    const c = confettiRef.current;
    if (!c) return;
    c.cannons(0.9);
    c.burst({ x: 0.5, y: 0.42 }, 0.8);
    if (!reducedMotion) c.startDrizzle();
    window.setTimeout(() => rootRef.current?.querySelector<HTMLElement>('.xmas-env')?.focus({ preventScroll: true }), 60);
  }, [reducedMotion]);

  const handleOpen = useCallback(() => {
    setPhase('opening');
    const r = sealRef.current?.getBoundingClientRect();
    if (r && confettiRef.current) {
      confettiRef.current.burst(
        { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
        0.7,
      );
    }
  }, []);

  const handleOpened = useCallback(() => {
    setPhase('zoom');
    confettiRef.current?.stopDrizzle();
    window.setTimeout(() => {
      setPhase('form');
      confettiRef.current?.cannons(0.55);
    }, reducedMotion ? 150 : 520);
  }, [reducedMotion]);

  const handleSubmit = useCallback(
    async (r: ChristmasResponse) => {
      const saved = await store.save(r);
      onSaved(saved);
      setSavedName(saved.fullName.trim().split(/\s+/)[0] || '');
      setPhase('thanks');
      confettiRef.current?.cannons(1.2);
      window.setTimeout(() => confettiRef.current?.burst({ x: 0.5, y: 0.35 }, 1), 350);
    },
    [store, onSaved],
  );

  // Close by itself a while after the thank-you.
  useEffect(() => {
    if (phase !== 'thanks') return;
    const t = window.setTimeout(() => onClose('done'), 7000);
    return () => window.clearTimeout(t);
  }, [phase, onClose]);

  return (
    <motion.div
      ref={rootRef}
      className="xmas-root"
      role="dialog"
      aria-modal="true"
      aria-label={`${CHRISTMAS_EVENT.title} invitation`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(6px)' }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
    >
      <div className="xmas-backdrop" />
      <motion.div
        className="xmas-glow"
        animate={{ opacity: cinematic ? 1 : 0.35, scale: cinematic ? [1, 1.08, 1] : 1 }}
        transition={{ opacity: { duration: 1 }, scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
      />
      {!reducedMotion && (
        <motion.div className="xmas-rays" initial={{ opacity: 0 }} animate={{ opacity: cinematic ? 1 : 0.25 }} transition={{ duration: 1.6 }} />
      )}

      {/* Letterbox bars for the cinematic part */}
      <motion.div
        className="xmas-bar-top"
        initial={{ y: '-100%' }}
        animate={{ y: cinematic ? '0%' : '-100%' }}
        transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.div
        className="xmas-bar-bottom"
        initial={{ y: '100%' }}
        animate={{ y: cinematic ? '0%' : '100%' }}
        transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
      />

      <AnimatePresence>
        {envelopeVisible && (
          <motion.div
            key="scene"
            className="xmas-scene"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div>
              <GoldenEnvelope
                ref={sealRef}
                phase={phase as 'intro' | 'idle' | 'opening' | 'zoom'}
                reducedMotion={reducedMotion}
                onLanded={handleLanded}
                onOpen={handleOpen}
                onOpened={handleOpened}
              />
            </div>
            <motion.div
              className="xmas-caption"
              initial={{ opacity: 0, y: 14 }}
              animate={phase === 'idle' ? { opacity: 1, y: 0 } : { opacity: 0, y: phase === 'intro' ? 14 : -10 }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
            >
              <div className="xmas-caption-script">You&rsquo;re invited</div>
              <div className="xmas-caption-hint">Tap or click the envelope to open your invitation</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'idle' && (
          <motion.button
            key="later"
            type="button"
            className="xmas-later"
            onClick={() => onClose('later')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            Remind me later
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'form' && (
          <motion.div
            key="form"
            className="xmas-form-scroll"
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.9, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.96, filter: 'blur(8px)' }}
            transition={{ duration: reducedMotion ? 0.3 : 1.0, ease: EASE_OUT }}
            style={{ transformOrigin: '50% 30%' }}
          >
            <ChristmasEventForm
              initial={initial}
              isUpdate={isUpdate}
              onSubmit={handleSubmit}
              onLater={() => onClose('later')}
              actionsHost={actionsHost}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed controls live outside the animated form so they stay pinned to the screen. */}
      <AnimatePresence>
        {phase === 'form' && (
          <motion.div
            key="form-controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{ delay: reducedMotion ? 0 : 0.5, duration: 0.6 }}
          >
            <button type="button" className="xmas-close" aria-label="Close (remind me later)" onClick={() => onClose('later')}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div ref={setActionsHost} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'thanks' && (
          <motion.div
            key="thanks"
            className="xmas-thanks"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.35, duration: 0.9, ease: EASE_OUT }}
          >
            <div className="xmas-thanks-card">
              <img src={logoUrl} alt="Securities Commission of Papua New Guinea" />
              <div className="xmas-thanks-title">Thank you{savedName ? `, ${savedName}` : ''}!</div>
              <p className="xmas-thanks-text">
                Your response has been saved for the Christmas Event Organising Committee.
                <br />
                Season&rsquo;s Greetings.
              </p>
              <button
                type="button"
                className="xmas-btn xmas-btn-gold"
                style={{ margin: '0 auto' }}
                onClick={() => onClose('done')}
                autoFocus
              >
                Continue to the intranet
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="xmas-confetti" aria-hidden="true" />
    </motion.div>
  );
}
