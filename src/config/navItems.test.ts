import { describe, expect, it } from 'vitest';
import { canViewNavItem, mainNavItems } from './navItems';

describe('PNGX announcements navigation access', () => {
  const item = mainNavItems.find(entry => entry.path === '/pngx-announcements');

  it('requires Market Data read permission for the menu item', () => {
    expect(item).toBeDefined();
    expect(item?.label).toBe('PNGX Announcements');
    expect(item?.resource).toBe('market_data');
    expect(item?.action).toBe('read');
    expect(canViewNavItem(item!, { market_data: ['read'] }, false)).toBe(true);
    expect(canViewNavItem(item!, { market_data: ['write'] }, false)).toBe(false);
    expect(canViewNavItem(item!, {}, false)).toBe(false);
    expect(canViewNavItem(item!, { all: ['*'] }, false)).toBe(true);
    expect(canViewNavItem(item!, null, true)).toBe(true);
  });
});

describe('Workflow Studio navigation access', () => {
  const item = mainNavItems.find(entry => entry.path === '/workflows');

  it('follows Strategy read permission and sits next to Strategy', () => {
    expect(item?.label).toBe('Workflows');
    expect(item?.resource).toBe('strategy');
    expect(item?.action).toBe('read');
    const strategyIndex = mainNavItems.findIndex(entry => entry.path === '/strategy');
    expect(mainNavItems[strategyIndex + 1]).toBe(item);
    expect(canViewNavItem(item!, { strategy: ['read'] }, false)).toBe(true);
    expect(canViewNavItem(item!, { strategy: ['read', 'manage_workflows'] }, false)).toBe(true);
    expect(canViewNavItem(item!, { units: ['read'] }, false)).toBe(false);
    expect(canViewNavItem(item!, null, true)).toBe(true);
  });
});
