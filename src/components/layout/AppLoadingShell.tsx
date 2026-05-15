import React from 'react';
import { Loader2 } from 'lucide-react';

interface AppLoadingShellProps {
  title?: string;
  message?: string;
}

const AppLoadingShell: React.FC<AppLoadingShellProps> = ({
  title = 'SCPNG Intranet',
  message = 'Preparing your workspace...',
}) => {
  return (
    <div className="min-h-screen bg-[#400010] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-[#d4a62a]/40 bg-white p-7 text-center shadow-2xl">
        <img
          src="/images/SCPNG Original Logo.png"
          alt="SCPNG Logo"
          className="mx-auto mb-4 h-20 w-auto"
        />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#9b7a18]">
          Securities Commission
        </p>
        <h1 className="mt-2 text-xl font-bold text-[#2a0008]">{title}</h1>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-[#7a1020]" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
};

export default AppLoadingShell;
