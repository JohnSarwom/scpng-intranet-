import { useEffect, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { ArrowRight, Bell, CalendarDays, Megaphone } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { dismissStaffNotices, getUnseenStaffAnnouncements, readDismissedStaffNotices } from '@/lib/staffAnnouncementPopup';
import type { IAnnouncement } from '@/types';

interface Props {
  announcements: IAnnouncement[];
  ready: boolean;
  onReadNotice: (notice: IAnnouncement) => void;
}

function summary(content: string): string {
  const clean = DOMPurify.sanitize(
    content.replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?\s*>/gi, ' '),
    { ALLOWED_TAGS: [], ALLOWED_ATTR: [] },
  );
  const text = (new DOMParser().parseFromString(clean, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 420) return text;
  const preview = text.slice(0, 420);
  const boundary = preview.lastIndexOf(' ');
  return `${preview.slice(0, boundary > 300 ? boundary : 420)}…`;
}

export default function StaffAnnouncementWelcome({ announcements, ready, onReadNotice }: Props) {
  const { accounts } = useMsal();
  const accountId = accounts[0]?.homeAccountId;
  const checkedAccount = useRef<string>();
  const [offered, setOffered] = useState<{ accountId: string; notices: IAnnouncement[] } | null>(null);

  useEffect(() => {
    if (!accountId || !ready || checkedAccount.current === accountId) return;
    // Evaluate once on arrival, after a fresh successful fetch; never interrupt work on background refresh.
    checkedAccount.current = accountId;
    const notices = getUnseenStaffAnnouncements(announcements, readDismissedStaffNotices(accountId));
    setOffered(notices.length ? { accountId, notices } : null);
  }, [accountId, ready, announcements]);

  const notices = offered?.accountId === accountId ? offered.notices : [];
  const close = () => {
    if (offered && offered.accountId === accountId) {
      dismissStaffNotices(offered.accountId, notices.map(notice => notice.id));
    }
    setOffered(null);
  };

  return (
    <Dialog open={notices.length > 0} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl border-intranet-primary/15 p-0 [&>button]:text-white [&>button]:ring-offset-intranet-primary">
        <DialogHeader className="shrink-0 bg-intranet-primary px-6 pb-6 pt-7 text-left text-white sm:px-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><Megaphone className="h-6 w-6" aria-hidden="true" /></span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">SCPNG · All staff</span>
          </div>
          <DialogTitle className="text-2xl font-semibold leading-tight text-white">{notices.length === 1 ? 'A new announcement for you' : 'Your latest staff announcements'}</DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-relaxed text-white/85">A quick update before you start your day.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 max-h-[min(50vh,28rem)] space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
          {notices.map(notice => (
            <article key={notice.id} className="rounded-xl border border-intranet-primary/10 bg-intranet-primary/[0.03] p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <time dateTime={notice.createdDate.toISOString()}>{notice.createdDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
                <span className="ml-auto flex items-center gap-1 font-medium text-intranet-primary dark:text-rose-300"><Bell className="h-3 w-3" aria-hidden="true" /> Announcement</span>
              </div>
              <h3 className="break-words text-lg font-semibold leading-snug text-foreground">{notice.title}</h3>
              <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">{summary(notice.content)}</p>
              <Button variant="link" className="mt-3 h-auto whitespace-normal p-0 text-intranet-primary dark:text-rose-300" onClick={() => {
                if (!accountId) return;
                // Only this notice is dismissed; the others remain new for the next home visit.
                dismissStaffNotices(accountId, [notice.id]);
                setOffered(null);
                onReadNotice(notice);
              }}>Read full notice<span className="sr-only">: {notice.title}</span><ArrowRight aria-hidden="true" /></Button>
            </article>
          ))}
        </div>

        <div className="flex shrink-0 flex-col gap-4 border-t bg-muted/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-muted-foreground">{notices.length} {notices.length === 1 ? 'new notice' : 'new notices'} · Available on your notice board</p>
          <Button className="bg-intranet-primary text-white hover:bg-intranet-secondary" onClick={close}>Continue to dashboard<ArrowRight aria-hidden="true" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
