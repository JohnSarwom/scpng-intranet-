import { describe, expect, it, vi } from 'vitest';
import { allowedOnly, frontDeskPermissionsFor } from './frontDeskPermissions';

const fromPermissions = (permissions: Record<string, string[]>) =>
  (resource: string, action: string) => !!permissions[resource]?.includes(action);

describe('front desk permissions', () => {
  it('gives a receptionist create and update only (plan D5)', () => {
    expect(frontDeskPermissionsFor(fromPermissions({ tickets: ['read', 'create', 'update'] }))).toEqual({
      canCreate: true, canUpdate: true, canDelete: false, canManage: false, canExport: false,
    });
  });

  it('gives a supervisor everything', () => {
    const supervisor = fromPermissions({ tickets: ['read', 'create', 'update', 'delete', 'manage', 'export'] });
    expect(Object.values(frontDeskPermissionsFor(supervisor)).every(Boolean)).toBe(true);
  });

  it('gives page access alone no actions, and ignores other resources', () => {
    expect(Object.values(frontDeskPermissionsFor(fromPermissions({ tickets: ['read'], assets: ['create'] }))).some(Boolean)).toBe(false);
  });

  it('runs a guarded handler only when allowed', () => {
    const handler = vi.fn();
    allowedOnly(false, handler)('a');
    allowedOnly(true, handler)('b');
    expect(handler.mock.calls).toEqual([['b']]);
  });
});
