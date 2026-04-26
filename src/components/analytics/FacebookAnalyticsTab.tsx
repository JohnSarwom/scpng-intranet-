import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, ExternalLink, Heart, Share2, MessageSquare, Inbox, Search, AlertCircle, FileText, Image as ImageIcon, Video, Album, TrendingUp, Calendar, ThumbsUp, Play } from 'lucide-react';
import { useFacebookAnalytics } from '@/hooks/useFacebookAnalytics';
import type { FacebookPost, FacebookComment, FacebookMessage } from '@/services/facebookAnalyticsService';

const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
};

const truncate = (s: string, n = 160) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

const postTypeIcon = (t: string) => {
    switch (t) {
        case 'photo': return <ImageIcon className="h-3.5 w-3.5" />;
        case 'video': return <Video className="h-3.5 w-3.5" />;
        case 'album': return <Album className="h-3.5 w-3.5" />;
        default: return <FileText className="h-3.5 w-3.5" />;
    }
};

const OverviewCards: React.FC<{ posts: FacebookPost[]; comments: FacebookComment[]; messages: FacebookMessage[] }> = ({ posts, comments, messages }) => {
    const totalReactions = posts.reduce((a, p) => a + (p.reactions || 0), 0);
    const totalShares = posts.reduce((a, p) => a + (p.shares || 0), 0);
    const incomingMessages = messages.filter(m => m.direction === 'Incoming').length;
    const replyRate = messages.length > 0
        ? Math.round((messages.filter(m => m.direction === 'Page Reply').length / Math.max(1, incomingMessages)) * 100)
        : 0;

    const stats = [
        { label: 'Posts Synced', value: posts.length, icon: FileText, color: 'text-blue-600' },
        { label: 'Total Reactions', value: totalReactions.toLocaleString(), icon: Heart, color: 'text-red-500' },
        { label: 'Total Shares', value: totalShares.toLocaleString(), icon: Share2, color: 'text-green-600' },
        { label: 'Comments', value: comments.length.toLocaleString(), icon: MessageSquare, color: 'text-purple-600' },
        { label: 'Conversations', value: new Set(messages.map(m => m.conversationId)).size, icon: Inbox, color: 'text-amber-600' },
        { label: 'Reply Rate', value: `${replyRate}%`, icon: RefreshCw, color: 'text-teal-600' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.map(s => {
                const Icon = s.icon;
                return (
                    <Card key={s.label}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                                </div>
                                <Icon className={`h-5 w-5 ${s.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};

const PostCard: React.FC<{
    post: FacebookPost;
    postComments: FacebookComment[];
    engagement: number;
    daysOld: number;
    engagementPerDay: number;
    maxEngagement: number;
}> = ({ post, postComments, engagement, daysOld, engagementPerDay, maxEngagement }) => {
    const [showComments, setShowComments] = useState(false);
    const [expandedCaption, setExpandedCaption] = useState(false);
    const [imgError, setImgError] = useState(false);
    const captionIsLong = (post.postMessage?.length || 0) > 240;
    const engagementPct = maxEngagement > 0 ? Math.round((engagement / maxEngagement) * 100) : 0;

    return (
        <Card className="overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
            <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                    <span className="font-bold text-lg leading-none">f</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">SCPNG</span>
                        <Badge variant="secondary" className="gap-1 text-[10px] h-5 px-1.5">
                            {postTypeIcon(post.postType)}
                            {post.postType}
                        </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(post.createdTime)}</span>
                        <span>·</span>
                        <span>{daysOld}d ago</span>
                    </div>
                </div>
                {post.postLink && (
                    <a
                        href={post.postLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-blue-600 transition-colors"
                        title="View on Facebook"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </a>
                )}
            </div>

            {post.postMessage ? (
                <div className="px-4 pb-3">
                    <p className={`text-sm whitespace-pre-wrap ${!expandedCaption && captionIsLong ? 'line-clamp-4' : ''}`}>
                        {post.postMessage}
                    </p>
                    {captionIsLong && (
                        <button
                            onClick={() => setExpandedCaption(v => !v)}
                            className="text-xs text-muted-foreground hover:text-foreground font-medium mt-1"
                        >
                            {expandedCaption ? 'Show less' : 'Show more'}
                        </button>
                    )}
                </div>
            ) : (
                <div className="px-4 pb-3">
                    <p className="text-sm italic text-muted-foreground">(no caption)</p>
                </div>
            )}

            {post.imageUrl && !imgError ? (
                <a
                    href={post.postLink || post.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-muted"
                >
                    <img
                        src={post.imageUrl}
                        alt=""
                        onError={() => setImgError(true)}
                        className="w-full aspect-[4/3] object-cover"
                        loading="lazy"
                    />
                </a>
            ) : post.videoUrl ? (
                <a
                    href={post.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 aspect-[4/3] group"
                >
                    <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="h-6 w-6 text-slate-900 ml-0.5" fill="currentColor" />
                    </div>
                </a>
            ) : post.postType === 'photo' || post.postType === 'album' ? (
                <div className="flex items-center justify-center bg-muted aspect-[4/3]">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                </div>
            ) : null}

            <div className="px-4 py-2.5 flex items-center justify-between text-xs border-t">
                <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1">
                        <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center border-2 border-background">
                            <Heart className="h-2.5 w-2.5 text-white" fill="currentColor" />
                        </div>
                        <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center border-2 border-background">
                            <ThumbsUp className="h-2.5 w-2.5 text-white" fill="currentColor" />
                        </div>
                    </div>
                    <span className="font-medium">{post.reactions.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{postComments.length} comments</span>
                    <span>{post.shares} shares</span>
                </div>
            </div>

            <div className="grid grid-cols-4 border-t bg-muted/20">
                <div className="p-2 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Reactions</div>
                    <div className="text-base font-semibold text-red-500">{post.reactions.toLocaleString()}</div>
                </div>
                <div className="p-2 text-center border-l">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Shares</div>
                    <div className="text-base font-semibold text-green-600">{post.shares.toLocaleString()}</div>
                </div>
                <div className="p-2 text-center border-l">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Comments</div>
                    <div className="text-base font-semibold text-purple-600">{postComments.length.toLocaleString()}</div>
                </div>
                <div className="p-2 text-center border-l">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Per Day</div>
                    <div className="text-base font-semibold text-amber-600">{engagementPerDay.toFixed(1)}</div>
                </div>
            </div>

            <div className="px-4 py-2 border-t">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span className="flex items-center gap-1 font-medium">
                        <TrendingUp className="h-3 w-3" />
                        Engagement Score
                    </span>
                    <span className="font-semibold">{engagement.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${engagementPct}%` }}
                    />
                </div>
            </div>

            <button
                onClick={() => setShowComments(v => !v)}
                className="border-t py-2 text-xs font-medium hover:bg-muted/50 flex items-center justify-center gap-2 transition-colors"
            >
                <MessageSquare className="h-3.5 w-3.5" />
                {showComments ? 'Hide comments' : postComments.length > 0 ? `View ${postComments.length} comments` : 'No comments'}
            </button>

            {showComments && (
                <div className="border-t bg-muted/20 p-3 space-y-2 max-h-80 overflow-y-auto">
                    {postComments.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic text-center py-2">No comments on this post.</p>
                    ) : (
                        postComments.map(c => (
                            <div
                                key={c.id}
                                className={`text-xs rounded-lg p-2 bg-background ${c.commentType === 'reply' ? 'ml-6' : ''}`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0">
                                        {(c.commentAuthor || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-semibold truncate">{c.commentAuthor || 'Anonymous'}</span>
                                    <Badge variant="outline" className="text-[9px] h-4 px-1 flex-shrink-0">{c.commentType}</Badge>
                                    <span className="text-muted-foreground ml-auto text-[10px] flex-shrink-0">{formatDate(c.commentTime)}</span>
                                </div>
                                <p className="whitespace-pre-wrap pl-8">{c.commentMessage}</p>
                            </div>
                        ))
                    )}
                </div>
            )}
        </Card>
    );
};

const PostsPanel: React.FC<{ posts: FacebookPost[]; comments: FacebookComment[] }> = ({ posts, comments }) => {
    const [q, setQ] = useState('');
    const [sortBy, setSortBy] = useState<'recent' | 'reactions' | 'engagement' | 'comments'>('recent');

    const commentsByPost = useMemo(() => {
        const map: Record<string, FacebookComment[]> = {};
        for (const c of comments) {
            if (!c.postId) continue;
            (map[c.postId] ||= []).push(c);
        }
        return map;
    }, [comments]);

    const enriched = useMemo(() => {
        return posts.map(p => {
            const pc = commentsByPost[p.postId] || [];
            const engagement = (p.reactions || 0) + (p.shares || 0) + pc.length;
            const created = p.createdTime ? new Date(p.createdTime).getTime() : 0;
            const daysOld = created ? Math.max(1, Math.floor((Date.now() - created) / 86400000)) : 1;
            const engagementPerDay = engagement / daysOld;
            return { post: p, postComments: pc, engagement, daysOld, engagementPerDay };
        });
    }, [posts, commentsByPost]);

    const maxEngagement = useMemo(() => enriched.reduce((m, e) => Math.max(m, e.engagement), 0), [enriched]);

    const filtered = useMemo(() => {
        let arr = enriched;
        if (q.trim()) {
            const needle = q.toLowerCase();
            arr = arr.filter(({ post: p }) =>
                p.postMessage?.toLowerCase().includes(needle) ||
                p.postId?.toLowerCase().includes(needle) ||
                p.postType?.toLowerCase().includes(needle)
            );
        }
        const sorted = [...arr];
        if (sortBy === 'recent') {
            sorted.sort((a, b) => (b.post.createdTime || '').localeCompare(a.post.createdTime || ''));
        } else if (sortBy === 'reactions') {
            sorted.sort((a, b) => b.post.reactions - a.post.reactions);
        } else if (sortBy === 'comments') {
            sorted.sort((a, b) => b.postComments.length - a.postComments.length);
        } else if (sortBy === 'engagement') {
            sorted.sort((a, b) => b.engagement - a.engagement);
        }
        return sorted;
    }, [enriched, q, sortBy]);

    if (posts.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No posts synced yet. Run <code className="font-mono text-xs">syncFacebookPage</code> in Apps Script.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search posts..." value={q} onChange={e => setQ(e.target.value)} className="pl-8" />
                </div>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="recent">Most recent</SelectItem>
                        <SelectItem value="reactions">Most reactions</SelectItem>
                        <SelectItem value="comments">Most comments</SelectItem>
                        <SelectItem value="engagement">Highest engagement</SelectItem>
                    </SelectContent>
                </Select>
                <Badge variant="outline">{filtered.length} / {posts.length}</Badge>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                    No posts match your search.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(({ post, postComments, engagement, daysOld, engagementPerDay }) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            postComments={postComments}
                            engagement={engagement}
                            daysOld={daysOld}
                            engagementPerDay={engagementPerDay}
                            maxEngagement={maxEngagement}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const MessagesPanel: React.FC<{ messages: FacebookMessage[] }> = ({ messages }) => {
    const [q, setQ] = useState('');
    const conversations = useMemo(() => {
        const map: Record<string, FacebookMessage[]> = {};
        for (const m of messages) {
            (map[m.conversationId] ||= []).push(m);
        }
        return Object.entries(map)
            .map(([id, msgs]) => ({
                id,
                messages: msgs.slice().sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || '')),
                latest: msgs[0],
                otherParty: msgs.find(m => m.direction === 'Incoming')?.senderName || 'Unknown',
            }))
            .sort((a, b) => (b.latest?.timestamp || '').localeCompare(a.latest?.timestamp || ''));
    }, [messages]);

    const filtered = useMemo(() => {
        if (!q.trim()) return conversations;
        const needle = q.toLowerCase();
        return conversations.filter(c =>
            c.otherParty.toLowerCase().includes(needle) ||
            c.messages.some(m => m.messageText.toLowerCase().includes(needle))
        );
    }, [conversations, q]);

    if (messages.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No messages synced yet.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search conversations..." value={q} onChange={e => setQ(e.target.value)} className="pl-8" />
                </div>
                <Badge variant="outline">{filtered.length} conversations</Badge>
            </div>

            <Accordion type="single" collapsible className="space-y-2">
                {filtered.map(c => (
                    <AccordionItem key={c.id} value={c.id} className="border rounded-lg bg-card px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex-1 text-left space-y-1 pr-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">{c.otherParty}</span>
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">{c.messages.length} msgs</Badge>
                                    <span className="text-xs text-muted-foreground">{formatDate(c.latest?.timestamp)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                    {truncate(c.latest?.messageText || '', 120)}
                                </p>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                {c.messages.map(m => {
                                    const isPage = m.direction === 'Page Reply';
                                    return (
                                        <div key={m.id} className={`flex ${isPage ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isPage ? 'bg-blue-600 text-white' : 'bg-muted'}`}>
                                                <div className={`text-[10px] mb-0.5 ${isPage ? 'text-blue-100' : 'text-muted-foreground'}`}>
                                                    {m.senderName} · {formatDate(m.timestamp)}
                                                </div>
                                                <p className="whitespace-pre-wrap">{m.messageText}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
};

const CommentsPanel: React.FC<{ comments: FacebookComment[] }> = ({ comments }) => {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        if (!q.trim()) return comments;
        const needle = q.toLowerCase();
        return comments.filter(c =>
            c.commentMessage.toLowerCase().includes(needle) ||
            c.commentAuthor.toLowerCase().includes(needle)
        );
    }, [comments, q]);

    if (comments.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No comments synced yet.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search comments..." value={q} onChange={e => setQ(e.target.value)} className="pl-8" />
                </div>
                <Badge variant="outline">{filtered.length} / {comments.length}</Badge>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Author</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.slice(0, 250).map(c => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.commentAuthor || 'Anonymous'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px]">{c.commentType}</Badge>
                                    </TableCell>
                                    <TableCell className="max-w-md"><p className="line-clamp-2 text-sm">{c.commentMessage}</p></TableCell>
                                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(c.commentTime)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {filtered.length > 250 && (
                        <div className="p-3 text-center text-xs text-muted-foreground border-t">
                            Showing first 250 of {filtered.length} — refine your search to narrow further.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export const FacebookAnalyticsTab: React.FC = () => {
    const { data, isLoading, error, refetch, isFetching } = useFacebookAnalytics();

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Loading Facebook analytics from SharePoint...</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive">
                <CardContent className="py-12 text-center">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
                    <p className="font-medium mb-1">Failed to load Facebook data</p>
                    <p className="text-sm text-muted-foreground mb-4">{(error as Error).message}</p>
                    <Button onClick={() => refetch()} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" /> Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const { posts = [], comments = [], messages = [] } = data || {};

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <div className="h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                            <span className="font-bold text-sm leading-none">f</span>
                        </div>
                        Facebook Page Analytics
                    </h3>
                    <p className="text-sm text-muted-foreground">Data synced from Facebook Graph API via Google Apps Script.</p>
                </div>
                <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
                    {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Refresh
                </Button>
            </div>

            <OverviewCards posts={posts} comments={comments} messages={messages} />

            <Tabs defaultValue="posts">
                <TabsList>
                    <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
                    <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
                    <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="posts" className="mt-4"><PostsPanel posts={posts} comments={comments} /></TabsContent>
                <TabsContent value="comments" className="mt-4"><CommentsPanel comments={comments} /></TabsContent>
                <TabsContent value="messages" className="mt-4"><MessagesPanel messages={messages} /></TabsContent>
            </Tabs>
        </div>
    );
};

export default FacebookAnalyticsTab;
