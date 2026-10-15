import {readFile, writeFile, mkdir, open, unlink} from 'node:fs/promises';
import {resolve, dirname, basename} from 'node:path';
import {parseArgs} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {validateSource, eligibility, planList, assertRemovalLimit} from './core.mjs';

const {values} = parseArgs({options: {config: {type: 'string'}, apply: {type: 'boolean', default: false}, 'max-removal-percent': {type: 'string', default: '25'}}});
if (!values.config) throw new Error('Provide --config path/to/config.json. Default is preview only.');
const configPath = resolve(values.config);
const config = JSON.parse(await readFile(configPath, 'utf8'));
const output = resolve(dirname(configPath), config.reportDirectory || 'reports');
await mkdir(output, {recursive: true});
const lockPath = resolve(output, 'staff-sync.lock');
const lock = await open(lockPath, 'wx');
await lock.writeFile(JSON.stringify({pid: process.pid, startedAt: new Date().toISOString()}));
const runId = new Date().toISOString().replaceAll(':', '-');
const reportPath = resolve(output, `${runId}.json`);
const report = {startedAt: new Date().toISOString(), mode: values.apply ? 'apply' : 'preview', status: 'reading', plans: [], completed: []};
let token;
let expires = 0;
let managedCredential;
let reportContainer;

async function identity() {
  if (!managedCredential) {
    const {ManagedIdentityCredential} = await import('@azure/identity');
    managedCredential = process.env.AZURE_CLIENT_ID ? new ManagedIdentityCredential({clientId: process.env.AZURE_CLIENT_ID}) : new ManagedIdentityCredential();
  }
  return managedCredential;
}

async function writeJson(path, data) {
  const text = JSON.stringify(data, null, 2);
  await writeFile(path, text, {mode: 0o600});
  if (config.reportStorageAccountUrl) {
    if (!reportContainer) {
      const {BlobServiceClient} = await import('@azure/storage-blob');
      const url = new URL(config.reportStorageAccountUrl);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.core.windows.net') || url.search) throw new Error('Use an Azure storage account URL without a secret or SAS query.');
      if (!config.reportContainer) throw new Error('Configure the private report container.');
      reportContainer = new BlobServiceClient(url.href, await identity()).getContainerClient(config.reportContainer);
    }
    // Durable backups must succeed before any SharePoint writes in cloud mode.
    await reportContainer.getBlockBlobClient(basename(path)).uploadData(Buffer.from(text), {blobHTTPHeaders: {blobContentType: 'application/json'}});
  }
}

async function authenticate() {
  if (token && Date.now() < expires) return token;
  if (process.env.STAFF_SYNC_AUTH_MODE === 'managed-identity') {
    const result = await (await identity()).getToken('https://graph.microsoft.com/.default');
    if (!result?.token) throw new Error('Managed identity returned no Graph token.');
    token = result.token;
    expires = result.expiresOnTimestamp - 120000;
    return token;
  }
  const tenant = process.env.STAFF_SYNC_TENANT_ID;
  const client = process.env.STAFF_SYNC_CLIENT_ID;
  const secret = process.env.STAFF_SYNC_CLIENT_SECRET;
  if (!tenant || !client || !secret || !/^[\w.-]+$/.test(tenant)) throw new Error('Configure STAFF_SYNC_TENANT_ID, STAFF_SYNC_CLIENT_ID and STAFF_SYNC_CLIENT_SECRET for the scheduled account.');
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    body: new URLSearchParams({client_id: client, client_secret: secret, grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default'})
  });
  if (!response.ok) throw new Error(`Authentication failed: HTTP ${response.status}`);
  const result = await response.json();
  if (!result.access_token) throw new Error('Authentication returned no token.');
  token = result.access_token;
  expires = Date.now() + (result.expires_in - 120) * 1000;
  return token;
}

async function graph(path, method = 'GET', body, eTag) {
  const url = new URL(path.startsWith('https://') ? path : `https://graph.microsoft.com/v1.0${path}`);
  if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/')) throw new Error('Invalid Graph pagination URL.');
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, {
      method, signal: AbortSignal.timeout(60000),
      headers: {Authorization: `Bearer ${await authenticate()}`, 'Content-Type': 'application/json', ...(eTag ? {'If-Match': eTag} : {})},
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    // Retry explicit throttling only for writes: never replay a create after an uncertain server failure.
    if ((response.status === 429 || (method === 'GET' && [502, 503, 504].includes(response.status))) && attempt < 5) {
      const retry = response.headers.get('Retry-After');
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000) : 2 ** attempt * 5;
      await delay(Math.min(Number.isFinite(seconds) ? seconds : 60, 900) * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`${method} ${url.pathname}: HTTP ${response.status}; request ${response.headers.get('request-id') || 'unknown'}`);
    return response.status === 204 ? null : response.json();
  }
}

async function all(path) {
  const rows = [];
  const seen = new Set();
  while (path) {
    if (seen.has(path)) throw new Error('Repeated pagination URL; refusing partial data.');
    seen.add(path);
    const result = await graph(path);
    if (!Array.isArray(result.value)) throw new Error('Invalid collection response.');
    rows.push(...result.value);
    path = result['@odata.nextLink'];
  }
  return rows;
}

try {
  if (!Array.isArray(config.allowedDomains) || !config.allowedDomains.length || !Array.isArray(config.excludedEmails)) throw new Error('Configure staff domains and excluded service addresses.');
  const users = await all('/users?$select=id,displayName,givenName,surname,mail,userPrincipalName,department,officeLocation,jobTitle,assignedLicenses,userType&$top=999');
  validateSource(users);
  report.sourceCount = users.length;
  report.excludedUsers = users.map(user => ({id: user.id, email: user.mail, reasons: eligibility(user, config)})).filter(u => u.reasons.length);
  const site = await graph(`/sites/${config.hostname}:${config.sitePath}`);
  const lists = await all(`/sites/${site.id}/lists?$select=id,displayName`);
  const snapshots = [];
  if (!Array.isArray(config.targets) || !config.targets.length) throw new Error('No target lists configured.');
  if (new Set(config.targets.map(target => target.name)).size !== config.targets.length) throw new Error('Duplicate target list configuration.');
  for (const target of config.targets) {
    const matches = lists.filter(l => l.displayName === target.name);
    if (matches.length !== 1) throw new Error(`List not found or ambiguous: ${target.name}`);
    const listId = matches[0].id;
    const prefix = `/sites/${site.id}/lists/${listId}`;
    const columns = await all(`${prefix}/columns`);
    const items = await all(`${prefix}/items?$expand=fields&$top=200`);
    snapshots.push({listId, name: target.name, items});
    report.plans.push({...planList(users, items, target, columns, config), prefix});
  }
  // All reads and schema checks finish before any mutation. Save full item snapshots first.
  await writeJson(resolve(output, `${runId}.backup.json`), {siteId: site.id, snapshots});
  report.status = 'planned';
  await writeJson(reportPath, report);
  if (values.apply) {
    assertRemovalLimit(report.plans, Number(values['max-removal-percent']));
    // Add/update all targets first. A write failure prevents cleanup from starting.
    for (const plan of report.plans) {
      for (const action of plan.actions.filter(a => a.type !== 'remove')) {
        if (action.type === 'create') await graph(`${plan.prefix}/items`, 'POST', {fields: action.fields});
        else await graph(`${plan.prefix}/items/${action.itemId}/fields`, 'PATCH', action.fields, action.eTag);
        report.completed.push({list: plan.name, ...action});
        await writeJson(reportPath, report);
      }
    }
    for (const plan of report.plans) {
      for (const action of plan.actions.filter(a => a.type === 'remove')) {
        await graph(`${plan.prefix}/items/${action.itemId}`, 'DELETE', undefined, action.eTag);
        report.completed.push({list: plan.name, ...action});
        await writeJson(reportPath, report);
      }
    }
  }
  report.status = values.apply ? 'applied' : 'previewed';
  console.log(`${report.status}. Report: ${reportPath}`);
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  try {
    await writeJson(reportPath, report);
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
