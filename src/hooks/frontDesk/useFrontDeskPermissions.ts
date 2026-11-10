import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { frontDeskPermissionsFor, type FrontDeskPermissions } from './frontDeskPermissions';

export { allowedOnly, type FrontDeskPermissions } from './frontDeskPermissions';

/** What the signed-in user may do on the Front Desk page. Admins can do everything (useRoleBasedAuth). */
export function useFrontDeskPermissions(): FrontDeskPermissions {
  const { hasPermission } = useRoleBasedAuth();
  return frontDeskPermissionsFor(hasPermission);
}
