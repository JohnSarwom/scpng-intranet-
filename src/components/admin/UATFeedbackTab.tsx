import React, { useEffect, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import {
  FeedbackSharePointService,
  UATFeedbackItem,
  FeedbackStatus,
} from '@/services/feedbackService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Star, Trash2, RefreshCw, Filter, MessageSquare, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  New: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Reviewed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Bug Report': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'UI/UX Issue': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Feature Request': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'General Comment': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'Performance Issue': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={13}
          className={s <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'}
        />
      ))}
    </div>
  );
}

export const UATFeedbackTab: React.FC = () => {
  const { instance } = useMsal();
  const serviceRef = useRef<FeedbackSharePointService | null>(null);

  const [feedback, setFeedback] = useState<UATFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPage, setFilterPage] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const getService = async () => {
    if (!serviceRef.current) {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Failed to initialise Graph client');
      serviceRef.current = new FeedbackSharePointService(client);
    }
    return serviceRef.current;
  };

  const load = async () => {
    setLoading(true);
    try {
      const svc = await getService();
      const data = await svc.getAll();
      setFeedback(data);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    try {
      const svc = await getService();
      await svc.updateStatus(id, status);
      setFeedback(prev => prev.map(f => f.id === id ? { ...f, status } : f));
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const svc = await getService();
      await svc.delete(id);
      setFeedback(prev => prev.filter(f => f.id !== id));
      toast.success('Entry deleted');
    } catch {
      toast.error('Failed to delete entry');
    }
  };

  const uniquePages = ['all', ...Array.from(new Set(feedback.map(f => f.pageName)))];
  const uniqueCategories = ['all', ...Array.from(new Set(feedback.map(f => f.category)))];

  const filtered = feedback.filter(f => {
    if (filterPage !== 'all' && f.pageName !== filterPage) return false;
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: feedback.length,
    unreviewed: feedback.filter(f => f.status === 'New').length,
    avgRating:
      feedback.length
        ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)
        : '–',
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Submissions</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Unreviewed</p>
            <p className="text-2xl font-bold text-blue-600">{stats.unreviewed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Avg. Rating</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{stats.avgRating}</p>
              <Star size={16} className="fill-amber-400 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={15} className="text-muted-foreground" />

        <Select value={filterPage} onValueChange={setFilterPage}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="All pages" />
          </SelectTrigger>
          <SelectContent>
            {uniquePages.map(p => (
              <SelectItem key={p} value={p} className="text-sm">
                {p === 'all' ? 'All Pages' : p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48 h-8 text-sm">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            {uniqueCategories.map(c => (
              <SelectItem key={c} value={c} className="text-sm">
                {c === 'all' ? 'All Categories' : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-sm">All Statuses</SelectItem>
            <SelectItem value="New" className="text-sm">New</SelectItem>
            <SelectItem value="Reviewed" className="text-sm">Reviewed</SelectItem>
            <SelectItem value="Resolved" className="text-sm">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={load} className="h-8 gap-1.5">
          <RefreshCw size={13} />
          Refresh
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {feedback.length} entries
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw size={15} className="animate-spin" />
          Loading from SharePoint...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <MessageSquare size={40} className="opacity-30" />
          <p className="text-sm">No feedback found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <Card key={item.id} className="border border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {item.pageName}
                      </span>
                      <span className="text-muted-foreground/30 text-xs">·</span>
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          CATEGORY_COLORS[item.category] ?? 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {item.category}
                      </span>
                      <StarDisplay rating={item.rating} />
                    </div>

                    {/* Comment */}
                    <p className="text-sm leading-relaxed">{item.comment}</p>

                    {/* Attachment */}
                    {item.attachmentUrl && (
                      <a
                        href={item.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-intranet-primary hover:underline"
                      >
                        <ExternalLink size={12} />
                        View attachment
                      </a>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.userName}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span>{item.userEmail}</span>
                      <span className="text-muted-foreground/30">·</span>
                      <span>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString('en-PG', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : '–'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Select
                      value={item.status ?? 'New'}
                      onValueChange={val => handleStatusChange(item.id!, val as FeedbackStatus)}
                    >
                      <SelectTrigger
                        className={cn(
                          'h-7 text-xs w-28 border-0 font-medium rounded-full px-2',
                          STATUS_COLORS[item.status ?? 'New']
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New" className="text-xs">New</SelectItem>
                        <SelectItem value="Reviewed" className="text-xs">Reviewed</SelectItem>
                        <SelectItem value="Resolved" className="text-xs">Resolved</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id!)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
