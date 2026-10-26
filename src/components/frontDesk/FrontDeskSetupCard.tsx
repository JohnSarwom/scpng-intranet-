import React, { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { ConciergeBell, Loader2, Search, Wrench } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getGraphClient } from '@/services/graphService';
import {
  ensureFrontDeskLists,
  type FrontDeskSetupResult,
  type FrontDeskSetupStatus,
} from '@/services/frontDesk/frontDeskListSetup';

const statusStyle: Record<FrontDeskSetupStatus, { label: string; className: string }> = {
  ok: { label: 'Ready', className: 'bg-green-100 text-green-800 border-green-200' },
  missing: { label: 'Missing', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  'needs-update': { label: 'Needs update', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  created: { label: 'Created', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  updated: { label: 'Updated', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-200' },
};

const detail = (result: FrontDeskSetupResult) => {
  if (result.error) return result.error;
  const parts: string[] = [];
  if (result.status === 'missing' || result.status === 'created') {
    const count = result.addedColumns.length;
    parts.push(result.kind === 'library' ? 'Document library' : `${count} column${count === 1 ? '' : 's'}`);
  } else if (result.addedColumns.length) {
    parts.push(`Columns: ${result.addedColumns.join(', ')}`);
  }
  if (result.indexedColumns.length) parts.push(`Index: ${result.indexedColumns.join(', ')}`);
  return parts.join(' · ');
};

/** TestGround card: check, then create or repair, the SharePoint lists the Front Desk module uses. */
export const FrontDeskSetupCard: React.FC = () => {
  const { instance } = useMsal();
  const { toast } = useToast();
  const [running, setRunning] = useState<'check' | 'apply' | null>(null);
  const [results, setResults] = useState<FrontDeskSetupResult[] | null>(null);

  const run = async (mode: 'check' | 'apply') => {
    setRunning(mode);
    try {
      const client = await getGraphClient(instance);
      if (!client) throw new Error('Could not connect to Microsoft 365. Please sign in again.');
      const next = await ensureFrontDeskLists(client, { dryRun: mode === 'check' });
      setResults(next);
      const failed = next.filter(r => r.status === 'failed').length;
      toast({
        title: failed ? `${failed} item${failed === 1 ? '' : 's'} failed` : mode === 'check' ? 'Check complete' : 'Front Desk lists are ready',
        description: failed ? 'See the table for the SharePoint error.' : undefined,
        variant: failed ? 'destructive' : undefined,
      });
    } catch (error) {
      toast({ title: 'Front Desk setup failed', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally {
      setRunning(null);
    }
  };

  return (
    <Card className="border-2 border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ConciergeBell className="h-5 w-5 text-amber-600" />
          Front Desk Lists Setup
        </CardTitle>
        <CardDescription>
          The eight SharePoint lists and the visitor photo library behind the Front Desk module.
          Check is read-only. Create / repair only adds what is missing, so it is safe to run again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => run('check')} disabled={!!running} className="gap-2">
            {running === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Check
          </Button>
          <Button onClick={() => run('apply')} disabled={!!running} className="gap-2 bg-amber-600 hover:bg-amber-700">
            {running === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            Create / repair
          </Button>
        </div>

        {results && (
          <div className="rounded-lg border divide-y text-sm">
            {results.map(result => (
              <div key={result.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="font-medium min-w-[14rem]">{result.name}</span>
                <Badge variant="outline" className={statusStyle[result.status].className}>{statusStyle[result.status].label}</Badge>
                <span className="text-xs text-muted-foreground">{detail(result)}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          After creating them, restrict FrontDesk_Visitors, FrontDesk_Appointments, FrontDesk_MailPackages and the
          photo library to the front desk group, admins and automation@ in SharePoint (plan decisions D10 and D12).
          Hiding buttons in the app does not stop site members opening the lists.
        </p>
      </CardContent>
    </Card>
  );
};

export default FrontDeskSetupCard;
