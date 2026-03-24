import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Bot, ChevronDown, ChevronUp, Zap, Trash2, Maximize, Minimize, Database, Eye, Users, Globe, BarChart3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase, logger, GLOBAL_SETTINGS_ID } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useMsal } from '@azure/msal-react';
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { ANALYTICS_QUICK_QUESTIONS, OVERVIEW_QUICK_QUESTIONS, ANALYTICS_QUESTION_LIBRARY } from './analyticsQuestions';
import { cn } from '@/lib/utils';
import {
    AIChatPanel,
    StaticQuestionLibrarySidebar,
    type AIChatMessage,
} from '@/components/shared/ai-chat';

// ─── Types ───────────────────────────────────────────────────

export interface AnalyticsOverview {
    totalPageViews: number;
    uniqueVisitors: number;
    avgSessionDuration: string;
    bounceRate: number;
    pageViewsTrend: number;
    visitorsTrend: number;
    sessionTrend: number;
    bounceTrend: number;
}

export interface PageStat {
    path: string;
    title: string;
    views: number;
    uniqueViews: number;
    avgTime: string;
}

export interface ReferrerStat {
    source: string;
    visits: number;
    percentage: number;
}

export interface DeviceStat {
    device: string;
    count: number;
    percentage: number;
}

export interface BrowserStat {
    name: string;
    percentage: number;
}

export interface DailyView {
    date: string;
    views: number;
    visitors: number;
}

export interface GeoStat {
    country: string;
    visits: number;
    pct: number;
}

export interface WebsiteAnalyticsData {
    overview: AnalyticsOverview;
    topPages: PageStat[];
    referrers: ReferrerStat[];
    devices: DeviceStat[];
    browsers: BrowserStat[];
    dailyViews: DailyView[];
    geoDistribution: GeoStat[];
    activeVisitors: number;
    newVisitorPct: number;
    returningVisitorPct: number;
    socialStats?: {
        facebook: { reach: number; engagement: number; followers: number; trend: number };
        linkedin: { impressions: number; clicks: number; followers: number; trend: number };
    };
    crossPlatformTrends?: { date: string; website: number; facebook: number; linkedin: number; }[];
    audienceGrowth?: { date: string; total: number }[];
    contentPerformance?: { category: string; engagement: number }[];
}

type DataSourceFilter = 'all' | 'pages' | 'traffic_sources' | 'devices' | 'geography';

// ─── System Prompt ───────────────────────────────────────────

const ANALYTICS_AI_SYSTEM_PROMPT = `You are the SCPNG Website Analytics Assistant — an AI analyst embedded within the Securities Commission of Papua New Guinea's intranet platform.

CRITICAL: You DO have access to live website analytics data. The data below has ALREADY been collected from the SCPNG public website via server-side PHP tracking and is provided to you in real-time. You MUST use this data to answer questions. Do NOT say you cannot access the data — the data is already here, loaded and ready for your analysis.

=== BEGIN LIVE WEBSITE ANALYTICS DATA ===
{analyticsDataContext}
=== END LIVE WEBSITE ANALYTICS DATA ===

INSTRUCTIONS:
- You are analyzing REAL, LIVE website analytics data from the SCPNG public website (scpng.gov.pg)
- Always reference specific numbers, page names, traffic sources, and percentages from the data above
- If data shows 0 items or empty sections, acknowledge that those areas have no data recorded yet
- Identify patterns, trends, and actionable insights based on the actual analytics data
- Provide recommendations for improving website performance and user engagement

Response Format:
1. Use data-driven analysis — cite specific page views, percentages, and visitor counts
2. Structure responses with clear **headings** and bullet points
3. When comparing data, use markdown tables for clarity
4. Highlight significant changes or anomalies with bold emphasis
5. Use **bold** for key metrics and emphasis

At the VERY end of your response, provide 3 relevant follow-up questions:
<followups>Question 1|Question 2|Question 3</followups>`;

// ─── Component ───────────────────────────────────────────────

interface WebsiteAnalyticsAIChatProps {
    data: WebsiteAnalyticsData;
    type?: 'website' | 'overview';
}

const WebsiteAnalyticsAIChat: React.FC<WebsiteAnalyticsAIChatProps> = ({ data, type = 'website' }) => {
    const isOverview = type === 'overview';
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');

    const INITIAL_GREETING = isOverview 
        ? "Hello! I'm your Cross-Platform Analytics Assistant. I can analyze trends and engagement across your Website, Facebook, and LinkedIn channels."
        : "Hello! I'm your Website Analytics Assistant. Ask me about traffic trends, top pages, visitor demographics, referral sources, and actionable insights for the SCPNG public website.";

    const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
        {
            id: uuidv4(),
            sender: 'ai',
            text: INITIAL_GREETING,
            isTyping: false,
            timestamp: new Date(),
        },
    ]);
    const [isSending, setIsSending] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [isChatFullScreen, setIsChatFullScreen] = useState(false);
    const [isClearChatDialogOpen, setIsClearChatDialogOpen] = useState(false);
    const [dataSourceFilter, setDataSourceFilter] = useState<DataSourceFilter>('all');

    const [apiKey, setApiKey] = useState('');
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const modelName = 'gemini-2.0-flash';

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const userScrolledUpRef = useRef(false);

    const { isLoading: isAuthLoading } = useSupabaseAuth();
    const { inProgress: msalInProgress } = useMsal();
    const graphContext = useMicrosoftGraph();


    const dataSourceOptions = useMemo(() => [
        { value: 'all', label: 'All Analytics', count: '' },
        { value: 'pages', label: 'Page Performance', count: `${data.topPages.length} pages` },
        { value: 'traffic_sources', label: 'Traffic Sources', count: `${data.referrers.length} sources` },
        { value: 'devices', label: 'Devices & Browsers', count: `${data.devices.length + data.browsers.length} types` },
        { value: 'geography', label: 'Geography', count: `${data.geoDistribution.length} countries` },
    ], [data]);

    const serializeAnalyticsContext = (filter: DataSourceFilter) => {
        let context = `TIMESTAMP: ${new Date().toISOString()}\n`;
        context += `ASSISTANT_TYPE: ${type.toUpperCase()} ANALYTICS\n\n`;

        if (isOverview && data.socialStats) {
            context += `--- SOCIAL MEDIA OVERVIEW ---\n`;
            context += `FACEBOOK: Reach ${data.socialStats.facebook.reach.toLocaleString()}, Engagement ${data.socialStats.facebook.engagement.toLocaleString()}, Followers ${data.socialStats.facebook.followers.toLocaleString()} (${data.socialStats.facebook.trend}% trend)\n`;
            context += `LINKEDIN: Impressions ${data.socialStats.linkedin.impressions.toLocaleString()}, Clicks ${data.socialStats.linkedin.clicks.toLocaleString()}, Followers ${data.socialStats.linkedin.followers.toLocaleString()} (${data.socialStats.linkedin.trend}% trend)\n\n`;
            
            if (data.crossPlatformTrends) {
                context += `--- CROSS-PLATFORM TRENDS (Daily Activity) ---\n`;
                data.crossPlatformTrends.forEach(t => {
                    context += `${t.date}: Website ${t.website}, Facebook ${t.facebook}, LinkedIn ${t.linkedin}\n`;
                });
                context += `\n`;
            }

            if (data.audienceGrowth) {
                context += `--- AUDIENCE GROWTH TREND ---\n`;
                data.audienceGrowth.forEach(g => {
                    context += `${g.date}: ${g.total.toLocaleString()} total audience\n`;
                });
                context += `\n`;
            }

            if (data.contentPerformance) {
                context += `--- CONTENT ENGAGEMENT BY CATEGORY ---\n`;
                data.contentPerformance.forEach(c => {
                    context += `${c.category}: ${c.engagement.toLocaleString()} interactions\n`;
                });
                context += `\n`;
            }
        }

        if (filter === 'all' || filter === 'pages') {
            context += `--- WEBSITE OVERVIEW METRICS ---\n`;
            context += `Total Page Views: ${data.overview.totalPageViews.toLocaleString()} (${data.overview.pageViewsTrend > 0 ? '+' : ''}${data.overview.pageViewsTrend}% vs last month)\n`;
            context += `Unique Visitors: ${data.overview.uniqueVisitors.toLocaleString()} (${data.overview.visitorsTrend > 0 ? '+' : ''}${data.overview.visitorsTrend}% vs last month)\n`;
            context += `Avg Session Duration: ${data.overview.avgSessionDuration} (${data.overview.sessionTrend > 0 ? '+' : ''}${data.overview.sessionTrend}% vs last month)\n`;
            context += `Bounce Rate: ${data.overview.bounceRate}% (${data.overview.bounceTrend > 0 ? '+' : ''}${data.overview.bounceTrend}% vs last month)\n`;
            context += `Active Visitors Right Now: ${data.activeVisitors}\n`;
            context += `New Visitors: ${data.newVisitorPct}% | Returning: ${data.returningVisitorPct}%\n\n`;
        }

        if (filter === 'all' || filter === 'pages') {
            context += `--- TOP PAGES (${data.topPages.length}) ---\n`;
            data.topPages.forEach((p, i) => {
                context += `${i + 1}. ${p.title} (${p.path}) — ${p.views.toLocaleString()} views, ${p.uniqueViews.toLocaleString()} unique, avg time: ${p.avgTime}\n`;
            });
            context += `\n`;

            context += `--- DAILY VIEWS (last ${data.dailyViews.length} days) ---\n`;
            data.dailyViews.forEach(d => {
                context += `${d.date}: ${d.views} views, ${d.visitors} visitors\n`;
            });
            context += `\n`;
        }

        if (filter === 'all' || filter === 'traffic_sources') {
            context += `--- TRAFFIC SOURCES (${data.referrers.length}) ---\n`;
            data.referrers.forEach(r => {
                context += `${r.source}: ${r.visits.toLocaleString()} visits (${r.percentage}%)\n`;
            });
            context += `\n`;
        }

        if (filter === 'all' || filter === 'devices') {
            context += `--- DEVICE BREAKDOWN ---\n`;
            data.devices.forEach(d => {
                context += `${d.device}: ${d.count.toLocaleString()} visits (${d.percentage}%)\n`;
            });
            context += `\n`;

            context += `--- BROWSER STATS ---\n`;
            data.browsers.forEach(b => {
                context += `${b.name}: ${b.percentage}%\n`;
            });
            context += `\n`;
        }

        if (filter === 'all' || filter === 'geography') {
            context += `--- GEOGRAPHIC DISTRIBUTION ---\n`;
            data.geoDistribution.forEach(g => {
                context += `${g.country}: ${g.visits.toLocaleString()} visits (${g.pct}%)\n`;
            });
            context += `\n`;
        }

        return context;
    };

    const handleClearChat = () => {
        setChatMessages([{
            id: uuidv4(),
            sender: 'ai',
            text: INITIAL_GREETING,
            isTyping: false,
            timestamp: new Date(),
        }]);
        setQuery('');
        setIsClearChatDialogOpen(false);
    };

    const scrollToBottom = (force = false) => {
        if (messagesContainerRef.current && (force || !userScrolledUpRef.current)) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
            userScrolledUpRef.current = !isAtBottom;
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [expanded]);

    useEffect(() => {
        const lastMessage = chatMessages[chatMessages.length - 1];
        if (lastMessage?.sender === 'ai' && lastMessage.isTyping && lastMessage.fullText) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            const typeNextChar = (charIndex: number) => {
                if (charIndex < lastMessage.fullText!.length) {
                    setChatMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === lastMessage.id
                                ? { ...msg, text: lastMessage.fullText!.substring(0, charIndex + 1) }
                                : msg
                        )
                    );
                    scrollToBottom();
                    typingTimeoutRef.current = setTimeout(() => typeNextChar(charIndex + 1), 25);
                } else {
                    setChatMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === lastMessage.id ? { ...msg, isTyping: false } : msg
                        )
                    );
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    scrollToBottom();
                }
            };

            const currentLen = lastMessage.text?.length || 0;
            if (currentLen < lastMessage.fullText.length) {
                typeNextChar(currentLen);
            } else {
                setChatMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === lastMessage.id ? { ...msg, isTyping: false } : msg
                    )
                );
            }
        }
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatMessages]);

    useEffect(() => {
        if (!userScrolledUpRef.current) {
            const timer = setTimeout(() => scrollToBottom(), 50);
            return () => clearTimeout(timer);
        }
    }, [chatMessages]);

    useEffect(() => {
        const fetchAiSettings = async () => {
            const envKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (envKey) {
                setApiKey(envKey);
                setIsConfigLoading(false);
                return;
            }

            if (graphContext.getAppSetting && !isAuthLoading && msalInProgress === 'none') {
                const spKey = await graphContext.getAppSetting('GeminiAPIKey');
                if (spKey) {
                    setApiKey(spKey);
                    setIsConfigLoading(false);
                    return;
                }
            }

            if (isAuthLoading || msalInProgress !== 'none') return;

            setIsConfigLoading(true);
            try {
                const { data: settingsData, error } = await supabase
                    .from('news_api_settings')
                    .select('api_key, api_endpoint')
                    .eq('id', GLOBAL_SETTINGS_ID)
                    .single();
                if (!error && settingsData?.api_key) setApiKey(settingsData.api_key);
            } catch (err: any) {
                logger.error('[AnalyticsAI] Exception fetching AI settings:', err);
            }
            setIsConfigLoading(false);
        };
        fetchAiSettings();
    }, [isAuthLoading, msalInProgress, graphContext]);

    const isAiTyping =
        chatMessages.length > 0 &&
        chatMessages[chatMessages.length - 1].sender === 'ai' &&
        !!chatMessages[chatMessages.length - 1].isTyping;

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        setChatMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.sender === 'ai' && last.isTyping) {
                return prev.map((msg) =>
                    msg.id === last.id ? { ...msg, isTyping: false } : msg
                );
            }
            return prev;
        });
        setIsSending(false);
    };

    const handleSend = async (e?: React.FormEvent, manualMessage?: string) => {
        e?.preventDefault();

        if (isSending || isAiTyping) {
            handleStopGeneration();
            return;
        }

        const messageToSend = manualMessage || query.trim();
        if (!messageToSend) return;

        userScrolledUpRef.current = false;

        setChatMessages((prev) => [
            ...prev,
            { id: uuidv4(), sender: 'user', text: messageToSend, timestamp: new Date() },
        ]);
        setQuery('');
        setIsSending(true);

        const effectiveApiKey = import.meta.env.VITE_GEMINI_API_KEY || apiKey;
        if (!effectiveApiKey) {
            setChatMessages((prev) => [
                ...prev,
                {
                    id: uuidv4(),
                    sender: 'ai',
                    text: 'AI is not configured. Please add VITE_GEMINI_API_KEY to your .env file or configure it in settings.',
                    isTyping: false,
                    timestamp: new Date(),
                },
            ]);
            setIsSending(false);
            return;
        }

        const contextStr = serializeAnalyticsContext(dataSourceFilter);

        const systemContext = ANALYTICS_AI_SYSTEM_PROMPT
            .replace('{analyticsDataContext}', contextStr);

        const conversationHistory: any[] = [
            {
                role: 'user',
                parts: [{ text: `System Instruction: ${systemContext}` }],
            },
            {
                role: 'model',
                parts: [
                    {
                        text: `Understood. I have loaded the SCPNG website analytics data into context based on the "${dataSourceFilter}" filter. I will analyze this data to provide actionable website performance insights.`,
                    },
                ],
            },
            ...chatMessages
                .filter((_, i) => i !== 0)
                .filter((msg) => msg.sender === 'user' || (msg.sender === 'ai' && !msg.isTyping))
                .map((msg) => ({
                    role: msg.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.fullText || msg.text }],
                })),
            { role: 'user', parts: [{ text: messageToSend }] },
        ];

        try {
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${effectiveApiKey.trim()}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: conversationHistory }),
                    signal: controller.signal,
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `Gemini API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`
                );
            }

            const responseData = await response.json();

            if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
                let aiResponseText = responseData.candidates[0].content.parts[0].text;
                let followUpQuestions: string[] = [];

                const followUpMatch = aiResponseText.match(/<followups>(.*?)<\/followups>/s);
                if (followUpMatch) {
                    followUpQuestions = followUpMatch[1].split('|').map((q: string) => q.trim());
                    aiResponseText = aiResponseText.replace(/<followups>.*?<\/followups>/s, '').trim();
                }

                setChatMessages((prev) => [
                    ...prev,
                    {
                        id: uuidv4(),
                        sender: 'ai',
                        text: '',
                        fullText: aiResponseText,
                        isTyping: true,
                        timestamp: new Date(),
                        followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : undefined,
                    },
                ]);
            } else {
                throw new Error('Chat response format not recognized or content missing.');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                setIsSending(false);
                return;
            }
            logger.error('[AnalyticsAI] AI Request failed:', error);
            setChatMessages((prev) => [
                ...prev,
                {
                    id: uuidv4(),
                    sender: 'ai',
                    text: `Error: ${error.message}`,
                    isTyping: false,
                    timestamp: new Date(),
                },
            ]);
        } finally {
            abortControllerRef.current = null;
        }

        setIsSending(false);
    };

    const handleFollowUpClick = (question: string) => {
        const prompt = question === 'Executive Brief'
            ? 'Give me a concise executive brief of the SCPNG website analytics: top-line traffic numbers, most popular pages, primary traffic sources, and any notable trends. Keep it under 200 words.'
            : question;
        setQuery(prompt);
        handleSend(undefined, prompt);
    };

    const handleCopy = (messageId: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
    };

    const chatHeaderSlot = (
        <div className="p-4">
            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Quick Analysis
                </p>
                <div className="flex flex-wrap gap-2">
                    {(isOverview ? OVERVIEW_QUICK_QUESTIONS : ANALYTICS_QUICK_QUESTIONS).map((q, i) => (
                        <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleFollowUpClick(q)}
                            disabled={isSending || isAiTyping}
                        >
                            <Zap className="w-3 h-3 mr-1" />
                            {q}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderChatInterface = (isFullScreenInstance = false) => (
        <Card className={cn(
            "flex flex-col h-full mt-6",
            isFullScreenInstance
                ? "w-full rounded-none border-none shadow-none mt-0"
                : "animate-fade-in overflow-hidden border-[#400010]/20"
        )}>
            <CardHeader className={cn(
                isFullScreenInstance ? "border-b py-3 px-4" : "border-b border-border pb-4",
                !isFullScreenInstance && !expanded && "cursor-pointer"
            )}
                onClick={!isFullScreenInstance && !expanded ? () => setExpanded(true) : undefined}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isFullScreenInstance && (
                            <img src="/images/SCPNG Original Logo.png" alt="SCPNG Logo" className="h-8 w-auto" />
                        )}
                        {!isFullScreenInstance && <Bot className="w-5 h-5 text-[#400010]" />}
                        <CardTitle className="text-lg">
                            {isOverview ? 'Cross-Platform AI Analyst' : 'Website Analytics AI Analyst'}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {(expanded || isFullScreenInstance) && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => { e.stopPropagation(); setIsClearChatDialogOpen(true); }}
                                    className="h-8 w-8"
                                    title="Clear chat"
                                >
                                    <Trash2 size={16} />
                                </Button>

                                <Select value={dataSourceFilter} onValueChange={(v) => setDataSourceFilter(v as DataSourceFilter)}>
                                    <SelectTrigger className="w-[200px] text-xs h-8" onClick={(e) => e.stopPropagation()}>
                                        <Database className="mr-1 h-3 w-3" />
                                        <SelectValue placeholder="Select Data Source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dataSourceOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                {opt.label} {opt.count && `(${opt.count})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => { e.stopPropagation(); setIsChatFullScreen(!isChatFullScreen); }}
                                    className="h-8 w-8"
                                    title={isChatFullScreen ? "Exit full screen" : "Enter full screen"}
                                >
                                    {isChatFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
                                </Button>
                            </>
                        )}
                        {!isFullScreenInstance && (
                            <div
                                className="cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                            >
                                {expanded
                                    ? <ChevronDown className="w-4 h-4" />
                                    : <ChevronUp className="w-4 h-4" />
                                }
                            </div>
                        )}
                    </div>
                </div>
                {!isFullScreenInstance && !expanded && (
                    <div className="mt-2 cursor-pointer" onClick={() => setExpanded(true)}>
                        <CardDescription className="mb-2">
                            {isOverview 
                                ? 'AI-powered cross-channel analysis for Website, Facebook, and LinkedIn'
                                : 'AI-powered website traffic analysis and performance insights'}
                        </CardDescription>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                <Eye className="w-3 h-3 text-[#400010]" />
                                <span>{data.overview.totalPageViews.toLocaleString()} Page Views</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                <Users className="w-3 h-3 text-blue-500" />
                                <span>{data.overview.uniqueVisitors.toLocaleString()} Visitors</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                <Globe className="w-3 h-3 text-green-500" />
                                <span>{data.geoDistribution.length} Countries</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                <BarChart3 className="w-3 h-3 text-amber-500" />
                                <span>{data.overview.bounceRate}% Bounce Rate</span>
                            </div>
                        </div>
                    </div>
                )}
            </CardHeader>

            {(expanded || isFullScreenInstance) && (
                <CardContent className={cn("p-0 overflow-hidden", isFullScreenInstance && "flex-1")}>
                    <div className={cn("flex", isFullScreenInstance ? "h-full" : "h-[640px]")}>
                        <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border">
                            <AIChatPanel
                                ref={messagesContainerRef}
                                messages={chatMessages}
                                isSending={isSending}
                                query={query}
                                onQueryChange={setQuery}
                                onSubmit={handleSend}
                                copiedMessageId={copiedMessageId}
                                onCopy={handleCopy}
                                onFollowUpClick={handleFollowUpClick}
                                disabled={isConfigLoading}
                                inputPlaceholder="Ask about website traffic, top pages, visitor insights..."
                                placeholderDisclaimer="This assistant analyzes SCPNG public website analytics data. Currently using mock data — connect to the live WordPress endpoint for real-time statistics."
                                headerSlot={chatHeaderSlot}
                                className="flex-1"
                            />
                        </div>

                        <div className="w-80 shrink-0 overflow-hidden border-l border-border hidden md:block">
                            <StaticQuestionLibrarySidebar
                                categories={ANALYTICS_QUESTION_LIBRARY}
                                onSelectQuestion={handleFollowUpClick}
                                title="Question Library"
                                className="h-full"
                            />
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );

    return (
        <>
            {!isChatFullScreen && renderChatInterface(false)}

            {isChatFullScreen && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex flex-col p-0 m-0 bg-background dark:bg-intranet-dark">
                    {renderChatInterface(true)}
                </div>,
                document.body
            )}

            <AlertDialog open={isClearChatDialogOpen} onOpenChange={setIsClearChatDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete your current conversation history. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleClearChat}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Clear Chat
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default WebsiteAnalyticsAIChat;
