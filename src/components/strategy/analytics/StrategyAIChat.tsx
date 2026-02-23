import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, ChevronDown, ChevronUp, Zap, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase, logger, GLOBAL_SETTINGS_ID } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useMsal } from '@azure/msal-react';
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { serializeStrategyContext } from '@/utils/strategyAnalyticsUtils';
import { STRATEGY_QUICK_QUESTIONS, STRATEGY_QUESTION_LIBRARY } from './strategyQuestions';
import strategyCalculationLogic from '@/prompts/strategyCalculationLogic.txt?raw';
import {
    AIChatPanel,
    StaticQuestionLibrarySidebar,
    type AIChatMessage,
} from '@/components/shared/ai-chat';

const STRATEGY_AI_SYSTEM_PROMPT = `You are the SCPNG Strategy Intelligence Assistant — an AI analyst embedded within the Securities Commission of Papua New Guinea's intranet platform.

CRITICAL: You DO have access to live organizational data. The data below has ALREADY been fetched from the organization's SharePoint environment via Microsoft Graph API and is provided to you in real-time. You MUST use this data to answer questions. Do NOT say you cannot access SharePoint or external data — the data is already here, loaded and ready for your analysis.

=== BEGIN LIVE STRATEGY DATA (from SharePoint via Microsoft Graph) ===
{strategyDataContext}
=== END LIVE STRATEGY DATA ===

INSTRUCTIONS:
- You are analyzing REAL, LIVE data from the SCPNG strategic management system
- Always reference specific objectives, KRAs, KPIs, divisions, and milestones BY NAME and with their actual numbers from the data above
- If data shows 0 items or empty sections, acknowledge that those areas have no data recorded yet
- Calculate averages, percentages, and comparisons directly from the numbers provided
- Identify patterns, risks, and opportunities based on the actual progress values

{calculationLogic}

ANALYTICS EXPANSION SUMMARY:
- Executive Scorecard: Dynamic color coding and a 5th "At-Risk" card.
- Status Distribution: Donut chart with Objectives/KRAs/KPIs tab toggle.
- Progress Trends: Line chart with a dashed "Planned Progress" reference line.
- Bar Chart: Horizontal layout, sorted by progress ascending, color-coded by status.
- Milestones: Date-aware countdowns and overdue indicators.

Response Format:
1. Use data-driven analysis — cite specific numbers, percentages, and objective names
2. Structure responses with clear **headings** and bullet points
3. When comparing divisions or objectives, use markdown tables
4. Highlight risks with bold warnings and recommendations prominently
5. Use **bold** for key metrics and emphasis

At the VERY end of your response, provide 3 relevant follow-up questions:
<followups>Question 1|Question 2|Question 3</followups>`;

interface StrategyAIChatProps {
    objectives: any[];
    kras: any[];
    kpis: any[];
    milestones: any[];
    unitObjectives: any[];
    orgHierarchy?: any[];
}

const StrategyAIChat: React.FC<StrategyAIChatProps> = ({
    objectives,
    kras,
    kpis,
    milestones,
    unitObjectives,
    orgHierarchy = [],
}) => {
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
        {
            id: uuidv4(),
            sender: 'ai',
            text: "Hello! I'm your Strategy Intelligence Assistant. Ask me anything about strategic objectives, divisional performance, KPIs, or execution progress.",
            isTyping: false,
            timestamp: new Date(),
        },
    ]);
    const [isSending, setIsSending] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    const [apiKey, setApiKey] = useState('');
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const modelName = 'gemini-2.0-flash';

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const briefTriggeredRef = useRef(false);

    // Teaser metrics for collapsed view
    const teaserMetrics = useMemo(() => {
        const avgCompletion = objectives.length > 0
            ? Math.round(objectives.reduce((s, o) => s + (o.progress || 0), 0) / objectives.length)
            : 0;
        const atRiskCount = objectives.filter(o => {
            const status = (o.status || '').toLowerCase();
            if (status === 'completed' || status === 'achieved' || (o.progress || 0) >= 100) return false;
            if (status === 'at-risk' || status === 'behind') return true;
            return (o.progress || 0) < 25;
        }).length;
        return { avgCompletion, atRiskCount };
    }, [objectives]);

    const { isLoading: isAuthLoading } = useSupabaseAuth();
    const { inProgress: msalInProgress } = useMsal();
    const graphContext = useMicrosoftGraph();

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    };

    // Typing animation
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
        const timer = setTimeout(() => scrollToBottom(), 50);
        return () => clearTimeout(timer);
    }, [chatMessages]);

    // Fetch API key
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
                const { data, error } = await supabase
                    .from('news_api_settings')
                    .select('api_key, api_endpoint')
                    .eq('id', GLOBAL_SETTINGS_ID)
                    .single();
                if (!error && data?.api_key) setApiKey(data.api_key);
            } catch (err: any) {
                logger.error('[StrategyAI] Exception fetching AI settings:', err);
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

        const strategyContext = serializeStrategyContext(
            objectives, kras, kpis, milestones, unitObjectives, orgHierarchy
        );
        const systemContext = STRATEGY_AI_SYSTEM_PROMPT
            .replace('{strategyDataContext}', strategyContext)
            .replace('{calculationLogic}', strategyCalculationLogic);

        const conversationHistory: any[] = [
            {
                role: 'user',
                parts: [{ text: `System Instruction: ${systemContext}` }],
            },
            {
                role: 'model',
                parts: [
                    {
                        text: `Understood. I have loaded ${objectives.length} strategic objectives, ${unitObjectives.length} unit-level objectives, ${kras.length} KRAs, ${kpis.length} KPIs, and ${milestones.length} milestones from the SCPNG SharePoint system. I will analyze this data to provide data-driven strategic insights.`,
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
            logger.error('[StrategyAI] AI Request failed:', error);
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
        // Map short button labels to detailed prompts
        const prompt = question === 'Executive Brief'
            ? 'Give me a concise executive brief: top-line progress, any at-risk objectives, and the single most important action item. Keep it under 150 words.'
            : question;
        setQuery(prompt);
        handleSend(undefined, prompt);
    };

    const handleCopy = (messageId: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
    };

    // Header slot: live data status + quick-question chips
    const chatHeaderSlot = (
        <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                <span className="text-[11px] text-green-700 dark:text-green-400 font-medium">
                    Live data connected — {objectives.length} Strategic Objectives,&nbsp;
                    {unitObjectives.length} Unit Objectives, {kras.length} KRAs,&nbsp;
                    {kpis.length} KPIs, {milestones.length} Milestones,&nbsp;
                    {orgHierarchy.length} Org Hierarchy entries loaded from SharePoint
                </span>
            </div>

            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Quick Analysis
                </p>
                <div className="flex flex-wrap gap-2">
                    {STRATEGY_QUICK_QUESTIONS.map((q, i) => (
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

    return (
        <Card className="animate-fade-in overflow-hidden">
            {/* Collapsible card header — same pattern as AIHub */}
            <CardHeader
                className="border-b border-border pb-4 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-intranet-primary" />
                        <CardTitle className="text-lg">Strategy Intelligence</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {!expanded && (
                            <span className="text-xs text-muted-foreground">
                                Click to expand AI analysis
                            </span>
                        )}
                        {expanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronUp className="w-4 h-4" />
                        }
                    </div>
                </div>
                {!expanded && (
                    <div className="mt-2">
                        <CardDescription className="mb-2">AI-powered strategic analysis and insights</CardDescription>
                        {objectives.length > 0 && (
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                    <TrendingUp className="w-3 h-3 text-intranet-primary" />
                                    <span>{teaserMetrics.avgCompletion}% avg. completion</span>
                                </div>
                                {teaserMetrics.atRiskCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>{teaserMetrics.atRiskCount} at-risk</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                    <BarChart3 className="w-3 h-3 text-blue-500" />
                                    <span>{kras.length} KRAs · {kpis.length} KPIs</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardHeader>

            {expanded && (
                <CardContent className="p-0 overflow-hidden">
                    {/* Two-column layout matching AIHub: chat (left) + question library (right) */}
                    <div className="flex h-[640px]">

                        {/* LEFT — AIChatPanel with header slot */}
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
                                inputPlaceholder="Ask about strategy performance..."
                                placeholderDisclaimer="This assistant analyzes live SCPNG strategic data from SharePoint in real-time. Always verify insights against official records."
                                headerSlot={chatHeaderSlot}
                                className="flex-1"
                            />
                        </div>

                        {/* RIGHT — Question Library (same styling as AIHub sidebar) */}
                        <div className="w-80 shrink-0 overflow-hidden border-l border-border">
                            <StaticQuestionLibrarySidebar
                                categories={STRATEGY_QUESTION_LIBRARY}
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
};

export default StrategyAIChat;
