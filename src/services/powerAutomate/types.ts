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
