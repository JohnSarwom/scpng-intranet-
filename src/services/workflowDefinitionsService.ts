/**
 * Saved workflows in the Workflow_Definitions SharePoint list.
 *
 * The list is created only by prepare(), which an administrator runs from
 * Workflow Studio after a confirmation; nothing creates it automatically.
 * Every definition is validated on the way in and on the way out, and updates
 * and deletes are conditional on the version that was loaded.
 */

import type { SavedWorkflow, WorkflowDefinition } from '../workflows/workflowTypes';
import { normaliseWorkflow, validateWorkflow, workflowToJson, WORKFLOW_SCHEMA_VERSION } from '../workflows/workflowSchema';

export const WORKFLOW_LIST_NAME = 'Workflow_Definitions';
const SITE_ADDRESS = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';

const COLUMN_DEFINITIONS = [
  { name: 'WorkflowKey', text: { maxLength: 64 }, indexed: true, enforceUniqueValues: true },
  { name: 'Summary', text: { allowMultipleLines: true, textType: 'plain' } },
  { name: 'Area', text: { maxLength: 120 } },
  { name: 'Status', text: { maxLength: 20 } },
  { name: 'Source', text: { maxLength: 20 } },
  { name: 'SchemaVersion', number: {} },
  { name: 'DefinitionJSON', text: { allowMultipleLines: true, textType: 'plain' } },
] as const;

export interface WorkflowListReadiness {
  exists: boolean;
  /** Why the list can't be used yet; empty when it is ready. */
  problems: string[];
}

export interface UnreadableWorkflow {
  itemId: string;
  title: string;
  errors: string[];
}

export interface SavedWorkflowList {
  workflows: SavedWorkflow[];
  /** Items whose stored JSON is missing or invalid; listed so they can be fixed, never shown on the canvas. */
  unreadable: UnreadableWorkflow[];
}

const isStaleWrite = (error: any): boolean => {
  const code = String(error?.code || '').toLowerCase();
  return error?.statusCode === 412 || error?.status === 412 || code === 'preconditionfailed' || code === 'etagmismatch';
};

const isDuplicateKey = (error: any): boolean =>
  error?.statusCode === 409 || /duplicate|unique/i.test(String(error?.message || error?.body || ''));

export class WorkflowDefinitionsService {
  private siteId = '';
  private listId = '';

  constructor(private client: any) {}

  private async site(): Promise<string> {
    if (!this.siteId) {
      const site = await this.client.api(SITE_ADDRESS).select('id').get();
      this.siteId = site.id;
    }
    return this.siteId;
  }

  private async all(url: string): Promise<any[]> {
    const result: any[] = [];
    const seen = new Set<string>();
    let next: string | undefined = url;
    while (next) {
      if (seen.has(next)) throw new Error('SharePoint returned a repeated page link; the list was not read completely.');
      seen.add(next);
      const page = await this.client.api(next).get();
      result.push(...(page.value || []));
      next = page['@odata.nextLink'];
    }
    return result;
  }

  private async findList(): Promise<any | null> {
    const siteId = await this.site();
    const lists = await this.all(`/sites/${siteId}/lists?$select=id,displayName`);
    const matches = lists.filter(list => list.displayName === WORKFLOW_LIST_NAME);
    if (matches.length > 1) throw new Error(`More than one ${WORKFLOW_LIST_NAME} list exists.`);
    return matches[0] || null;
  }

  private async listUrl(): Promise<string> {
    if (!this.listId) {
      const list = await this.findList();
      if (!list) throw new Error(`The ${WORKFLOW_LIST_NAME} list has not been created yet.`);
      this.listId = list.id;
    }
    return `/sites/${await this.site()}/lists/${this.listId}`;
  }

  private columnProblems(columns: any[]): string[] {
    const problems: string[] = [];
    for (const definition of COLUMN_DEFINITIONS) {
      const column = columns.find(item => item.name === definition.name);
      if (!column) { problems.push(`Column ${definition.name} is missing.`); continue; }
      if ('number' in definition ? !column.number : !column.text) problems.push(`Column ${definition.name} has the wrong type.`);
    }
    const key = columns.find(item => item.name === 'WorkflowKey');
    if (key && (!key.indexed || !key.enforceUniqueValues)) problems.push('Column WorkflowKey must be indexed and unique.');
    const json = columns.find(item => item.name === 'DefinitionJSON');
    if (json?.text && !json.text.allowMultipleLines) problems.push('Column DefinitionJSON must allow multiple lines.');
    return problems;
  }

  /** Read-only check. */
  async readiness(): Promise<WorkflowListReadiness> {
    const list = await this.findList();
    if (!list) return { exists: false, problems: [`The ${WORKFLOW_LIST_NAME} list has not been created yet.`] };
    this.listId = list.id;
    const columns = await this.all(`${await this.listUrl()}/columns`);
    return { exists: true, problems: this.columnProblems(columns) };
  }

  /**
   * Creates the list and any missing columns. Safe to run again. A schema
   * change on the production site: call only after an administrator confirms.
   */
  async prepare(): Promise<void> {
    const siteId = await this.site();
    let list = await this.findList();
    if (!list) {
      list = await this.client.api(`/sites/${siteId}/lists`).post({
        displayName: WORKFLOW_LIST_NAME,
        description: 'Workflow Studio: saved workflow definitions (JSON).',
        list: { template: 'genericList' },
      });
    }
    this.listId = list.id;
    const url = await this.listUrl();
    const columns = await this.all(`${url}/columns`);
    for (const definition of COLUMN_DEFINITIONS) {
      if (!columns.some(column => column.name === definition.name)) {
        await this.client.api(`${url}/columns`).post(definition);
      }
    }
    const problems = this.columnProblems(await this.all(`${url}/columns`));
    if (problems.length) throw new Error(`The ${WORKFLOW_LIST_NAME} list is not usable: ${problems.join(' ')}`);
  }

  private toSaved(item: any): SavedWorkflow | UnreadableWorkflow {
    const fields = item.fields || {};
    const itemId = String(item.id);
    const title = String(fields.Title || '(untitled)');
    let raw: unknown;
    try {
      raw = JSON.parse(String(fields.DefinitionJSON || ''));
    } catch {
      return { itemId, title, errors: ['The stored definition is not valid JSON.'] };
    }
    const status = String(fields.Status || '').toLowerCase() === 'published' ? 'published' : 'draft';
    const source = String(fields.Source || '') === 'ai' ? 'ai' : 'manual';
    const definition = normaliseWorkflow(raw, { id: String(fields.WorkflowKey || ''), status, source });
    const errors = validateWorkflow(definition);
    if (errors.length) return { itemId, title, errors };
    return {
      itemId,
      revision: String(item.eTag || ''),
      definition,
      createdBy: item.createdBy?.user?.displayName,
      modifiedBy: item.lastModifiedBy?.user?.displayName,
      modifiedAt: item.lastModifiedDateTime,
    };
  }

  async list(): Promise<SavedWorkflowList> {
    const items = await this.all(`${await this.listUrl()}/items?$expand=fields`);
    const result: SavedWorkflowList = { workflows: [], unreadable: [] };
    for (const item of items) {
      const parsed = this.toSaved(item);
      if ('definition' in parsed) result.workflows.push(parsed);
      else result.unreadable.push(parsed);
    }
    result.workflows.sort((a, b) => a.definition.title.localeCompare(b.definition.title));
    return result;
  }

  private fieldsFor(definition: WorkflowDefinition) {
    if (definition.source === 'built-in' || definition.status === 'implemented') {
      throw new Error('Built-in workflows live in code. Duplicate it as a draft to save a copy.');
    }
    const errors = validateWorkflow(definition);
    if (errors.length) throw new Error(`The workflow can't be saved: ${errors.join(' ')}`);
    return {
      Title: definition.title,
      WorkflowKey: definition.id,
      Summary: definition.summary || '',
      Area: definition.area || '',
      Status: definition.status,
      Source: definition.source,
      SchemaVersion: WORKFLOW_SCHEMA_VERSION,
      DefinitionJSON: workflowToJson(definition),
    };
  }

  private async read(itemId: string): Promise<SavedWorkflow> {
    const item = await this.client.api(`${await this.listUrl()}/items/${itemId}`).expand('fields').get();
    const parsed = this.toSaved(item);
    if (!('definition' in parsed)) throw new Error(`Workflow ${itemId} was saved but could not be read back: ${parsed.errors.join(' ')}`);
    return parsed;
  }

  async create(definition: WorkflowDefinition): Promise<SavedWorkflow> {
    const fields = this.fieldsFor(definition);
    try {
      const created = await this.client.api(`${await this.listUrl()}/items`).post({ fields });
      return this.read(String(created.id));
    } catch (error) {
      if (isDuplicateKey(error)) throw new Error(`A saved workflow already uses the ID "${definition.id}". Rename it or update that one.`);
      throw error;
    }
  }

  async update(itemId: string, revision: string, definition: WorkflowDefinition): Promise<SavedWorkflow> {
    if (!revision) throw new Error('This workflow has no loaded version. Reload before saving.');
    const url = `${await this.listUrl()}/items/${itemId}`;
    const current = await this.client.api(url).expand('fields').get();
    if (String(current.fields?.WorkflowKey || '') !== definition.id) {
      throw new Error("A saved workflow's ID can't change. Save it as a new workflow instead.");
    }
    try {
      await this.client.api(url).header('If-Match', revision).patch({ fields: this.fieldsFor(definition) });
    } catch (error) {
      if (isStaleWrite(error)) throw new Error('Someone else changed this workflow after you opened it. Reload and review it before saving.');
      throw error;
    }
    return this.read(itemId);
  }

  async remove(itemId: string, revision: string): Promise<void> {
    if (!revision) throw new Error('This workflow has no loaded version. Reload before deleting.');
    try {
      await this.client.api(`${await this.listUrl()}/items/${itemId}`).header('If-Match', revision).delete();
    } catch (error) {
      if (isStaleWrite(error)) throw new Error('Someone else changed this workflow after you opened it. Reload before deleting.');
      throw error;
    }
  }
}
