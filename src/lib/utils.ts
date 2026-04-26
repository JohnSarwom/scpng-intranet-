import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";

  try {
    const date = new Date(dateString + 'T00:00:00');

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return "Invalid Date";
  }
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return 'K0.00';
  }

  return new Intl.NumberFormat('en-PG', {
    style: 'currency',
    currency: 'PGK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (isNaN(diffDays)) {
      return 'Invalid Date';
    }

    if (diffDays < 0) {
      const futureDays = Math.abs(diffDays);
      if (futureDays === 1) return 'Tomorrow';
      return `In ${futureDays} days`;
    }

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;

  } catch (error) {
    console.error("Error formatting relative time:", dateString, error);
    return 'Invalid Date';
  }
}

/**
 * Compresses an image file using the browser's Canvas API.
 * 
 * @param file The image file to compress
 * @param maxWidth The maximum width of the output image (default: 1920)
 * @param quality The JPEG quality from 0 to 1 (default: 0.8)
 * @returns A Promise that resolves to the compressed File object
 */
export async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    // 1. Create an image element to load the file
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        // 2. Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        // 3. Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // 4. Export to blob/file
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Could not compress image'));
            return;
          }

          // Create new file with same name but likely smaller size
          // Force jpg for better compression of photos
          const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(newFile);
        }, 'image/jpeg', quality);
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

/**
 * Decodes common HTML entities in a string.
 * Useful for text coming from SharePoint or RSS feeds that contain encoded characters.
 */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str) return '';
  
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x2f;': '/',
    '&#32;': ' ',
    '&#8211;': '–', // en-dash
    '&#8212;': '—', // em-dash
    '&#8216;': '‘',
    '&#8217;': '’',
    '&#8220;': '“',
    '&#8221;': '”',
    '&ndash;': '–',
    '&mdash;': '—',
    '&lsquo;': '‘',
    '&rsquo;': '’',
    '&ldquo;': '“',
    '&rdquo;': '”',
    '&middot;': '·',
    '&bull;': '•',
    '&hellip;': '…',
  };

  return str.replace(/&[#\w\d]+;/g, (match) => {
    return entities[match] || match;
  });
}
