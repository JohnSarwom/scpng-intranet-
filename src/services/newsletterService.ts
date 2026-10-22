import type { IPublicClientApplication } from '@azure/msal-browser';
import { getGraphClient } from './graphService';
import { NewsletterSharePointTransport } from './newsletterSharePointTransport';
import type { Routing, RoutingAdminView } from '@/types/newsletterRouting';
import type {
  Assignment,
  Attachment,
  Content,
  Newsletter,
  Publication,
  Staff,
} from '@/types/newsletter';

export const newslettersConfigured = () =>
  Boolean(
    import.meta.env.VITE_NEWSLETTER_REQUEST_SITE_ID &&
      import.meta.env.VITE_NEWSLETTER_REQUEST_LIST_ID &&
      import.meta.env.VITE_NEWSLETTER_REQUEST_PARTS_LIST_ID,
  );
// Share only in-flight reads in this sign-in context; never cache results or merge writes.
const pendingReads = new WeakMap<IPublicClientApplication, Map<string, Promise<unknown>>>();
const readActions = new Set(['notifications', 'routing_admin_get', 'session', 'list', 'get', 'version', 'public_list', 'public_get']);
export class NewsletterService {
  constructor(private readonly msal: IPublicClientApplication) {}
  async request<T>(
    action: string,
    data: Record<string, unknown> = {},
    binary = false,
  ): Promise<T> {
    if (!newslettersConfigured()) {
      throw new Error(
        'The newsletter workspace is awaiting service configuration. Your existing news remains available.',
      );
    }
    const account = this.msal.getActiveAccount() ||
      this.msal.getAllAccounts()[0];
    if (!account) throw new Error('Sign in to access newsletters.');
    const execute = async () => {
      const graph = await getGraphClient(this.msal);
      if (!graph) {
        throw new Error('Sign in to connect to the SharePoint newsletter queue.');
      }
      return new NewsletterSharePointTransport(graph, {
        siteId: import.meta.env.VITE_NEWSLETTER_REQUEST_SITE_ID,
        requestsId: import.meta.env.VITE_NEWSLETTER_REQUEST_LIST_ID,
        partsId: import.meta.env.VITE_NEWSLETTER_REQUEST_PARTS_LIST_ID,
      }).execute<T>(action, data, binary);
    };
    if (!readActions.has(action) || binary) return execute();
    let reads = pendingReads.get(this.msal);
    if (!reads) { reads = new Map(); pendingReads.set(this.msal, reads); }
    const key = JSON.stringify([account.homeAccountId, account.tenantId,
      import.meta.env.VITE_NEWSLETTER_REQUEST_SITE_ID,
      import.meta.env.VITE_NEWSLETTER_REQUEST_LIST_ID,
      import.meta.env.VITE_NEWSLETTER_REQUEST_PARTS_LIST_ID, action, data]);
    const inFlight = reads;
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const pending = execute().finally(() => { if (inFlight.get(key) === pending) inFlight.delete(key); });
    inFlight.set(key, pending);
    return pending;
  }
  session() {
    return this.request<
      {
        actor: Staff;
        roles: Assignment[];
        capabilities: { scheduling: boolean; staffEmail: boolean };
      }
    >('session');
  }
  routingSettings() {
    return this.request<RoutingAdminView>('routing_admin_get');
  }
  saveRouting(config: Routing, etag: string | null, reason: string) {
    return this.request<RoutingAdminView>('routing_admin_save', {
      config,
      etag,
      reason,
    });
  }
  list() {
    return this.request<Newsletter[]>('list');
  }
  publications() {
    return this.request<Publication[]>('public_list');
  }
  publication(id: string) {
    return this.request<Publication>('public_get', { id });
  }
  create() {
    return this.request<Newsletter>('create');
  }
  get(id: string) {
    return this.request<Newsletter>('get', { id });
  }
  save(n: Newsletter, content: Content) {
    return this.request<Newsletter>('save', {
      id: n.id,
      revision: n.revision,
      content,
    });
  }
  action(n: Newsletter, action: string, comment = '', scheduledAt?: string) {
    return this.request<Newsletter & { publicationWarning?: string }>(action, {
      id: n.id,
      revision: n.revision,
      comment,
      scheduledAt,
    });
  }
  async upload(n: Newsletter, file: File): Promise<Attachment> {
    if (file.size > 3 * 1024 * 1024) {
      throw new Error('Each attachment must be at most 3 MB.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = '';
    for (let i = 0; i < bytes.length; i += 32768) {
      text += String.fromCharCode(...bytes.subarray(i, i + 32768));
    }
    return this.request<Attachment>('upload', {
      id: n.id,
      revision: n.revision,
      name: file.name,
      base64: btoa(text),
    });
  }
  async download(id: string, attachment: Attachment, published: boolean) {
    const blob = await this.request<Blob>('download', {
      id,
      attachmentId: attachment.id,
      published,
    }, true);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
