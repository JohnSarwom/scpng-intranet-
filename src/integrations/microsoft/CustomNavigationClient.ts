import { NavigationClient, NavigationOptions } from '@azure/msal-browser';
import { NavigateFunction } from 'react-router-dom';

/**
 * Overrides MSAL's default internal navigation (window.location, full page reload)
 * with React Router's navigate so the component tree and MSAL context stay alive
 * through the post-login redirect. This is the Microsoft-recommended pattern for
 * React SPAs:
 * https://learn.microsoft.com/en-us/entra/msal/javascript/react/performance
 */
export class CustomNavigationClient extends NavigationClient {
  private navigate: NavigateFunction;

  constructor(navigate: NavigateFunction) {
    super();
    this.navigate = navigate;
  }

  async navigateInternal(url: string, options: NavigationOptions): Promise<boolean> {
    const relativePath = url.replace(window.location.origin, '');

    if (options.noHistory) {
      this.navigate(relativePath, { replace: true });
    } else {
      this.navigate(relativePath);
    }

    // Returning false tells MSAL we handled the navigation ourselves
    return false;
  }
}
