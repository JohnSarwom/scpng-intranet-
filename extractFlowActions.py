import re
import sys

with open('src/services/powerAutomateService.ts', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.search(r'(private buildReportSchedulerDefinition.*?)\n    private getAIInstructionsExpression', text, re.DOTALL)
if not pattern:
    print('Could not extract buildReportSchedulerDefinition')
    sys.exit(1)

content = pattern.group(1).strip()
content = content.replace('private buildReportSchedulerDefinition', 'export function buildReportSchedulerDefinition')
content = content.replace('this.getAIInstructionsExpression()', 'getAIInstructionsExpression()')
content = content.replace('this.buildSnapshotAIPromptExpression()', 'buildSnapshotAIPromptExpression()')
content = content.replace('this.buildCustomAIPromptExpression()', 'buildCustomAIPromptExpression()')
content = content.replace('this.buildSnapshotEmailTemplate()', 'buildSnapshotEmailTemplate()')
content = content.replace('this.buildCustomEmailTemplate()', 'buildCustomEmailTemplate()')

header = """import { FLOW_CONFIG } from './config';
import { getAIInstructionsExpression, buildSnapshotAIPromptExpression, buildCustomAIPromptExpression } from './templates/aiPrompts';
import { buildSnapshotEmailTemplate } from './templates/snapshotEmail';
import { buildCustomEmailTemplate } from './templates/customEmail';

"""

with open('src/services/powerAutomate/flowActions.ts', 'w', encoding='utf-8') as f:
    f.write(header + content + '\n')

print('Successfully created flowActions.ts')
