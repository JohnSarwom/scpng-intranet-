import { FLOW_CONFIG } from './config';
import { PowerAutomateAuth } from './auth';
import { FlowListItem } from './types';

export class FlowClient {
    private auth: PowerAutomateAuth;

    constructor(auth: PowerAutomateAuth) {
        this.auth = auth;
    }

    async powerAppsFetch(path: string): Promise<any> {
        const token = await this.auth.getPowerAppsToken();
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

    async flowFetch(path: string, options: RequestInit = {}): Promise<any> {
        const token = await this.auth.getFlowToken();
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

    async getFlowDefinition(flowId: string): Promise<any> {
        const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
        const data = await this.flowFetch(`${envPath}/flows/${flowId}?api-version=2016-11-01`);
        return data;
    }

    async deleteFlow(flowName: string): Promise<void> {
        const envPath = `/providers/Microsoft.ProcessSimple/environments/${FLOW_CONFIG.ENVIRONMENT_ID}`;
        await this.flowFetch(`${envPath}/flows/${flowName}?api-version=2016-11-01`, {
            method: 'DELETE',
        });
    }
}
