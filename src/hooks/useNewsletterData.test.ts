import { beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise hook state transitions without a DOM or a persisted query cache.
const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[],
  account: 'john', deps: [] as unknown[][],
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [harness.slots[index], (next: unknown) => {
      harness.slots[index] = typeof next === 'function'
        ? next(harness.slots[index]) : next;
    }];
  },
  useMemo: (factory: () => unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = factory();
    return harness.slots[index];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void, deps: unknown[]) => {
    const index = harness.cursor++;
    if (!harness.deps[index] || deps.some((value, i) => value !== harness.deps[index][i])) {
      harness.deps[index] = deps;
      harness.effects.push(effect);
    }
  },
}));
vi.mock('@azure/msal-react', () => {
  const instance = {
    getActiveAccount: () => ({ homeAccountId: harness.account }),
    getAllAccounts: () => [{ homeAccountId: harness.account }],
  };
  return { useMsal: () => ({ instance, accounts: instance.getAllAccounts() }) };
});
vi.mock('@/services/newsletterService', () => ({
  newslettersConfigured: () => true,
  NewsletterService: class {},
}));
import { useNewsletterData } from './useNewsletterData';

type View = { records: { id: string; revision: number }[] };
const load = vi.fn<() => Promise<View>>();
function Harness(key = 'workspace') {
  harness.cursor = 0;
  const result = useNewsletterData(load, key);
  harness.effects.splice(0).forEach(effect => effect());
  return result;
}
async function loaded() {
  Harness();
  await Promise.resolve();
  return Harness();
}
describe('confirmed newsletter results', () => {
  beforeEach(() => {
    harness.slots = []; harness.deps = []; harness.effects = [];
    harness.account = 'john';
    load.mockReset().mockResolvedValue({ records: [] });
  });
  it('opens a confirmed new draft without another workspace load', async () => {
    const view = await loaded();
    view.updateData(current => ({ ...current, records: [{ id: 'draft', revision: 1 }] }));
    const next = Harness();
    expect(next.data?.records).toEqual([{ id: 'draft', revision: 1 }]);
    expect(next.loading).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('keeps the confirmed saved revision without rereading older data', async () => {
    load.mockResolvedValue({ records: [{ id: 'draft', revision: 1 }] });
    const view = await loaded();
    view.updateData(current => ({ ...current, records: [{ id: 'draft', revision: 2 }] }));
    expect(Harness().data?.records[0].revision).toBe(2);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('refuses a late result after the signed-in account changes', async () => {
    const oldView = await loaded();
    harness.account = 'sam';
    oldView.updateData(() => ({ records: [{ id: 'private-john-draft', revision: 1 }] }));
    expect(Harness().data).toBeUndefined();
    await Promise.resolve();
    expect(Harness().data?.records).toEqual([]);
  });
  it('does not let an old view replace data for a different semantic key', async () => {
    const oldView = await loaded();
    Harness('reader');
    await Promise.resolve();
    oldView.updateData(() => ({ records: [{ id: 'wrong-view', revision: 1 }] }));
    expect(Harness('reader').data?.records).toEqual([]);
  });
});
