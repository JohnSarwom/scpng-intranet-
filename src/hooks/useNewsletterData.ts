import { useCallback, useEffect, useMemo, useState } from "react";
import { useMsal } from "@azure/msal-react";
import {
  newslettersConfigured,
  NewsletterService,
} from "@/services/newsletterService";

/** Workflow content deliberately bypasses the application's persisted query cache. */
export function useNewsletterData<T>(
  load: (service: NewsletterService) => Promise<T>,
  key: string,
  enabled = true,
) {
  const { instance, accounts } = useMsal();
  const identity =
    (instance.getActiveAccount() || accounts[0])?.homeAccountId || "";
  const service = useMemo(() => new NewsletterService(instance), [instance]);
  const [epoch, setEpoch] = useState(0);
  const [state, setState] = useState<
    { owner: string; key: string; data?: T; loading: boolean; error?: string }
  >({ owner: "", key: "", loading: true });
  const reload = useCallback(() => setEpoch((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setState((previous) => ({
      owner: identity,
      key,
      loading: enabled && newslettersConfigured() && !!identity,
      ...(previous.owner === identity && previous.key === key
        ? { data: previous.data }
        : {}),
    }));
    if (enabled && newslettersConfigured() && identity) {
      load(service).then((data) => {
        if (active) setState({ owner: identity, key, data, loading: false });
      }).catch((error) => {
        if (active) {
          setState({
            owner: identity,
            key,
            loading: false,
            error: error instanceof Error
              ? error.message
              : "Could not load newsletters.",
          });
        }
      });
    }
    return () => {
      active = false;
    };
    // The caller supplies a stable semantic key; function identity must not trigger refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, identity, key, epoch, enabled]);
  const current = state.owner === identity && state.key === key
    ? state
    : { loading: true, data: undefined, error: undefined };
  return { ...current, service, reload, configured: newslettersConfigured() };
}
