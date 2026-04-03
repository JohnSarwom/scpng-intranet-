import { FLOW_CONFIG } from './config';
import { buildSenderSnapshotEmailTemplate, buildSenderCustomEmailTemplate } from './templates/senderEmail';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Authentication block required by OpenApiConnection actions */
const authBlock = {
    value: "@json(decodeBase64(triggerOutputs().headers['X-MS-APIM-Tokens']))['$ConnectionKey']",
    type: "Raw"
};

const siteUrl = FLOW_CONFIG.SHAREPOINT_SITE;

/** SharePoint: Get Items */
function spGetItems(table: string, filter: string, runAfter: Record<string, string[]> = {}) {
    const params: Record<string, any> = { dataset: siteUrl, table, "$top": 500 };
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
}

/** SharePoint: Patch (update) Item */
function spPatchItem(
    table: string,
    id: string,
    fields: Record<string, string>,
    runAfter: Record<string, string[]> = {}
) {
    return {
        type: "OpenApiConnection",
        runAfter,
        inputs: {
            host: {
                apiId: `/providers/Microsoft.PowerApps/apis/shared_sharepointonline`,
                connectionName: "shared_sharepointonline",
                operationId: "PatchItem"
            },
            parameters: { dataset: siteUrl, table, id, ...fields },
            authentication: authBlock,
        }
    };
}

/** Google Sheets: Insert a row into a named sheet */
function sheetsInsertRow(
    spreadsheetId: string,
    sheetName: string,
    item: Record<string, string>,
    runAfter: Record<string, string[]> = {}
) {
    return {
        type: "OpenApiConnection",
        runAfter,
        inputs: {
            host: {
                apiId: `/providers/Microsoft.PowerApps/apis/shared_googlesheet`,
                connectionName: "shared_googlesheet",
                operationId: "PostItem"
            },
            parameters: {
                dataset: spreadsheetId,
                table: sheetName,
                item,
            },
            authentication: authBlock,
        }
    };
}

/** Google Sheets: Get all rows from a named sheet */
function sheetsGetRows(
    spreadsheetId: string,
    sheetName: string,
    runAfter: Record<string, string[]> = {}
) {
    return {
        type: "OpenApiConnection",
        runAfter,
        inputs: {
            host: {
                apiId: `/providers/Microsoft.PowerApps/apis/shared_googlesheet`,
                connectionName: "shared_googlesheet",
                operationId: "GetItems"
            },
            parameters: {
                dataset: spreadsheetId,
                table: sheetName,
            },
            authentication: authBlock,
        }
    };
}

/** Google Sheets: Update a single row by its row ID */
function sheetsUpdateRow(
    spreadsheetId: string,
    sheetName: string,
    rowId: string,
    item: Record<string, string>,
    runAfter: Record<string, string[]> = {}
) {
    return {
        type: "OpenApiConnection",
        runAfter,
        inputs: {
            host: {
                apiId: `/providers/Microsoft.PowerApps/apis/shared_googlesheet`,
                connectionName: "shared_googlesheet",
                operationId: "PatchItem"
            },
            parameters: {
                dataset: spreadsheetId,
                table: sheetName,
                id: rowId,
                item,
            },
            authentication: authBlock,
        }
    };
}

// ─── Shared data-gathering actions (used by Dispatch flow) ────────────────────

/**
 * All the actions inside Process_Each_User that gather SharePoint data,
 * compute metrics, and build the Task HTML / Period Label — unchanged from
 * the original single flow.  Returns at the Insert_AI_Queue_Row step.
 */
function buildDispatchLoopActions(spreadsheetId: string) {
    return {
        // ── Data Retrieval ──────────────────────────────────────────────
        "Get_Tasks":      spGetItems("Operations_Tasks",  "Department eq '@{items('Process_Each_User')?['Unit']}'"),
        "Get_KRAs":       spGetItems("Performance_KRAs",  "Unit eq '@{items('Process_Each_User')?['Unit']}'"),
        "Get_KPIs":       spGetItems("Performance_KPIs",  ""),
        "Get_Objectives": spGetItems("Unit_Objectives",   "Unit eq '@{items('Process_Each_User')?['Unit']}'"),

        // ── Custom date-range boundaries ────────────────────────────────
        "Compute_Custom_Start": {
            type: "Compose", runAfter: {},
            inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), items('Process_Each_User')?['CustomStartDate'], formatDateTime(addDays(utcNow(), mul(-1, int(if(empty(items('Process_Each_User')?['RollingWindowDays']), '30', items('Process_Each_User')?['RollingWindowDays'])))), 'yyyy-MM-ddTHH:mm:ssZ')), '1970-01-01T00:00:00Z')"
        },
        "Compute_Custom_End": {
            type: "Compose", runAfter: {},
            inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), items('Process_Each_User')?['CustomEndDate'], formatDateTime(utcNow(), 'yyyy-MM-ddTHH:mm:ssZ')), '2099-12-31T23:59:59Z')"
        },

        // ── Optional date-range filters (only meaningful for custom) ────
        "Filter_Tasks_InDateRange": {
            type: "Query",
            runAfter: { "Get_Tasks": ["Succeeded"], "Compute_Custom_Start": ["Succeeded"], "Compute_Custom_End": ["Succeeded"] },
            inputs: {
                from: "@body('Get_Tasks')?['value']",
                where: "@or(and(not(empty(item()?['Modified'])), greaterOrEquals(item()?['Modified'], outputs('Compute_Custom_Start')), lessOrEquals(item()?['Modified'], outputs('Compute_Custom_End'))), and(not(empty(item()?['DueDate'])), greaterOrEquals(item()?['DueDate'], outputs('Compute_Custom_Start')), lessOrEquals(item()?['DueDate'], outputs('Compute_Custom_End'))))"
            }
        },
        "Filter_KRAs_InDateRange": {
            type: "Query",
            runAfter: { "Get_KRAs": ["Succeeded"], "Compute_Custom_Start": ["Succeeded"], "Compute_Custom_End": ["Succeeded"] },
            inputs: {
                from: "@body('Get_KRAs')?['value']",
                where: "@and(not(empty(item()?['Modified'])), greaterOrEquals(item()?['Modified'], outputs('Compute_Custom_Start')), lessOrEquals(item()?['Modified'], outputs('Compute_Custom_End')))"
            }
        },
        "Filter_KPIs_InDateRange": {
            type: "Query",
            runAfter: { "Get_KPIs": ["Succeeded"], "Compute_Custom_Start": ["Succeeded"], "Compute_Custom_End": ["Succeeded"] },
            inputs: {
                from: "@body('Get_KPIs')?['value']",
                where: "@and(not(empty(item()?['Modified'])), greaterOrEquals(item()?['Modified'], outputs('Compute_Custom_Start')), lessOrEquals(item()?['Modified'], outputs('Compute_Custom_End')))"
            }
        },

        // ── Unified base arrays ─────────────────────────────────────────
        "Compute_Base_Tasks": {
            type: "Compose",
            runAfter: { "Filter_Tasks_InDateRange": ["Succeeded", "Skipped", "Failed"] },
            inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), body('Filter_Tasks_InDateRange'), body('Get_Tasks')?['value'])"
        },
        "Compute_Base_KRAs": {
            type: "Compose",
            runAfter: { "Filter_KRAs_InDateRange": ["Succeeded", "Skipped", "Failed"] },
            inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), body('Filter_KRAs_InDateRange'), body('Get_KRAs')?['value'])"
        },
        "Compute_Base_KPIs": {
            type: "Compose",
            runAfter: { "Filter_KPIs_InDateRange": ["Succeeded", "Skipped", "Failed"] },
            inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), body('Filter_KPIs_InDateRange'), body('Get_KPIs')?['value'])"
        },

        // ── Task metrics ────────────────────────────────────────────────
        "Compute_Task_Metrics": {
            type: "Compose", runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
            inputs: { totalTasks: "@length(outputs('Compute_Base_Tasks'))" }
        },
        "Filter_Completed_Tasks": {
            type: "Query", runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_Tasks')", where: "@equals(item()?['Status'], 'Done')" }
        },
        "Filter_InProgress_Tasks": {
            type: "Query", runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_Tasks')", where: "@equals(item()?['Status'], 'In Progress')" }
        },
        "Filter_Todo_Tasks": {
            type: "Query", runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_Tasks')", where: "@equals(item()?['Status'], 'Todo')" }
        },
        "Filter_Review_Tasks": {
            type: "Query", runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_Tasks')", where: "@equals(item()?['Status'], 'Review')" }
        },

        // ── KRA metrics ─────────────────────────────────────────────────
        "Compute_KRA_Metrics": {
            type: "Compose", runAfter: { "Compute_Base_KRAs": ["Succeeded"] },
            inputs: { totalKRAs: "@length(outputs('Compute_Base_KRAs'))" }
        },
        "Filter_Active_KRAs": {
            type: "Query", runAfter: { "Compute_Base_KRAs": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_KRAs')", where: "@or(equals(item()?['Status'], 'In Progress'), equals(item()?['Status'], 'Open'))" }
        },
        "Filter_Completed_KRAs": {
            type: "Query", runAfter: { "Compute_Base_KRAs": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_KRAs')", where: "@equals(item()?['Status'], 'Closed')" }
        },

        // ── KPI metrics ─────────────────────────────────────────────────
        "Compute_KPI_Metrics": {
            type: "Compose", runAfter: { "Compute_Base_KPIs": ["Succeeded"] },
            inputs: { totalKPIs: "@length(outputs('Compute_Base_KPIs'))" }
        },
        "Filter_OnTrack_KPIs": {
            type: "Query", runAfter: { "Compute_Base_KPIs": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_KPIs')", where: "@or(equals(item()?['Status'], 'On Track'), equals(item()?['Status'], 'Completed'))" }
        },
        "Filter_AtRisk_KPIs": {
            type: "Query", runAfter: { "Compute_Base_KPIs": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_KPIs')", where: "@equals(item()?['Status'], 'At Risk')" }
        },
        "Filter_Behind_KPIs": {
            type: "Query", runAfter: { "Compute_Base_KPIs": ["Succeeded"] },
            inputs: { from: "@outputs('Compute_Base_KPIs')", where: "@equals(item()?['Status'], 'Behind')" }
        },

        // ── Task list HTML ──────────────────────────────────────────────
        "Select_Task_HTML": {
            type: "Select", runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
            inputs: {
                from: "@outputs('Compute_Base_Tasks')",
                select: "@concat('<tr><td style=''padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;''>', item()?['Title'], '</td><td align=''right'' style=''padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;font-weight:600;color:#800020;''>', item()?['Status'], '</td></tr>')"
            }
        },
        "Build_Task_List_HTML": {
            type: "Compose",
            runAfter: { "Select_Task_HTML": ["Succeeded"] },
            inputs: "@join(body('Select_Task_HTML'), '')"
        },

        // ── Period label ────────────────────────────────────────────────
        "Compute_Period_Label": {
            type: "Compose",
            runAfter: {
                "Compute_Task_Metrics": ["Succeeded"], "Filter_Completed_Tasks": ["Succeeded"],
                "Filter_InProgress_Tasks": ["Succeeded"], "Filter_Todo_Tasks": ["Succeeded"],
                "Filter_Review_Tasks": ["Succeeded"], "Compute_KRA_Metrics": ["Succeeded"],
                "Filter_Active_KRAs": ["Succeeded"], "Filter_Completed_KRAs": ["Succeeded"],
                "Compute_KPI_Metrics": ["Succeeded"], "Filter_OnTrack_KPIs": ["Succeeded"],
                "Filter_AtRisk_KPIs": ["Succeeded"], "Filter_Behind_KPIs": ["Succeeded"],
                "Get_Objectives": ["Succeeded"], "Build_Task_List_HTML": ["Succeeded"]
            },
            inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'quarterly'), concat('Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4')))), if(equals(items('Process_Each_User')?['TimePeriod'], 'half-yearly'), concat('H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2')), if(equals(items('Process_Each_User')?['TimePeriod'], 'yearly'), formatDateTime(utcNow(), 'yyyy'), items('Process_Each_User')?['TimePeriod'])))"
        },

        // ── Generate unique RunId for this dispatch ─────────────────────
        "Generate_RunId": {
            type: "Compose",
            runAfter: { "Compute_Period_Label": ["Succeeded"] },
            inputs: "@concat(replace(items('Process_Each_User')?['UserEmail'], '@', '_'), '_', formatDateTime(utcNow(), 'yyyyMMddHHmmss'))"
        },

        // ── Write to Google Sheets AI_Queue (replaces Gemini HTTP call) ─
        "Insert_AI_Queue_Row": sheetsInsertRow(
            spreadsheetId,
            "AI_Queue",
            {
                "item/RunId":              "@{outputs('Generate_RunId')}",
                "item/UserEmail":          "@{items('Process_Each_User')?['UserEmail']}",
                "item/UserName":           "@{items('Process_Each_User')?['Title']}",
                "item/ManagerEmail":       "@{items('Process_Each_User')?['ManagerEmail']}",
                "item/Unit":               "@{items('Process_Each_User')?['Unit']}",
                "item/Division":           "@{items('Process_Each_User')?['Division']}",
                "item/TimePeriod":         "@{items('Process_Each_User')?['TimePeriod']}",
                "item/PeriodLabel":        "@{outputs('Compute_Period_Label')}",
                "item/TotalTasks":         "@{outputs('Compute_Task_Metrics')?['totalTasks']}",
                "item/CompletedTasks":     "@{length(body('Filter_Completed_Tasks'))}",
                "item/InProgressTasks":    "@{length(body('Filter_InProgress_Tasks'))}",
                "item/TodoTasks":          "@{length(body('Filter_Todo_Tasks'))}",
                "item/ReviewTasks":        "@{length(body('Filter_Review_Tasks'))}",
                "item/TotalKRAs":          "@{outputs('Compute_KRA_Metrics')?['totalKRAs']}",
                "item/ActiveKRAs":         "@{length(body('Filter_Active_KRAs'))}",
                "item/CompletedKRAs":      "@{length(body('Filter_Completed_KRAs'))}",
                "item/TotalKPIs":          "@{outputs('Compute_KPI_Metrics')?['totalKPIs']}",
                "item/OnTrackKPIs":        "@{length(body('Filter_OnTrack_KPIs'))}",
                "item/AtRiskKPIs":         "@{length(body('Filter_AtRisk_KPIs'))}",
                "item/BehindKPIs":         "@{length(body('Filter_Behind_KPIs'))}",
                "item/TotalObjectives":    "@{length(body('Get_Objectives')?['value'])}",
                "item/TaskListHTML":       "@{outputs('Build_Task_List_HTML')}",
                "item/ScheduleItemID":     "@{items('Process_Each_User')?['ID']}",
                "item/IsOneTime":          "@{items('Process_Each_User')?['IsOneTime']}",
                "item/CustomIntervalDays": "@{items('Process_Each_User')?['CustomIntervalDays']}",
                "item/CustomStart":        "@{outputs('Compute_Custom_Start')}",
                "item/CustomEnd":          "@{outputs('Compute_Custom_End')}",
                "item/Status":             "PENDING",
                "item/AISummary":          "",
                "item/CreatedAt":          "@{utcNow()}",
                "item/ProcessedAt":        "",
            },
            { "Generate_RunId": ["Succeeded"] }
        ),
    };
}

// ─── Flow 1: Dispatch ─────────────────────────────────────────────────────────

/**
 * Reads due schedules from SharePoint, gathers metrics, and writes a PENDING
 * row to the Google Sheets AI_Queue for GAS to process.
 * No HTTP calls — all standard connectors.
 */
export function buildDispatchFlowDefinition(
    connections: { sharepoint: string; office365: string; googlesheets: string },
    spreadsheetId: string
) {
    return {
        properties: {
            displayName: FLOW_CONFIG.DISPATCH_FLOW_NAME,
            state: 'Started',
            definition: {
                "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
                contentVersion: "1.0.0.0",
                parameters: {
                    "$connections": { defaultValue: {}, type: "Object" },
                    "$authentication": { defaultValue: {}, type: "SecureObject" }
                },
                triggers: {
                    "Scheduled_Dispatch": {
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
                    "Get_Active_Schedules": spGetItems("Report_Schedules", "IsActive eq 'true'"),

                    "Filter_Due_Schedules": {
                        type: "Query",
                        runAfter: { "Get_Active_Schedules": ["Succeeded"] },
                        inputs: {
                            from: "@body('Get_Active_Schedules')?['value']",
                            where: "@lessOrEquals(item()?['NextSendAt'], utcNow())"
                        }
                    },

                    "Process_Each_User": {
                        type: "Foreach",
                        runAfter: { "Filter_Due_Schedules": ["Succeeded"] },
                        foreach: "@body('Filter_Due_Schedules')",
                        runtimeConfiguration: {
                            concurrency: { repetitions: 20 }
                        },
                        actions: buildDispatchLoopActions(spreadsheetId),
                    },
                },
                outputs: {}
            },
            connectionReferences: {
                shared_sharepointonline: {
                    connectionName: connections.sharepoint,
                    source: "Invoker",
                    id: `/providers/Microsoft.PowerApps/apis/shared_sharepointonline`
                },
                shared_googlesheet: {
                    connectionName: connections.googlesheets,
                    source: "Invoker",
                    id: `/providers/Microsoft.PowerApps/apis/shared_googlesheet`
                },
            }
        }
    };
}

// ─── Flow 2: Send ────────────────────────────────────────────────────────────

/**
 * Polls the Google Sheets AI_Queue for READY rows, builds the full HTML email
 * (including the GAS-generated AI summary), sends via Office 365, then updates
 * NextSendAt in SharePoint and marks the row as SENT.
 * No HTTP calls — all standard connectors.
 */
export function buildSendFlowDefinition(
    connections: { sharepoint: string; office365: string; googlesheets: string },
    spreadsheetId: string
) {
    const calculateNextSend =
        "@if(equals(items('Process_Ready_Row')?['TimePeriod'], 'custom'), " +
            "if(equals(items('Process_Ready_Row')?['IsOneTime'], 'true'), 'DEACTIVATE', " +
                "addDays(utcNow(), int(if(empty(items('Process_Ready_Row')?['CustomIntervalDays']), '14', items('Process_Ready_Row')?['CustomIntervalDays'])))), " +
            "if(equals(items('Process_Ready_Row')?['TimePeriod'], 'daily'), addDays(utcNow(), 1), " +
            "if(equals(items('Process_Ready_Row')?['TimePeriod'], 'weekly'), addDays(utcNow(), 7), " +
            "if(equals(items('Process_Ready_Row')?['TimePeriod'], 'monthly'), addDays(utcNow(), 30), " +
            "if(equals(items('Process_Ready_Row')?['TimePeriod'], 'quarterly'), addDays(utcNow(), 90), " +
            "if(equals(items('Process_Ready_Row')?['TimePeriod'], 'half-yearly'), addDays(utcNow(), 182), " +
                "addDays(utcNow(), 365)))))))";

    return {
        properties: {
            displayName: FLOW_CONFIG.SEND_FLOW_NAME,
            state: 'Started',
            definition: {
                "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
                contentVersion: "1.0.0.0",
                parameters: {
                    "$connections": { defaultValue: {}, type: "Object" },
                    "$authentication": { defaultValue: {}, type: "SecureObject" }
                },
                triggers: {
                    "Poll_Queue": {
                        type: "Recurrence",
                        recurrence: {
                            frequency: "Minute",
                            interval: 15,
                            timeZone: "Pacific/Port_Moresby"
                        }
                    }
                },
                actions: {
                    // Step 1: Read all rows from AI_Queue
                    "Get_Queue_Rows": sheetsGetRows(spreadsheetId, "AI_Queue"),

                    // Step 2: Keep only READY rows
                    "Filter_Ready_Rows": {
                        type: "Query",
                        runAfter: { "Get_Queue_Rows": ["Succeeded"] },
                        inputs: {
                            from: "@body('Get_Queue_Rows')?['value']",
                            where: "@equals(item()?['Status'], 'READY')"
                        }
                    },

                    // Step 3: Process each READY row concurrently
                    "Process_Ready_Row": {
                        type: "Foreach",
                        runAfter: { "Filter_Ready_Rows": ["Succeeded"] },
                        foreach: "@body('Filter_Ready_Rows')",
                        runtimeConfiguration: {
                            concurrency: { repetitions: 20 }
                        },
                        actions: {

                            // Build snapshot email (standard periods)
                            "Build_Snapshot_Email": {
                                type: "Compose",
                                runAfter: {},
                                inputs: buildSenderSnapshotEmailTemplate()
                            },

                            // Build custom-range email
                            "Build_Custom_Email": {
                                type: "Compose",
                                runAfter: {},
                                inputs: buildSenderCustomEmailTemplate()
                            },

                            // Select correct template based on TimePeriod
                            "Build_Email_Body": {
                                type: "Compose",
                                runAfter: {
                                    "Build_Snapshot_Email": ["Succeeded"],
                                    "Build_Custom_Email": ["Succeeded"]
                                },
                                inputs: "@if(equals(items('Process_Ready_Row')?['TimePeriod'], 'custom'), outputs('Build_Custom_Email'), outputs('Build_Snapshot_Email'))"
                            },

                            // Send email via Office 365
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
                                        "emailMessage/To": "@items('Process_Ready_Row')?['UserEmail']",
                                        "emailMessage/Cc": "@if(empty(items('Process_Ready_Row')?['ManagerEmail']), '', items('Process_Ready_Row')?['ManagerEmail'])",
                                        "emailMessage/Subject": "@{items('Process_Ready_Row')?['TimePeriod']} Report — @{items('Process_Ready_Row')?['Unit']} — @{formatDateTime(utcNow(), 'dd MMM yyyy')}",
                                        "emailMessage/Body": "@outputs('Build_Email_Body')",
                                        "emailMessage/Importance": "Normal"
                                    },
                                    authentication: authBlock,
                                }
                            },

                            // Calculate when the next report should send
                            "Calculate_Next_Send": {
                                type: "Compose",
                                runAfter: { "Send_Report_Email": ["Succeeded"] },
                                inputs: calculateNextSend
                            },

                            // Update NextSendAt in SharePoint Report_Schedules
                            "Update_Schedule": spPatchItem(
                                "Report_Schedules",
                                "@items('Process_Ready_Row')?['ScheduleItemID']",
                                {
                                    "item/Title":       "@items('Process_Ready_Row')?['UserName']",
                                    "item/LastSentAt":  "@utcNow()",
                                    "item/NextSendAt":  "@if(equals(outputs('Calculate_Next_Send'), 'DEACTIVATE'), utcNow(), outputs('Calculate_Next_Send'))",
                                    "item/IsActive":    "@if(equals(outputs('Calculate_Next_Send'), 'DEACTIVATE'), 'false', 'true')"
                                },
                                { "Calculate_Next_Send": ["Succeeded"] }
                            ),

                            // Mark the Google Sheets row as SENT
                            "Mark_Queue_Row_Sent": sheetsUpdateRow(
                                spreadsheetId,
                                "AI_Queue",
                                "@{items('Process_Ready_Row')?['id']}",
                                {
                                    "item/Status":      "SENT",
                                    "item/ProcessedAt": "@{utcNow()}"
                                },
                                { "Update_Schedule": ["Succeeded", "Failed"] }
                            ),
                        }
                    },
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
                },
                shared_googlesheet: {
                    connectionName: connections.googlesheets,
                    source: "Invoker",
                    id: `/providers/Microsoft.PowerApps/apis/shared_googlesheet`
                },
            }
        }
    };
}

// ─── Legacy export (kept for backward compatibility with TestGround) ──────────

/** @deprecated Use buildDispatchFlowDefinition + buildSendFlowDefinition */
export function buildReportSchedulerDefinition(
    connections: { sharepoint: string; office365: string; googlesheets: string }
) {
    return buildDispatchFlowDefinition(connections, FLOW_CONFIG.SPREADSHEET_ID);
}
