import type { WorkPlanGoal } from '../types/division.types';

const NAME = 'Division_WorkPlanPayloads';
const LIMIT = 50000;
type Ref = { hash: string; chunks: number };

/** Immutable goal payloads; only the small manifest is updated with the plan's ETag. */
export class WorkPlanStorageService {
  private listId = '';
  private encoded = new Map<string, Ref>();
  private decoded = new Map<string, WorkPlanGoal>();
  constructor(private client: any, private siteId: string) {}
  private async all(url: string) {
    const result: any[] = [], seen = new Set<string>();
    while (url) {
      if (seen.has(url)) throw new Error('Repeated payload continuation link.');
      seen.add(url);
      const page = await this.client.api(url).get();
      result.push(...(page.value || [])); url = page['@odata.nextLink'];
    }
    return result;
  }
  private async resolve() {
    if (!this.listId) {
      const lists = await this.all(`/sites/${this.siteId}/lists?$select=id,displayName`);
      const matches = lists.filter(item => item.displayName === NAME);
      if (matches.length !== 1) throw new Error('Prepare the work-plan payload schema before saving a large plan.');
      this.listId = matches[0].id;
    }
    return `/sites/${this.siteId}/lists/${this.listId}`;
  }
  async prepare() {
    const lists = await this.all(`/sites/${this.siteId}/lists?$select=id,displayName`);
    let list = lists.find(item => item.displayName === NAME);
    if (!list) list = await this.client.api(`/sites/${this.siteId}/lists`).post({ displayName: NAME, list: { template: 'genericList' } });
    this.listId = list.id;
    const url = await this.resolve();
    const columns = await this.all(`${url}/columns`);
    for (const definition of [
      { name: 'PayloadKey', text: { maxLength: 255 }, indexed: true, enforceUniqueValues: true },
      { name: 'Content', text: { allowMultipleLines: true } },
    ]) if (!columns.some(column => column.name === definition.name)) await this.client.api(`${url}/columns`).post(definition);
    await this.ready();
  }
  private async ready() {
    const columns = await this.all(`${await this.resolve()}/columns`);
    const key = columns.find(column => column.name === 'PayloadKey');
    if (!key?.text || !key.enforceUniqueValues || !key.indexed || !columns.find(column => column.name === 'Content')?.text?.allowMultipleLines) throw new Error('Work-plan payload schema is incompatible.');
  }
  async readiness(): Promise<string[]> {
    try { await this.ready(); return []; }
    catch (error) { return [error instanceof Error ? error.message : String(error)]; }
  }
  private async hash(text: string) {
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(value => value.toString(16).padStart(2, '0')).join('');
  }
  private async get(key: string) {
    const filter = encodeURIComponent(`fields/PayloadKey eq '${key}'`);
    const items = await this.all(`${await this.resolve()}/items?$expand=fields&$filter=${filter}`);
    if (items.length > 1) throw new Error('Duplicate work-plan payload key.');
    return items[0];
  }
  async encode(goals: WorkPlanGoal[]): Promise<string> {
    const json = JSON.stringify(goals);
    if (json.length <= LIMIT) return json;
    await this.ready();
    const refs: Ref[] = [];
    for (const goal of goals) {
      const text = JSON.stringify(goal), hash = await this.hash(text);
      let ref = this.encoded.get(hash);
      if (!ref) {
        const parts: string[] = [];
        for (let start = 0; start < text.length;) {
          let end = Math.min(start + LIMIT, text.length);
          const last = text.charCodeAt(end - 1);
          if (end < text.length && last >= 0xD800 && last <= 0xDBFF) end--;
          parts.push(text.slice(start, end)); start = end;
        }
        const chunks = parts.length;
        for (let index = 0; index < chunks; index++) {
          const key = `${hash}:${index}`, content = parts[index];
          let item = await this.get(key);
          if (!item) {
            try { item = await this.client.api(`${await this.resolve()}/items`).post({ fields: { Title: key, PayloadKey: key, Content: content } }); }
            catch (error) { item = await this.get(key); if (!item) throw error; }
          }
          if (item.fields?.Content !== content) {
            const actual = await this.get(key);
            if (actual?.fields.Content !== content) throw new Error('Work-plan payload content mismatch.');
          }
        }
        ref = { hash, chunks }; this.encoded.set(hash, ref);
      }
      refs.push(ref);
    }
    const manifest = JSON.stringify({ format: 'work-plan-goals-v1', refs });
    if (manifest.length > LIMIT) throw new Error('This plan has too many goals for one manifest; split it by reporting period.');
    return manifest;
  }
  async decode(raw: string | undefined): Promise<WorkPlanGoal[]> {
    let value: any;
    try { value = JSON.parse(raw || '[]'); } catch { throw new Error('Invalid work-plan JSON.'); }
    if (Array.isArray(value)) return value;
    if (value?.format !== 'work-plan-goals-v1' || !Array.isArray(value.refs)) throw new Error('Unsupported work-plan storage format.');
    const goals: WorkPlanGoal[] = [];
    for (const ref of value.refs) {
      if (!/^[a-f0-9]{64}$/.test(ref.hash) || !Number.isInteger(ref.chunks) || ref.chunks < 1 || ref.chunks > 10000) throw new Error('Invalid payload reference.');
      let goal = this.decoded.get(ref.hash);
      if (!goal) {
        let text = '';
        for (let index = 0; index < ref.chunks; index++) {
          const item = await this.get(`${ref.hash}:${index}`);
          if (typeof item?.fields.Content !== 'string') throw new Error('A work-plan payload chunk is missing.');
          text += item.fields.Content;
        }
        if (await this.hash(text) !== ref.hash) throw new Error('Work-plan payload checksum mismatch.');
        goal = JSON.parse(text); this.decoded.set(ref.hash, goal!);
      }
      goals.push(structuredClone(goal!));
    }
    return goals;
  }
}
