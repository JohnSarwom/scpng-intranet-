import { FLOW_CONFIG } from './config';
import { FlowConnection } from './types';
import { FlowClient } from './flowClient';

export class ConnectionManager {
    private client: FlowClient;

    constructor(client: FlowClient) {
        this.client = client;
    }

    async listConnections(): Promise<FlowConnection[]> {
        const data = await this.client.powerAppsFetch(
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

    async findConnections(): Promise<{ sharepoint: string; office365: string }> {
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
}
