import { ChristmasListNotReadyError } from './christmasEventService';

const KEPT = 'Your answers are kept on this computer.';

/**
 * Turns a failed save into a message an officer can act on. Graph errors carry
 * an HTTP statusCode (-1 when the request never got a reply).
 */
export function describeSaveError(err: unknown, online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine): string {
  const e = (err ?? {}) as { statusCode?: number; name?: string; message?: string; code?: string; errorCode?: string };
  const status = typeof e.statusCode === 'number' ? e.statusCode : undefined;
  const text = `${e.name ?? ''} ${e.code ?? ''} ${e.errorCode ?? ''} ${e.message ?? ''}`;

  if (err instanceof ChristmasListNotReadyError) {
    return `The Christmas list isn't set up yet, so your answers couldn't be saved. Please let IT know. ${KEPT}`;
  }
  if (/InteractionRequired|interaction_required|login_required|consent_required|BrowserAuthError|token/i.test(text) && status !== 403) {
    return `Your sign-in has expired. Refresh the page, sign in again, then press Submit. ${KEPT}`;
  }
  if (status === 401 || status === 403) {
    return `You don't have permission to save to the Christmas list yet. Please let IT know. ${KEPT}`;
  }
  if (status === 429 || status === 503 || status === 504) {
    return `SharePoint is busy right now. Please wait a minute and press Submit again. ${KEPT}`;
  }
  if (!online || status === -1 || status === 0 || /Failed to fetch|NetworkError|network|timeout/i.test(text)) {
    return `Your answers couldn't reach SharePoint. Check your connection and press Submit again. ${KEPT}`;
  }
  return `SharePoint couldn't save your answers${status ? ` (error ${status})` : ''}. Please try again, or let IT know. ${KEPT}`;
}
