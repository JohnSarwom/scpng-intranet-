import { IPublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { FLOW_CONFIG } from './config';

export class PowerAutomateAuth {
    private msalInstance: IPublicClientApplication;

    constructor(msalInstance: IPublicClientApplication) {
        this.msalInstance = msalInstance;
    }

    async getFlowToken(): Promise<string> {
        const account = this.msalInstance.getActiveAccount()
            || this.msalInstance.getAllAccounts()[0];

        if (!account) throw new Error('No authenticated account found');

        try {
            const response = await this.msalInstance.acquireTokenSilent({
                scopes: FLOW_CONFIG.FLOW_SCOPES,
                account,
            });
            return response.accessToken;
        } catch (e) {
            if (e instanceof InteractionRequiredAuthError) {
                const response = await this.msalInstance.acquireTokenPopup({
                    scopes: FLOW_CONFIG.FLOW_SCOPES,
                });
                return response.accessToken;
            }
            throw e;
        }
    }

    async getPowerAppsToken(): Promise<string> {
        const account = this.msalInstance.getActiveAccount()
            || this.msalInstance.getAllAccounts()[0];

        if (!account) throw new Error('No authenticated account found');

        try {
            const response = await this.msalInstance.acquireTokenSilent({
                scopes: FLOW_CONFIG.POWERAPPS_SCOPES,
                account,
            });
            return response.accessToken;
        } catch (e) {
            if (e instanceof InteractionRequiredAuthError) {
                const response = await this.msalInstance.acquireTokenPopup({
                    scopes: FLOW_CONFIG.POWERAPPS_SCOPES,
                });
                return response.accessToken;
            }
            throw e;
        }
    }
}
