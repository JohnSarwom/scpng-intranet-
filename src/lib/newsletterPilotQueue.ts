/** Only these unprocessed, inline read requests may be held during a pilot. */
export function isQueuedPilotRead(fields: Record<string, unknown>): boolean {
  if (fields.Status !== 'Queued' || fields.PartCount !== 0 ||
    !['routing_admin_get', 'notifications'].includes(String(fields.Action))) return false;
  try { return JSON.parse(String(fields.InputText))?.action === fields.Action; }
  catch { return false; }
}
