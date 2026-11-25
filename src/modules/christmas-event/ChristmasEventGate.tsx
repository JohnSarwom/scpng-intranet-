import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getGraphClient } from '@/services/graphService';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import InvitationOverlay from './InvitationOverlay';
import { CHRISTMAS_EVENT } from './config';
import {
  ChristmasEventDemoStore,
  ChristmasEventSharePointStore,
  type ChristmasResponse,
  type ChristmasResponseStore,
} from './christmasEventService';

/** Pages where the invitation never appears. */
const EXCLUDED_PATHS = ['/login', '/unauthorized', '/asset-public', '/leave-action', '/dev/christmas-event'];

const submittedKey = (email: string) => `${CHRISTMAS_EVENT.id}:submitted:${email}`;
const laterKey = `${CHRISTMAS_EVENT.id}:later`;

/** Add ?christmas=open to any intranet address to open the form again (for example to change an answer). */
const REOPEN_PARAM = 'christmas';

const isPastShowUntil = () => {
  const [y, m, d] = CHRISTMAS_EVENT.showUntil.split('-').map(Number);
  return Date.now() > new Date(y, m - 1, d, 23, 59, 59).getTime();
};

const formatDivisionUnit = (division?: string, unit?: string) => {
  const d = division && division !== 'No Division' ? division.trim() : '';
  const u = unit?.trim() ?? '';
  if (d && u && d !== u) return `${d} / ${u}`;
  return d || u;
};

interface Props {
  /** Developer preview: always shows, saves nothing to SharePoint. */
  demo?: boolean;
}

/**
 * Shows the Christmas invitation the first time each staff member opens the
 * intranet in a session, until they have submitted the form.
 */
export default function ChristmasEventGate({ demo = false }: Props) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { user } = useRoleBasedAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const account = accounts[0];
  const email = demo ? 'preview.user@scpng.gov.pg' : (account?.username ?? '').toLowerCase();
  const forced = new URLSearchParams(location.search).get(REOPEN_PARAM) === 'open';
  const eligible =
    demo ||
    (CHRISTMAS_EVENT.enabled &&
      !isPastShowUntil() &&
      isAuthenticated &&
      !!email &&
      !EXCLUDED_PATHS.includes(location.pathname));

  const [store, setStore] = useState<ChristmasResponseStore | null>(null);
  const [existing, setExisting] = useState<ChristmasResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!eligible || open) return;
    if (!demo && !forced) {
      if (sessionStorage.getItem(laterKey) === '1') return;
      if (localStorage.getItem(submittedKey(email)) === '1') return;
    }
    let cancelled = false;
    (async () => {
      try {
        let s: ChristmasResponseStore;
        if (demo) {
          s = new ChristmasEventDemoStore();
        } else {
          const client = await getGraphClient(instance);
          if (!client) return;
          s = new ChristmasEventSharePointStore(client);
        }
        const mine = await s.getMine(email);
        if (cancelled) return;
        if (mine && !forced && !demo) {
          localStorage.setItem(submittedKey(email), '1');
          return;
        }
        setStore(s);
        setExisting(mine);
        // Let the page underneath paint first, then bring the curtain down.
        window.setTimeout(() => !cancelled && setOpen(true), demo ? 300 : 900);
      } catch (err) {
        // List missing and this user cannot create it, or SharePoint is unreachable:
        // stay out of the way rather than show a form that cannot be saved.
        console.warn('[ChristmasEvent] invitation not shown:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, email, forced, demo]);

  const initial = useMemo<ChristmasResponse>(
    () =>
      existing ?? {
        fullName: user?.user_name || account?.name || '',
        email,
        divisionUnit: formatDivisionUnit(user?.division_name, user?.unit_name),
        attendance: '',
        arrangement: '',
        destination: '',
        startDate: '',
        endDate: '',
        comments: '',
      },
    [existing, user?.user_name, user?.division_name, user?.unit_name, account?.name, email],
  );

  const handleSaved = useCallback(
    (r: ChristmasResponse) => {
      setExisting(r);
      if (!demo) localStorage.setItem(submittedKey(email), '1');
    },
    [demo, email],
  );

  const handleClose = useCallback(
    (reason: 'later' | 'done') => {
      if (reason === 'later' && !demo) sessionStorage.setItem(laterKey, '1');
      setOpen(false);
      if (forced) {
        const params = new URLSearchParams(location.search);
        params.delete(REOPEN_PARAM);
        const qs = params.toString();
        navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
      }
    },
    [demo, forced, location.pathname, location.search, navigate],
  );

  return (
    <AnimatePresence>
      {open && store && (
        <InvitationOverlay
          key="christmas-invitation"
          store={store}
          initial={initial}
          isUpdate={!!existing}
          startAtForm={forced && !!existing}
          onSaved={handleSaved}
          onClose={handleClose}
        />
      )}
    </AnimatePresence>
  );
}
