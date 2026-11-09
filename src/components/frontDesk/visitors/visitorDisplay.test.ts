import { describe, expect, it } from 'vitest';
import { initialsOfVisitor, shortDate } from './visitorDisplay';

describe('visitor display helpers', () => {
  it('builds initials from letters and digits, skipping brackets and symbols', () => {
    expect(initialsOfVisitor('Mary K')).toBe('MK');
    expect(initialsOfVisitor('[TEST] Walk-in Alpha')).toBe('TW');
    expect(initialsOfVisitor('  ')).toBe('?');
  });

  it('shows dates the way the paper sheet does', () => {
    expect(shortDate('2026-11-10')).toBe('10/11/2026');
    expect(shortDate('')).toBe('');
  });
});
