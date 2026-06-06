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
import { Bot, ChevronDown, ChevronUp, Zap, TrendingUp, AlertTriangle, BarChart3, Trash2, Maximize, Minimize, Database, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase, logger, GLOBAL_SETTINGS_ID } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useMsal } from '@azure/msal-react';
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { REGULATORY_QUICK_QUESTIONS, REGULATORY_QUESTION_LIBRARY } from './regulatoryQuestions';
import { cn } from '@/lib/utils';
import {
    AIChatPanel,
    StaticQuestionLibrarySidebar,
    type AIChatMessage,
} from '@/components/shared/ai-chat';
import { RegulatoryCase, KPIStats } from '../types';

type DataSourceFilter = 'all' | 'scam' | 'whistleblower' | 'investigation' | 'compliance' | 'enquiry' | 'high_risk';

const REGULATORY_AI_SYSTEM_PROMPT = `You are the SCPNG Regulatory Intelligence Assistant — an AI analyst embedded within the Securities Commission of Papua New Guinea's intranet platform.

CRITICAL: You DO have access to live organizational data. The data below has ALREADY been fetched from the organization's SharePoint environment via Microsoft Graph API and is provided to you in real-time. You MUST use this data to answer questions. Do NOT say you cannot access SharePoint or external data — the data is already here, loaded and ready for your analysis.

=== BEGIN LIVE REGULATORY DATA (from SharePoint via Microsoft Graph) ===
{regulatoryDataContext}
=== END LIVE REGULATORY DATA ===

INSTRUCTIONS:
- You are analyzing REAL, LIVE data from the SCPNG Regulatory Intelligence system
- Always reference specific cases, case IDs, dates, and risk levels from the data above
- If data shows 0 items or empty sections, acknowledge that those areas have no data recorded yet
- Identify patterns, risk exposure, and critical compliance issues based on the actual case details
- Maintain confidentiality context implicitly (e.g., don't advise sharing whistleblower details publicly)

Response Format:
1. Use data-driven analysis — cite specific case counts, risk levels, and categories
2. Structure responses with clear **headings** and bullet points
3. When summarizing cases, use markdown tables to display Case ID, Type, Risk, and Status
4. Highlight <CRITICAL> or <HIGH RISK> items with bold warnings and recommend immediate action if appropriate
5. Use **bold** for key metrics and emphasis

At the VERY end of your response, provide 3 relevant follow-up questions:
<followups>Question 1|Question 2|Question 3</followups>`;

interface RegulatoryAIChatProps {
    cases: RegulatoryCase[];
    stats: KPIStats;
}

const RegulatoryAIChat: React.FC<RegulatoryAIChatProps> = ({ cases, stats }) => {
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([
        {
            id: uuidv4(),
            sender: 'ai',
            text: "Hello! I'm your Regulatory Intelligence Assistant. Ask me anything about current scams, whistleblower reports, investigations, and overall compliance metrics.",
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
    const modelName = 'gemini-2.5-flash';

    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const userScrolledUpRef = useRef(false);

    const { isLoading: isAuthLoading } = useSupabaseAuth();
    const { inProgress: msalInProgress } = useMsal();
    const graphContext = useMicrosoftGraph();

    const INITIAL_GREETING = "Hello! I'm your Regulatory Intelligence Assistant. Ask me anything about current scams, whistleblower reports, investigations, and overall compliance metrics.";

    // Data source options for the dropdown
    const dataSourceOptions = useMemo(() => [
        { value: 'all', label: 'All Cases', count: cases.length },
        { value: 'scam', label: 'Scams', count: cases.filter(c => c.type === 'scam').length },
        { value: 'whistleblower', label: 'Whistleblowers', count: cases.filter(c => c.type === 'whistleblower').length },
        { value: 'investigation', label: 'Investigations', count: cases.filter(c => c.type === 'investigation').length },
        { value: 'compliance', label: 'Compliance', count: cases.filter(c => c.type === 'compliance').length },
        { value: 'enquiry', label: 'Enquiries', count: cases.filter(c => c.type === 'enquiry').length },
        { value: 'high_risk', label: 'High/Critical Risk Only', count: cases.filter(c => c.risk === 'HIGH' || c.risk === 'CRITICAL').length },
    ], [cases]);

    // Filter data based on selected source
    const getFilteredCases = () => {
        if (dataSourceFilter === 'all') return cases;
        if (dataSourceFilter === 'high_risk') return cases.filter(c => c.risk === 'HIGH' || c.risk === 'CRITICAL');
        return cases.filter(c => c.type === dataSourceFilter);
    };

    const serializeRegulatoryContext = (filteredCases: RegulatoryCase[], currentStats: KPIStats) => {
        let context = `TIMESTAMP: ${new Date().toISOString()}\n\n`;

        context += `--- KPI Overviews ---\n`;
        context += `Total Reports: ${currentStats.totalReports}\n`;
        context += `Open Cases: ${currentStats.openCases}\n`;
        context += `High Risk Cases: ${currentStats.highRisk}\n`;
        context += `Critical Alerts: ${currentStats.criticalAlerts}\n\n`;

        context += `--- FILTERED CASES (${filteredCases.length}) ---\n`;
        filteredCases.forEach((c) => {
            context += `Case ID: ${c.caseId}\n`;
            context += `Type: ${c.type} | Category: ${c.category} | Risk: ${c.risk} | Status: ${c.status}\n`;
            context += `Created: ${c.createdAt}\n`;
            context += `Assigned To: ${c.assignedUnit} (${c.assignedOfficer || 'Unassigned'})\n`;
            if (c.title) context += `Title: ${c.title}\n`;
            if (c.description) context += `Description: ${c.description}\n`;
            if (c.summary) context += `Summary: ${c.summary}\n`;
            if (c.anonymous !== undefined) context += `Anonymous: ${c.anonymous ? 'Yes' : 'No'}\n`;
            if (c.reporterName) context += `Reporter Name: ${c.reporterName}\n`;
            if (c.reporterContact) context += `Reporter Contact: ${c.reporterContact}\n`;
            if (c.source) context += `Source: ${c.source}\n`;
            context += `---\n`;
        });

        // Add a safeguard if there's no data
        if (filteredCases.length === 0) {
            context += `No cases found for the selected filter.\n`;
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
                const { data, error } = await supabase
                    .from('news_api_settings')
                    .select('api_key, api_endpoint')
                    .eq('id', GLOBAL_SETTINGS_ID)
                    .single();
                if (!error && data?.api_key) setApiKey(data.api_key);
            } catch (err: any) {
                logger.error('[RegulatoryAI] Exception fetching AI settings:', err);
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

        const filteredCases = getFilteredCases();
        const contextStr = serializeRegulatoryContext(filteredCases, stats);

        const systemContext = REGULATORY_AI_SYSTEM_PROMPT
            .replace('{regulatoryDataContext}', contextStr);

        const conversationHistory: any[] = [
            {
                role: 'user',
                parts: [{ text: `System Instruction: ${systemContext}` }],
            },
            {
                role: 'model',
                parts: [
                    {
                        text: `Understood. I have loaded ${filteredCases.length} regulatory cases into context based on the current filter, alongside the KPI stats. I will analyze this data to provide data-driven regulatory insights.`,
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
            logger.error('[RegulatoryAI] AI Request failed:', error);
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
            ? 'Give me a concise executive brief: top-line risk assessment, any critical alerts, and the most active scam/investigation trends. Keep it under 150 words.'
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
                    {REGULATORY_QUICK_QUESTIONS.map((q, i) => (
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
                        <CardTitle className="text-lg">Regulatory AI Analyst</CardTitle>
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
                        <CardDescription className="mb-2">AI-powered regulatory analysis and compliance insights</CardDescription>
                        {cases.length > 0 && (
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                    <Shield className="w-3 h-3 text-[#400010]" />
                                    <span>{cases.length} Total Cases</span>
                                </div>
                                {stats.highRisk > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>{stats.highRisk} High Risk</span>
                                    </div>
                                )}
                                {stats.criticalAlerts > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>{stats.criticalAlerts} Critical</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                    <BarChart3 className="w-3 h-3 text-blue-500" />
                                    <span>{stats.openCases} Open</span>
                                </div>
                            </div>
                        )}
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
                                inputPlaceholder="Ask about compliance issues or investigations..."
                                placeholderDisclaimer="This assistant analyzes live SCPNG regulatory data from SharePoint in real-time. Always verify insights against official records."
                                headerSlot={chatHeaderSlot}
                                className="flex-1"
                            />
                        </div>

                        <div className="w-80 shrink-0 overflow-hidden border-l border-border hidden md:block">
                            <StaticQuestionLibrarySidebar
                                categories={REGULATORY_QUESTION_LIBRARY}
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

export default RegulatoryAIChat;
