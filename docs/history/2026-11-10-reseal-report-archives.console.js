// RECORD: this is the exact script run on 10 November 2026 (see 2026-11-10-strategy-fixes-live-verification-handover.md).
// Its guards stop it from running again on these items. To repair another pre-fix archive, change
// ARCHIVE_IDS and EXPECTED_OLD below. It is not part of the application build.
//
// Re-seal the two Research Unit report archives (Performance_Reports items 4 and 5)
// and their linked print/download log entries (items 6-11).
//
// Why: both archives were saved on 2026-11-09 by the old checksum code, which hashed Dates as {}
// and missing fields as the text "undefined". The stored JSON can never match that checksum, and
// one failing archive stops report history and Strategy/Division AI from loading. This replaces
// only the stored checksum value in each item with one computed by the fixed code (PR #19).
//
// Run it in the browser console of http://localhost:8080/division (the Vite dev server running
// main). Wait until the Division page has fully loaded first: the script reuses the page's
// Microsoft Graph client. Changes are made as whoever is signed in on that page.
//
// Safety:
// - Read-only checks run first and stop the script if anything is unexpected (including a second run).
// - Nothing is written until you click OK in the confirmation dialog.
// - Each item is re-read just before it is saved, and saved only if nobody changed it since (If-Match).
// - SharePoint version history keeps the previous text, so each item can be restored there.

(async () => {
  const ARCHIVE_IDS = ['4', '5'];
  // Start of the current (broken) checksum for each archived snapshot: a guard against
  // running this on anything other than the two records it was written for.
  const EXPECTED_OLD = {
    'strategy-report:unit:2026-11-09T09:23:16.446Z': 'a72bcd209309',
    'strategy-report:unit:2026-11-09T09:23:33.793Z': 'a4cb5bf27c49',
  };

  const stop = (message) => { console.error(`Re-seal stopped: ${message}`); throw new Error(message); };

  // Same canonical form as canonicalJson() in src/services/strategyReportArchiveService.ts after PR #19.
  const canonicalJson = (value) => {
    if (value === undefined) return 'null';
    if (value !== null && typeof value.toJSON === 'function') return canonicalJson(value.toJSON());
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  };
  const sha256 = async (value) => [...new Uint8Array(await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(canonicalJson(value)),
  ))].map((part) => part.toString(16).padStart(2, '0')).join('');

  const graph = await import('/src/services/graphService.ts');
  const ops = await import('/src/services/sharePointOpsService.ts');
  const archiveModule = await import('/src/services/strategyReportArchiveService.ts');

  const client = await graph.getGraphClient(null);
  if (!client) stop('the page has no Graph client yet. Open /division, wait for it to load, then run this again.');
  const service = new ops.SharePointOpsService(client);
  await service.initialize();
  const listId = service.listIds.REPORTS;
  if (!listId) stop('the Performance_Reports list was not found.');
  const itemsUrl = `/sites/${service.siteId}/lists/${listId}/items`;

  // ---- 1. Plan (read-only) -------------------------------------------------------------------
  const reports = await service.getReports(200);
  const archives = reports.filter((r) => r.template_id === 'strategy-report-archive-v1' && r.content?.archive);
  const deliveries = reports.filter((r) => r.template_id === 'strategy-report-delivery-v1' && r.content?.delivery);

  const checksums = {}; // snapshotId -> { old, next }
  const resealed = {};  // snapshotId -> archive record with the new checksum (in memory only)
  for (const id of ARCHIVE_IDS) {
    const report = archives.find((r) => String(r.id) === id);
    if (!report) stop(`archive item ${id} was not found.`);
    const archive = structuredClone(report.content.archive);
    const expected = EXPECTED_OLD[archive.snapshotId];
    if (!expected) stop(`item ${id} holds an unexpected snapshot (${archive.snapshotId}).`);
    if (!archive.snapshotChecksum.startsWith(expected)) {
      stop(`item ${id} no longer has the expected old checksum. It may already be re-sealed; nothing was changed.`);
    }
    const old = archive.snapshotChecksum;
    archive.snapshotChecksum = await sha256(archive.snapshot);
    await archiveModule.verifyStrategyReportArchive(archive, id); // the app's own check must pass
    checksums[archive.snapshotId] = { old, next: archive.snapshotChecksum };
    resealed[archive.snapshotId] = archive;
  }

  const linkedDeliveries = [];
  for (const report of deliveries) {
    const delivery = structuredClone(report.content.delivery);
    const pair = checksums[delivery.snapshotId];
    if (!pair) continue;
    if (delivery.snapshotChecksum !== pair.old) stop(`log entry ${report.id} points at an unexpected checksum.`);
    delivery.snapshotChecksum = pair.next;
    await archiveModule.verifyStrategyReportDeliveryRecord(delivery, resealed[delivery.snapshotId], report.id);
    linkedDeliveries.push(report);
  }

  // Simulate the full archive history with the re-sealed records, as an administrator would see it.
  const simulatedStore = {
    async list() {
      return archives.map((r) => ({
        storageId: r.id,
        record: resealed[r.content.archive.snapshotId] || r.content.archive,
      }));
    },
    async listDeliveries(snapshotIds) {
      return deliveries.map((r) => {
        const delivery = structuredClone(r.content.delivery);
        const pair = checksums[delivery.snapshotId];
        if (pair && delivery.snapshotChecksum === pair.old) delivery.snapshotChecksum = pair.next;
        return { storageId: r.id, record: delivery };
      }).filter((item) => snapshotIds.includes(item.record.snapshotId));
    },
    async append() { throw new Error('dry run'); },
    async appendDelivery() { throw new Error('dry run'); },
  };
  const simulated = await new archiveModule.StrategyReportArchiveService(simulatedStore, {
    async current() { return { email: 'dry-run@scpng.gov.pg', role: 'admin', isAdmin: true }; },
  }).history(100);

  const targets = [
    ...ARCHIVE_IDS.map((id) => ({ id, kind: 'report archive', snapshotId: archives.find((r) => String(r.id) === id).content.archive.snapshotId })),
    ...linkedDeliveries.map((r) => ({ id: String(r.id), kind: `log entry (${r.content.delivery.event?.channel})`, snapshotId: r.content.delivery.snapshotId })),
  ];
  console.log(`Dry run passed: ${simulated.length} archive(s) load after re-sealing.`);
  console.table(targets.map((t) => ({
    item: t.id, kind: t.kind,
    oldChecksum: checksums[t.snapshotId].old.slice(0, 12),
    newChecksum: checksums[t.snapshotId].next.slice(0, 12),
  })));

  // ---- 2. Confirm ----------------------------------------------------------------------------
  const go = window.confirm(
    `Re-seal ${targets.length} Performance_Reports items (${targets.map((t) => t.id).join(', ')})?\n\n` +
    'Only the stored checksum value in each item changes. SharePoint keeps the previous version.',
  );
  if (!go) { console.log('Cancelled. Nothing was changed.'); return; }

  // ---- 3. Write (only the checksum value, guarded by If-Match) --------------------------------
  const results = [];
  for (const target of targets) {
    const { old, next } = checksums[target.snapshotId];
    try {
      const item = await client.api(`${itemsUrl}/${target.id}`).expand('fields').get();
      const text = item.fields.ContentJSON;
      const occurrences = text.split(old).length - 1;
      if (occurrences !== 1) { results.push({ item: target.id, result: `skipped: old checksum found ${occurrences} times` }); continue; }
      const updated = text.replace(old, next);
      const parsed = JSON.parse(updated);
      const stored = (parsed.archive || parsed.delivery)?.snapshotChecksum;
      if (stored !== next) { results.push({ item: target.id, result: 'skipped: the value is not in the expected field' }); continue; }
      await client.api(`${itemsUrl}/${target.id}`).header('If-Match', item.eTag).patch({ fields: { ContentJSON: updated } });
      results.push({ item: target.id, result: 'updated' });
    } catch (error) {
      results.push({ item: target.id, result: `failed: ${error?.message || error}` });
    }
  }
  console.table(results);

  // ---- 4. Check the real archive history as the signed-in user -------------------------------
  try {
    const history = await archiveModule.createSharePointStrategyReportArchiveService(service).history(100);
    console.log(`Archive history now loads: ${history.length} archive(s) visible to you, every checksum verified.`);
  } catch (error) {
    console.error('Archive history still fails:', error?.message || error);
  }
})();
