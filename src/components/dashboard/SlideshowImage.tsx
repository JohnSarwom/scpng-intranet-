import { useQuery } from '@tanstack/react-query';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { useState } from 'react';
import { BookOpen, Scale, TrendingUp } from 'lucide-react';
import { getGraphClient } from '@/services/graphService';
import { resolveSlideshowImage } from '@/services/slideshowSharePointService';
import type { SlideshowItem } from '@/types/slideshow.types';

function ImageWithFallback({ src, item }: { src?: string; item: SlideshowItem }) {
  const [failed, setFailed] = useState(false);
  const Icon = item.category === 'MS Office 365 Tips' ? BookOpen : item.category === 'Capital Market Acts' ? Scale : TrendingUp;
  return <>
    {src && !failed ? <img src={src} alt={item.imageAlt || item.title}
      className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy"
      onError={() => setFailed(true)} /> : <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-intranet-primary/15 to-intranet-accent/20 text-intranet-primary dark:text-white"
      role="img" aria-label={`${item.category} illustration`}>
      <Icon className="h-16 w-16" aria-hidden="true" /><span className="text-sm font-medium">{item.category}</span>
    </div>}
    {src && !failed && item.imageCredit && <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white px-2 py-1 text-[10px]">{item.imageCredit}</span>}
  </>;
}

/** Resolve protected media at render time; never persist expiring download URLs. */
export default function SlideshowImage({ item }: { item: SlideshowItem }) {
  const { instance, accounts, inProgress } = useMsal();
  const accountId = (instance.getActiveAccount() || accounts[0])?.homeAccountId;
  const protectedImage = !!item.imageDriveId && !!item.imageItemId;
  const image = useQuery({
    queryKey: ['slideshowImage', accountId, item.imageDriveId, item.imageItemId],
    enabled: protectedImage && !!accountId && inProgress === InteractionStatus.None,
    queryFn: async () => {
      const client = await getGraphClient(instance);
      if (!client || instance.getActiveAccount()?.homeAccountId !== accountId) throw new Error('Sign in required.');
      const url = await resolveSlideshowImage(client, item.imageDriveId, item.imageItemId);
      if (instance.getActiveAccount()?.homeAccountId !== accountId) throw new Error('Account changed.');
      return url;
    },
    staleTime: 60_000, gcTime: 0, retry: false, meta: { persist: false },
  });
  const src = !accountId ? undefined : protectedImage ? image.data || undefined : item.imageUrl;
  return <ImageWithFallback key={`${accountId}:${src}`} src={src} item={item} />;
}
