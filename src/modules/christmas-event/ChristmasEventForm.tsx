import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import artworkUrl from './assets/form-artwork.webp';
import logoUrl from './assets/scpng-logo.webp';
import {
  ARRANGEMENT_OPTIONS,
  ARRANGEMENT_ROWS_Y,
  ATTENDANCE_OPTIONS,
  ATTENDANCE_ROWS_Y,
  CHRISTMAS_EVENT,
  DIVISION_UNIT_SUGGESTIONS,
  FIELD_BOXES,
  LOGO_MEDALLION,
  TICK_ROW,
} from './config';
import type { ChristmasResponse } from './christmasEventService';
import { validateChristmasResponse, type ChristmasField } from './validation';
import { describeSaveError } from './saveErrors';

type Box = { x: number; y: number; w: number; h: number };
const at = (b: Box) => ({ '--x': b.x, '--y': b.y, '--w': b.w, '--h': b.h }) as React.CSSProperties;
const medallionBox: Box = {
  x: LOGO_MEDALLION.cx - LOGO_MEDALLION.d / 2,
  y: LOGO_MEDALLION.cy - LOGO_MEDALLION.d / 2,
  w: LOGO_MEDALLION.d,
  h: LOGO_MEDALLION.d,
};

const draftKey = (email: string) => `${CHRISTMAS_EVENT.id}:draft:${email.toLowerCase()}`;

interface Props {
  initial: ChristmasResponse;
  isUpdate: boolean;
  onSubmit: (r: ChristmasResponse) => Promise<void>;
  onLater: () => void;
  /**
   * Where the action bar is drawn. It must sit outside any animated (transformed
   * or filtered) parent, or "position: fixed" stops being fixed to the screen.
   */
  actionsHost: HTMLElement | null;
}

/**
 * The form exactly as designed: the artwork is the page and each working
 * field sits on the box drawn for it. Positions come from config.ts.
 */
export default function ChristmasEventForm({ initial, isUpdate, onSubmit, onLater, actionsHost }: Props) {
  const [value, setValue] = useState<ChristmasResponse>(() => {
    if (isUpdate) return initial;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey(initial.email)) || 'null');
      return saved ? { ...initial, ...saved, email: initial.email } : initial;
    } catch {
      return initial;
    }
  });
  const [invalid, setInvalid] = useState<Set<ChristmasField>>(new Set());
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({
    text: isUpdate ? 'You can change your answers and submit again.' : 'Fill in the form, then press Submit.',
  });
  const [saving, setSaving] = useState(false);
  const refs = useRef<Partial<Record<ChristmasField, HTMLElement | null>>>({});

  const suggestions = useMemo(
    () => Object.entries(DIVISION_UNIT_SUGGESTIONS).flatMap(([d, units]) => units.map((u) => `${d} / ${u}`)),
    [],
  );

  // Keep a draft on this device so a refresh or "Not now" loses nothing.
  useEffect(() => {
    if (isUpdate) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey(value.email), JSON.stringify(value));
      } catch {
        /* storage full or blocked: drafts are a convenience only */
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [value, isUpdate]);

  // Start in the first empty box.
  useEffect(() => {
    const first: ChristmasField = value.fullName ? (value.divisionUnit ? 'attendance' : 'divisionUnit') : 'fullName';
    const el = refs.current[first];
    const target = el instanceof HTMLFieldSetElement ? el.querySelector('input') : el;
    const t = window.setTimeout(() => target?.focus({ preventScroll: true }), 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof ChristmasResponse>(k: K, v: ChristmasResponse[K]) => {
    const nextValue = { ...value, [k]: v };
    setValue(nextValue);
    if (!invalid.size) return;
    // Once someone starts fixing flagged answers, keep the message in step with what is left.
    const flagged = validateChristmasResponse(nextValue).filter((p) => invalid.has(p.field));
    setInvalid(new Set(flagged.map((p) => p.field)));
    setStatus(
      flagged.length
        ? { text: flagged[0].message + (flagged.length > 1 ? ` (${flagged.length} items to fix)` : ''), error: true }
        : { text: 'Thank you. Press Submit when you are ready.' },
    );
  };

  const cls = (field: ChristmasField, base: string) => (invalid.has(field) ? `${base} xmas-invalid` : base);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const problems = validateChristmasResponse(value);
    if (problems.length) {
      setInvalid(new Set(problems.map((p) => p.field)));
      setStatus({
        text: problems[0].message + (problems.length > 1 ? ` (${problems.length} items to fix)` : ''),
        error: true,
      });
      const el = refs.current[problems[0].field];
      const target = el instanceof HTMLFieldSetElement ? el.querySelector('input') : el;
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
      return;
    }
    setInvalid(new Set());
    setSaving(true);
    setStatus({ text: 'Saving your response…' });
    try {
      await onSubmit(value);
      try {
        localStorage.removeItem(draftKey(value.email));
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error('[ChristmasEvent] save failed', err);
      setStatus({ text: describeSaveError(err), error: true });
      setSaving(false);
    }
  };

  const tickGroup = (
    name: 'attendance' | 'arrangement',
    legend: string,
    options: readonly { value: string; label: string }[],
    rowsY: readonly number[],
  ) => (
    <fieldset
      ref={(el) => { refs.current[name] = el; }}
      className={invalid.has(name) ? 'xmas-group-invalid' : undefined}
    >
      <legend className="xmas-sr">{legend}</legend>
      {options.map((o, i) => (
        <label key={o.value} className="xmas-opt xmas-at" style={at({ x: TICK_ROW.x, y: rowsY[i], w: TICK_ROW.w, h: TICK_ROW.h })}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value[name] === o.value}
            onChange={() => set(name, o.value as ChristmasResponse[typeof name])}
          />
          <span className="xmas-box" />
          <span className="xmas-sr">{o.label}</span>
        </label>
      ))}
    </fieldset>
  );

  const actions = (
    <div className="xmas-actions" role="region" aria-label="Form actions">
      <div className={`xmas-status${status.error ? ' is-error' : ''}`} role="status" aria-live="polite">
        {status.text}
      </div>
      <button type="button" className="xmas-btn" onClick={onLater} disabled={saving}>
        Not now
      </button>
      <button type="submit" form="xmas-form" className="xmas-btn xmas-btn-gold" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {saving ? 'Saving…' : isUpdate ? 'Update response' : 'Submit response'}
      </button>
    </div>
  );

  return (
    <>
      <form id="xmas-form" className="xmas-stage" onSubmit={handleSubmit} noValidate autoComplete="on">
        <img
          className="xmas-art"
          src={artworkUrl}
          width={1055}
          height={1491}
          alt={`Securities Commission of Papua New Guinea. ${CHRISTMAS_EVENT.title}. Staff Attendance and Availability Form. ${CHRISTMAS_EVENT.eventDateLabel}, ${CHRISTMAS_EVENT.venue}. All staff are kindly requested to complete this form, regardless of whether they will be attending the event, to assist the Organising Committee with its preparations.`}
          draggable={false}
        />
        <div className="xmas-medallion xmas-at" style={at(medallionBox)} aria-hidden="true">
          <img src={logoUrl} alt="" draggable={false} />
        </div>

        <h2 className="xmas-sr">{CHRISTMAS_EVENT.title}: Staff Attendance and Availability Form</h2>

        <input
          ref={(el) => { refs.current.fullName = el; }}
          className={cls('fullName', 'xmas-field xmas-at')}
          style={at(FIELD_BOXES.fullName)}
          type="text"
          autoComplete="name"
          aria-label="Full name"
          maxLength={120}
          value={value.fullName}
          onChange={(e) => set('fullName', e.target.value)}
        />
        <input
          ref={(el) => { refs.current.divisionUnit = el; }}
          className={cls('divisionUnit', 'xmas-field xmas-at')}
          style={at(FIELD_BOXES.divisionUnit)}
          type="text"
          list="xmas-division-units"
          aria-label="Division / Unit"
          maxLength={160}
          value={value.divisionUnit}
          onChange={(e) => set('divisionUnit', e.target.value)}
        />
        <datalist id="xmas-division-units">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        {tickGroup('attendance', 'Attendance confirmation', ATTENDANCE_OPTIONS, ATTENDANCE_ROWS_Y)}
        {tickGroup('arrangement', 'Christmas period arrangements', ARRANGEMENT_OPTIONS, ARRANGEMENT_ROWS_Y)}

        <input
          ref={(el) => { refs.current.destination = el; }}
          className={cls('destination', 'xmas-field xmas-at')}
          style={at(FIELD_BOXES.destination)}
          type="text"
          aria-label="Travel destination"
          maxLength={160}
          value={value.destination}
          onChange={(e) => set('destination', e.target.value)}
        />
        <input
          ref={(el) => { refs.current.startDate = el; }}
          className={cls('startDate', `xmas-field xmas-at${value.startDate ? '' : ' is-empty'}`)}
          style={at(FIELD_BOXES.startDate)}
          type="date"
          aria-label="Departure / leave start date"
          value={value.startDate}
          onChange={(e) => set('startDate', e.target.value)}
        />
        <input
          ref={(el) => { refs.current.endDate = el; }}
          className={cls('endDate', `xmas-field xmas-at${value.endDate ? '' : ' is-empty'}`)}
          style={at(FIELD_BOXES.endDate)}
          type="date"
          aria-label="Return / leave end date"
          min={value.startDate || undefined}
          value={value.endDate}
          onChange={(e) => set('endDate', e.target.value)}
        />
        <textarea
          className="xmas-field xmas-at"
          style={at(FIELD_BOXES.comments)}
          aria-label="Additional comments (optional)"
          maxLength={1000}
          value={value.comments}
          onChange={(e) => set('comments', e.target.value)}
        />
      </form>
      {actionsHost && createPortal(actions, actionsHost)}
    </>
  );
}
