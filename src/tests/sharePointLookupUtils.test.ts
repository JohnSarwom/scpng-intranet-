import { describe, expect, it } from 'vitest';
import {
  normalizeLookupId,
  normalizeLookupNumber,
  normalizeLookupString,
} from '../utils/sharePointLookupUtils';

describe('sharePointLookupUtils', () => {
  describe('normalizeLookupId', () => {
    it('normalizes empty lookup values to null', () => {
      expect(normalizeLookupId(undefined)).toBeNull();
      expect(normalizeLookupId(null)).toBeNull();
      expect(normalizeLookupId('')).toBeNull();
      expect(normalizeLookupId('   ')).toBeNull();
      expect(normalizeLookupId('none')).toBeNull();
      expect(normalizeLookupId('NONE')).toBeNull();
      expect(normalizeLookupId('null')).toBeNull();
      expect(normalizeLookupId('undefined')).toBeNull();
      expect(normalizeLookupId(Number.NaN)).toBeNull();
    });

    it('preserves valid lookup identifiers', () => {
      expect(normalizeLookupId(42)).toBe(42);
      expect(normalizeLookupId('42')).toBe('42');
      expect(normalizeLookupId(' 42 ')).toBe('42');
      expect(normalizeLookupId('abc-123')).toBe('abc-123');
    });
  });

  describe('normalizeLookupNumber', () => {
    it('returns numeric lookup IDs for SharePoint lookup fields', () => {
      expect(normalizeLookupNumber(42)).toBe(42);
      expect(normalizeLookupNumber('42')).toBe(42);
      expect(normalizeLookupNumber(' 42 ')).toBe(42);
    });

    it('returns null for empty or non-numeric lookup values', () => {
      expect(normalizeLookupNumber('none')).toBeNull();
      expect(normalizeLookupNumber('abc-123')).toBeNull();
      expect(normalizeLookupNumber(undefined)).toBeNull();
    });
  });

  describe('normalizeLookupString', () => {
    it('returns string IDs for text-backed relationship fields', () => {
      expect(normalizeLookupString(42)).toBe('42');
      expect(normalizeLookupString(' 42 ')).toBe('42');
      expect(normalizeLookupString('abc-123')).toBe('abc-123');
    });

    it('returns null for empty lookup values', () => {
      expect(normalizeLookupString('none')).toBeNull();
      expect(normalizeLookupString(null)).toBeNull();
    });
  });
});
