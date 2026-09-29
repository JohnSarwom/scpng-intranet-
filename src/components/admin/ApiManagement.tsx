
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Play, CheckCircle, XCircle, Loader2, ExternalLink, Edit, Save, Activity, Key, Globe, Sparkles } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { useMicrosoftGraph } from "@/hooks/useMicrosoftGraph";
import { GEMINI_API_KEY_SETTING_NAME, invalidateGeminiApiKey } from "@/hooks/useGeminiApiKey";
import {
    AI_TEXT_ASSIST_MODEL_OPTIONS,
    AI_TEXT_ASSIST_SETTINGS_QUERY_KEY,
    DEFAULT_AI_TEXT_ASSIST_SETTINGS,
    parseAiTextAssistSettings,
} from "@/hooks/useAiTextAssistSettings";
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "@/services/graphService";
import { AssetsSharePointService } from "@/services/assetsSharePointService";
import { HRSharePointService } from "@/services/hrSharePointService";
import { PaymentsSharePointService } from "@/services/paymentsSharePointService";
import { UserSharePointService } from "@/services/userSharePointService";
import { fetchStaffMembers } from "@/services/staffService";
import { getCompanies } from "@/services/marketDataSharePointService";
import { supabase, logger, GLOBAL_SETTINGS_ID } from "@/lib/supabaseClient";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { toast } from "sonner";

interface ApiDefinition {
    id: string;
    name: string;
    url: string;
    method: string;
    type: 'Internal' | 'External' | 'SharePoint' | 'Supabase';
    description: string;
    usedIn: string;
}



const INITIAL_APIS: ApiDefinition[] = [
    {
        id: 'graph_assets',
        name: 'Assets Service',
        url: 'https://graph.microsoft.com/v1.0/sites/scpng1.sharepoint.com:/sites/scpngintranet',
        method: 'GET',
        type: 'SharePoint',
        description: 'Manages IT assets in SharePoint list',
        usedIn: 'src/services/assetsSharePointService.ts'
    },
    {
        id: 'graph_hr',
        name: 'HR Service',
        url: 'https://graph.microsoft.com/v1.0/sites/scpng1.sharepoint.com:/sites/scpngintranet',
        method: 'GET',
        type: 'SharePoint',
        description: 'Manages employee profiles and leave requests',
        usedIn: 'src/services/hrSharePointService.ts'
    },
    {
        id: 'graph_payments',
        name: 'Payments Service',
        url: 'https://graph.microsoft.com/v1.0/sites/scpng1.sharepoint.com:/sites/scpngintranet',
        method: 'GET',
        type: 'SharePoint',
        description: 'Manages payment records and approvals',
        usedIn: 'src/services/paymentsSharePointService.ts'
    },
    {
        id: 'graph_users',
        name: 'User Management',
        url: 'https://graph.microsoft.com/v1.0/sites/scpng1.sharepoint.com:/sites/scpngintranet',
        method: 'GET',
        type: 'SharePoint',
        description: 'Manages user roles and permissions',
        usedIn: 'src/services/userSharePointService.ts'
    },
    {
        id: 'graph_market',
        name: 'Market Data Service',
        url: 'https://graph.microsoft.com/v1.0/sites/scpng1.sharepoint.com:/sites/scpngintranet',
        method: 'GET',
        type: 'SharePoint',
        description: 'Manages market companies and price history',
        usedIn: 'src/services/marketDataSharePointService.ts'
    },
    {
        id: 'supabase_staff',
        name: 'Staff Directory',
        url: 'Supabase Database',
        method: 'SELECT',
        type: 'Supabase',
        description: 'Fetches staff members from Supabase',
        usedIn: 'src/services/staffService.ts'
    },
];

const ApiManagement = () => {
    const { instance } = useMsal();
    const { user } = useSupabaseAuth();

    // Internal/System APIs
    const [apis, setApis] = useState<ApiDefinition[]>(INITIAL_APIS);
    const [statuses, setStatuses] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
    const [messages, setMessages] = useState<Record<string, string>>({});

    // Global Config State (Persisted in Supabase)
    const [apiKey, setApiKey] = useState('');
    const [tickerUrl, setTickerUrl] = useState('https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'); // Default
    const [prompts, setPrompts] = useState<any>({});
    const [textImproverEnabled, setTextImproverEnabled] = useState(DEFAULT_AI_TEXT_ASSIST_SETTINGS.enabled);
    const [textImproverModel, setTextImproverModel] = useState(DEFAULT_AI_TEXT_ASSIST_SETTINGS.model);
    const queryClient = useQueryClient();
    const { getAppSetting, setAppSetting, isAuthenticated: isGraphReady } = useMicrosoftGraph();
    // The Gemini key lives in the SharePoint InternalAppSettings list, not Supabase.
    const [savedApiKey, setSavedApiKey] = useState('');
    const [isKeyLoading, setIsKeyLoading] = useState(true);

    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTestingGenAI, setIsTestingGenAI] = useState(false);

    // Editing State for System APIs
    const [editingApi, setEditingApi] = useState<ApiDefinition | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // Initial Load
    useEffect(() => {
        const loadSettings = async () => {
            setIsConfigLoading(true);
            try {
                const { data, error } = await supabase
                    .from('news_api_settings')
                    .select('*')
                    .eq('id', GLOBAL_SETTINGS_ID)
                    .single();

                if (data) {
                    setPrompts(data.prompts || {});
                    const assist = parseAiTextAssistSettings(data.prompts);
                    setTextImproverEnabled(assist.enabled);
                    setTextImproverModel(assist.model);
                    if (data.prompts?.system_ticker_url) {
                        setTickerUrl(data.prompts.system_ticker_url);
                    }
                }
            } catch (error) {
                console.error("Failed to load settings", error);
            } finally {
                setIsConfigLoading(false);
            }
        };
        loadSettings();
    }, []);

    // Load the Gemini key from SharePoint once Graph auth is ready
    useEffect(() => {
        if (!isGraphReady) return;
        let cancelled = false;
        const loadKey = async () => {
            setIsKeyLoading(true);
            const value = (await getAppSetting(GEMINI_API_KEY_SETTING_NAME)) || '';
            if (cancelled) return;
            setApiKey(value);
            setSavedApiKey(value);
            setIsKeyLoading(false);
        };
        loadKey();
        return () => { cancelled = true; };
    }, [isGraphReady, getAppSetting]);

    const handleSaveConfig = async () => {
        setIsSaving(true);
        // Prepare prompts object with ticker url integrated
        const updatedPrompts = {
            ...prompts,
            system_ticker_url: tickerUrl,
            text_improver_enabled: textImproverEnabled,
            text_improver_model: textImproverModel,
        };

        const settingsData = {
            id: GLOBAL_SETTINGS_ID,
            prompts: updatedPrompts,
            updated_at: new Date().toISOString(),
            last_updated_by: user?.id
        };

        try {
            // Gemini key goes to SharePoint (InternalAppSettings) so every AI feature picks it up.
            if (apiKey.trim() !== savedApiKey) {
                const result = await setAppSetting(GEMINI_API_KEY_SETTING_NAME, apiKey.trim());
                if (!result.success) {
                    console.error('[ApiManagement] Gemini key save failed:', result.error);
                    throw new Error(`Could not save the Gemini key to SharePoint. ${result.error || 'Check you have edit access to the InternalAppSettings list.'}`);
                }
                setSavedApiKey(apiKey.trim());
                invalidateGeminiApiKey(queryClient);
            }

            const { error } = await supabase.from('news_api_settings').upsert(settingsData, { onConflict: 'id' });
            if (error) throw error;
            toast.success("Global configurations saved successfully");
            setPrompts(updatedPrompts);
            // Improve-with-AI buttons read these settings through React Query; refresh them now.
            queryClient.invalidateQueries({ queryKey: AI_TEXT_ASSIST_SETTINGS_QUERY_KEY });
        } catch (error: any) {
            toast.error("Failed to save", { description: error.message, duration: 20000 });
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Tests the key against the models the intranet actually uses:
     * the Improve-with-AI model chosen above and gemini-2.5-flash (chat assistants).
     * Shows Google's own error message so a bad key, a retired model or a
     * restricted key can be told apart.
     */
    const handleTestGenAI = async () => {
        setIsTestingGenAI(true);
        const key = apiKey.trim();
        if (!key) {
            toast.error("Enter an API key first.");
            setIsTestingGenAI(false);
            return;
        }

        const modelsToTest = Array.from(new Set([textImproverModel, 'gemini-2.5-flash']));
        const testBody = {
            contents: [{ parts: [{ text: "Respond with exactly: Connection OK" }] }],
            generationConfig: { maxOutputTokens: 16, temperature: 0 },
        };

        const results: string[] = [];
        let allOk = true;

        for (const model of modelsToTest) {
            try {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(testBody),
                    }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    allOk = false;
                    const reason = data?.error?.message || res.statusText || 'Unknown error';
                    results.push(`${model}: HTTP ${res.status} - ${reason}`);
                    continue;
                }
                const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? '').join('').trim();
                if (text) {
                    results.push(`${model}: OK ("${text}")`);
                } else if (data?.promptFeedback?.blockReason) {
                    allOk = false;
                    results.push(`${model}: blocked (${data.promptFeedback.blockReason})`);
                } else {
                    allOk = false;
                    results.push(`${model}: unexpected response shape`);
                }
            } catch (error: any) {
                allOk = false;
                results.push(`${model}: ${error?.message || 'network error'}`);
            }
        }

        if (allOk) {
            toast.success("Gemini key works", { description: results.join('\n'), duration: 8000 });
        } else {
            toast.error("Gemini test failed", { description: results.join('\n'), duration: 15000 });
        }
        setIsTestingGenAI(false);
    };

    // System Status Helpers
    const updateStatus = (id: string, status: 'idle' | 'loading' | 'success' | 'error', message?: string) => {
        setStatuses(prev => ({ ...prev, [id]: status }));
        if (message) {
            setMessages(prev => ({ ...prev, [id]: message }));
        }
    };

    const handleEditClick = (api: ApiDefinition) => {
        setEditingApi({ ...api });
        setIsEditDialogOpen(true);
    };

    const handleSaveEdit = () => {
        if (editingApi) {
            setApis(prev => prev.map(api => api.id === editingApi.id ? editingApi : api));
            setIsEditDialogOpen(false);
            setEditingApi(null);
            toast.success("API definition updated (Local only)");
        }
    };

    const testApi = async (api: ApiDefinition) => {
        updateStatus(api.id, 'loading');
        try {
            switch (api.id) {
                // ... same test logic as before ...
                case 'graph_assets': {
                    const client = await getGraphClient(instance);
                    if (!client) throw new Error("Failed to initialize Graph Client");
                    const service = new AssetsSharePointService(client);
                    await service.initialize();
                    updateStatus(api.id, 'success', 'Connected to Assets');
                    break;
                }
                case 'graph_hr': {
                    const client = await getGraphClient(instance);
                    const service = new HRSharePointService(client!);
                    await service.initialize();
                    updateStatus(api.id, 'success', 'Connected to HR');
                    break;
                }
                case 'graph_payments': {
                    const client = await getGraphClient(instance);
                    const service = new PaymentsSharePointService(client!);
                    await service.initialize();
                    updateStatus(api.id, 'success', 'Connected to Payments');
                    break;
                }
                case 'graph_users': {
                    const client = await getGraphClient(instance);
                    const service = new UserSharePointService(client!);
                    await service.initialize();
                    updateStatus(api.id, 'success', 'Connected to User Roles');
                    break;
                }
                case 'graph_market': {
                    const data = await getCompanies();
                    if (data) updateStatus(api.id, 'success', `Fetched ${data.length} companies`);
                    break;
                }
                case 'supabase_staff': {
                    const data = await fetchStaffMembers();
                    if (data) updateStatus(api.id, 'success', `Fetched ${data.length} staff`);
                    break;
                }
                default:
                    // Basic fetch for others
                    if (api.url.startsWith('http')) {
                        await fetch(api.url, { mode: 'no-cors' });
                        updateStatus(api.id, 'success', 'Endpoint Reachable');
                    } else {
                        updateStatus(api.id, 'error', 'No test defined');
                    }
            }
        } catch (error: any) {
            updateStatus(api.id, 'error', error.message || 'Failed');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">API & Integrations</h2>
                    <p className="text-muted-foreground">Manage external API keys, integration links, and monitor system health.</p>
                </div>
                <Button onClick={handleSaveConfig} disabled={isSaving || isConfigLoading}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Configurations
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* AI Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            Generative AI Configuration
                        </CardTitle>
                        <CardDescription>The Gemini key used by the AI assistants and the Improve with AI button. Models are fixed in code (gemini-2.5-flash for chat) and chosen below for text improvement.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>API Provider Info</Label>
                            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border text-xs font-mono text-muted-foreground">
                                Current Provider: Google Gemini
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="api_key">API Key</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="api_key"
                                    type="password"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder={isKeyLoading ? "Loading from SharePoint..." : "Enter API Key"}
                                    disabled={isKeyLoading}
                                />
                                <Button variant="outline" onClick={handleTestGenAI} disabled={isTestingGenAI || isKeyLoading} title="Test this key against the models the intranet uses">
                                    {isTestingGenAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Stored in the SharePoint list <span className="font-mono">InternalAppSettings</span> (item <span className="font-mono">GeminiAPIKey</span>). Every AI feature in the intranet reads it from there; changes reach users within a few minutes.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Improve with AI (text assist on form fields) */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Improve with AI
                        </CardTitle>
                        <CardDescription>
                            The sparkle button on task, ticket, KPI/KRA, project, risk and form fields that fixes grammar or polishes wording. Uses the Gemini key above.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <div className="space-y-0.5">
                                <Label htmlFor="text_improver_enabled">Enable across the intranet</Label>
                                <p className="text-xs text-muted-foreground">
                                    When off, the button is hidden on every field. Field text is sent to Google when a user clicks it.
                                </p>
                            </div>
                            <Switch
                                id="text_improver_enabled"
                                checked={textImproverEnabled}
                                onCheckedChange={setTextImproverEnabled}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="text_improver_model">Model</Label>
                            <Select value={textImproverModel} onValueChange={setTextImproverModel}>
                                <SelectTrigger id="text_improver_model">
                                    <SelectValue placeholder="Select model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {AI_TEXT_ASSIST_MODEL_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                    {!AI_TEXT_ASSIST_MODEL_OPTIONS.some(opt => opt.value === textImproverModel) && (
                                        <SelectItem value={textImproverModel}>{textImproverModel}</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Flash-Lite is enough for grammar and titles and uses less quota. Changes apply after Save Configuration.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* External Links */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-primary" />
                            External Widgets & Links
                        </CardTitle>
                        <CardDescription>Manage URLs for external integrations like the Ticker Tape.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="ticker_url">TradingView Ticker Embed URL</Label>
                            <Textarea
                                id="ticker_url"
                                value={tickerUrl}
                                onChange={e => setTickerUrl(e.target.value)}
                                placeholder="https://s3.tradingview.com/..."
                                className="min-h-[80px] font-mono text-xs"
                            />
                            <p className="text-xs text-muted-foreground">
                                Verify this URL matches the widget requirements. Changes reflect on the Home/Market pages.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* System Health Monitor */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-green-600" />
                        System Health Monitor
                    </CardTitle>
                    <CardDescription>
                        Monitor connection statuses for SharePoint lists and internal services.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Service Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="hidden md:table-cell">Endpoint</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {apis.map((api) => (
                                <TableRow key={api.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{api.name}</span>
                                            <span className="text-xs text-muted-foreground md:hidden">{api.type}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{api.type}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <span className="text-xs text-muted-foreground truncate max-w-[200px] block" title={api.url}>
                                            {api.url}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            {statuses[api.id] === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                            {statuses[api.id] === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                            {statuses[api.id] === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                                            {(!statuses[api.id] || statuses[api.id] === 'idle') && <span className="text-muted-foreground">-</span>}
                                            {messages[api.id] && status[api.id] === 'error' && (
                                                <span className="text-xs text-red-500 truncate max-w-[100px]" title={messages[api.id]}>
                                                    {messages[api.id]}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => testApi(api)} disabled={statuses[api.id] === 'loading'}>
                                            Test
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default ApiManagement;
