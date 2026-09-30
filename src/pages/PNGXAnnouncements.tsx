import { useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, RefreshCw, Search } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getGraphClient } from '@/services/graphService';
import { PNGXAnnouncementsSharePointService } from '@/services/pngxAnnouncementsSharePointService';

const PAGE_SIZE = 20;

function formatPublishedDate(value: string | null): string {
  if (!value) return 'Publication date unavailable';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Pacific/Port_Moresby',
  }).format(new Date(value));
}

export default function PNGXAnnouncements() {
  const { instance, accounts } = useMsal();
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('all');
  const [category, setCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: announcements = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['pngx-market-announcements', accounts[0]?.homeAccountId],
    queryFn: async () => {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Could not connect to Microsoft 365. Please sign in again.');
      return new PNGXAnnouncementsSharePointService(client).getAnnouncements();
    },
    enabled: accounts.length > 0,
    refetchOnMount: 'always',
  });

  const companies = useMemo(() => [...new Set(announcements.map(item => item.companyName).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)), [announcements]);
  const categories = useMemo(() => [...new Set(announcements.flatMap(item => item.categories))]
    .sort((a, b) => a.localeCompare(b)), [announcements]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return announcements.filter(item => {
      if (company !== 'all' && item.companyName !== company) return false;
      if (category !== 'all' && !item.categories.includes(category)) return false;
      if (!query) return true;
      return [item.title, item.securityCode, item.companyName, item.reviewedSummary, ...item.categories]
        .some(value => value.toLowerCase().includes(query));
    });
  }, [announcements, search, company, category]);

  const visible = filtered.slice(0, visibleCount);
  const errorMessage = error instanceof Error ? error.message : 'The announcements could not be loaded.';

  return (
    <PageLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">PNGX Announcements</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Company announcements recorded from PNGX. Open a filing to read the original announcement.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)_minmax(11rem,auto)]">
          <label className="relative block">
            <span className="sr-only">Search announcements</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }}
              placeholder="Search announcements" className="pl-9" />
          </label>
          <label className="block">
            <span className="sr-only">Filter by company</span>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={company} onChange={event => { setCompany(event.target.value); setVisibleCount(PAGE_SIZE); }}>
              <option value="all">All companies</option>
              {companies.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Filter by category</span>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={category} onChange={event => { setCategory(event.target.value); setVisibleCount(PAGE_SIZE); }}>
              <option value="all">All categories</option>
              {categories.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
            Unable to load PNGX announcements: {errorMessage}
          </div>
        )}

        {isLoading && <p role="status" className="py-12 text-center text-muted-foreground">Loading announcements…</p>}

        {!isLoading && !error && (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? 'announcement' : 'announcements'}
            </p>
            {announcements.length === 0 ? (
              <div className="rounded-xl border bg-card px-6 py-12 text-center text-muted-foreground">
                No PNGX announcements are recorded in SharePoint yet.
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border bg-card px-6 py-12 text-center text-muted-foreground">
                No announcements match your search or filters.
              </div>
            ) : (
              <div className="space-y-4">
                {visible.map(item => (
                  <Card key={item.id}>
                    <CardContent className="space-y-3 p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-semibold leading-snug text-foreground">{item.title}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[item.companyName, item.securityCode].filter(Boolean).join(' · ') || 'Company not specified'}
                          </p>
                        </div>
                        <time className="text-sm text-muted-foreground" dateTime={item.announcementDate ?? undefined}>
                          {formatPublishedDate(item.announcementDate)}
                        </time>
                      </div>
                      {item.categories.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.categories.map(value => (
                            <span key={value} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{value}</span>
                          ))}
                        </div>
                      )}
                      {item.reviewedSummary && <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.reviewedSummary}</p>}
                      <div className="flex flex-wrap gap-4 pt-1 text-sm">
                        {item.announcementPage ? (
                          <a href={item.announcementPage} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                            Read announcement <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : <span className="text-muted-foreground">Source link unavailable</span>}
                        {item.documentUrl && (
                          <a href={item.documentUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                            Open document <FileText className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {visibleCount < filtered.length && (
                  <div className="text-center">
                    <Button variant="outline" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>Show more</Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
