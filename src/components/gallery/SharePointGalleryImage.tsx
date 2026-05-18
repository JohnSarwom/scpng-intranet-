import React, { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { getGalleryPhotoDisplayUrl, resolveGalleryPhotoImageUrl } from '@/services/gallerySharePointImageService';
import type { GalleryPhoto } from '@/integrations/supabase/galleryService';

type SharePointGalleryImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  photo: GalleryPhoto;
  onResolved?: (photoId: string, displayUrl: string) => void;
};

const isSharePointUrl = (url?: string) => Boolean(url?.includes('scpng1.sharepoint.com'));

const SharePointGalleryImage: React.FC<SharePointGalleryImageProps> = ({ photo, onResolved, ...props }) => {
  const { instance: msalInstance } = useMsal();
  const initialUrl = getGalleryPhotoDisplayUrl(photo);
  const [src, setSrc] = useState(isSharePointUrl(initialUrl) ? '' : initialUrl);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      const currentUrl = getGalleryPhotoDisplayUrl(photo);
      if (!isSharePointUrl(currentUrl) || currentUrl.startsWith('blob:')) {
        setSrc(currentUrl);
        return;
      }

      const graphClient = await getGraphClient(msalInstance);
      const displayUrl = await resolveGalleryPhotoImageUrl(graphClient, photo);
      if (!isMounted) return;

      if (displayUrl) {
        setSrc(displayUrl);
        onResolved?.(photo.id, displayUrl);
      } else {
        setSrc(currentUrl);
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [msalInstance, onResolved, photo]);

  if (!src) {
    return <div className={props.className} aria-label={props.alt} />;
  }

  return <img {...props} src={src} />;
};

export default SharePointGalleryImage;
