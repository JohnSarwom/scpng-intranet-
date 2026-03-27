/**
 * Power Automate Service
 * 
 * Orchestrator facade built on top of the modularized powerAutomate/ directory.
 */
import { IPublicClientApplication } from '@azure/msal-browser';
import { PowerAutomateAuth } from './powerAutomate/auth';
import { FlowClient } from './powerAutomate/flowClient';
import { ConnectionManager } from './powerAutomate/connectionManager';
import { buildReportSchedulerDefinition } from './powerAutomate/flowActions';
import { FLOW_CONFIG } from './powerAutomate/config';
import { DeployResult, FlowListItem, FlowConnection } from './powerAutomate/types';

export type { FlowListItem, FlowConnection, DeployResult };

export class PowerAutomateService {
    private auth: PowerAutomateAuth;
    private client: FlowClient;
    private configManager: ConnectionManager;

    constructor(msalInstance: IPublicClientApplication) {
        this.auth = new PowerAutomateAuth(msalInstance);
        this.client = new FlowClient(this.auth);
        this.configManager = new ConnectionManager(this.client);
    }

    async listFlows(): Promise<FlowListItem[]> {
        return this.client.listFlows();
    }

    async getFlowDefinition(flowId: string): Promise<any> {
        return this.client.getFlowDefinition(flowId);
    }

    async deleteFlow(flowName: string): Promise<void> {
        return this.client.deleteFlow(flowName);
    }

    async findExistingReportFlow(): Promise<FlowListItem | null> {
        const flows = await this.listFlows();
        return flows.find(f => f.displayName === FLOW_CONFIG.REPORT_FLOW_NAME) || null;
    }

    async listConnections(): Promise<FlowConnection[]> {
        return this.configManager.listConnections();
    }

    async deployReportSchedulerFlow(): Promise<DeployResult> {
        try {
            const existing = await this.findExistingReportFlow();
            if (existing) {
                return {
                    success: true,
                    flowId: existing.name,
                    flowName: existing.displayName,
                    message: `Flow already exists (${existing.state}). Delete it first to redeploy.`,
                };
            }

            const connections = await this.configManager.findConnections();
            const flowDefinition = buildReportSchedulerDefinition(connections);

            const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
            const result = await this.client.flowFetch(`${envPath}/flows?api-version=2016-11-01`, {
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
}
