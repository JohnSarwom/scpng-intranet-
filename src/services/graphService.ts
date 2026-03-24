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
  if (!msalInstance.getActiveAccount()) {
    const allAccounts = msalInstance.getAllAccounts();
    if (allAccounts.length > 0) {
      msalInstance.setActiveAccount(allAccounts[0]);
    } else {
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

  const scopes = ['Sites.ReadWrite.All', 'Files.ReadWrite.All', 'User.Read.All', 'Mail.Send'];
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

// Singleton promise instance to prevent race conditions during concurrent react renders
let graphClientPromise: Promise<Client | null> | null = null;

/**
 * Initializes and returns a Microsoft Graph client instance.
 * Uses a Promise-based Singleton pattern to prevent concurrent race conditions.
 * @param msalInstance The MSAL public client application instance.
 * @returns A promise that resolves to the Graph client instance, or null if initialization fails.
 */
export const getGraphClient = (msalInstance: IPublicClientApplication): Promise<Client | null> => {
  if (graphClientPromise) {
    return graphClientPromise;
  }

  console.log('🌐 [getGraphClient] Initializing NEW Microsoft Graph client (True Singleton)...');

  graphClientPromise = (async () => {
    try {
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

      // Warm up the token once explicitly if desired, but NOT causing race conditions
      // This ensures we at least have a valid token before returning the client
      await getAccessToken(msalInstance);

      console.log('   ✅ Graph client initialized successfully (Singleton Created)');
      return client;
    } catch (e: any) {
      console.error('❌ [getGraphClient] Failed to initialize Microsoft Graph client');
      console.error('   Error:', e);
      // Reset the promise on failure so subsequent calls can retry
      graphClientPromise = null;
      return null;
    }
  })();

  return graphClientPromise;
};
