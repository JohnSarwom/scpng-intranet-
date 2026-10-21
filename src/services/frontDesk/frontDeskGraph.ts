import type { Client } from '@microsoft/microsoft-graph-client';
import { FRONT_DESK_SITE_PATH } from './frontDeskConfig';

type Fields = Record<string, unknown>;

export interface GraphPage<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

export interface GraphListItem {
  id: string;
  fields?: Fields;
}

export class FrontDeskListMissingError extends Error {
  constructor(public readonly listName: string) {
    super(`List ${listName} not found — run Front Desk setup in TestGround`);
    this.name = 'FrontDeskListMissingError';
  }
}

// Shared across instances so every hook resolves the site and list IDs once per session.
let cachedSiteId = '';
let cachedListIds: Map<string, string> | null = null;

/** Call after creating lists (and between tests) so the next lookup re-reads SharePoint. */
export function resetFrontDeskGraphCache() {
  cachedSiteId = '';
  cachedListIds = null;
}

/**
 * Thin wrapper over Microsoft Graph for the Front Desk lists: site and list resolution,
 * paging, and item create / update / delete. Each list's service maps the fields.
 */
export class FrontDeskGraph {
  constructor(private readonly client: Client) {}

  async collectPages<T>(firstUrl: string): Promise<T[]> {
    const items: T[] = [];
    const visited = new Set<string>();
    let nextUrl: string | undefined = firstUrl;
    while (nextUrl) {
      if (visited.has(nextUrl)) throw new Error('SharePoint returned a repeated page link.');
      visited.add(nextUrl);
      const page = await this.client.api(nextUrl).get() as GraphPage<T>;
      if (!Array.isArray(page?.value)) throw new Error('SharePoint returned an invalid list response.');
      items.push(...page.value);
      nextUrl = page['@odata.nextLink'];
    }
    return items;
  }

  async resolveSiteId(): Promise<string> {
    if (!cachedSiteId) {
      const site = await this.client.api(FRONT_DESK_SITE_PATH).get() as { id?: string };
      if (!site?.id) throw new Error('SCPNG SharePoint site was not found.');
      cachedSiteId = site.id;
    }
    return cachedSiteId;
  }

  /** The list's ID, or undefined when the list does not exist. */
  async findListId(listName: string): Promise<string | undefined> {
    if (!cachedListIds) {
      const siteId = await this.resolveSiteId();
      const lists = await this.collectPages<{ id: string; displayName: string }>(
        `/sites/${siteId}/lists?$select=id,displayName&$top=200`,
      );
      cachedListIds = new Map(lists.map(list => [list.displayName, list.id]));
    }
    return cachedListIds.get(listName);
  }

  async resolveListId(listName: string): Promise<string> {
    const id = await this.findListId(listName);
    if (!id) throw new FrontDeskListMissingError(listName);
    return id;
  }

  async listPath(listName: string): Promise<string> {
    const [siteId, listId] = await Promise.all([this.resolveSiteId(), this.resolveListId(listName)]);
    return `/sites/${siteId}/lists/${listId}`;
  }

  /** `query` is appended to the items URL, e.g. `&$filter=fields/Status eq 'On Site'`. */
  async getItems(listName: string, query = ''): Promise<GraphListItem[]> {
    const path = await this.listPath(listName);
    return this.collectPages<GraphListItem>(`${path}/items?$expand=fields&$top=200${query}`);
  }

  async createItem(listName: string, fields: Fields): Promise<GraphListItem> {
    const path = await this.listPath(listName);
    return await this.client.api(`${path}/items`).post({ fields }) as GraphListItem;
  }

  async updateFields(listName: string, itemId: string, fields: Fields): Promise<Fields> {
    const path = await this.listPath(listName);
    return await this.client.api(`${path}/items/${itemId}/fields`).patch(fields) as Fields;
  }

  async deleteItem(listName: string, itemId: string): Promise<void> {
    const path = await this.listPath(listName);
    await this.client.api(`${path}/items/${itemId}`).delete();
  }
}
