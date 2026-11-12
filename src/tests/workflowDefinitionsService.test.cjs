// Run with: node --test src/tests/workflowDefinitionsService.test.cjs
// Uses an in-memory Graph client; no SharePoint calls are made.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

/** Loads a TS module and its relative imports, transpiled to CommonJS. */
function loadModule(file, cache = {}) {
  const filename = path.resolve(file);
  if (cache[filename]) return cache[filename];
  const exports = {};
  cache[filename] = exports;
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = spec => {
    if (!spec.startsWith('.')) return require(spec);
    const base = path.resolve(path.dirname(filename), spec);
    const target = [`${base}.ts`, `${base}.tsx`, base].find(candidate => fs.existsSync(candidate));
    return loadModule(target, cache);
  };
  vm.runInThisContext(`(function(exports, require) { ${code}\n})`, { filename })(exports, localRequire);
  return exports;
}

const { WorkflowDefinitionsService, WORKFLOW_LIST_NAME } = loadModule(path.resolve(__dirname, '../services/workflowDefinitionsService.ts'));
const SITE = '/sites/scpng1.sharepoint.com:/sites/scpngintranet';

/** A tiny fake of the Graph list/column/item endpoints the service uses. */
function fakeGraph({ pageSize = 50 } = {}) {
  const state = { lists: [{ id: 'other', displayName: 'Operations_Tasks' }], columns: {}, items: {}, nextItemId: 1, writes: [] };
  const page = (values, url) => {
    const offset = Number((url.match(/[?&]skip=(\d+)/) || [])[1] || 0);
    const slice = values.slice(offset, offset + pageSize);
    const base = url.replace(/[?&]skip=\d+/, '');
    const next = offset + pageSize < values.length ? `${base}${base.includes('?') ? '&' : '?'}skip=${offset + pageSize}` : undefined;
    return { value: slice, ...(next ? { '@odata.nextLink': next } : {}) };
  };
  const request = url => {
    const headers = {};
    const self = {
      select: () => self,
      expand: () => self,
      header: (key, value) => { headers[key] = value; return self; },
      async get() {
        if (url === SITE) return { id: 'site1' };
        if (url.startsWith('/sites/site1/lists?')) return page(state.lists, url);
        let match = url.match(/^\/sites\/site1\/lists\/(\w+)\/columns/);
        if (match) return page(state.columns[match[1]] || [], url);
        match = url.match(/^\/sites\/site1\/lists\/(\w+)\/items\?/);
        if (match) return page(state.items[match[1]] || [], url);
        match = url.match(/^\/sites\/site1\/lists\/(\w+)\/items\/(\d+)$/);
        if (match) {
          const item = (state.items[match[1]] || []).find(entry => entry.id === match[2]);
          if (!item) throw Object.assign(new Error('Not found'), { statusCode: 404 });
          return JSON.parse(JSON.stringify(item));
        }
        throw new Error(`Unexpected GET ${url}`);
      },
      async post(body) {
        state.writes.push(['POST', url]);
        if (url === '/sites/site1/lists') {
          const list = { id: 'wf', displayName: body.displayName };
          state.lists.push(list);
          state.columns.wf = [{ name: 'Title', text: {} }];
          state.items.wf = [];
          return list;
        }
        let match = url.match(/^\/sites\/site1\/lists\/(\w+)\/columns$/);
        if (match) { state.columns[match[1]].push(JSON.parse(JSON.stringify(body))); return body; }
        match = url.match(/^\/sites\/site1\/lists\/(\w+)\/items$/);
        if (match) {
          if (state.items[match[1]].some(item => item.fields.WorkflowKey === body.fields.WorkflowKey)) {
            throw Object.assign(new Error('Duplicate value for unique column'), { statusCode: 409 });
          }
          const item = { id: String(state.nextItemId++), eTag: '"1"', fields: { ...body.fields } };
          state.items[match[1]].push(item);
          return item;
        }
        throw new Error(`Unexpected POST ${url}`);
      },
      async patch(body) {
        state.writes.push(['PATCH', url]);
        const match = url.match(/^\/sites\/site1\/lists\/(\w+)\/items\/(\d+)$/);
        const item = state.items[match[1]].find(entry => entry.id === match[2]);
        if (headers['If-Match'] !== item.eTag) throw Object.assign(new Error('Precondition failed'), { statusCode: 412 });
        Object.assign(item.fields, body.fields);
        item.eTag = `"${Number(item.eTag.replace(/"/g, '')) + 1}"`;
        return item;
      },
      async delete() {
        state.writes.push(['DELETE', url]);
        const match = url.match(/^\/sites\/site1\/lists\/(\w+)\/items\/(\d+)$/);
        const item = state.items[match[1]].find(entry => entry.id === match[2]);
        if (headers['If-Match'] !== item.eTag) throw Object.assign(new Error('Precondition failed'), { statusCode: 412 });
        state.items[match[1]] = state.items[match[1]].filter(entry => entry !== item);
      },
    };
    return self;
  };
  return { state, client: { api: request } };
}

const draft = (id = 'leave-approval') => ({
  schemaVersion: 1, id, title: 'Leave approval', status: 'draft', source: 'ai',
  nodes: [
    { id: 'request', label: 'Request leave', type: 'input', x: 570, y: 1150 },
    { id: 'done', label: 'Done', type: 'end', x: 570, y: 975 },
  ],
  edges: [{ from: 'request', to: 'done' }],
});

test('readiness reports a missing list without creating anything', async () => {
  const { state, client } = fakeGraph();
  const readiness = await new WorkflowDefinitionsService(client).readiness();
  assert.equal(readiness.exists, false);
  assert.match(readiness.problems[0], /has not been created/);
  assert.deepEqual(state.writes, []);
});

test('prepare creates the list and its columns once, and is safe to repeat', async () => {
  const { state, client } = fakeGraph({ pageSize: 1 });
  const service = new WorkflowDefinitionsService(client);
  await service.prepare();
  assert.equal(state.lists.filter(list => list.displayName === WORKFLOW_LIST_NAME).length, 1, 'found across list pages');
  const writesAfterFirst = state.writes.length;
  assert.equal(writesAfterFirst, 1 + 7, 'one list and seven columns');
  await new WorkflowDefinitionsService(client).prepare();
  assert.equal(state.writes.length, writesAfterFirst, 'nothing is created a second time');
  assert.deepEqual(await service.readiness(), { exists: true, problems: [] });
  const key = state.columns.wf.find(column => column.name === 'WorkflowKey');
  assert.equal(key.enforceUniqueValues, true);
});

test('saved workflows round-trip through every page, and unreadable items are reported, not shown', async () => {
  const { state, client } = fakeGraph({ pageSize: 2 });
  const service = new WorkflowDefinitionsService(client);
  await service.prepare();
  for (const id of ['alpha', 'beta', 'gamma']) await service.create({ ...draft(id), title: `Workflow ${id}` });
  state.items.wf.push({ id: '99', eTag: '"1"', fields: { Title: 'Broken', WorkflowKey: 'broken', DefinitionJSON: '{not json' } });

  const { workflows, unreadable } = await service.list();
  assert.deepEqual(workflows.map(item => item.definition.id), ['alpha', 'beta', 'gamma']);
  assert.equal(workflows[0].definition.source, 'ai');
  assert.equal(workflows[0].revision, '"1"');
  assert.deepEqual(unreadable.map(item => [item.itemId, item.errors[0]]), [['99', 'The stored definition is not valid JSON.']]);
});

test('create refuses built-in, invalid and duplicate workflows', async () => {
  const { client } = fakeGraph();
  const service = new WorkflowDefinitionsService(client);
  await service.prepare();
  await assert.rejects(service.create({ ...draft(), status: 'implemented', source: 'built-in' }), /Built-in workflows live in code/);
  await assert.rejects(service.create({ ...draft(), edges: [{ from: 'request', to: 'ghost' }] }), /can't be saved/);
  await service.create(draft());
  await assert.rejects(service.create(draft()), /already uses the ID "leave-approval"/);
});

test('updates and deletes need the loaded version, and the ID cannot change', async () => {
  const { client } = fakeGraph();
  const service = new WorkflowDefinitionsService(client);
  await service.prepare();
  const saved = await service.create(draft());

  const updated = await service.update(saved.itemId, saved.revision, { ...saved.definition, title: 'Leave approval v2', status: 'published' });
  assert.equal(updated.definition.title, 'Leave approval v2');
  assert.equal(updated.definition.status, 'published');
  assert.equal(updated.revision, '"2"');

  await assert.rejects(service.update(saved.itemId, saved.revision, saved.definition), /Someone else changed this workflow/);
  await assert.rejects(service.update(saved.itemId, updated.revision, { ...updated.definition, id: 'renamed' }), /ID can't change/);
  await assert.rejects(service.remove(saved.itemId, saved.revision), /Someone else changed this workflow/);
  await service.remove(saved.itemId, updated.revision);
  assert.deepEqual((await service.list()).workflows, []);
});
