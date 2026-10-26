import { useMemo } from 'react';
import { useMsal } from '@azure/msal-react';

export interface FrontDeskActor {
  /** Lower-cased sign-in email; empty when nobody is signed in. */
  email: string;
  name: string;
  initials: string;
}

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';

/** Who is using the front desk right now: written to LoggedByEmail / CreatedByEmail and shown on comments. */
export function useFrontDeskActor(): FrontDeskActor {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() || accounts[0];
  return useMemo(() => {
    const email = (account?.username || '').trim().toLowerCase();
    const name = account?.name?.trim() || email;
    return { email, name, initials: initialsOf(name) };
  }, [account]);
}
