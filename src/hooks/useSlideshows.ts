import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { getGraphClient } from '@/services/graphService';
import { getAllSlideshows, isVisibleSlideshow } from '@/services/slideshowSharePointService';
import type { SlideshowCategory, SlideshowHookReturn } from '@/types/slideshow.types';

/** All category consumers share this account-scoped query. Draft lists are never read. */
export function useAllSlideshows(category?: SlideshowCategory): SlideshowHookReturn {
  const { instance, accounts, inProgress } = useMsal();
  const account = instance.getActiveAccount() || accounts[0];
  const accountId = account?.homeAccountId;
  const enabled = !!accountId && inProgress === InteractionStatus.None;
  const query = useQuery({
    queryKey: ['informationSlideshows', 'scpngintranet', accountId],
    queryFn: async () => {
      const client = await getGraphClient(instance);
      if (!client || instance.getActiveAccount()?.homeAccountId !== accountId) throw new Error('Please sign in again.');
      const slides = await getAllSlideshows(client);
      if (instance.getActiveAccount()?.homeAccountId !== accountId) throw new Error('Account changed.');
      return slides;
    },
    enabled, staleTime: 60_000, refetchOnMount: 'always', refetchOnWindowFocus: 'always',
    refetchInterval: 300_000, retry: 1, meta: { persist: false },
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return {
    slides: enabled ? (query.data || []).filter(slide =>
      (!category || slide.category === category) && isVisibleSlideshow(slide, Math.max(now, Date.now())))
      .slice(0, category ? 5 : undefined) : [],
    isLoading: !!accountId && (!enabled || query.isLoading),
    error: !accountId ? 'Sign in to view information slides.' : query.error ? 'Information is temporarily unavailable. Please try again.' : null,
    refetch: () => { void query.refetch(); },
  };
}
export const useMSOffice365Tips = () => useAllSlideshows('MS Office 365 Tips');
export const useCapitalMarketNews = () => useAllSlideshows('Capital Market News');
export const useCapitalMarketActs = () => useAllSlideshows('Capital Market Acts');
