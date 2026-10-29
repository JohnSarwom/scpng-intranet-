import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { getGraphClient } from '@/services/graphService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isQueuedPilotRead } from '@/lib/newsletterPilotQueue';

type QueueRow = { id: string; fields: Record<string, unknown> };

export default function NewsletterQueueAudit() {
  const { instance } = useMsal();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [reviewed, setReviewed] = useState<QueueRow[]>([]);

  async function inspect() {
    setBusy(true);
    setReviewed([]);
    setResult('Reading the complete queued-request inventory…');
    try {
      const site = import.meta.env.VITE_NEWSLETTER_REQUEST_SITE_ID;
      const list = import.meta.env.VITE_NEWSLETTER_REQUEST_LIST_ID;
      if (!site || !list) throw new Error('Configure the newsletter connection first.');
      const graph = await getGraphClient(instance);
      if (!graph) throw new Error('Sign in to inspect the queue.');
      let next = `/sites/${site}/lists/${list}/items?$expand=fields&$filter=fields/Status eq 'Queued'&$top=500`;
      const rows: QueueRow[] = [];
      const pages = new Set<string>();
      while (next) {
        if (pages.has(next) || rows.length >= 5000) throw new Error('Inventory is incomplete. Keep the Processor off.');
        pages.add(next);
        const page = await graph.api(next).header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly').get();
        rows.push(...page.value);
        next = page['@odata.nextLink'] || '';
      }
      const counts: Record<string, number> = {};
      const review: string[] = [];
      for (const row of rows) {
        const action = String(row.fields.Action || 'missing action');
        counts[action] = (counts[action] || 0) + 1;
        if (!isQueuedPilotRead(row.fields)) review.push(row.id);
      }
      if (!review.length) setReviewed(rows);
      setResult(JSON.stringify({ complete: true, queued: rows.length, actions: counts, requestsNeedingReview: review,
        note: 'Read-only inventory at this moment. No requests, appointments or permissions were changed.' }, null, 2));
    } catch (error) {
      setResult(`Inspection failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  }

  async function holdReviewedReads() {
    setBusy(true);
    const held: string[] = [];
    try {
      const graph = await getGraphClient(instance);
      if (!graph) throw new Error('Sign in to hold test reads.');
      const base = `/sites/${import.meta.env.VITE_NEWSLETTER_REQUEST_SITE_ID}/lists/${import.meta.env.VITE_NEWSLETTER_REQUEST_LIST_ID}/items`;
      for (const row of reviewed) {
        const current = await graph.api(`${base}/${row.id}?$expand=fields`).get();
        if (!isQueuedPilotRead(current.fields) || !current.eTag) throw new Error(`Request ${row.id} changed. Inspect the queue again.`);
        await graph.api(`${base}/${row.id}/fields`).header('If-Match', current.eTag).patch({
          Status: 'PilotHeld', ErrorMessage: 'Old read-only local pilot request held for a fresh controlled test. Record preserved.',
        });
        held.push(row.id);
        setResult(`Held ${held.length} of ${reviewed.length} old test reads. Records are preserved.`);
      }
      setResult(`Held ${held.length} old test reads. No newsletter content, appointments or permissions were changed. Inspect the queue again before running the pilot.`);
    } catch (error) {
      setResult(`Held ${held.length} requests before stopping: ${error instanceof Error ? error.message : String(error)}. Inspect again before continuing.`);
    } finally { setReviewed([]); setBusy(false); }
  }

  return <Card>
    <CardHeader>
      <CardTitle>Newsletter pilot queue review</CardTitle>
      <CardDescription>Read every page of pending requests before running the controlled pilot.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <Button onClick={inspect} disabled={busy}>{busy ? 'Inspecting queue…' : 'Inspect queued newsletter requests'}</Button>
      <Button variant="outline" onClick={holdReviewedReads} disabled={busy || !reviewed.length}>Hold reviewed old test reads</Button>
      {result && <pre role="status" className="whitespace-pre-wrap text-sm">{result}</pre>}
    </CardContent>
  </Card>;
}
