import { Client } from '@microsoft/microsoft-graph-client';
import { IPublicClientApplication, InteractionStatus, InteractionRequiredAuthError, AccountInfo } from '@azure/msal-browser';
import { Logger } from '@/utils/logger';

/**
 * Acquires an access token for Microsoft Graph.
 * Handles silent acquisition and falls back to popup if needed.
 * @param msalInstance The MSAL public client application instance.
 * @returns A promise that resolves to the access token.
 */
export const getAccessToken = async (msalInstance: IPublicClientApplication): Promise<string> => {
  console.log('🔐 [getAccessToken] Starting token acquisition...');

  if (msalInstance.getActiveAccount()) {
    console.log('   ✅ Active account found:', msalInstance.getActiveAccount()?.username);
  } else {
    console.log('   ⚠️  No active account, checking all accounts...');
    const allAccounts = msalInstance.getAllAccounts();
    if (allAccounts.length > 0) {
      console.log(`   ✅ Found ${allAccounts.length} account(s), setting first as active`);
      console.log('   Account:', allAccounts[0].username);
      msalInstance.setActiveAccount(allAccounts[0]);
    } else {
      console.error('   ❌ No accounts found!');
      console.error('   ❌ No accounts found!'); // Keep console.error for errors
      throw new Error('No MSAL accounts found. Please log in.');
    }
  }

  // Note: We can't check interaction status here as it's handled by the hook
  // The MSAL instance doesn't have getInProgress() method
  // Interaction status should be checked in the React component using useMsal hook

  const activeAccount = msalInstance.getActiveAccount();
  if (!activeAccount) {
    console.error('   ❌ No active account after check'); // Keep console.error for errors
    throw new Error('No active MSAL account found.');
  }

  const scopes = ['Sites.ReadWrite.All', 'Files.ReadWrite.All', 'User.Read.All'];
  Logger.debug('   📋 Requesting scopes:', scopes.join(', '));

  try {
    Logger.debug('   🔄 Attempting silent token acquisition...');
    const response = await msalInstance.acquireTokenSilent({
      scopes,
      account: activeAccount,
    });
    Logger.debug('   ✅ Token acquired silently');
    return response.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      Logger.debug('   ⚠️  Silent acquisition failed, showing popup...');
      const response = await msalInstance.acquireTokenPopup({ scopes });
      console.log('   ✅ Token acquired via popup');
      return response.accessToken;
    }
    console.error('   ❌ Token acquisition failed:', e);
    throw e;
  }
};

// Singleton instance
let graphClientInstance: Client | null = null;

/**
 * Initializes and returns a Microsoft Graph client instance.
 * Uses a Singleton pattern to reuse the client.
 * @param msalInstance The MSAL public client application instance.
 * @returns A promise that resolves to the Graph client instance, or null if initialization fails.
 */
export const getGraphClient = async (msalInstance: IPublicClientApplication): Promise<Client | null> => {
  if (graphClientInstance) {
    // console.log('🔄 [getGraphClient] Returning existing singleton instance');
    return graphClientInstance;
  }

  try {
    console.log('🌐 [getGraphClient] Initializing NEW Microsoft Graph client...');

    // Initialize with a dynamic authProvider that fetches the token on each request
    const client = Client.init({
      authProvider: async (done) => {
        try {
          // Fetch a fresh token for every request to handle expiry automatically
          const accessToken = await getAccessToken(msalInstance);
          done(null, accessToken);
        } catch (error) {
          console.error('❌ [GraphClient] AuthProvider failed to get token:', error);
          done(error as Error, null);
        }
      },
    });

    // Test the token/connection once before returning (optional but good for debugging)
    // We can skip the strict check to be faster, or do a quick internal check.
    // For now, let's just assume if init worked, it's good. 
    // We can trigger a token fetch to verify auth if needed, but getAccessToken inside provider will do it on first call.

    // To be safe and compatible with previous behavior that logged the token status:
    await getAccessToken(msalInstance);

    graphClientInstance = client;
    console.log('   ✅ Graph client initialized successfully (Singleton Created)');
    return client;
  } catch (e: any) {
    console.error('❌ [getGraphClient] Failed to initialize Microsoft Graph client');
    console.error('   Error:', e);
    // Optionally, use a logging service or toast notification here
    return null;
  }
};
