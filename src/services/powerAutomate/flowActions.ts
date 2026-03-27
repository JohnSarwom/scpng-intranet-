import { FLOW_CONFIG } from './config';
import { getAIInstructionsExpression, buildSnapshotAIPromptExpression, buildCustomAIPromptExpression } from './templates/aiPrompts';
import { buildSnapshotEmailTemplate } from './templates/snapshotEmail';
import { buildCustomEmailTemplate } from './templates/customEmail';

export function buildReportSchedulerDefinition(connections: { sharepoint: string; office365: string }) {
        const siteUrl = FLOW_CONFIG.SHAREPOINT_SITE;
        console.log('🚀 [PowerAutomate] Building flow definition with unified base arrays v2!');

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
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), items('Process_Each_User')?['CustomStartDate'], formatDateTime(addDays(utcNow(), mul(-1, int(if(empty(items('Process_Each_User')?['RollingWindowDays']), '30', items('Process_Each_User')?['RollingWindowDays'])))), 'yyyy-MM-ddTHH:mm:ssZ')), '1970-01-01T00:00:00Z')"
                                },
                                "Compute_Custom_End": {
                                    type: "Compose",
                                    runAfter: {},
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), if(equals(items('Process_Each_User')?['IsOneTime'], 'true'), items('Process_Each_User')?['CustomEndDate'], formatDateTime(utcNow(), 'yyyy-MM-ddTHH:mm:ssZ')), '2099-12-31T23:59:59Z')"
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

                                // --- Base Arrays (Unifies Custom and Standard Snapshot) ---
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

                                // --- Task Metrics ---
                                // Schema: Status choices = "Todo", "In Progress", "Review", "Done"
                                "Compute_Task_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
                                    inputs: {
                                        totalTasks: "@length(outputs('Compute_Base_Tasks'))"
                                    }
                                },
                                "Filter_Completed_Tasks": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_Tasks')",
                                        where: "@equals(item()?['Status'], 'Done')"
                                    }
                                },
                                "Filter_InProgress_Tasks": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_Tasks')",
                                        where: "@equals(item()?['Status'], 'In Progress')"
                                    }
                                },
                                "Filter_Todo_Tasks": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_Tasks')",
                                        where: "@equals(item()?['Status'], 'Todo')"
                                    }
                                },
                                "Filter_Review_Tasks": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_Tasks')",
                                        where: "@equals(item()?['Status'], 'Review')"
                                    }
                                },

                                // --- KRA Metrics ---
                                // Schema: Status is text = "Open", "In Progress", "Closed"
                                "Compute_KRA_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Compute_Base_KRAs": ["Succeeded"] },
                                    inputs: {
                                        totalKRAs: "@length(outputs('Compute_Base_KRAs'))"
                                    }
                                },
                                "Filter_Active_KRAs": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_KRAs": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_KRAs')",
                                        where: "@or(equals(item()?['Status'], 'In Progress'), equals(item()?['Status'], 'Open'))"
                                    }
                                },
                                "Filter_Completed_KRAs": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_KRAs": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_KRAs')",
                                        where: "@equals(item()?['Status'], 'Closed')"
                                    }
                                },

                                // --- KPI Metrics ---
                                // Schema: Status choices = "On Track", "At Risk", "Behind", "Completed"
                                "Compute_KPI_Metrics": {
                                    type: "Compose",
                                    runAfter: { "Compute_Base_KPIs": ["Succeeded"] },
                                    inputs: {
                                        totalKPIs: "@length(outputs('Compute_Base_KPIs'))"
                                    }
                                },
                                "Filter_OnTrack_KPIs": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_KPIs": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_KPIs')",
                                        where: "@or(equals(item()?['Status'], 'On Track'), equals(item()?['Status'], 'Completed'))"
                                    }
                                },
                                "Filter_AtRisk_KPIs": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_KPIs": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_KPIs')",
                                        where: "@equals(item()?['Status'], 'At Risk')"
                                    }
                                },
                                "Filter_Behind_KPIs": {
                                    type: "Query",
                                    runAfter: { "Compute_Base_KPIs": ["Succeeded"] },
                                    inputs: {
                                        from: "@outputs('Compute_Base_KPIs')",
                                        where: "@equals(item()?['Status'], 'Behind')"
                                    }
                                },

                                // --- Task List for Daily Email ---
                                "Select_Task_HTML": {
                                    type: "Select",
                                    runAfter: { "Compute_Base_Tasks": ["Succeeded"] },
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

                                // --- AI Analysis ---

                                // Standard AI prompt (for non-daily reports)
                                
                                // --- Dynamic Labels & Instructions ---
                                "Compute_Period_Label": {
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
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'quarterly'), concat('Q', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 3), '1', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '2', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 9), '3', '4')))), if(equals(items('Process_Each_User')?['TimePeriod'], 'half-yearly'), concat('H', if(lessOrEquals(int(formatDateTime(utcNow(), 'M')), 6), '1', '2')), if(equals(items('Process_Each_User')?['TimePeriod'], 'yearly'), formatDateTime(utcNow(), 'yyyy'), items('Process_Each_User')?['TimePeriod'])))"
                                },
                                "Select_AI_Instructions": {
                                    type: "Compose",
                                    runAfter: { "Compute_Period_Label": ["Succeeded"] },
                                    inputs: getAIInstructionsExpression()
                                },

                                // --- AI Prompts ---
                                "Build_Snapshot_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: { "Select_AI_Instructions": ["Succeeded"] },
                                    inputs: buildSnapshotAIPromptExpression()
                                },
                                "Build_Custom_AI_Prompt": {
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
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: buildCustomAIPromptExpression()
                                },
                                "Build_AI_Prompt": {
                                    type: "Compose",
                                    runAfter: {
                                        "Build_Snapshot_AI_Prompt": ["Succeeded"],
                                        "Build_Custom_AI_Prompt": ["Succeeded"]
                                    },
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), outputs('Build_Custom_AI_Prompt'), outputs('Build_Snapshot_AI_Prompt'))"
                                },

                                // --- Gemini API Call ---
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

                                // Extract AI response text
                                "Extract_AI_Response": {
                                    type: "Compose",
                                    runAfter: { "Call_Gemini_API": ["Succeeded", "Failed", "TimedOut"] },
                                    inputs: "@if(equals(outputs('Call_Gemini_API')['statusCode'], 200), body('Call_Gemini_API')?['candidates']?[0]?['content']?['parts']?[0]?['text'], '')"
                                },

                                // --- Build HTML email body ---
                                "Build_Snapshot_Email": {
                                    type: "Compose",
                                    runAfter: { "Extract_AI_Response": ["Succeeded"] },
                                    inputs: buildSnapshotEmailTemplate()
                                },
                                "Build_Custom_Email": {
                                    type: "Compose",
                                                                        runAfter: {
                                        "Extract_AI_Response": ["Succeeded"],
                                        "Filter_Tasks_InDateRange": ["Succeeded"],
                                        "Filter_Completed_Tasks": ["Succeeded"],
                                        "Filter_InProgress_Tasks": ["Succeeded"],
                                        "Filter_Todo_Tasks": ["Succeeded"],
                                        "Filter_Review_Tasks": ["Succeeded"],
                                        "Compute_Task_Metrics": ["Succeeded"],
                                        "Compute_KRA_Metrics": ["Succeeded"],
                                        "Compute_KPI_Metrics": ["Succeeded"],
                                        "Filter_Active_KRAs": ["Succeeded"],
                                        "Filter_Completed_KRAs": ["Succeeded"],
                                        "Filter_OnTrack_KPIs": ["Succeeded"],
                                        "Filter_AtRisk_KPIs": ["Succeeded"],
                                        "Filter_Behind_KPIs": ["Succeeded"],
                                        "Compute_Custom_Start": ["Succeeded"],
                                        "Compute_Custom_End": ["Succeeded"]
                                    },
                                    inputs: buildCustomEmailTemplate()
                                },
                                "Build_Email_Body": {
                                    type: "Compose",
                                    runAfter: {
                                        "Build_Snapshot_Email": ["Succeeded"],
                                        "Build_Custom_Email": ["Succeeded"]
                                    },
                                    inputs: "@if(equals(items('Process_Each_User')?['TimePeriod'], 'custom'), outputs('Build_Custom_Email'), outputs('Build_Snapshot_Email'))"
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

    // --- Unified Snapshot Instructions ---
