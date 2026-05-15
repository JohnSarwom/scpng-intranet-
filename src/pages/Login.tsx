import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from '@/integrations/microsoft/msalConfig';

export default function Login() {
  const navigate = useNavigate();
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fallback: if the user lands on /login already authenticated (e.g. MSAL navigated back
  // here after a redirect), send them to the saved target via React Router (no page reload).
  useEffect(() => {
    if (isAuthenticated && inProgress === InteractionStatus.None) {
      const target = sessionStorage.getItem('auth_return_to') ?? '/';
      sessionStorage.removeItem('auth_return_to');
      const dest = (target && target !== '/login') ? target : '/';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, inProgress]);

  const handleMicrosoftLogin = async () => {
    if (inProgress !== InteractionStatus.None || isRedirecting) return;
    setIsRedirecting(true);
    setError(null);

    try {
      // loginRedirect navigates the full page to Microsoft — the promise never resolves.
      // After auth, Microsoft redirects back to the app root, MsalProvider processes the
      // tokens, and AppRoutes navigates to the saved auth_return_to target.
      await instance.loginRedirect({
        ...loginRequest,
        redirectUri: window.location.origin + '/',
      });
    } catch (msalError: any) {
      logger.error('MSAL loginRedirect error', msalError);
      setIsRedirecting(false);
      setError(msalError.message || 'An error occurred during Microsoft sign-in.');
    }
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-3 text-sm">
        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
        <div>
          <p className="text-red-700 font-medium">Login Error</p>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#400010] p-4">
      <Card className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <img
              src="/images/SCPNG Original Logo.png"
              alt="SCPNG Logo"
              className="w-24 h-auto mb-4"
            />
            <h1 className="text-2xl font-semibold text-center text-gray-800 mb-1">SCPNG Intranet Portal</h1>
            <p className="text-gray-500 text-sm text-center">Sign in to access the portal</p>
          </div>

          {renderError()}

          <Button
            variant="outline"
            className="w-full mt-6 bg-white border-gray-300 hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-2"
            onClick={handleMicrosoftLogin}
            disabled={inProgress !== InteractionStatus.None || isRedirecting}
          >
            {isRedirecting || inProgress !== InteractionStatus.None ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z" /><path fill="#00a4ef" d="M1 11h9v9H1z" /><path fill="#7fba00" d="M11 1h9v9h-9z" /><path fill="#ffb900" d="M11 11h9v9h-9z" /></svg>
            )}
            <span>Sign in with Microsoft</span>
          </Button>

          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-center text-gray-500">
              Authorized personnel only. &copy; SCPNG Intranet Portal {new Date().getFullYear()}
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
