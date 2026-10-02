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
