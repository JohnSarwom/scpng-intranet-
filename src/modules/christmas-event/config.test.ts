import { describe, expect, it } from 'vitest';
import { CHRISTMAS_EVENT, isChristmasLoginThemeOn, isOnOrBefore } from './config';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('isOnOrBefore', () => {
  it('includes the whole of the last day, in local time', () => {
    expect(isOnOrBefore('2027-01-05', at(2027, 1, 5, 23))).toBe(true);
    expect(isOnOrBefore('2027-01-05', at(2027, 1, 6, 0))).toBe(false);
  });
});

describe('isChristmasLoginThemeOn', () => {
  it('decorates the sign-in page through the holidays', () => {
    expect(CHRISTMAS_EVENT.loginTheme).toBe(true);
    expect(isChristmasLoginThemeOn(at(2026, 11, 25))).toBe(true);
    expect(isChristmasLoginThemeOn(at(2027, 1, 5))).toBe(true);
  });

  it('switches itself off after the last day', () => {
    expect(isChristmasLoginThemeOn(at(2027, 1, 6))).toBe(false);
  });
});
