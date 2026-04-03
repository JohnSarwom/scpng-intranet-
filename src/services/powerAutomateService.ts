/**
 * Power Automate Service
 *
 * Orchestrator facade built on top of the modularised powerAutomate/ directory.
 * Now deploys two flows (Dispatch + Send) instead of one.
 */
import { IPublicClientApplication } from '@azure/msal-browser';
import { PowerAutomateAuth } from './powerAutomate/auth';
import { FlowClient } from './powerAutomate/flowClient';
import { ConnectionManager } from './powerAutomate/connectionManager';
import { buildDispatchFlowDefinition, buildSendFlowDefinition } from './powerAutomate/flowActions';
import { FLOW_CONFIG } from './powerAutomate/config';
import { DeployResult, DeployAllResult, FlowListItem, FlowConnection } from './powerAutomate/types';

export type { FlowListItem, FlowConnection, DeployResult, DeployAllResult };

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

    async listConnections(): Promise<FlowConnection[]> {
        return this.configManager.listConnections();
    }

    // ── Finders ────────────────────────────────────────────────────────────────

    async findExistingDispatchFlow(): Promise<FlowListItem | null> {
        const flows = await this.listFlows();
        return flows.find(f => f.displayName === FLOW_CONFIG.DISPATCH_FLOW_NAME) || null;
    }

    async findExistingSendFlow(): Promise<FlowListItem | null> {
        const flows = await this.listFlows();
        return flows.find(f => f.displayName === FLOW_CONFIG.SEND_FLOW_NAME) || null;
    }

    /** @deprecated Use findExistingDispatchFlow */
    async findExistingReportFlow(): Promise<FlowListItem | null> {
        const flows = await this.listFlows();
        return (
            flows.find(f => f.displayName === FLOW_CONFIG.DISPATCH_FLOW_NAME) ||
            flows.find(f => f.displayName === FLOW_CONFIG.REPORT_FLOW_NAME) ||
            null
        );
    }

    // ── Deployers ──────────────────────────────────────────────────────────────

    private async deployFlow(
        definition: object,
        displayName: string,
        existingFlow: FlowListItem | null
    ): Promise<DeployResult> {
        if (existingFlow) {
            return {
                success: true,
                flowId: existingFlow.name,
                flowName: existingFlow.displayName,
                message: `Flow already exists (${existingFlow.state}). Delete it first to redeploy.`,
            };
        }

        const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
        const result = await this.client.flowFetch(`${envPath}/flows?api-version=2016-11-01`, {
            method: 'POST',
            body: JSON.stringify(definition),
        });

        return {
            success: true,
            flowId: result.name,
            flowName: displayName,
            message: `${displayName} deployed successfully!`,
        };
    }

    async deployDispatchFlow(): Promise<DeployResult> {
        try {
            const existing = await this.findExistingDispatchFlow();
            const connections = await this.configManager.findConnections();
            const definition = buildDispatchFlowDefinition(connections, FLOW_CONFIG.SPREADSHEET_ID);
            return await this.deployFlow(definition, FLOW_CONFIG.DISPATCH_FLOW_NAME, existing);
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to deploy Dispatch flow', error: e };
        }
    }

    async deploySendFlow(): Promise<DeployResult> {
        try {
            const existing = await this.findExistingSendFlow();
            const connections = await this.configManager.findConnections();
            const definition = buildSendFlowDefinition(connections, FLOW_CONFIG.SPREADSHEET_ID);
            return await this.deployFlow(definition, FLOW_CONFIG.SEND_FLOW_NAME, existing);
        } catch (e: any) {
            return { success: false, message: e.message || 'Failed to deploy Send flow', error: e };
        }
    }

    /**
     * Deploys both flows in sequence. If the Dispatch flow fails the Send
     * flow is still attempted so the caller gets a full picture of what happened.
     */
    async deployReportSchedulerFlow(): Promise<DeployAllResult> {
        const dispatch = await this.deployDispatchFlow();
        const send = await this.deploySendFlow();
        return {
            dispatch,
            send,
            overallSuccess: dispatch.success && send.success,
        };
    }
}
