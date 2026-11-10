
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Bell, Calendar, ExternalLink, Pin, AlertTriangle, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useNoticeBoard } from '@/hooks/useNoticeBoard';
import { IAnnouncement } from '@/types';
import DOMPurify from 'dompurify';
import { NoticeBoardSkeleton } from './skeletons/NoticeBoardSkeleton';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useToast } from '@/hooks/use-toast';
import StaffAnnouncementWelcome from './StaffAnnouncementWelcome';

const NewsCarousel: React.FC = () => {
  const newsImages = [
    "https://picsum.photos/id/1033/800/400",
    "https://picsum.photos/id/1025/800/400",
    "https://picsum.photos/id/1015/800/400",
    "https://picsum.photos/id/1018/800/400"
  ];

  return (
    <Carousel className="w-full mb-4">
      <CarouselContent>
        {newsImages.map((image, index) => (
          <CarouselItem key={index}>
            <div className="p-1">
              <div className="overflow-hidden rounded-md">
                <img
                  src={image}
                  alt={`News image ${index + 1}`}
                  className="h-48 w-full object-cover transition-all hover:scale-105"
                />
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="flex justify-center mt-2">
        <CarouselPrevious className="relative static left-0 translate-y-0 mr-2" />
        <CarouselNext className="relative static right-0 translate-y-0" />
      </div>
    </Carousel>
  );
};

const NoticeBoard = () => {
  const { announcements, loading, error, deleteNotice, popupReady } = useNoticeBoard();
  const { isAdmin } = useRoleBasedAuth();
  const { toast } = useToast();
  const [selectedNotice, setSelectedNotice] = React.useState<IAnnouncement | null>(null);

  // Get category badge color and icon
  const getCategoryDetails = (category: IAnnouncement['category']) => {
    switch (category) {
      case 'Announcement':
        return { color: 'bg-intranet-primary', icon: <Bell size={14} /> };
      case 'Event':
        return { color: 'bg-intranet-primary', icon: <Calendar size={14} /> };
      case 'Update':
        return { color: 'bg-intranet-primary', icon: <ExternalLink size={14} /> };
      case 'Alert':
        return { color: 'bg-intranet-primary', icon: <Bell size={14} /> };
      default:
        return { color: 'bg-intranet-primary', icon: <Bell size={14} /> };
    }
  };

  // Format date — handles both Date objects and ISO strings (from cache deserialization)
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Helper to remove common email signatures
  const stripSignature = (content: string) => {
    const signaturePatterns = [
      /Best(?:<[^>]+>|\s|&nbsp;)+Regards/i,
      /Kind(?:<[^>]+>|\s|&nbsp;)+Regards/i,
      /Regards,?/i,
      /Sincerely,?/i,
      /Cheers,?/i,
      /Sent(?:<[^>]+>|\s|&nbsp;)+from(?:<[^>]+>|\s|&nbsp;)+my/i,
      /Sent(?:<[^>]+>|\s|&nbsp;)+from(?:<[^>]+>|\s|&nbsp;)+Outlook/i,
      /From:/i,
      /_{10,}/, // Underscore line separator
      /This(?:<[^>]+>|\s|&nbsp;)+communication(?:<[^>]+>|\s|&nbsp;)+contains(?:<[^>]+>|\s|&nbsp;)+information/i // Common disclaimer start
    ];

    // Find the first occurrence of any signature pattern
    let cutoffIndex = content.length;

    for (const pattern of signaturePatterns) {
      const match = content.match(pattern);
      if (match && match.index !== undefined && match.index < cutoffIndex) {
        cutoffIndex = match.index;
      }
    }

    if (cutoffIndex !== content.length) {
      // Trim any trailing whitespace/newlines before the cutoff to clean it up
      return content.substring(0, cutoffIndex).trim();
    }
    return content;
  };

  // Helper to sanitize HTML content
  const sanitizeContent = (content: string, shorten = false) => {
    const cleanContent = shorten ? stripSignature(content) : content;

    // 2. Then Extract Body if present
    const bodyMatch = cleanContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const contentToSanitize = bodyMatch ? bodyMatch[1] : cleanContent;

    return DOMPurify.sanitize(contentToSanitize, {
      ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a'],
      ALLOWED_ATTR: ['href'],
    });
  };

  const previewText = (content: string) => {
    const parsed = new DOMParser().parseFromString(sanitizeContent(content, true), 'text/html');
    return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const findEmailInOutlook = async (notice: IAnnouncement) => {
    const query = `from:${notice.sourceEmail || ''} subject:"${notice.title.replace(/"/g, '')}"`;
    window.open('https://outlook.cloud.microsoft/mail/', '_blank', 'noopener,noreferrer');
    try {
      await navigator.clipboard.writeText(query);
      toast({ title: 'Outlook search copied', description: 'Paste it into the Outlook search box to find the email and attachments.' });
    } catch {
      toast({ title: 'Search in Outlook', description: query });
    }
  };

  if (loading) {
    return <NoticeBoardSkeleton />;
  }

  return (
    <>
      <StaffAnnouncementWelcome announcements={announcements} ready={popupReady} onReadNotice={setSelectedNotice} />
      <Card className="bg-white dark:bg-gray-800 rounded-xl shadow-sm animate-fade-in border dark:border-white/10">
        <CardHeader className="pb-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold dark:text-gray-100">
            <Bell className="h-5 w-5 text-intranet-primary" />
            SCPNG Notice Board
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[580px] flex flex-col">
          <NewsCarousel />
          <div className="space-y-3 flex-1 overflow-y-auto scrollbar-thin pr-2">
            {error && (
              <div className="flex flex-col items-center justify-center h-full text-red-500">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <p className="text-sm">Failed to load notices.</p>
                <p className="text-xs">{error.message}</p>
              </div>
            )}
            {!error && announcements.map((notice) => (
              <div
                key={notice.id}
                onClick={() => setSelectedNotice(notice)}
                className={`group relative p-2.5 rounded-lg border border-border dark:border-white/10 hover:border-intranet-primary/50 dark:hover:bg-white/5 transition-colors duration-300 cursor-pointer
                  ${notice.isPinned ? 'border-intranet-primary/50 bg-intranet-primary/5 dark:bg-intranet-primary/10' : ''}`}
              >
                {isAdmin && notice.source !== 'email' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (deleteNotice) deleteNotice(notice.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm z-10"
                    title="Delete Notice"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="font-medium text-sm leading-snug break-words min-w-0 flex items-start gap-1">
                    {notice.isPinned && <Pin size={12} className="text-intranet-primary animate-pulse" />}
                    {notice.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`shrink-0 flex items-center gap-1 text-white text-xs px-1.5 py-0.5 ${getCategoryDetails(notice.category).color}`}
                  >
                    {getCategoryDetails(notice.category).icon}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 line-clamp-2 break-words">
                  {previewText(notice.content)}
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2">
                  <span>{formatDate(notice.createdDate)}</span>
                  {notice.source === 'email' && notice.sourceEmail && <span>From {notice.sourceEmail}</span>}
                  {notice.audience && <span>{notice.audience}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedNotice} onOpenChange={(open) => !open && setSelectedNotice(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between mr-4">
              <Badge
                variant="outline"
                className={`flex items-center gap-1 text-white mb-2 ${selectedNotice ? getCategoryDetails(selectedNotice.category).color : ''}`}
              >
                {selectedNotice && getCategoryDetails(selectedNotice.category).icon}
                {selectedNotice?.category}
              </Badge>
              {selectedNotice?.isPinned && (
                <Badge variant="secondary" className="mb-2 flex items-center gap-1">
                  <Pin size={12} /> Pinned
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl dark:text-gray-100">{selectedNotice?.title}</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              Posted on {selectedNotice && formatDate(selectedNotice.createdDate)}
              {selectedNotice?.author && ` by ${selectedNotice.author}`}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
            <div
              className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: selectedNotice ? sanitizeContent(selectedNotice.content) : ''
              }}
            />

            {selectedNotice?.sourceEmail && (
              <div className="mt-6 pt-4 border-t text-xs text-gray-500">
                Source: {selectedNotice.sourceEmail}
              </div>
            )}
            {selectedNotice?.source === 'email' && (
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-intranet-primary hover:underline"
                onClick={() => void findEmailInOutlook(selectedNotice)}
              >
                <ExternalLink size={16} /> Find email and attachments in Outlook
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NoticeBoard;
