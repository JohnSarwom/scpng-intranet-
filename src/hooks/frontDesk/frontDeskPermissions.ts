import { FRONT_DESK_RESOURCE } from '@/services/frontDesk/frontDeskConfig';

export interface FrontDeskPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManage: boolean;
  canExport: boolean;
}

export function frontDeskPermissionsFor(hasPermission: (resource: string, action: string) => boolean): FrontDeskPermissions {
  const can = (action: string) => hasPermission(FRONT_DESK_RESOURCE, action);
  return {
    canCreate: can('create'),
    canUpdate: can('update'),
    canDelete: can('delete'),
    canManage: can('manage'),
    canExport: can('export'),
  };
}

/** Wraps a handler so it does nothing without the permission: the safety net behind hidden controls. */
export function allowedOnly<A extends unknown[]>(allowed: boolean, handler: (...args: A) => void) {
  return (...args: A) => {
    if (allowed) handler(...args);
  };
}
