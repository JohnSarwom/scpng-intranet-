import { useEffect, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { useMsal } from '@azure/msal-react';

/** Clear source-bound history and stop requests when evidence changes or the panel unmounts. */
export function useAiConversationLifecycle<T>({ sourceId, controller, setMessages, setQuery, setBusy, clearRoute }: {
  sourceId: string;
  controller: MutableRefObject<AbortController | null>;
  setMessages: Dispatch<SetStateAction<T[]>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  clearRoute?: () => void;
}) {
  const { accounts } = useMsal();
  const accountId = accounts[0]?.homeAccountId || accounts[0]?.username || 'signed-out';
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    setMessages(messages => messages.slice(0, 1));
    setQuery('');
    setBusy(false);
    clearRoute?.();
    return () => { controller.current?.abort(); controller.current = null; };
  }, [sourceId, accountId, controller, setMessages, setQuery, setBusy, clearRoute]);
}
