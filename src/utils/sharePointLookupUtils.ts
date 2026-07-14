export type NormalizedLookupId = string | number | null;

const EMPTY_LOOKUP_STRINGS = new Set(['', 'none', 'null', 'undefined', 'nan']);

export function normalizeLookupId(value: unknown): NormalizedLookupId {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (EMPTY_LOOKUP_STRINGS.has(trimmed.toLowerCase())) return null;
    return trimmed;
  }

  return null;
}

export function normalizeLookupNumber(value: unknown): number | null {
  const normalized = normalizeLookupId(value);
  if (normalized === null) return null;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeLookupString(value: unknown): string | null {
  const normalized = normalizeLookupId(value);
  return normalized === null ? null : String(normalized);
}
