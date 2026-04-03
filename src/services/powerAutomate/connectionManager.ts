import { FlowConnection, FlowConnections } from './types';
import { FlowClient } from './flowClient';

export class ConnectionManager {
    private client: FlowClient;

    constructor(client: FlowClient) {
        this.client = client;
    }

    /**
     * Lists connections by scanning connectionReferences across all deployed flows.
     * This avoids the PowerApps/Flow connections list API which requires admin roles.
     */
    async listConnections(): Promise<FlowConnection[]> {
        const flows = await this.client.listFlows();
        const seen = new Map<string, FlowConnection>();

        // Scan up to 20 flows to collect connection names
        const toScan = flows.slice(0, 20);
        await Promise.all(toScan.map(async (flow) => {
            try {
                const def = await this.client.getFlowDefinition(flow.name);
                const refs: Record<string, any> = def?.properties?.connectionReferences || {};
                for (const [, ref] of Object.entries(refs)) {
                    const name   = ref.connectionName as string;
                    const apiId  = ref.id || ref.api?.id || '';
                    if (name && !seen.has(name)) {
                        seen.set(name, {
                            name,
                            id: apiId,
                            displayName: name,
                            apiId,
                            status: 'Connected',
                        });
                    }
                }
            } catch {
                // Skip flows we can't read
            }
        }));

        return Array.from(seen.values());
    }

    async findConnections(): Promise<FlowConnections> {
        const connections = await this.listConnections();

        const spConn = connections.find(c => c.apiId.includes('shared_sharepointonline'));
        const mailConn = connections.find(c => c.apiId.includes('shared_office365'));
        const sheetsConn = connections.find(c => c.apiId.includes('shared_googlesheet'));

        if (!spConn) throw new Error(
            'No SharePoint connection found. Make sure at least one flow using a SharePoint action exists in Power Automate.'
        );
        if (!mailConn) throw new Error(
            'No Office 365 connection found. Make sure at least one flow using a Send Email action exists in Power Automate.'
        );
        if (!sheetsConn) throw new Error(
            'No Google Sheets connection found. Make sure the test flow you created with the Google Sheets "Get rows" action is saved in Power Automate.'
        );

        return {
            sharepoint:   spConn.name,
            office365:    mailConn.name,
            googlesheets: sheetsConn.name,
        };
    }
}
