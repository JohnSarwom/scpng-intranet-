/**
 * Finds the newest SharePoint revision (ETag) the app knows for a record.
 *
 * Save and delete callbacks are often called from a closure created before an
 * earlier save finished (for example, a follow-up write fired straight after a
 * dialog save). Reading the record from that closure's `query.data` returns the
 * revision from before the first save, so SharePoint's version check rejects
 * the second write as a conflict even though nobody else changed the record.
 *
 * The query cache is updated as soon as a save returns, so it is searched first.
 * The closure's snapshot is only a fallback.
 */
export interface RevisionedRecord {
  id: string | number;
  revision?: string;
}

export function latestKnownRevision(
  id: string | number,
  ...sources: Array<ReadonlyArray<RevisionedRecord> | null | undefined>
): string | undefined {
  const key = String(id);
  for (const source of sources) {
    const match = source?.find(record => String(record.id) === key);
    if (match?.revision) return match.revision;
  }
  return undefined;
}
