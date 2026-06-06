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
import { supabase, logger, GLOBAL_SETTINGS_ID } from '@/lib/supabaseClient';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useMsal } from '@azure/msal-react';
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';
import { DIVISION_QUICK_QUESTIONS, DIVISION_QUESTION_LIBRARY } from './divisionQuestions';
import { cn } from '@/lib/utils';
import {
    AIChatPanel,
    StaticQuestionLibrarySidebar,
    type AIChatMessage,
} from '@/components/shared/ai-chat';
import { UseDivisionDataReturn } from '@/hooks/useDivisionData';
import { DivisionMetrics } from '@/types/division.types';

type DataSourceFilter = 'all' | 'tasks' | 'projects' | 'strategy' | 'staff';

const DIVISION_AI_SYSTEM_PROMPT = `You are the SCPNG Division Intelligence Assistant — an AI analyst embedded within the Securities Commission of Papua New Guinea's intranet platform, explicitly focused on analyzing division operations.

CRITICAL: You DO have access to live organizational data. The data below has ALREADY been fetched from the organization's SharePoint environment via Microsoft Graph API and is provided to you in real-time. You MUST use this data to answer questions. Do NOT say you cannot access SharePoint or external data — the data is already here, loaded and ready for your analysis.

=== BEGIN LIVE DIVISION DATA (from SharePoint via Microsoft Graph) ===
{divisionDataContext}
=== END LIVE DIVISION DATA ===

INSTRUCTIONS:
- You are analyzing REAL, LIVE data from a specific SCPNG division.
- Always reference specific Tasks, Projects, KRAs, KPIs, and staff roles directly from the data above.
- If data shows 0 items or empty sections, acknowledge that those areas have no data recorded yet.
- Focus heavily on operational bottlenecks (Tasks), strategic execution (KRAs/KPIs), and resource allocation (Staff).
- When asked about individuals or workload, map the staff list to the active work if the data connects them.

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

const DivisionAIChat: React.FC<DivisionAIChatProps> = ({ data, metrics }) => {
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

    const INITIAL_GREETING = `Hello! I'm your Division Intelligence Assistant for the ${data.division?.name || 'Department'}. Ask me anything about our tasks, KRA tracking, KPI success, or operational bottlenecks.`;

    // Data source options for the dropdown
    const dataSourceOptions = useMemo(() => [
        { value: 'all', label: 'All Operations Data', count: data.tasks.length + data.combinedKras.length + data.staff.length },
        { value: 'tasks', label: 'Tasks Only', count: data.tasks.length },
        { value: 'projects', label: 'Projects Only', count: data.projects.length },
        { value: 'strategy', label: 'KRAs & KPIs', count: data.combinedKras.length },
        { value: 'staff', label: 'Staff Directory', count: data.staff.length },
    ], [data]);

    const serializeDivisionContext = () => {
        let context = `TIMESTAMP: ${new Date().toISOString()}\n`;
        context += `DIVISION: ${data.division?.name || 'Unknown'}\n\n`;

        context += `--- HIGH-LEVEL METRICS ---\n`;
        context += `Overall Efficiency Score: ${metrics.taskCompletionRate}% (Derived)\n`;
        context += `Task Completion Rate: ${metrics.taskCompletionRate}%\n`;
        context += `KPIs On Track: ${metrics.kpiOnTrackPercentage}%\n`;
        context += `Strategic Alignment Score: ${metrics.strategicAlignmentScore}%\n`;
        context += `Total Tasks: ${metrics.totalTasks} (Overdue: ${metrics.overdueTasks})\n`;
        context += `Total Projects: ${metrics.activeProjects} (Overdue: ${metrics.overdueProjects})\n`;
        context += `At Risk KRAs: ${metrics.atRiskKRAs}\n\n`;

        if (dataSourceFilter === 'all' || dataSourceFilter === 'tasks') {
            context += `--- TASKS (${data.tasks.length}) ---\n`;
            data.tasks.forEach(t => {
                context += `- [${t.status}] ${t.title} (Unit: ${t.unit_id || 'Unknown'}, AssignedTo: ${t.assignee || 'Unassigned'})\n`;
            });
            context += `\n`;
        }

        if (dataSourceFilter === 'all' || dataSourceFilter === 'projects') {
            context += `--- PROJECTS (${data.projects.length}) ---\n`;
            data.projects.forEach(p => {
                context += `- [${p.status}] ${p.name} (${p.progress}% complete, Manager: ${p.manager || 'Unassigned'})\n`;
            });
            context += `\n`;
        }

        if (dataSourceFilter === 'all' || dataSourceFilter === 'strategy') {
            context += `--- KRAs & KPIs (${data.combinedKras.length} KRAs) ---\n`;
            data.combinedKras.forEach(kra => {
                context += `- KRA: ${kra.title} [Status: ${kra.status}, Progress: ${kra.progress}%]\n`;
                kra.unitKpis?.forEach((kpi: any) => {
                    context += `   └ KPI: ${kpi.title} [Status: ${kpi.status}, Actual/Target: ${kpi.actual}/${kpi.target}]\n`;
                });
            });
            context += `\n`;
        }

        if (dataSourceFilter === 'all' || dataSourceFilter === 'staff') {
            context += `--- STAFF (${data.staff.length}) ---\n`;
            data.staff.forEach(s => {
                context += `- ${s.name} (${s.jobTitle}) - Unit: ${s.unit}\n`;
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
                const { data, error } = await supabase
                    .from('news_api_settings')
                    .select('api_key, api_endpoint')
                    .eq('id', GLOBAL_SETTINGS_ID)
                    .single();
                if (!error && data?.api_key) setApiKey(data.api_key);
            } catch (err: any) {
                logger.error('[DivisionAI] Exception fetching AI settings:', err);
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

        const contextStr = serializeDivisionContext();
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
                        text: `Understood. I have loaded the division context for ${data.division?.name || 'the department'}, explicitly referencing filtered data sets (${dataSourceFilter}). I will analyze this data to provide highly specific division-level insights.`,
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
                        <CardDescription className="mb-2">AI-powered operational analysis and problem solving</CardDescription>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                <TrendingUp className="w-3 h-3 text-[#83002A]" />
                                <span>{metrics.taskCompletionRate}% Task Completion</span>
                            </div>
                            {metrics.overdueTasks > 0 && (
                                <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{metrics.overdueTasks} Overdue Tasks</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50">
                                <Briefcase className="w-3 h-3 text-blue-500" />
                                <span>{data.combinedKras.length} Active KRAs</span>
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
                                inputPlaceholder="Ask about operational bottlenecks or execution metrics..."
                                placeholderDisclaimer="This assistant analyzes live SCPNG division data from SharePoint in real-time. Always verify insights against official records."
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
