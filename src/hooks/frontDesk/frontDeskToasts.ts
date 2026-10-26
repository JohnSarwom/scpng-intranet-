import { toast } from 'sonner';
import { FrontDeskListMissingError } from '@/services/frontDesk/frontDeskGraph';

/** The one message style for Front Desk saves and failures. */
export function frontDeskSaved(message: string) {
  toast.success(message);
}

export function frontDeskFailed(action: string, error: unknown) {
  const detail = error instanceof FrontDeskListMissingError
    ? `${error.listName} has not been set up yet. An administrator can create it from TestGround → Front Desk Lists Setup.`
    : error instanceof Error ? error.message : String(error);
  console.error(`[FrontDesk] ${action} failed`, error);
  toast.error(`Could not ${action}`, { description: detail });
}
