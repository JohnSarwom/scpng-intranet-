import { useSyncExternalStore } from 'react';

/**
 * Lets one full-screen moment (such as the Christmas invitation) ask the
 * intranet's welcome pop-ups to wait, so two modals never open at once.
 * A modal dialog disables clicks on the rest of the page, so stacking two
 * leaves the top one unclickable.
 */
const holders = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Start holding the screen. Call the returned function to let go (safe to call twice). */
export function holdScreenTakeover(id: string): () => void {
  holders.add(id);
  emit();
  return () => {
    if (holders.delete(id)) emit();
  };
}

export function isScreenTakeoverActive(): boolean {
  return holders.size > 0;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** True while something holds the screen; welcome pop-ups should stay closed until it is false. */
export function useScreenTakeoverActive(): boolean {
  return useSyncExternalStore(subscribe, isScreenTakeoverActive, () => false);
}
