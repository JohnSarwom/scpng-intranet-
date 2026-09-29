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
import { Bot, ChevronDown, ChevronUp, Zap, TrendingUp, AlertTriangle, BarChart3, Trash2, Maximize, Minimize, Database, Briefcase } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/supabaseClient';
import { useGeminiApiKey } from '@/hooks/useGeminiApiKey';
import { DIVISION_QUICK_QUESTIONS, DIVISION_QUESTION_LIBRARY } from './divisionQuestions';
import { cn } from '@/lib/utils';
import {
    AIChatPanel,
    StaticQuestionLibrarySidebar,
    type AIChatMessage,
} from '@/components/shared/ai-chat';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';
import { useArchivedStrategyAI } from '@/hooks/useArchivedStrategyAI';
import {
    assertStrategyAIResponseUsesArchivedNumbers,
    serializeArchivedStrategyAIContext,
    strategyAIFilterRowCount,
    type StrategyAIEvidenceFilter,
} from '@/services/strategyReportAIService';

type DataSourceFilter = StrategyAIEvidenceFilter;

const DIVISION_AI_SYSTEM_PROMPT = `You are the SCPNG Division Intelligence Assistant — an AI analyst embedded within the Securities Commission of Papua New Guinea's intranet platform, explicitly focused on analyzing division operations.

CRITICAL: Your only factual source is the checksum-verified immutable report archive below. It is historical evidence, not a live SharePoint view. Never use page data, conversation claims, general knowledge, or assumptions as SCPNG performance evidence.

=== BEGIN AUTHORIZED ARCHIVED DIVISION EVIDENCE ===
{divisionDataContext}
=== END AUTHORIZED ARCHIVED DIVISION EVIDENCE ===

INSTRUCTIONS:
- State the frozen scope label and reporting period when answering.
- Never generalize findings beyond the archived scope.
- Numeric facts may only be repeated exactly when they appear in the archive context. Do not calculate, estimate, forecast, or invent a new number.
- Always reference specific Tasks, KRAs and KPIs directly from the archived rows above.
- If data shows 0 items or empty sections, acknowledge that those areas have no data recorded yet.
- If the requested evidence is absent, say it is unavailable in this archived snapshot.

Response Format:
1. Use data-driven analysis — cite specific completion rates, metric scores, and task names.
2. Structure responses with clear **headings** and bullet points.
3. When comparing unit performance or task distribution, use markdown tables.
4. Highlight efficiency drops or overdue work with bold warnings and recommend actionable steps.
5. Use **bold** for key metrics and emphasis.

At the VERY end of your response, provide 3 relevant follow-up questions:
<followups>Question 1|Question 2|Question 3</followups>`;

interface DivisionAIChatProps {
    data: UseDivisionDataReturn;
    metrics: DivisionMetrics;
}

const DivisionAIChat: React.FC<DivisionAIChatProps> = ({ data }) => {
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
        {
            id: uuidv4(),
            sender: 'ai',
            text: `Hello! I'm your Division Intelligence Assistant for the ${data.division?.name || 'Department'}. Ask me anything about our tasks, KRA tracking, KPI success, or operational bottlenecks.`,
            isTyping: false,
            timestamp: new Date(),
        },
    ]);
    const [isSending, setIsSending] = useState(false);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [isChatFullScreen, setIsChatFullScreen] = useState(false);
    const [isClearChatDialogOpen, setIsClearChatDialogOpen] = useState(false);
    const [dataSourceFilter, setDataSourceFilter] = useState<DataSourceFilter>('all');

    const { apiKey, isReady: isKeyReady } = useGeminiApiKey();
    const isConfigLoading = !isKeyReady;
    const modelName = 'gemini-2.5-flash';
    const archivedEvidence = useArchivedStrategyAI({
        audience: 'division',
        division: data.division?.name || data.userContext.division,
    });

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const userScrolledUpRef = useRef(false);

    const INITIAL_GREETING = `Hello! I'm your Division Intelligence Assistant for the ${data.division?.name || 'Department'}. Ask me anything about our tasks, KRA tracking, KPI success, or operational bottlenecks.`;

    // Data source options for the dropdown
    const dataSourceOptions = useMemo(() => [
        { value: 'all', label: 'All Archived Evidence', count: strategyAIFilterRowCount(archivedEvidence.archive, 'all') },
        { value: 'traceability', label: 'Traceability & Heatmap', count: strategyAIFilterRowCount(archivedEvidence.archive, 'traceability') },
        { value: 'delivery-risks', label: 'Overdue & Evidence Risks', count: strategyAIFilterRowCount(archivedEvidence.archive, 'delivery-risks') },
        { value: 'accountability', label: 'Owner Accountability', count: strategyAIFilterRowCount(archivedEvidence.archive, 'accountability') },
        { value: 'variance', label: 'KPI Variance', count: strategyAIFilterRowCount(archivedEvidence.archive, 'variance') },
        { value: 'governance', label: 'KPI Governance', count: strategyAIFilterRowCount(archivedEvidence.archive, 'governance') },
        { value: 'exceptions', label: 'Exceptions & Diagnostics', count: strategyAIFilterRowCount(archivedEvidence.archive, 'exceptions') },
    ], [archivedEvidence.archive]);

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

        if (archivedEvidence.isLoading || !archivedEvidence.archive) {
            setChatMessages((prev) => [...prev, {
                id: uuidv4(), sender: 'ai',
                text: archivedEvidence.isLoading
                    ? 'The authorized report archive is still loading. Please try again shortly.'
                    : archivedEvidence.error?.message || 'No authorized archived Division evidence is available.',
                isTyping: false, timestamp: new Date(),
            }]);
            setIsSending(false);
            return;
        }

        const effectiveApiKey = apiKey;
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

        const contextStr = serializeArchivedStrategyAIContext(archivedEvidence.archive, dataSourceFilter);
        const systemContext = DIVISION_AI_SYSTEM_PROMPT.replace('{divisionDataContext}', contextStr);

        const conversationHistory: any[] = [
            {
                role: 'user',
                parts: [{ text: `System Instruction: ${systemContext}` }],
            },
            {
                role: 'model',
                parts: [
                    {
                        text: `Understood. I will use only archived snapshot ${archivedEvidence.archive.record.snapshotId}, preserve its ${archivedEvidence.archive.record.scope.label} scope, and avoid unsupported numeric claims.`,
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
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${effectiveApiKey.trim()}`,
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
                assertStrategyAIResponseUsesArchivedNumbers(aiResponseText, contextStr);
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
            logger.error('[DivisionAI] AI Request failed:', error);
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
            ? 'Give me a concise executive brief: highlight the largest bottleneck in our tasks, any KPIs failing, and one immediate actionable recommendation. Keep it under 150 words.'
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
                    {DIVISION_QUICK_QUESTIONS.map((q, i) => (
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
                : "animate-fade-in overflow-hidden border-[#83002A]/20"
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
                        {!isFullScreenInstance && <Bot className="w-5 h-5 text-[#83002A]" />}
                        <CardTitle className="text-lg">Division AI Analyst</CardTitle>
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
                                                {opt.label} ({opt.count})
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
                            {archivedEvidence.archive
                                ? `Checksum-verified ${archivedEvidence.archive.record.scope.label} report evidence`
                                : archivedEvidence.isLoading ? 'Loading authorized archived evidence…' : 'Archived report evidence required'}
                        </CardDescription>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                <TrendingUp className="w-3 h-3 text-[#83002A]" />
                                <span>{archivedEvidence.archive?.record.snapshot.summary.averageProgress ?? '—'}% Archived Progress</span>
                            </div>
                            {(archivedEvidence.archive?.record.snapshot.sections.find(section => section.id === 'overdue')?.rows.length || 0) > 0 && (
                                <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{archivedEvidence.archive?.record.snapshot.sections.find(section => section.id === 'overdue')?.rows.length} Archived Overdue Tasks</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                <Briefcase className="w-3 h-3 text-blue-500" />
                                <span>{archivedEvidence.archive?.record.snapshot.summary.evidenceCount ?? '—'} Evidence Records</span>
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
                                disabled={isConfigLoading || archivedEvidence.isLoading || !archivedEvidence.archive}
                                inputPlaceholder="Ask about the archived Division report evidence..."
                                placeholderDisclaimer="This assistant uses one authorized checksum-verified archived report. It cannot use live page totals or introduce numeric facts absent from that snapshot."
                                headerSlot={chatHeaderSlot}
                                className="flex-1"
                            />
                        </div>

                        <div className="w-80 shrink-0 overflow-hidden border-l border-border hidden md:block">
                            <StaticQuestionLibrarySidebar
                                categories={DIVISION_QUESTION_LIBRARY}
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

export default DivisionAIChat;
