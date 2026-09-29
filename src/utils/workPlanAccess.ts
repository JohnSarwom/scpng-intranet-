import type { UserRole } from '../services/userSharePointService';

/** Mirrors the existing strategy editor roles, scoped to the manager's division. */
export function canManageWorkPlan(user: UserRole | null | undefined, divisionName: string): boolean {
  if (!user) return false;
  const role = user.role_name?.trim().toLowerCase();
  if (user.is_admin || role === 'admin' || role === 'super_admin') return true;
  const normalize = (value: string | undefined) => value?.trim().toLowerCase() || '';
  return role === 'manager' && !!normalize(divisionName) &&
    normalize(user.division_name) === normalize(divisionName);
}

export function assertCanManageWorkPlan(user: UserRole | null | undefined, divisionName: string): void {
  if (!canManageWorkPlan(user, divisionName)) {
    throw new Error('You do not have permission to manage work plans for this division.');
  }
}
