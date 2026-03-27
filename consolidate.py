import sys
import re

with open('src/services/powerAutomate/flowActions.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Fix Compute_Custom_Start and Compute_Custom_End defaults to prevent invalid date errors
text = text.replace(")), '')\"", ")), '1970-01-01T00:00:00Z')\"", 1)
text = text.replace(")), '')\"", ")), '2099-12-31T23:59:59Z')\"", 1)

# 2. Delete lines for Filter_Custom_* (12 independent queries)
text = re.sub(r'// --- Custom Status Filters.*?// --- Task Metrics ---', '// --- Task Metrics ---', text, flags=re.DOTALL)

# 3. Add Compute_Base_* Compose nodes before // --- Task Metrics ---
base_nodes = """// --- Base Arrays (Unifies Custom and Standard Snapshot) ---
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

                                // --- Task Metrics ---"""
text = text.replace('// --- Task Metrics ---', base_nodes)

# 4. Modify dependencies and references for standard filters
text = text.replace('runAfter: { "Get_Tasks": ["Succeeded"] }', 'runAfter: { "Compute_Base_Tasks": ["Succeeded"] }')
text = text.replace('runAfter: { "Get_KRAs": ["Succeeded"] }', 'runAfter: { "Compute_Base_KRAs": ["Succeeded"] }')
text = text.replace('runAfter: { "Get_KPIs": ["Succeeded"] }', 'runAfter: { "Compute_Base_KPIs": ["Succeeded"] }')

text = text.replace("body('Get_Tasks')?['value']", "outputs('Compute_Base_Tasks')")
text = text.replace("body('Get_KRAs')?['value']", "outputs('Compute_Base_KRAs')")
text = text.replace("body('Get_KPIs')?['value']", "outputs('Compute_Base_KPIs')")

# 5. Fix dependencies for AI Prompt
custom_deps = """                                    runAfter: {
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
                                    },"""
text = re.sub(r'runAfter: \{\s*"Compute_Custom_Task_Metrics": \["Succeeded"\].*?"Compute_Custom_End": \["Succeeded"\]\s*\},', custom_deps, text, flags=re.DOTALL)

# 6. Fix dependencies for Email Output
email_deps = """                                    runAfter: {
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
                                    },"""
text = re.sub(r'runAfter: \{\s*"Extract_AI_Response": \["Succeeded"\],\s*"Filter_Tasks_InDateRange": \["Succeeded"\],\s*"Filter_Custom_Completed_Tasks".*?"Compute_Custom_End": \["Succeeded"\]\s*\},', email_deps, text, flags=re.DOTALL)

with open('src/services/powerAutomate/flowActions.ts', 'w', encoding='utf-8') as f:
    f.write(text)

# 7. Modify aiPrompts.ts and customEmail.ts strings
def update_templates(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace("Filter_Custom_", "Filter_")
    content = content.replace("Compute_Custom_Task_Metrics", "Compute_Task_Metrics")
    content = content.replace("Compute_Custom_KRA_Metrics", "Compute_KRA_Metrics")
    content = content.replace("Compute_Custom_KPI_Metrics", "Compute_KPI_Metrics")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

update_templates('src/services/powerAutomate/templates/aiPrompts.ts')
update_templates('src/services/powerAutomate/templates/customEmail.ts')

print("Refactor complete! Payload AST size successfully reduced.")
