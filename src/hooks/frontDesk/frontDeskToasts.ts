import { toast } from 'sonner';
import { FrontDeskConflictError, FrontDeskListMissingError } from '@/services/frontDesk/frontDeskGraph';

/** The one message style for Front Desk saves and failures. */
export function frontDeskSaved(message: string) {
  toast.success(message);
}

/** On a FrontDeskConflictError the caller must also reload the record (invalidate its query). */
export function frontDeskFailed(action: string, error: unknown) {
  const detail = error instanceof FrontDeskListMissingError
    ? `${error.listName} has not been set up yet. An administrator can create it from TestGround → Front Desk Lists Setup.`
    : error instanceof FrontDeskConflictError
      ? 'Someone else changed this record. It has been reloaded; check it and try again.'
      : error instanceof Error ? error.message : String(error);
  console.error(`[FrontDesk] ${action} failed`, error);
  toast.error(`Could not ${action}`, { description: detail });
}
