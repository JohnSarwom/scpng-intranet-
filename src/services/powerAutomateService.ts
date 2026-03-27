/**
 * Power Automate Service
 *
 * Creates and manages flows via the Flow Management API.
 * Uses the automation@scpng.gov.pg account to own all flows.
 *
 * API Base: https://api.flow.microsoft.com
 * Environment: Default-b173aac7-6781-4d49-a037-d874bd4a09ab
 */

import { IPublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

// ===== Config =====

const FLOW_CONFIG = {
    ENVIRONMENT_ID: 'Default-b173aac7-6781-4d49-a037-d874bd4a09ab',
    API_BASE: 'https://api.flow.microsoft.com',
    POWERAPPS_API_BASE: 'https://api.powerapps.com',
    SHAREPOINT_SITE: 'https://scpng1.sharepoint.com/sites/scpngintranet',
    FLOW_SCOPES: ['https://service.flow.microsoft.com//.default'],
    POWERAPPS_SCOPES: ['https://service.powerapps.com//.default'],
    REPORT_FLOW_NAME: 'SCPNG Intranet — Scheduled Report Dispatcher',
};

// ===== Types =====

export interface FlowListItem {
    name: string;           // Flow GUID
    id: string;             // Full resource path
    displayName: string;
    state: string;          // Started, Stopped, Suspended
    createdTime: string;
    lastModifiedTime: string;
}

export interface FlowConnection {
    name: string;
    id: string;
    displayName: string;
    apiId: string;
    status: string;
}

export interface DeployResult {
    success: boolean;
    flowId?: string;
    flowName?: string;
    message: string;
    error?: any;
}

// ===== Service =====

export class PowerAutomateService {
    private msalInstance: IPublicClientApplication;

    constructor(msalInstance: IPublicClientApplication) {
        this.msalInstance = msalInstance;
    }

    // --- Token Acquisition ---

    private async getFlowToken(): Promise<string> {
        const account = this.msalInstance.getActiveAccount()
            || this.msalInstance.getAllAccounts()[0];

        if (!account) throw new Error('No authenticated account found');

        try {
            const response = await this.msalInstance.acquireTokenSilent({
                scopes: FLOW_CONFIG.FLOW_SCOPES,
                account,
            });
            return response.accessToken;
        } catch (e) {
            if (e instanceof InteractionRequiredAuthError) {
                const response = await this.msalInstance.acquireTokenPopup({
                    scopes: FLOW_CONFIG.FLOW_SCOPES,
                });
                return response.accessToken;
            }
            throw e;
        }
    }

    private async getPowerAppsToken(): Promise<string> {
        const account = this.msalInstance.getActiveAccount()
            || this.msalInstance.getAllAccounts()[0];

        if (!account) throw new Error('No authenticated account found');

        try {
            const response = await this.msalInstance.acquireTokenSilent({
                scopes: FLOW_CONFIG.POWERAPPS_SCOPES,
                account,
            });
            return response.accessToken;
        } catch (e) {
            if (e instanceof InteractionRequiredAuthError) {
                const response = await this.msalInstance.acquireTokenPopup({
                    scopes: FLOW_CONFIG.POWERAPPS_SCOPES,
                });
                return response.accessToken;
            }
            throw e;
        }
    }

    private async powerAppsFetch(path: string): Promise<any> {
        const token = await this.getPowerAppsToken();
        const url = `${FLOW_CONFIG.POWERAPPS_API_BASE}${path}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[PowerApps] ${response.status} ${response.statusText}:`, errorBody);
            throw new Error(`PowerApps API error ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    private async flowFetch(path: string, options: RequestInit = {}): Promise<any> {
        const token = await this.getFlowToken();
        const url = `${FLOW_CONFIG.API_BASE}${path}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[PowerAutomate] ${response.status} ${response.statusText}:`, errorBody);
            throw new Error(`Flow API error ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    // --- List Flows ---

    async listFlows(): Promise<FlowListItem[]> {
        const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
        const data = await this.flowFetch(`${envPath}/flows?api-version=2016-11-01`);

        return (data.value || []).map((f: any) => ({
            name: f.name,
            id: f.id,
            displayName: f.properties?.displayName || 'Unnamed',
            state: f.properties?.state || 'Unknown',
            createdTime: f.properties?.createdTime,
            lastModifiedTime: f.properties?.lastModifiedTime,
        }));
    }

    // --- Get Flow Definition (for debugging) ---

    async getFlowDefinition(flowId: string): Promise<any> {
        const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
        const data = await this.flowFetch(`${envPath}/flows/${flowId}?api-version=2016-11-01`);
        return data;
    }

    // --- List Connections ---

    async listConnections(): Promise<FlowConnection[]> {
        const data = await this.powerAppsFetch(
            `/providers/Microsoft.PowerApps/connections?api-version=2020-06-01&$filter=environment eq '${FLOW_CONFIG.ENVIRONMENT_ID}'`
        );

        return (data.value || []).map((c: any) => ({
            name: c.name,
            id: c.id,
            displayName: c.properties?.displayName || c.properties?.apiId || 'Unknown',
            apiId: c.properties?.apiId || '',
            status: c.properties?.statuses?.[0]?.status || 'Unknown',
        }));
    }

    // --- Find required connections ---

    private async findConnections(): Promise<{ sharepoint: string; office365: string }> {
        const connections = await this.listConnections();

        const spConn = connections.find(c =>
            c.apiId.includes('shared_sharepointonline') && c.status === 'Connected'
        );
        const mailConn = connections.find(c =>
            c.apiId.includes('shared_office365') && c.status === 'Connected'
        );

        if (!spConn) {
            throw new Error(
                'No SharePoint connection found for automation@scpng.gov.pg. ' +
                'Please create one in Power Automate first by making any flow with a SharePoint action.'
            );
        }
        if (!mailConn) {
            throw new Error(
                'No Office 365 Outlook connection found for automation@scpng.gov.pg. ' +
                'Please create one in Power Automate first by making any flow with a Send Email action.'
            );
        }

        return {
            sharepoint: spConn.name,
            office365: mailConn.name,
        };
    }

    // --- Delete Flow ---

    async deleteFlow(flowName: string): Promise<void> {
        const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
        await this.flowFetch(`${envPath}/flows/${flowName}?api-version=2016-11-01`, {
            method: 'DELETE',
        });
    }

    // --- Check if report flow already exists ---

    async findExistingReportFlow(): Promise<FlowListItem | null> {
        const flows = await this.listFlows();
        return flows.find(f => f.displayName === FLOW_CONFIG.REPORT_FLOW_NAME) || null;
    }

    // --- Deploy the Master Report Scheduler Flow ---

    async deployReportSchedulerFlow(): Promise<DeployResult> {
        try {
            // 1. Check for existing flow
            const existing = await this.findExistingReportFlow();
            if (existing) {
                return {
                    success: true,
                    flowId: existing.name,
                    flowName: existing.displayName,
                    message: `Flow already exists (${existing.state}). Delete it first to redeploy.`,
                };
            }

            // 2. Find connections
            const connections = await this.findConnections();

            // 3. Build flow definition
            const flowDefinition = this.buildReportSchedulerDefinition(connections);

            // Debug: log the full payload
            console.log('[PowerAutomate] Deploy payload connectionReferences:', JSON.stringify(flowDefinition.properties.connectionReferences, null, 2));
            console.log('[PowerAutomate] Deploy payload first action host:', JSON.stringify(flowDefinition.properties.definition.actions['Get_Active_Schedules']?.inputs?.host, null, 2));
            console.log('[PowerAutomate] Full deploy payload:', JSON.stringify(flowDefinition, null, 2));

            // 4. Create flow
            const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
            const result = await this.flowFetch(`${envPath}/flows?api-version=2016-11-01`, {
                method: 'POST',
                body: JSON.stringify(flowDefinition),
            });

            return {
                success: true,
                flowId: result.name,
                flowName: FLOW_CONFIG.REPORT_FLOW_NAME,
                message: 'Report Scheduler flow deployed successfully!',
            };
        } catch (e: any) {
            return {
                success: false,
                message: e.message || 'Failed to deploy flow',
                error: e,
            };
        }
    }

    // --- Build Flow Definition ---

    private buildReportSchedulerDefinition(connections: { sharepoint: string; office365: string }) {
        const siteUrl = FLOW_CONFIG.SHAREPOINT_SITE;

        // Authentication block required by OpenApiConnection actions
        const authBlock = {
            value: "@json(decodeBase64(triggerOutputs().headers['X-MS-APIM-Tokens']))['$ConnectionKey']",
            type: "Raw"
        };

        // Helper: build a SharePoint "Get Items" action
        const spGetItems = (table: string, filter: string, runAfter: Record<string, string[]> = {}) => {
            const params: Record<string, any> = {
                dataset: siteUrl,
                table,
                "$top": 500
            };
            if (filter) params["$filter"] = filter;
            return {
                type: "OpenApiConnection",
                runAfter,
                inputs: {
                    host: {
                        apiId: `/providers/Microsoft.PowerApps/apis/shared_sharepointonline`,
                        connectionName: "shared_sharepointonline",
                        operationId: "GetItems"
                    },
                    parameters: params,
                    authentication: authBlock,
                }
            };
        };

        return {
            properties: {
                displayName: FLOW_CONFIG.REPORT_FLOW_NAME,
                state: 'Started',
                definition: {
                    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
                    contentVersion: "1.0.0.0",
                    parameters: {
                        "$connections": {
                            defaultValue: {},
                            type: "Object"
                        },
                        "$authentication": {
                            defaultValue: {},
                            type: "SecureObject"
                        }
                    },
                    triggers: {
                        "Scheduled_Check": {
                            type: "Recurrence",
                            recurrence: {
                                frequency: "Day",
                                interval: 1,
                                schedule: {
                                    hours: ["6", "7", "8", "9", "10", "12", "14", "16", "17"],
                                    minutes: ["0"]
                                },
                                timeZone: "Pacific/Port_Moresby"
                            }
                        }
                    },
                    actions: {
                        // Step 1: Get all active schedules
                        "Get_Active_Schedules": spGetItems("Report_Schedules", "IsActive eq 'true'"),

                        // Step 1b: Fetch Gemini API key from InternalAppSettings (parallel)
                        "Get_Gemini_API_Key": spGetItems("InternalAppSettings", "Title eq 'GeminiAPIKey'"),

                        // Step 2: Filter for schedules that are due (NextSendAt <= now)
                        "Filter_Due_Schedules": {
                            type: "Query",
                            runAfter: { "Get_Active_Schedules": ["Succeeded"] },
                            inputs: {
                                from: "@body('Get_Active_Schedules')?['value']",
                                where: "@lessOrEquals(item()?['NextSendAt'], utcNow())"
                            }
                        },

                        // Step 3: Process each due schedule
                        "Process_Each_User": {
                            type: "Foreach",
                            runAfter: {
                                "Filter_Due_Schedules": ["Succeeded"],
                                "Get_Gemini_API_Key": ["Succeeded", "Failed"]
                            },
                            foreach: "@body('Filter_Due_Schedules')",
                            actions: {
                                // --- Data Retrieval ---
                                "Get_Tasks": spGetItems("Operations_Tasks", "Department eq '@{items('Process_Each_User')?['Unit']}'"),
                                "Get_KRAs": spGetItems("Performance_KRAs", "Unit eq '@{items('Process_Each_User')?['Unit']}'"),
                                "Get_KPIs": spGetItems("Performance_KPIs", ""),
                                "Get_Objectives": spGetItems("Unit_Objectives", "Unit eq '@{items('Process_Each_User')?['Unit']}'"),

                                // --- Custom Date Range Computation ---
                                "Compute_Custom_Start": {
                                    type: "Compose",
                                    runAfter: {},
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), items('Process_Each_User')?['CustomStartDate'], formatDateTime(addDays(utcNow(), mul(-1, int(if(empty(items('Process_Each_User')?['RollingWindowDays']), '30', items('Process_Each_User')?['RollingWindowDays'])))), 'yyyy-MM-ddTHH:mm:ssZ')), '')"
                                },
                                "Compute_Custom_End": {
                                    type: "Compose",
                                    runAfter: {},
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), items('Process_Each_User')?['CustomEndDate'], formatDateTime(utcNow(), 'yyyy-MM-ddTHH:mm:ssZ')), '')"
                                },

                                // --- Custom Date Range Filters (only used by custom template) ---
                                "Filter_Tasks_InDateRange": {
                                    type: "Query",
                                    runAfter: {
                                        "Get_Tasks": ["Succeeded"],
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: {
                                        from: "@body('Get_Tasks')?['value']",
                                        where: "@or(and(not(empty(item()?['Modified'])), greaterOrEquals(item()?['Modified'], outputs('Compute_Custom_Start')), lessOrEquals(item()?['Modified'], outputs('Compute_Custom_End'))), and(not(empty(item()?['DueDate'])), greaterOrEquals(item()?['DueDate'], outputs('Compute_Custom_Start')), lessOrEquals(item()?['DueDate'], outputs('Compute_Custom_End'))))"
                                    }
                                },
                                "Filter_KRAs_InDateRange": {
                                    type: "Query",
                                    runAfter: {
                                        "Get_KRAs": ["Succeeded"],
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: {
                                        from: "@body('Get_KRAs')?['value']",
                                        where: "@and(not(empty(item()?['Modified'])), greaterOrEquals(item()?['Modified'], outputs('Compute_Custom_Start')), lessOrEquals(item()?['Modified'], outputs('Compute_Custom_End')))"
                                    }
                                },
                                "Filter_KPIs_InDateRange": {
                                    type: "Query",
                                    runAfter: {
                                        "Get_KPIs": ["Succeeded"],
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: {
                                        from: "@body('Get_KPIs')?['value']",
                                        where: "@and(not(empty(item()?['Modified'])), greaterOrEquals(item()?['Modified'], outputs('Compute_Custom_Start')), lessOrEquals(item()?['Modified'], outputs('Compute_Custom_End')))"
                                    }
                                },

                                // --- Custom Status Filters (operate on date-filtered data) ---
                                "Filter_Custom_Completed_Tasks": {
                                    type: "Query",
                                    runAfter: { "Filter_Tasks_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_Tasks_InDateRange')",
                                        where: "@equals(item()?['Status'], 'Done')"
                                    }
                                },
                                "Filter_Custom_InProgress_Tasks": {
                                    type: "Query",
                                    runAfter: { "Filter_Tasks_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_Tasks_InDateRange')",
                                        where: "@equals(item()?['Status'], 'In Progress')"
                                    }
                                },
                                "Filter_Custom_Todo_Tasks": {
                                    type: "Query",
                                    runAfter: { "Filter_Tasks_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_Tasks_InDateRange')",
                                        where: "@equals(item()?['Status'], 'Todo')"
                                    }
                                },
                                "Filter_Custom_Review_Tasks": {
                                    type: "Query",
                                    runAfter: { "Filter_Tasks_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_Tasks_InDateRange')",
                                        where: "@equals(item()?['Status'], 'Review')"
                                    }
                                },
                                "Filter_Custom_Active_KRAs": {
                                    type: "Query",
                                    runAfter: { "Filter_KRAs_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_KRAs_InDateRange')",
                                        where: "@or(equals(item()?['Status'], 'In Progress'), equals(item()?['Status'], 'Open'))"
                                    }
                                },
                                "Filter_Custom_Completed_KRAs": {
                                    type: "Query",
                                    runAfter: { "Filter_KRAs_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_KRAs_InDateRange')",
                                        where: "@equals(item()?['Status'], 'Closed')"
                                    }
                                },
                                "Filter_Custom_OnTrack_KPIs": {
                                    type: "Query",
                                    runAfter: { "Filter_KPIs_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_KPIs_InDateRange')",
                                        where: "@or(equals(item()?['Status'], 'On Track'), equals(item()?['Status'], 'Completed'))"
                                    }
                                },
                                "Filter_Custom_AtRisk_KPIs": {
                                    type: "Query",
                                    runAfter: { "Filter_KPIs_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_KPIs_InDateRange')",
                                        where: "@equals(item()?['Status'], 'At Risk')"
                                    }
                                },
                                "Filter_Custom_Behind_KPIs": {
                                    type: "Query",
                                    runAfter: { "Filter_KPIs_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Filter_KPIs_InDateRange')",
                                        where: "@equals(item()?['Status'], 'Behind')"
                                    }
                                },

                                // --- Custom Metrics Computation ---
                                "Compute_Custom_Task_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Filter_Tasks_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        totalTasks: "@length(body('Filter_Tasks_InDateRange'))"
                                    }
                                },
                                "Compute_Custom_KRA_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Filter_KRAs_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        totalKRAs: "@length(body('Filter_KRAs_InDateRange'))"
                                    }
                                },
                                "Compute_Custom_KPI_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Filter_KPIs_InDateRange": ["Succeeded"] },
                                    inputs: {
                                        totalKPIs: "@length(body('Filter_KPIs_InDateRange'))"
                                    }
                                },

                                // --- Task Metrics ---
                                // Schema: Status choices = "Todo", "In Progress", "Review", "Done"
                                "Compute_Task_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Get_Tasks": ["Succeeded"] },
                                    inputs: {
                                        totalTasks: "@length(body('Get_Tasks')?['value'])"
                                    }
                                },
                                "Filter_Completed_Tasks": {
                                    type: "Query",
                                    runAfter: { "Get_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_Tasks')?['value']",
                                        where: "@equals(item()?['Status'], 'Done')"
                                    }
                                },
                                "Filter_InProgress_Tasks": {
                                    type: "Query",
                                    runAfter: { "Get_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_Tasks')?['value']",
                                        where: "@equals(item()?['Status'], 'In Progress')"
                                    }
                                },
                                "Filter_Todo_Tasks": {
                                    type: "Query",
                                    runAfter: { "Get_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_Tasks')?['value']",
                                        where: "@equals(item()?['Status'], 'Todo')"
                                    }
                                },
                                "Filter_Review_Tasks": {
                                    type: "Query",
                                    runAfter: { "Get_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_Tasks')?['value']",
                                        where: "@equals(item()?['Status'], 'Review')"
                                    }
                                },

                                // --- KRA Metrics ---
                                // Schema: Status is text = "Open", "In Progress", "Closed"
                                "Compute_KRA_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Get_KRAs": ["Succeeded"] },
                                    inputs: {
                                        totalKRAs: "@length(body('Get_KRAs')?['value'])"
                                    }
                                },
                                "Filter_Active_KRAs": {
                                    type: "Query",
                                    runAfter: { "Get_KRAs": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_KRAs')?['value']",
                                        where: "@or(equals(item()?['Status'], 'In Progress'), equals(item()?['Status'], 'Open'))"
                                    }
                                },
                                "Filter_Completed_KRAs": {
                                    type: "Query",
                                    runAfter: { "Get_KRAs": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_KRAs')?['value']",
                                        where: "@equals(item()?['Status'], 'Closed')"
                                    }
                                },

                                // --- KPI Metrics ---
                                // Schema: Status choices = "On Track", "At Risk", "Behind", "Completed"
                                "Compute_KPI_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Get_KPIs": ["Succeeded"] },
                                    inputs: {
                                        totalKPIs: "@length(body('Get_KPIs')?['value'])"
                                    }
                                },
                                "Filter_OnTrack_KPIs": {
                                    type: "Query",
                                    runAfter: { "Get_KPIs": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_KPIs')?['value']",
                                        where: "@or(equals(item()?['Status'], 'On Track'), equals(item()?['Status'], 'Completed'))"
                                    }
                                },
                                "Filter_AtRisk_KPIs": {
                                    type: "Query",
                                    runAfter: { "Get_KPIs": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_KPIs')?['value']",
                                        where: "@equals(item()?['Status'], 'At Risk')"
                                    }
                                },
                                "Filter_Behind_KPIs": {
                                    type: "Query",
                                    runAfter: { "Get_KPIs": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_KPIs')?['value']",
                                        where: "@equals(item()?['Status'], 'Behind')"
                                    }
                                },

                                // --- Task List for Daily Email ---
                                "Select_Task_HTML": {
                                    type: "Select",
                                    runAfter: { "Get_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@body('Get_Tasks')?['value']",
                                        select: "@concat('<tr><td style=''padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;''>', item()?['Title'], '</td><td align=''right'' style=''padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;color:#800020;''>', item()?['Status'], '</td></tr>')"
                                    }
                                },
                                "Build_Task_List_HTML": {
                                    type: "Compose",
                                    runAfter: { "Select_Task_HTML": ["Succeeded"] },
                                    inputs: "@join(body('Select_Task_HTML'), '')"
                                },

                                // --- AI Analysis ---

                                // Standard AI prompt (for non-daily reports)
                                "Build_Standard_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"]
                                    },
                                    inputs: this.buildStandardAIPromptExpression()
                                },

                                // Daily AI prompt (task-aware, daily-focused)
                                "Build_Daily_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildDailyAIPromptExpression()
                                },

                                // Weekly AI prompt (week-in-review, achievement-focused)
                                "Build_Weekly_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildWeeklyAIPromptExpression()
                                },

                                // Monthly AI prompt (strategic, trend-focused)
                                "Build_Monthly_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildMonthlyAIPromptExpression()
                                },

                                // Quarterly AI prompt (executive, impact-focused)
                                "Build_Quarterly_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildQuarterlyAIPromptExpression()
                                },

                                // Half-Yearly AI prompt (trajectory, sustained impact)
                                "Build_HalfYearly_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildHalfYearlyAIPromptExpression()
                                },
                                "Build_Yearly_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildYearlyAIPromptExpression()
                                },
                                "Build_Custom_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Compute_Custom_Task_Metrics": ["Succeeded"],
                                        "Filter_Custom_Completed_Tasks": ["Succeeded"],
                                        "Filter_Custom_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Custom_Todo_Tasks": ["Succeeded"],
                                        "Filter_Custom_Review_Tasks": ["Succeeded"],
                                        "Compute_Custom_KRA_Metrics": ["Succeeded"],
                                        "Filter_Custom_Active_KRAs": ["Succeeded"],
                                        "Filter_Custom_Completed_KRAs": ["Succeeded"],
                                        "Compute_Custom_KPI_Metrics": ["Succeeded"],
                                        "Filter_Custom_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_Custom_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Custom_Behind_KPIs": ["Succeeded"],
                                        "Get_Objectives": ["Succeeded"],
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: this.buildCustomAIPromptExpression()
                                },

                                // Selector: pick the right prompt based on TimePeriod
                                "Build_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Build_Standard_AI_Prompt": ["Succeeded"],
                                        "Build_Daily_AI_Prompt": ["Succeeded"],
                                        "Build_Weekly_AI_Prompt": ["Succeeded"],
                                        "Build_Monthly_AI_Prompt": ["Succeeded"],
                                        "Build_Quarterly_AI_Prompt": ["Succeeded"],
                                        "Build_HalfYearly_AI_Prompt": ["Succeeded"],
                                        "Build_Yearly_AI_Prompt": ["Succeeded"],
                                        "Build_Custom_AI_Prompt": ["Succeeded"]
                                    },
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'daily'), outputs('Build_Daily_AI_Prompt'), if(equals(items('Process_Each_User')?['TimePeriod'], 'weekly'), outputs('Build_Weekly_AI_Prompt'), if(equals(items('Process_Each_User')?['TimePeriod'], 'monthly'), outputs('Build_Monthly_AI_Prompt'), if(equals(items('Process_Each_User')?['TimePeriod'], 'quarterly'), outputs('Build_Quarterly_AI_Prompt'), if(equals(items('Process_Each_User')?['TimePeriod'], 'half-yearly'), outputs('Build_HalfYearly_AI_Prompt'), if(equals(items('Process_Each_User')?['TimePeriod'], 'yearly'), outputs('Build_Yearly_AI_Prompt'), if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), outputs('Build_Custom_AI_Prompt'), outputs('Build_Standard_AI_Prompt'))))))))"
                                },

                                // Call Gemini API with the metrics prompt
                                "Call_Gemini_API": {
                                    type: "Http",
                                    runAfter: { "Build_AI_Prompt": ["Succeeded"] },
                                    inputs: {
                                        method: "POST",
                                        uri: "@{concat('https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=', if(greater(length(body('Get_Gemini_API_Key')?['value']), 0), body('Get_Gemini_API_Key')?['value'][0]?['Value'], ''))}",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: {
                                            contents: [
                                                {
                                                    parts: [
                                                        {
                                                            text: "@outputs('Build_AI_Prompt')"
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                },

                                // Extract AI response text with graceful fallback
                                "Extract_AI_Response": {
                                    type: "Compose",
                                    runAfter: { "Call_Gemini_API": ["Succeeded", "Failed", "TimedOut"] },
                                    inputs: "@if(equals(outputs('Call_Gemini_API')['statusCode'], 200), body('Call_Gemini_API')?['candidates']?[0]?['content']?['parts']?[0]?['text'], '')"
                                },

                                // --- Build HTML email body ---
                                "Build_Standard_Email": {
                                    type: "Compose",
                                    runAfter: { "Extract_AI_Response": ["Succeeded"] },
                                    inputs: this.buildStandardEmailTemplate()
                                },
                                "Build_Daily_Email": {
                                    type: "Compose",
                                    runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildDailyEmailTemplate()
                                },
                                "Build_Weekly_Email": {
                                    type: "Compose",
                                    runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildWeeklyEmailTemplate()
                                },
                                "Build_Monthly_Email": {
                                    type: "Compose",
                                    runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildMonthlyEmailTemplate()
                                },
                                "Build_Quarterly_Email": {
                                    type: "Compose",
                                    runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildQuarterlyEmailTemplate()
                                },
                                "Build_HalfYearly_Email": {
                                    type: "Compose",
                                    runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildHalfYearlyEmailTemplate()
                                },
                                "Build_Yearly_Email": {
                                    type: "Compose",
                                    runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Build_Task_List_HTML": ["Succeeded"]
                                    },
                                    inputs: this.buildYearlyEmailTemplate()
                                },
                                "Build_Custom_Email": {
                                    type: "Compose",
                                    runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Filter_Tasks_InDateRange": ["Succeeded"],
                                        "Filter_Custom_Completed_Tasks": ["Succeeded"],
                                        "Filter_Custom_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Custom_Todo_Tasks": ["Succeeded"],
                                        "Filter_Custom_Review_Tasks": ["Succeeded"],
                                        "Compute_Custom_Task_Metrics": ["Succeeded"],
                                        "Compute_Custom_KRA_Metrics": ["Succeeded"],
                                        "Compute_Custom_KPI_Metrics": ["Succeeded"],
                                        "Filter_Custom_Active_KRAs": ["Succeeded"],
                                        "Filter_Custom_Completed_KRAs": ["Succeeded"],
                                        "Filter_Custom_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_Custom_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Custom_Behind_KPIs": ["Succeeded"],
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: this.buildCustomEmailTemplate()
                                },
                                "Build_Email_Body": {
                                    type: "Compose",
                                    runAfter: {
                                        "Build_Standard_Email": ["Succeeded"],
                                        "Build_Daily_Email": ["Succeeded"],
                                        "Build_Weekly_Email": ["Succeeded"],
                                        "Build_Monthly_Email": ["Succeeded"],
                                        "Build_Quarterly_Email": ["Succeeded"],
                                        "Build_HalfYearly_Email": ["Succeeded"],
                                        "Build_Yearly_Email": ["Succeeded"],
                                        "Build_Custom_Email": ["Succeeded"]
                                    },
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'daily'), outputs('Build_Daily_Email'), if(equals(items('Process_Each_User')?['TimePeriod'], 'weekly'), outputs('Build_Weekly_Email'), if(equals(items('Process_Each_User')?['TimePeriod'], 'monthly'), outputs('Build_Monthly_Email'), if(equals(items('Process_Each_User')?['TimePeriod'], 'quarterly'), outputs('Build_Quarterly_Email'), if(equals(items('Process_Each_User')?['TimePeriod'], 'half-yearly'), outputs('Build_HalfYearly_Email'), if(equals(items('Process_Each_User')?['TimePeriod'], 'yearly'), outputs('Build_Yearly_Email'), if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), outputs('Build_Custom_Email'), outputs('Build_Standard_Email'))))))))"
                                },

                                // --- Send email ---
                                "Send_Report_Email": {
                                    type: "OpenApiConnection",
                                    runAfter: { "Build_Email_Body": ["Succeeded"] },
                                    inputs: {
                                        host: {
                                            apiId: `/providers/Microsoft.PowerApps/apis/shared_office365`,
                                            connectionName: "shared_office365",
                                            operationId: "SendEmailV2"
                                        },
                                        parameters: {
                                            "emailMessage/To": "@items('Process_Each_User')?['UserEmail']",
                                            "emailMessage/Subject": "@{items('Process_Each_User')?['TimePeriod']} Report — @{items('Process_Each_User')?['Unit']} — @{formatDateTime(utcNow(), 'dd MMM yyyy')}",
                                            "emailMessage/Body": "@outputs('Build_Email_Body')",
                                            "emailMessage/Importance": "Normal"
                                        },
                                        authentication: authBlock,
                                    }
                                },

                                // --- Calculate next send date ---
                                "Calculate_Next_Send": {
                                    type: "Compose",
                                    runAfter: { "Send_Report_Email": ["Succeeded"] },
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), 'DEACTIVATE', addDays(utcNow(), int(if(empty(items('Process_Each_User')?['CustomIntervalDays']), '14', items('Process_Each_User')?['CustomIntervalDays'])))), if(equals(items('Process_Each_User')?['TimePeriod'], 'daily'), addDays(utcNow(), 1), if(equals(items('Process_Each_User')?['TimePeriod'], 'weekly'), addDays(utcNow(), 7), if(equals(items('Process_Each_User')?['TimePeriod'], 'monthly'), addDays(utcNow(), 30), if(equals(items('Process_Each_User')?['TimePeriod'], 'quarterly'), addDays(utcNow(), 90), if(equals(items('Process_Each_User')?['TimePeriod'], 'half-yearly'), addDays(utcNow(), 182), addDays(utcNow(), 365)))))))"
                                },

                                // --- Update schedule ---
                                "Update_Schedule": {
                                    type: "OpenApiConnection",
                                    runAfter: { "Calculate_Next_Send": ["Succeeded"] },
                                    inputs: {
                                        host: {
                                            apiId: `/providers/Microsoft.PowerApps/apis/shared_sharepointonline`,
                                            connectionName: "shared_sharepointonline",
                                            operationId: "PatchItem"
                                        },
                                        parameters: {
                                            dataset: siteUrl,
                                            table: "Report_Schedules",
                                            id: "@items('Process_Each_User')?['ID']",
                                            "item/Title": "@items('Process_Each_User')?['Title']",
                                            "item/LastSentAt": "@utcNow()",
                                            "item/NextSendAt": "@if(equals(outputs('Calculate_Next_Send'), 'DEACTIVATE'), utcNow(), outputs('Calculate_Next_Send'))",
                                            "item/IsActive": "@if(equals(outputs('Calculate_Next_Send'), 'DEACTIVATE'), 'false', items('Process_Each_User')?['IsActive'])"
                                        },
                                        authentication: authBlock,
                                    }
                                }
                            }
                        }
                    },
                    outputs: {}
                },
                connectionReferences: {
                    shared_sharepointonline: {
                        connectionName: connections.sharepoint,
                        source: "Invoker",
                        id: `/providers/Microsoft.PowerApps/apis/shared_sharepointonline`
                    },
                    shared_office365: {
                        connectionName: connections.office365,
                        source: "Invoker",
                        id: `/providers/Microsoft.PowerApps/apis/shared_office365`
                    }
                }
            }
        };
    }

    // --- Standard HTML Email Template (non-daily reports) ---

    private buildStandardEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head>
<style>
body { font-family: Segoe UI, Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
.container { max-width: 640px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.header { background: #83002A; color: white; padding: 24px 32px; }
.header h1 { margin: 0 0 4px 0; font-size: 20px; }
.header p { margin: 0; opacity: 0.8; font-size: 13px; }
.body { padding: 24px 32px; }
.section { margin-bottom: 24px; }
.section h2 { font-size: 15px; font-weight: 600; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0; }
.metrics-grid { display: flex; gap: 12px; flex-wrap: wrap; }
.metric-card { flex: 1; min-width: 120px; background: #f9f9f9; border-radius: 8px; padding: 12px; text-align: center; }
.metric-card .value { font-size: 28px; font-weight: 700; color: #83002A; }
.metric-card .label { font-size: 11px; color: #666; margin-top: 2px; }
.status-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
.status-row .label { color: #555; }
.status-row .value { font-weight: 600; }
.footer { text-align: center; padding: 16px 32px; font-size: 11px; color: #999; border-top: 1px solid #eee; }
.cta { display: inline-block; background: #83002A; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; font-weight: 600; margin-top: 16px; }
.ai-section { background: linear-gradient(135deg, #f8f0f4 0%, #f0e8ec 100%); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; border-left: 4px solid #83002A; }
.ai-section h2 { font-size: 15px; font-weight: 600; margin: 0 0 12px 0; color: #83002A; border-bottom: none; padding-bottom: 0; }
.ai-section ul { margin: 0; padding: 0 0 0 18px; }
.ai-section li { font-size: 13px; color: #333; line-height: 1.6; margin-bottom: 8px; }
.ai-badge { display: inline-block; background: #83002A; color: white; font-size: 9px; padding: 2px 6px; border-radius: 3px; margin-left: 6px; vertical-align: middle; letter-spacing: 0.5px; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>', items('Process_Each_User')?['TimePeriod'], ' Report</h1>
<p>', items('Process_Each_User')?['Unit'], ' &middot; ', items('Process_Each_User')?['Division'], ' &middot; ', formatDateTime(utcNow(), 'dd MMMM yyyy'), '</p>
</div>
<div class="body">

<div class="section">
<h2>Task Performance</h2>
<div class="metrics-grid">
<div class="metric-card"><div class="value">', outputs('Compute_Task_Metrics')?['totalTasks'], '</div><div class="label">Total Tasks</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_Completed_Tasks')), '</div><div class="label">Completed</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_InProgress_Tasks')), '</div><div class="label">In Progress</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_Todo_Tasks')), '</div><div class="label">To Do</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_Review_Tasks')), '</div><div class="label">Review</div></div>
</div>
</div>

<div class="section">
<h2>Key Result Areas</h2>
<div class="metrics-grid">
<div class="metric-card"><div class="value">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</div><div class="label">Total KRAs</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_Active_KRAs')), '</div><div class="label">Active</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_Completed_KRAs')), '</div><div class="label">Completed</div></div>
</div>
</div>

<div class="section">
<h2>Key Performance Indicators</h2>
<div class="metrics-grid">
<div class="metric-card"><div class="value">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</div><div class="label">Total KPIs</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_OnTrack_KPIs')), '</div><div class="label">On Track</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_AtRisk_KPIs')), '</div><div class="label">At Risk</div></div>
<div class="metric-card"><div class="value">', length(body('Filter_Behind_KPIs')), '</div><div class="label">Behind</div></div>
</div>
</div>

<div class="section">
<h2>Objectives</h2>
<div class="metrics-grid">
<div class="metric-card"><div class="value">', length(body('Get_Objectives')?['value']), '</div><div class="label">Total Objectives</div></div>
</div>
</div>

', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat('<div class="ai-section"><h2>AI Strategic Insights <span class="ai-badge">GEMINI AI</span></h2><ul><li>', replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</li><li>'), '</li></ul></div>'), ''), '

<div style="text-align:center;margin-top:20px;">
<a href="https://unitopia-hub.vercel.app" class="cta">View Full Report in Intranet</a>
</div>

</div>
<div class="footer">
Confidential &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
This is an automated report from the SCPNG Intranet system.
</div>
</div>
</body>
</html>'
)}`;
    }

    // --- Standard AI Prompt Expression (non-daily reports) ---

    private buildStandardAIPromptExpression(): string {
        return `@{concat(
'You are a strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Analyze the following unit performance metrics and provide exactly 3 to 5 concise, actionable strategic insights. Each insight should be 1-2 sentences. Focus on identifying patterns, risks, strengths, and specific recommendations. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Do not include any preamble or conclusion, just the insights separated by the delimiter.

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Report Period: ', items('Process_Each_User')?['TimePeriod'], '
Date: ', formatDateTime(utcNow(), 'dd MMMM yyyy'), '

TASK METRICS:
- Total Tasks: ', string(outputs('Compute_Task_Metrics')?['totalTasks']), '
- Completed (Done): ', string(length(body('Filter_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Review_Tasks'))), '

KRA METRICS (Key Result Areas):
- Total KRAs: ', string(outputs('Compute_KRA_Metrics')?['totalKRAs']), '
- Active (Open + In Progress): ', string(length(body('Filter_Active_KRAs'))), '
- Completed (Closed): ', string(length(body('Filter_Completed_KRAs'))), '

KPI METRICS (Key Performance Indicators):
- Total KPIs: ', string(outputs('Compute_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Behind_KPIs'))), '

OBJECTIVES:
- Total Objectives: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    // --- Daily AI Prompt Expression ---

    private buildDailyAIPromptExpression(): string {
        return `@{concat(
'You are a strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Review today''s task activity and performance data for this unit. Provide exactly 3 to 5 concise, actionable insights focused on: (1) what was accomplished today, (2) any risks, blockers, or overdue items visible from the data, and (3) recommended priorities for the next working day. Each insight should be 1-2 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Date: ', formatDateTime(utcNow(), 'dd MMMM yyyy'), '

TASK METRICS:
- Total Tasks: ', string(outputs('Compute_Task_Metrics')?['totalTasks']), '
- Completed (Done): ', string(length(body('Filter_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Review_Tasks'))), '

KRA METRICS:
- Total KRAs: ', string(outputs('Compute_KRA_Metrics')?['totalKRAs']), '
- Active: ', string(length(body('Filter_Active_KRAs'))), '
- Completed: ', string(length(body('Filter_Completed_KRAs'))), '

KPI METRICS:
- Total KPIs: ', string(outputs('Compute_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Behind_KPIs'))), '

OBJECTIVES:
- Total: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    // --- Weekly HTML Email Template ---

    private buildWeeklyEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<!-- HEADER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:12px 12px 0 0;">
<tr><td style="padding:20px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Weekly Report</td>
<td align="right" style="font-size:13px;color:#e0a0a0;">', formatDateTime(addDays(utcNow(), -6), 'dd'), '&ndash;', formatDateTime(utcNow(), 'dd MMMM yyyy'), '</td>
</tr>
</table>
</td></tr>
</table>

<!-- DEPARTMENT + SENDER BAR -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #eee;border-right:1px solid #eee;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">', items('Process_Each_User')?['Unit'], ' - ', items('Process_Each_User')?['Division'], '</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<!-- SUMMARY STATS (4-column) -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #eee;border-right:1px solid #eee;">
<tr>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Filter_Completed_Tasks')), ' / ', outputs('Compute_Task_Metrics')?['totalTasks'], '</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Get_Objectives')?['value']), '</div>
</td>
</tr>
</table>

<!-- WEEKLY VITALS STRIP -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:10px 8px;font-size:12px;font-weight:600;color:#555;">
', outputs('Compute_Task_Metrics')?['totalTasks'], ' Total Tasks
</td>
<td width="34%" align="center" style="padding:10px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '% Completion
</td>
<td width="33%" align="center" style="padding:10px 8px;font-size:12px;font-weight:600;color:#555;">
', length(body('Filter_InProgress_Tasks')), ' In Progress
</td>
</tr>
</table>

<!-- SENDER INFO -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #eee;border-top:none;">
<tr><td style="padding:20px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="50px" valign="top">
<div style="width:42px;height:42px;border-radius:8px;background:#f0e6e8;color:#800020;font-size:18px;text-align:center;line-height:42px;">W</div>
</td>
<td valign="top" style="padding-left:12px;">
<p style="margin:0 0 3px 0;font-size:14px;font-weight:600;color:#333;">Automated Weekly Aggregation</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ', items('Process_Each_User')?['Title'], '</p>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- 2x2 METRICS DETAIL GRID -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #eee;border-top:none;">
<tr><td style="padding:20px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>

<!-- Task Volume -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:15px;">
<p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Task Volume</p>
<p style="margin:10px 0;font-size:28px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Task_Metrics')?['totalTasks'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_Tasks')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">', length(body('Filter_InProgress_Tasks')), ' In Progress</span>
</td>
</tr>
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Todo_Tasks')), ' To Do</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Review_Tasks')), ' Review</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Key Result Areas -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:15px;">
<p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Key Result Areas</p>
<p style="margin:10px 0;font-size:28px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_KRAs')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Active_KRAs')), ' Active</span>
</td>
</tr>
</table>
</td>

</tr>
<tr><td colspan="3" style="padding:6px 0;"></td></tr>
<tr>

<!-- KPI Status -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:15px;">
<p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">KPI Status</p>
<p style="margin:10px 0;font-size:28px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_OnTrack_KPIs')), ' On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_AtRisk_KPIs')), ' At Risk</span>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_Behind_KPIs')), ' Behind</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Objectives Progress -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:15px;">
<p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Objectives Progress</p>
<p style="margin:10px 0;font-size:28px;font-weight:700;color:#800020;text-align:center;">', length(body('Get_Objectives')?['value']), '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">Total Active</span>
</td>
</tr>
</table>
</td>

</tr>
</table>
</td></tr>
</table>

<!-- WORK LOG -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #eee;border-top:none;">
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;">Weekly Work Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
', outputs('Build_Task_List_HTML'), '
</table>
</td></tr>
</table>

<!-- AI WEEKLY ANALYSIS -->
', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat(
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #eee;border-top:none;">
<tr><td style="padding:0 24px 20px 24px;border-top:2px dashed #eee;">

<!-- Top Achievements -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
<tr><td style="font-size:14px;font-weight:700;color:#800020;padding-bottom:10px;">Weekly Performance Analysis <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;">GEMINI AI</span></td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-radius:8px;">
<tr><td style="padding:12px 15px;font-size:13px;color:#444;line-height:1.5;border-bottom:1px solid #eee;">',
replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</td></tr><tr><td style="padding:12px 15px;font-size:13px;color:#444;line-height:1.5;border-bottom:1px solid #eee;">'),
'</td></tr>
</table>

</td></tr>
</table>'
), ''), '

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #eee;border-top:none;">
<tr><td align="center" style="padding:20px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">View Full Weekly Report</a>
</td></tr>
</table>

<!-- FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:14px 24px;font-size:11px;color:#aaa;">
Confidential &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
This is an automated weekly report from the SCPNG Intranet system.
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>'
)}`;
    }

    // --- Weekly AI Prompt Expression ---

    private buildWeeklyAIPromptExpression(): string {
        return `@{concat(
'You are a strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Review the weekly performance data for this unit covering the past 7 days. Provide exactly 5 concise, actionable insights covering: (1) top achievements and completed work, (2) challenges and blockers encountered, (3) a productivity observation based on the task completion rate, (4) recommended priorities for the coming week, and (5) a brief overall weekly reflection (1-2 sentences). Each insight should be 1-2 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Week: ', formatDateTime(addDays(utcNow(), -6), 'dd MMM'), ' - ', formatDateTime(utcNow(), 'dd MMM yyyy'), '

TASK METRICS:
- Total Tasks: ', string(outputs('Compute_Task_Metrics')?['totalTasks']), '
- Completed (Done): ', string(length(body('Filter_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Review_Tasks'))), '
- Completion Rate: ', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '%

KRA METRICS (Key Result Areas):
- Total KRAs: ', string(outputs('Compute_KRA_Metrics')?['totalKRAs']), '
- Active (Open + In Progress): ', string(length(body('Filter_Active_KRAs'))), '
- Completed (Closed): ', string(length(body('Filter_Completed_KRAs'))), '

KPI METRICS (Key Performance Indicators):
- Total KPIs: ', string(outputs('Compute_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Behind_KPIs'))), '

OBJECTIVES:
- Total Objectives: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    // --- Monthly HTML Email Template ---

    private buildMonthlyEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<!-- HEADER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:12px 12px 0 0;">
<tr><td style="padding:20px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Monthly Report</td>
<td align="right" style="font-size:13px;color:#e0a0a0;">', formatDateTime(utcNow(), 'MMMM yyyy'), '</td>
</tr>
</table>
</td></tr>
</table>

<!-- DEPARTMENT + SENDER BAR -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #eee;border-right:1px solid #eee;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">', items('Process_Each_User')?['Unit'], ' - ', items('Process_Each_User')?['Division'], '</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<!-- SUMMARY STATS (4-column) -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #eee;border-right:1px solid #eee;">
<tr>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Filter_Completed_Tasks')), ' / ', outputs('Compute_Task_Metrics')?['totalTasks'], '</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Get_Objectives')?['value']), '</div>
</td>
</tr>
</table>

<!-- MONTHLY VITALS STRIP -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:10px 8px;font-size:12px;font-weight:600;color:#555;">
', outputs('Compute_Task_Metrics')?['totalTasks'], ' Total Tasks
</td>
<td width="34%" align="center" style="padding:10px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '% Completion
</td>
<td width="33%" align="center" style="padding:10px 8px;font-size:12px;font-weight:600;color:#0052cc;">
', formatDateTime(utcNow(), 'MMMM'), ' Summary
</td>
</tr>
</table>

<!-- SENDER INFO -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #eee;border-top:none;">
<tr><td style="padding:20px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="50px" valign="top">
<div style="width:42px;height:42px;border-radius:8px;background:#f0e6e8;color:#800020;font-size:18px;text-align:center;line-height:42px;">M</div>
</td>
<td valign="top" style="padding-left:12px;">
<p style="margin:0 0 3px 0;font-size:14px;font-weight:600;color:#333;">Automated Monthly Aggregation</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ', items('Process_Each_User')?['Title'], '</p>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- 2x2 METRICS DETAIL GRID -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #eee;border-top:none;">
<tr><td style="padding:20px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>

<!-- Monthly Task Volume -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:15px;">
<p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Monthly Task Volume</p>
<p style="margin:10px 0;font-size:28px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Task_Metrics')?['totalTasks'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_Tasks')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">', length(body('Filter_InProgress_Tasks')), ' In Progress</span>
</td>
</tr>
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Todo_Tasks')), ' To Do</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Review_Tasks')), ' Review</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Key Result Areas -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:15px;">
<p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Key Result Areas</p>
<p style="margin:10px 0;font-size:28px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_KRAs')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Active_KRAs')), ' Active</span>
</td>
</tr>
</table>
</td>

</tr>
<tr><td colspan="3" style="padding:6px 0;"></td></tr>
<tr>

<!-- KPI Performance -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:15px;">
<p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">KPI Performance</p>
<p style="margin:10px 0;font-size:28px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_OnTrack_KPIs')), ' On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_AtRisk_KPIs')), ' At Risk</span>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_Behind_KPIs')), ' Behind</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Objectives Progress -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:15px;">
<p style="margin:0 0 5px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Objectives Progress</p>
<p style="margin:10px 0;font-size:28px;font-weight:700;color:#800020;text-align:center;">', length(body('Get_Objectives')?['value']), '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">Total Active</span>
</td>
</tr>
</table>
</td>

</tr>
</table>
</td></tr>
</table>

<!-- WORK LOG -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #eee;border-top:none;">
<tr><td style="padding:20px 24px;">
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;">Monthly Work Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
', outputs('Build_Task_List_HTML'), '
</table>
</td></tr>
</table>

<!-- AI MONTHLY STRATEGIC ANALYSIS -->
', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat(
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #eee;border-top:none;">
<tr><td style="padding:0 24px 20px 24px;border-top:2px dashed #eee;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
<tr><td style="font-size:14px;font-weight:700;color:#800020;padding-bottom:10px;">Strategic Performance &amp; Impact Analysis <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;">GEMINI AI</span></td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-radius:8px;">
<tr><td style="padding:12px 15px;font-size:13px;color:#444;line-height:1.5;border-bottom:1px solid #eee;">',
replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</td></tr><tr><td style="padding:12px 15px;font-size:13px;color:#444;line-height:1.5;border-bottom:1px solid #eee;">'),
'</td></tr>
</table>

</td></tr>
</table>'
), ''), '

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #eee;border-top:none;">
<tr><td align="center" style="padding:20px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:700;">View Monthly Executive Summary</a>
</td></tr>
</table>

<!-- FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:14px 24px;font-size:11px;color:#aaa;">
Confidential &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
This is an automated monthly report from the SCPNG Intranet system.
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>'
)}`;
    }

    // --- Monthly AI Prompt Expression ---

    private buildMonthlyAIPromptExpression(): string {
        return `@{concat(
'You are a strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Review the monthly performance data for this unit. Provide exactly 6 concise, actionable insights covering: (1) performance trends observed across the month, (2) key achievements and their strategic impact, (3) systemic bottlenecks or recurring blockers, (4) skill growth or development observations based on task complexity and completion patterns, (5) recommended priorities for the coming month, and (6) a brief executive reflection summarizing the month (2-3 sentences). Each insight should be 1-3 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Month: ', formatDateTime(utcNow(), 'MMMM yyyy'), '

TASK METRICS:
- Total Tasks: ', string(outputs('Compute_Task_Metrics')?['totalTasks']), '
- Completed (Done): ', string(length(body('Filter_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Review_Tasks'))), '
- Completion Rate: ', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '%

KRA METRICS (Key Result Areas):
- Total KRAs: ', string(outputs('Compute_KRA_Metrics')?['totalKRAs']), '
- Active (Open + In Progress): ', string(length(body('Filter_Active_KRAs'))), '
- Completed (Closed): ', string(length(body('Filter_Completed_KRAs'))), '

KPI METRICS (Key Performance Indicators):
- Total KPIs: ', string(outputs('Compute_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Behind_KPIs'))), '

OBJECTIVES:
- Total Objectives: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    // --- Quarterly HTML Email Template ---

    private buildQuarterlyEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<!-- HEADER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:12px 12px 0 0;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;">Quarterly Report</td>
<td align="right">
<span style="display:inline-block;font-size:13px;color:#ffffff;background:rgba(255,255,255,0.15);padding:5px 12px;border-radius:4px;">Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4'))), ' ', formatDateTime(utcNow(), 'yyyy'), '</span>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- DEPARTMENT BAR -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">', items('Process_Each_User')?['Unit'], ' - ', items('Process_Each_User')?['Division'], '</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<!-- SUMMARY STATS (4-column) -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Filter_Completed_Tasks')), ' / ', outputs('Compute_Task_Metrics')?['totalTasks'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Get_Objectives')?['value']), '</div>
</td>
</tr>
</table>

<!-- QUARTERLY VITALS STRIP -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fa;border:1px solid #e0e0e0;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#555;">
', outputs('Compute_Task_Metrics')?['totalTasks'], ' Total Tasks
</td>
<td width="34%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '% Completion
</td>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#6a41a4;">
Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4'))), ' Summary
</td>
</tr>
</table>

<!-- SENDER INFO -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="55px" valign="top">
<div style="width:46px;height:46px;border-radius:10px;background:#800020;color:#ffffff;font-size:18px;text-align:center;line-height:46px;box-shadow:0 4px 8px rgba(128,0,32,0.2);">Q</div>
</td>
<td valign="top" style="padding-left:14px;">
<p style="margin:0 0 3px 0;font-size:14px;font-weight:600;color:#333;">Quarterly Strategic Assessment</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ', items('Process_Each_User')?['Title'], '</p>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- 2x2 METRICS DETAIL GRID -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>

<!-- Quarterly Volume -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Quarterly Volume</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Task_Metrics')?['totalTasks'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_Tasks')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">', length(body('Filter_InProgress_Tasks')), ' In Progress</span>
</td>
</tr>
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Todo_Tasks')), ' To Do</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e8f0fe;border:1px solid #d2e3fc;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1967d2;">', length(body('Filter_Review_Tasks')), ' Review</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Key Result Areas -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Key Result Areas</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_KRAs')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Active_KRAs')), ' Active</span>
</td>
</tr>
</table>
</td>

</tr>
<tr><td colspan="3" style="padding:6px 0;"></td></tr>
<tr>

<!-- Q KPI Status -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4'))), ' KPI Status</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_OnTrack_KPIs')), ' On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_AtRisk_KPIs')), ' At Risk</span>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_Behind_KPIs')), ' Behind</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Strategic Objectives -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Strategic Objectives</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', length(body('Get_Objectives')?['value']), '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">Total Active</span>
</td>
</tr>
</table>
</td>

</tr>
</table>
</td></tr>
</table>

<!-- WORK LOG -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;">Quarterly Work Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
', outputs('Build_Task_List_HTML'), '
</table>
</td></tr>
</table>

<!-- AI QUARTERLY STRATEGIC ANALYSIS -->
', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat(
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:0 24px 22px 24px;border-top:2px dashed #eee;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
<tr><td style="font-size:15px;font-weight:700;color:#800020;padding-bottom:12px;">Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4'))), ' Executive Review <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;">GEMINI AI</span></td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-radius:8px;">
<tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">',
replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</td></tr><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">'),
'</td></tr>
</table>

</td></tr>
</table>'
), ''), '

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td align="center" style="padding:22px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(128,0,32,0.2);">View Complete Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4'))), ' Dossier</a>
</td></tr>
</table>

<!-- FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:16px 24px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">
Confidential &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
<span style="text-transform:none;letter-spacing:normal;">This is an automated quarterly report from the SCPNG Intranet system.</span>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>'
)}`;
    }

    // --- Quarterly AI Prompt Expression ---

    private buildQuarterlyAIPromptExpression(): string {
        return `@{concat(
'You are a senior strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Review the quarterly performance data for this unit. Provide exactly 7 concise, impactful insights covering: (1) strategic contributions and their organizational impact, (2) performance trends observed across the 3-month period, (3) key achievements vs missed targets (identify both wins and misses), (4) organizational or systemic bottlenecks that affected delivery, (5) professional growth and leadership observations based on task complexity and completion patterns, (6) forward strategy recommendations for the next quarter, and (7) an executive reflection summarizing the quarter (3-4 sentences, covering overall performance, challenges, and strategic direction). Each insight should be 2-3 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Quarter: Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4'))), ' ', formatDateTime(utcNow(), 'yyyy'), '

TASK METRICS:
- Total Tasks: ', string(outputs('Compute_Task_Metrics')?['totalTasks']), '
- Completed (Done): ', string(length(body('Filter_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Review_Tasks'))), '
- Completion Rate: ', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '%

KRA METRICS (Key Result Areas):
- Total KRAs: ', string(outputs('Compute_KRA_Metrics')?['totalKRAs']), '
- Active (Open + In Progress): ', string(length(body('Filter_Active_KRAs'))), '
- Completed (Closed): ', string(length(body('Filter_Completed_KRAs'))), '

KPI METRICS (Key Performance Indicators):
- Total KPIs: ', string(outputs('Compute_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Behind_KPIs'))), '

OBJECTIVES:
- Total Objectives: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    // --- Half-Yearly HTML Email Template ---

    private buildHalfYearlyEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<!-- HEADER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:12px 12px 0 0;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;">Half-Yearly Report</td>
<td align="right">
<span style="display:inline-block;font-size:13px;color:#ffffff;background:rgba(255,255,255,0.15);padding:5px 12px;border-radius:4px;">H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' ', formatDateTime(utcNow(), 'yyyy'), '</span>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- DEPARTMENT BAR -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">', items('Process_Each_User')?['Unit'], ' - ', items('Process_Each_User')?['Division'], '</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<!-- SUMMARY STATS (4-column) -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Filter_Completed_Tasks')), ' / ', outputs('Compute_Task_Metrics')?['totalTasks'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Get_Objectives')?['value']), '</div>
</td>
</tr>
</table>

<!-- HALF-YEARLY VITALS STRIP -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fa;border:1px solid #e0e0e0;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#555;">
', outputs('Compute_Task_Metrics')?['totalTasks'], ' Total Tasks
</td>
<td width="34%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '% Completion
</td>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#0052cc;">
H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' Performance Review
</td>
</tr>
</table>

<!-- SENDER INFO -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="55px" valign="top">
<div style="width:46px;height:46px;border-radius:10px;background:#800020;color:#ffffff;font-size:16px;text-align:center;line-height:46px;font-weight:700;box-shadow:0 4px 8px rgba(128,0,32,0.2);">H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), '</div>
</td>
<td valign="top" style="padding-left:14px;">
<p style="margin:0 0 3px 0;font-size:14px;font-weight:600;color:#333;">H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' Strategic Assessment</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ', items('Process_Each_User')?['Title'], '</p>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- 2x2 METRICS DETAIL GRID -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>

<!-- H Task Volume -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' Task Volume</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Task_Metrics')?['totalTasks'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_Tasks')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">', length(body('Filter_InProgress_Tasks')), ' In Progress</span>
</td>
</tr>
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Todo_Tasks')), ' To Do</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e8f0fe;border:1px solid #d2e3fc;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1967d2;">', length(body('Filter_Review_Tasks')), ' Review</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Key Result Areas -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Key Result Areas</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_KRAs')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Active_KRAs')), ' Active</span>
</td>
</tr>
</table>
</td>

</tr>
<tr><td colspan="3" style="padding:6px 0;"></td></tr>
<tr>

<!-- H KPI Trajectory -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' KPI Trajectory</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_OnTrack_KPIs')), ' On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_AtRisk_KPIs')), ' At Risk</span>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_Behind_KPIs')), ' Behind</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Strategic Objectives -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Strategic Objectives</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', length(body('Get_Objectives')?['value']), '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">Total Active</span>
</td>
</tr>
</table>
</td>

</tr>
</table>
</td></tr>
</table>

<!-- WORK LOG -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;">H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' Work Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
', outputs('Build_Task_List_HTML'), '
</table>
</td></tr>
</table>

<!-- AI HALF-YEARLY STRATEGIC ANALYSIS -->
', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat(
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:0 24px 22px 24px;border-top:2px dashed #eee;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
<tr><td style="font-size:15px;font-weight:700;color:#800020;padding-bottom:12px;">H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' Strategic Performance &amp; Trajectory <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;">GEMINI AI</span></td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-radius:8px;">
<tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">',
replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</td></tr><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">'),
'</td></tr>
</table>

</td></tr>
</table>'
), ''), '

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td align="center" style="padding:22px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:8px;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(128,0,32,0.2);">View Complete H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' Performance Dossier</a>
</td></tr>
</table>

<!-- FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:16px 24px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">
Confidential &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
<span style="text-transform:none;letter-spacing:normal;">This is an automated half-yearly report from the SCPNG Intranet system.</span>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>'
)}`;
    }

    // --- Yearly HTML Email Template ---

    private buildYearlyEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<!-- HEADER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:12px 12px 0 0;">
<tr><td style="padding:24px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;text-transform:uppercase;">Annual Report</td>
<td align="right">
<span style="display:inline-block;font-size:14px;color:#ffffff;background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:4px;font-weight:700;">', formatDateTime(utcNow(), 'yyyy'), '</span>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- DEPARTMENT BAR -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">', items('Process_Each_User')?['Unit'], ' - ', items('Process_Each_User')?['Division'], '</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<!-- SUMMARY STATS (4-column) -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Filter_Completed_Tasks')), ' / ', outputs('Compute_Task_Metrics')?['totalTasks'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Get_Objectives')?['value']), '</div>
</td>
</tr>
</table>

<!-- ANNUAL VITALS STRIP -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fa;border:1px solid #e0e0e0;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#555;">
', outputs('Compute_Task_Metrics')?['totalTasks'], ' Total Tasks
</td>
<td width="34%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '% Overall Completion
</td>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#d4af37;">
', formatDateTime(utcNow(), 'yyyy'), ' Annual Review
</td>
</tr>
</table>

<!-- SENDER INFO -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="55px" valign="top">
<div style="width:50px;height:50px;border-radius:12px;background:#800020;color:#ffffff;font-size:14px;text-align:center;line-height:50px;font-weight:700;box-shadow:0 4px 10px rgba(128,0,32,0.25);">FY</div>
</td>
<td valign="top" style="padding-left:14px;">
<p style="margin:0 0 3px 0;font-size:15px;font-weight:600;color:#333;">Annual Executive Assessment</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ', items('Process_Each_User')?['Title'], '</p>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- 2x2 METRICS DETAIL GRID -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>

<!-- Annual Task Volume -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Annual Task Volume</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Task_Metrics')?['totalTasks'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_Tasks')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">', length(body('Filter_InProgress_Tasks')), ' In Progress</span>
</td>
</tr>
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Todo_Tasks')), ' To Do</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e8f0fe;border:1px solid #d2e3fc;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1967d2;">', length(body('Filter_Review_Tasks')), ' Review</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Key Result Areas -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Key Result Areas</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Completed_KRAs')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Active_KRAs')), ' Active</span>
</td>
</tr>
</table>
</td>

</tr>
<tr><td colspan="3" style="padding:6px 0;"></td></tr>
<tr>

<!-- Annual KPI Achievement -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Annual KPI Achievement</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_OnTrack_KPIs')), ' On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_AtRisk_KPIs')), ' At Risk</span>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_Behind_KPIs')), ' Behind</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Strategic Objectives -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Strategic Objectives</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', length(body('Get_Objectives')?['value']), '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">Total Active</span>
</td>
</tr>
</table>
</td>

</tr>
</table>
</td></tr>
</table>

<!-- WORK LOG -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;">', formatDateTime(utcNow(), 'yyyy'), ' Work Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
', outputs('Build_Task_List_HTML'), '
</table>
</td></tr>
</table>

<!-- AI ANNUAL STRATEGIC ANALYSIS -->
', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat(
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:0 24px 22px 24px;border-top:2px dashed #eee;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
<tr><td style="font-size:15px;font-weight:700;color:#800020;padding-bottom:12px;">Annual Strategic Performance &amp; Impact <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;">GEMINI AI</span></td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdfaf0;border:1px solid #f6eacc;border-left:4px solid #d4af37;border-radius:8px;">
<tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.7;border-bottom:1px solid #f0e8d0;">',
replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</td></tr><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.7;border-bottom:1px solid #f0e8d0;">'),
'</td></tr>
</table>

</td></tr>
</table>'
), ''), '

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td align="center" style="padding:22px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:18px 36px;border-radius:8px;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(128,0,32,0.2);">View Complete ', formatDateTime(utcNow(), 'yyyy'), ' Annual Dossier</a>
</td></tr>
</table>

<!-- FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:16px 24px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">
Confidential Annual Review Document &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
<span style="text-transform:none;letter-spacing:normal;">This is an automated annual report from the SCPNG Intranet system.</span>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>'
)}`;
    }

    // --- Yearly AI Prompt Expression ---

    private buildYearlyAIPromptExpression(): string {
        return `@{concat(
'You are a senior strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Review the full-year annual performance data for this unit. Provide exactly 8 concise, impactful insights covering: (1) strategic impact and major value creation — identify the most significant deliverables and their measurable business impact across the full year, (2) yearly performance trends — analyze velocity, consistency, and trajectory across all four quarters (growth, plateaus, or decline), (3) key achievements vs missed targets — present the most important wins alongside any gaps or shortfalls, (4) professional growth and leadership development — assess how task complexity, cross-functional responsibilities, and technical mastery evolved, (5) systemic organizational insights — identify persistent structural or process challenges that affected annual output, (6) forward strategy for the next year — recommend 3 concrete priorities for scale, optimization, and culture, (7) a comprehensive annual executive reflection summarizing the full year''s trajectory, organizational maturation, strategic direction, and personal leadership evolution (5-6 sentences), and (8) a single-sentence defining statement of the year''s ultimate legacy contribution. Each insight should be 2-3 sentences except the reflection (5-6 sentences) and legacy statement (1 sentence). Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Period: Full Year ', formatDateTime(utcNow(), 'yyyy'), '

TASK METRICS:
- Total Tasks: ', string(outputs('Compute_Task_Metrics')?['totalTasks']), '
- Completed (Done): ', string(length(body('Filter_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Review_Tasks'))), '
- Completion Rate: ', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '%

KRA METRICS (Key Result Areas):
- Total KRAs: ', string(outputs('Compute_KRA_Metrics')?['totalKRAs']), '
- Active (Open + In Progress): ', string(length(body('Filter_Active_KRAs'))), '
- Completed (Closed): ', string(length(body('Filter_Completed_KRAs'))), '

KPI METRICS (Key Performance Indicators):
- Total KPIs: ', string(outputs('Compute_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Behind_KPIs'))), '

OBJECTIVES:
- Total Objectives: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    // --- Half-Yearly AI Prompt Expression ---

    private buildHalfYearlyAIPromptExpression(): string {
        return `@{concat(
'You are a senior strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Review the half-yearly (6-month) performance data for this unit. Provide exactly 7 concise, impactful insights covering: (1) sustained strategic impact and major deliverables across the half-year, (2) performance trajectory comparing the two quarters (growth, consistency, or decline), (3) key achievements vs gaps (identify both wins and misses), (4) capability and role growth observations based on task volume and complexity patterns, (5) systemic challenges and organizational gaps that persisted across the half-year, (6) forward strategy and priorities for the next half-year, and (7) a mid-year executive reflection summarizing overall trajectory, maturation, and strategic direction (4-5 sentences). Each insight should be 2-3 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Period: H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2'), ' ', formatDateTime(utcNow(), 'yyyy'), '

TASK METRICS:
- Total Tasks: ', string(outputs('Compute_Task_Metrics')?['totalTasks']), '
- Completed (Done): ', string(length(body('Filter_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Review_Tasks'))), '
- Completion Rate: ', if(equals(outputs('Compute_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Completed_Tasks')), 100), outputs('Compute_Task_Metrics')?['totalTasks']))), '%

KRA METRICS (Key Result Areas):
- Total KRAs: ', string(outputs('Compute_KRA_Metrics')?['totalKRAs']), '
- Active (Open + In Progress): ', string(length(body('Filter_Active_KRAs'))), '
- Completed (Closed): ', string(length(body('Filter_Completed_KRAs'))), '

KPI METRICS (Key Performance Indicators):
- Total KPIs: ', string(outputs('Compute_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Behind_KPIs'))), '

OBJECTIVES:
- Total Objectives: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    // --- Custom Date Range AI Prompt Expression ---

    private buildCustomAIPromptExpression(): string {
        return `@{concat(
'You are a strategic performance analyst for the Securities Commission of Papua New Guinea (SCPNG). Analyze the following performance data for a specific custom date range window. Provide exactly 5 concise, actionable insights covering: (1) what activity and output occurred within this date range — summarize the key work items, completions, and progress made, (2) completion velocity and throughput — assess whether the output level is strong, moderate, or low relative to a window of this length, (3) risks and items that were active or overdue during this period — flag anything concerning, (4) any KRA or KPI trend changes visible within this window — note movements in status or trajectory, and (5) recommendations for the period immediately following this window — what should be prioritized next. Each insight should be 1-2 sentences. Do NOT use markdown formatting, bullet points, or numbered lists. Separate each insight with the delimiter ||INSIGHT||. Output nothing else.

Unit: ', items('Process_Each_User')?['Unit'], '
Division: ', items('Process_Each_User')?['Division'], '
Date Range: ', formatDateTime(outputs('Compute_Custom_Start'), 'dd MMMM yyyy'), ' to ', formatDateTime(outputs('Compute_Custom_End'), 'dd MMMM yyyy'), '
Window Type: ', if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), 'One-Time Custom Range', concat('Rolling (', if(empty(items('Process_Each_User')?['RollingWindowDays']), '30', items('Process_Each_User')?['RollingWindowDays']), '-day window)')), '

TASK METRICS (items modified/due within date range):
- Total Tasks in Range: ', string(outputs('Compute_Custom_Task_Metrics')?['totalTasks']), '
- Completed: ', string(length(body('Filter_Custom_Completed_Tasks'))), '
- In Progress: ', string(length(body('Filter_Custom_InProgress_Tasks'))), '
- To Do: ', string(length(body('Filter_Custom_Todo_Tasks'))), '
- In Review: ', string(length(body('Filter_Custom_Review_Tasks'))), '
- Completion Rate: ', if(equals(outputs('Compute_Custom_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Custom_Completed_Tasks')), 100), outputs('Compute_Custom_Task_Metrics')?['totalTasks']))), '%

KRA METRICS (items modified within date range):
- Total KRAs in Range: ', string(outputs('Compute_Custom_KRA_Metrics')?['totalKRAs']), '
- Active: ', string(length(body('Filter_Custom_Active_KRAs'))), '
- Completed: ', string(length(body('Filter_Custom_Completed_KRAs'))), '

KPI METRICS (items modified within date range):
- Total KPIs in Range: ', string(outputs('Compute_Custom_KPI_Metrics')?['totalKPIs']), '
- On Track + Completed: ', string(length(body('Filter_Custom_OnTrack_KPIs'))), '
- At Risk: ', string(length(body('Filter_Custom_AtRisk_KPIs'))), '
- Behind: ', string(length(body('Filter_Custom_Behind_KPIs'))), '

OBJECTIVES:
- Total Objectives: ', string(length(body('Get_Objectives')?['value'])), '
'
)}`;
    }

    // --- Custom Date Range HTML Email Template ---

    private buildCustomEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:650px;margin:20px auto;">
<tr><td>

<!-- HEADER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:12px 12px 0 0;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Custom Date Range Report</td>
<td align="right">
<span style="display:inline-block;font-size:12px;color:#ffffff;background:rgba(255,255,255,0.2);padding:5px 12px;border-radius:4px;letter-spacing:0.3px;">', formatDateTime(outputs('Compute_Custom_Start'), 'dd MMM yyyy'), ' &ndash; ', formatDateTime(outputs('Compute_Custom_End'), 'dd MMM yyyy'), '</span>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- DEPARTMENT BAR -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr><td style="padding:18px 24px;border-bottom:1px solid #eee;">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#333;">', items('Process_Each_User')?['Unit'], ' - ', items('Process_Each_User')?['Division'], '</p>
<p style="margin:0;font-size:13px;color:#777;">Securities Commission of Papua New Guinea</p>
</td></tr>
</table>

<!-- SUMMARY STATS (4-column) -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Tasks</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Filter_Custom_Completed_Tasks')), ' / ', outputs('Compute_Custom_Task_Metrics')?['totalTasks'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KRAs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_Custom_KRA_Metrics')?['totalKRAs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-right:1px solid #f0f0f0;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">KPIs</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', outputs('Compute_Custom_KPI_Metrics')?['totalKPIs'], '</div>
</td>
<td width="25%" align="center" style="padding:18px 8px;border-bottom:1px solid #eee;">
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Objectives</div>
<div style="font-size:24px;font-weight:700;color:#800020;">', length(body('Get_Objectives')?['value']), '</div>
</td>
</tr>
</table>

<!-- VITALS STRIP -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fa;border:1px solid #e0e0e0;border-top:none;">
<tr>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#555;">
', outputs('Compute_Custom_Task_Metrics')?['totalTasks'], ' Tasks in Range
</td>
<td width="34%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#1e8e3e;">
', if(equals(outputs('Compute_Custom_Task_Metrics')?['totalTasks'], 0), '0', string(div(mul(length(body('Filter_Custom_Completed_Tasks')), 100), outputs('Compute_Custom_Task_Metrics')?['totalTasks']))), '% Completion
</td>
<td width="33%" align="center" style="padding:12px 8px;font-size:12px;font-weight:600;color:#0052cc;">
', if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), 'One-Time Report', concat(if(empty(items('Process_Each_User')?['RollingWindowDays']), '30', items('Process_Each_User')?['RollingWindowDays']), '-Day Rolling Window')), '
</td>
</tr>
</table>

<!-- SENDER INFO -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;border-bottom:1px solid #eee;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td width="55px" valign="top">
<div style="width:46px;height:46px;border-radius:10px;background:#800020;color:#ffffff;font-size:14px;text-align:center;line-height:46px;font-weight:700;box-shadow:0 4px 8px rgba(128,0,32,0.2);">DR</div>
</td>
<td valign="top" style="padding-left:14px;">
<p style="margin:0 0 3px 0;font-size:14px;font-weight:600;color:#333;">Custom Date Range Analysis</p>
<p style="margin:0;font-size:12px;color:#888;">Prepared for ', items('Process_Each_User')?['Title'], '</p>
</td>
</tr>
</table>
</td></tr>
</table>

<!-- 2x2 METRICS DETAIL GRID -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:22px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>

<!-- Task Volume -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Task Volume (Date Range)</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Custom_Task_Metrics')?['totalTasks'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Custom_Completed_Tasks')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fef7e0;border:1px solid #fce8b2;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#b08d00;">', length(body('Filter_Custom_InProgress_Tasks')), ' In Progress</span>
</td>
</tr>
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Custom_Todo_Tasks')), ' To Do</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e8f0fe;border:1px solid #d2e3fc;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1967d2;">', length(body('Filter_Custom_Review_Tasks')), ' Review</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Key Result Areas -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Key Result Areas</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Custom_KRA_Metrics')?['totalKRAs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Custom_Completed_KRAs')), ' Completed</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">', length(body('Filter_Custom_Active_KRAs')), ' Active</span>
</td>
</tr>
</table>
</td>

</tr>
<tr><td colspan="3" style="padding:6px 0;"></td></tr>
<tr>

<!-- KPI Status -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">KPI Status (Date Range)</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', outputs('Compute_Custom_KPI_Metrics')?['totalKPIs'], '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#e6f4ea;border:1px solid #cce8d6;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#1e8e3e;">', length(body('Filter_Custom_OnTrack_KPIs')), ' On Track</span>
</td>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_Custom_AtRisk_KPIs')), ' At Risk</span>
</td>
</tr>
<tr>
<td colspan="2" align="center" style="padding:3px;">
<span style="display:inline-block;background:#fce8e6;border:1px solid #fad2cf;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#d93025;">', length(body('Filter_Custom_Behind_KPIs')), ' Behind</span>
</td>
</tr>
</table>
</td>

<td width="4%"></td>

<!-- Strategic Objectives -->
<td width="48%" valign="top" style="background:#fcfcfc;border:1px solid #f0f0f0;border-radius:8px;padding:18px 15px;">
<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:1px solid #eee;padding-bottom:5px;">Strategic Objectives</p>
<p style="margin:10px 0;font-size:30px;font-weight:700;color:#800020;text-align:center;">', length(body('Get_Objectives')?['value']), '</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding:3px;">
<span style="display:inline-block;background:#fff;border:1px solid #e0e0e0;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#555;">Total Active</span>
</td>
</tr>
</table>
</td>

</tr>
</table>
</td></tr>
</table>

<!-- AI CUSTOM DATE RANGE ANALYSIS -->
', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat(
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:0 24px 22px 24px;border-top:2px dashed #eee;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
<tr><td style="font-size:15px;font-weight:700;color:#800020;padding-bottom:12px;">Custom Range Analysis <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;">GEMINI AI</span></td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fcfcfc;border:1px solid #eee;border-left:4px solid #0052cc;border-radius:8px;">
<tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">',
replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</td></tr><tr><td style="padding:14px 15px;font-size:13px;color:#444;line-height:1.6;border-bottom:1px solid #eee;">'),
'</td></tr>
</table>

</td></tr>
</table>'
), ''), '

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td align="center" style="padding:22px 24px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:8px;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(128,0,32,0.2);">View Full Report in Intranet</a>
</td></tr>
</table>

<!-- FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;">
<tr><td align="center" style="padding:16px 24px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">
Confidential &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
<span style="text-transform:none;letter-spacing:normal;">This is an automated custom date range report from the SCPNG Intranet system.</span>
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>'
)}`;
    }

    // --- Daily HTML Email Template ---

    private buildDailyEmailTemplate(): string {
        return `@{concat(
'<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Segoe UI,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:20px auto;">
<tr><td>

<!-- HEADER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#800020;border-radius:8px 8px 0 0;">
<tr><td style="padding:24px 28px;">
<p style="margin:0 0 4px 0;font-size:11px;color:#f0c0c0;text-transform:uppercase;letter-spacing:1px;">Automated Daily Report</p>
<h1 style="margin:0 0 6px 0;font-size:20px;color:#ffffff;font-weight:700;">Daily Report</h1>
<p style="margin:0;font-size:13px;color:#e0a0a0;">
', items('Process_Each_User')?['Unit'], ' &middot; ', items('Process_Each_User')?['Division'], '<br/>
', formatDateTime(utcNow(), 'dddd, dd MMMM yyyy'), '
</p>
</td></tr>
</table>

<!-- SENDER BAR -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#6b001a;">
<tr><td style="padding:10px 28px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="font-size:12px;color:#f0c0c0;">Automated Intranet System</td>
<td align="right" style="font-size:12px;color:#f0c0c0;">Prepared for <strong style="color:#ffffff;">', items('Process_Each_User')?['Title'], '</strong></td>
</tr>
</table>
</td></tr>
</table>

<!-- SUMMARY STATS BAR -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
<tr>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;">
<div style="font-size:28px;font-weight:700;color:#800020;">', outputs('Compute_Task_Metrics')?['totalTasks'], '</div>
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Tasks</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;">
<div style="font-size:28px;font-weight:700;color:#800020;">', outputs('Compute_KRA_Metrics')?['totalKRAs'], '</div>
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">KRAs</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;border-right:1px solid #f0f0f0;">
<div style="font-size:28px;font-weight:700;color:#800020;">', outputs('Compute_KPI_Metrics')?['totalKPIs'], '</div>
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">KPIs</div>
</td>
<td width="25%" align="center" style="padding:16px 8px;">
<div style="font-size:28px;font-weight:700;color:#800020;">', length(body('Get_Objectives')?['value']), '</div>
<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Objectives</div>
</td>
</tr>
</table>

<!-- METRICS DETAIL GRID -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:20px 28px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>

<!-- Task Performance Box -->
<td width="48%" valign="top" style="background:#ffffff;border:1px solid #e8e8e8;padding:14px;">
<p style="margin:0 0 10px 0;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;">Task Performance</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#555;padding:3px 0;">Done</td><td align="right" style="font-size:12px;font-weight:600;color:#155724;">', length(body('Filter_Completed_Tasks')), '</td></tr>
<tr><td style="font-size:12px;color:#555;padding:3px 0;">In Progress</td><td align="right" style="font-size:12px;font-weight:600;color:#004085;">', length(body('Filter_InProgress_Tasks')), '</td></tr>
<tr><td style="font-size:12px;color:#555;padding:3px 0;">Review</td><td align="right" style="font-size:12px;font-weight:600;color:#856404;">', length(body('Filter_Review_Tasks')), '</td></tr>
<tr><td style="font-size:12px;color:#555;padding:3px 0;">To Do</td><td align="right" style="font-size:12px;font-weight:600;color:#555;">', length(body('Filter_Todo_Tasks')), '</td></tr>
</table>
</td>

<td width="4%"></td>

<!-- KRAs Box -->
<td width="48%" valign="top" style="background:#ffffff;border:1px solid #e8e8e8;padding:14px;">
<p style="margin:0 0 10px 0;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;">Key Result Areas</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#555;padding:3px 0;">Active</td><td align="right" style="font-size:12px;font-weight:600;color:#004085;">', length(body('Filter_Active_KRAs')), '</td></tr>
<tr><td style="font-size:12px;color:#555;padding:3px 0;">Completed</td><td align="right" style="font-size:12px;font-weight:600;color:#155724;">', length(body('Filter_Completed_KRAs')), '</td></tr>
</table>
</td>

</tr>
<tr><td colspan="3" style="padding:6px 0;"></td></tr>
<tr>

<!-- KPIs Box -->
<td width="48%" valign="top" style="background:#ffffff;border:1px solid #e8e8e8;padding:14px;">
<p style="margin:0 0 10px 0;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;">Key Performance Indicators</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-size:12px;color:#555;padding:3px 0;">On Track</td><td align="right" style="font-size:12px;font-weight:600;color:#155724;">', length(body('Filter_OnTrack_KPIs')), '</td></tr>
<tr><td style="font-size:12px;color:#555;padding:3px 0;">At Risk</td><td align="right" style="font-size:12px;font-weight:600;color:#856404;">', length(body('Filter_AtRisk_KPIs')), '</td></tr>
<tr><td style="font-size:12px;color:#555;padding:3px 0;">Behind</td><td align="right" style="font-size:12px;font-weight:600;color:#721c24;">', length(body('Filter_Behind_KPIs')), '</td></tr>
</table>
</td>

<td width="4%"></td>

<!-- Objectives Box -->
<td width="48%" valign="top" style="background:#ffffff;border:1px solid #e8e8e8;padding:14px;">
<p style="margin:0 0 10px 0;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;">Objectives</p>
<p style="margin:0;font-size:24px;font-weight:700;color:#333;text-align:center;">', length(body('Get_Objectives')?['value']), '</p>
<p style="margin:4px 0 0 0;font-size:11px;color:#888;text-align:center;">total</p>
</td>

</tr>
</table>
</td></tr>
</table>

<!-- WORK LOG -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:20px 28px;">
<p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#333;">Work Log</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8e8e8;">
<tr style="background:#f9f9f9;">
<td style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Task</td>
<td align="right" style="padding:8px 12px;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e0e0e0;">Status</td>
</tr>
', outputs('Build_Task_List_HTML'), '
</table>
</td></tr>
</table>

<!-- AI STRATEGIC ANALYSIS -->
', if(greater(length(string(outputs('Extract_AI_Response'))), 2), concat(
'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf5f7;border:1px solid #e0e0e0;border-top:none;">
<tr><td style="padding:20px 28px;border-left:4px solid #800020;">
<p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#800020;">AI Strategic Analysis <span style="display:inline-block;background:#800020;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0.5px;">GEMINI AI</span></p>
<p style="margin:0 0 12px 0;font-size:11px;color:#999;">Insights generated from today''s performance data</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:8px 0;font-size:13px;color:#333;line-height:1.7;border-bottom:1px solid #f0e0e4;">',
replace(string(outputs('Extract_AI_Response')), '||INSIGHT||', '</td></tr><tr><td style="padding:8px 0;font-size:13px;color:#333;line-height:1.7;border-bottom:1px solid #f0e0e4;">'),
'</td></tr>
</table>
</td></tr>
</table>'
), ''), '

<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e0e0e0;border-top:none;">
<tr><td align="center" style="padding:20px 28px;">
<a href="https://unitopia-hub.vercel.app" style="display:inline-block;background:#800020;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:13px;font-weight:600;">View Full Report in Intranet</a>
</td></tr>
</table>

<!-- FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
<tr><td align="center" style="padding:14px 28px;font-size:11px;color:#999;">
Confidential &mdash; ', items('Process_Each_User')?['Unit'], ' &middot; Securities Commission of Papua New Guinea<br/>
This is an automated daily report from the SCPNG Intranet system.
</td></tr>
</table>

</td></tr>
</table>
</body>
</html>'
)}`;
    }
}
