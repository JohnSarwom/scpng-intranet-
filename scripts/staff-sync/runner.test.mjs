import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute = promisify(execFile);
const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));

async function scenario(mode, apply) {
  const folder = await mkdtemp(join(tmpdir(), 'staff-sync-test-'));
  const output = join(folder, 'reports');
  const config = {hostname: 'scpng1.sharepoint.com', sitePath: '/sites/scpngintranet', reportDirectory: output, allowedDomains: ['scpng.gov.pg'], excludedEmails: [], targets: [{name: 'Staff', fields: {id: 'EntraUserId', mail: 'Title', department: 'Department'}}]};
  await writeFile(join(folder, 'config.json'), JSON.stringify(config));
  // All HTTP is intercepted in this child process; no live tenant or credentials are used.
  await writeFile(join(folder, 'mock.mjs'), `
import {appendFileSync, readdirSync, readFileSync} from 'node:fs';
const user = {id:'u1',displayName:'Test Officer',mail:'officer@scpng.gov.pg',userPrincipalName:'officer@scpng.gov.pg',department:'IT',officeLocation:'Division',userType:'Member',assignedLicenses:[{skuId:'sku'}]};
globalThis.fetch = async (url, options={}) => {
  const path = new URL(url).pathname;
  const method = options.method || 'GET';
  if (method !== 'GET' && !path.endsWith('/token')) {
    const backups = readdirSync(process.env.TEST_REPORTS).filter(n=>n.endsWith('.backup.json'));
    if (!backups.length || !JSON.parse(readFileSync(process.env.TEST_REPORTS+'/'+backups[0])).snapshots.length) throw new Error('Mutation before durable local backup');
    appendFileSync(process.env.TEST_WRITES, method+' '+path+'\\n');
    if (process.env.TEST_MODE==='conflict' && method==='PATCH') return new Response('{}',{status:412});
    return new Response(method==='DELETE'?null:'{}',{status:method==='DELETE'?204:200});
  }
  let data;
  if (path.endsWith('/token')) data={access_token:'fake',expires_in:3600};
  else if (path==='/v1.0/users') data={value:[user],'@odata.nextLink':'https://graph.microsoft.com/v1.0/users-next'};
  else if (path==='/v1.0/users-next') {
    if (process.env.TEST_MODE==='partial') return new Response('{}',{status:403});
    data={value:[{...user,id:'u2',mail:'old@scpng.gov.pg',userPrincipalName:'old@scpng.gov.pg',assignedLicenses:[]}]};
  }
  else if (path==='/v1.0/sites/scpng1.sharepoint.com:/sites/scpngintranet') data={id:'site'};
  else if (path.endsWith('/lists')) data={value:[{id:'list',displayName:'Staff'}]};
  else if (path.endsWith('/columns')) data={value:['EntraUserId','Title','Department'].map(name=>({name,displayName:name}))};
  else if (path.endsWith('/items')) data={value:[{id:'1',eTag:'v1',fields:{EntraUserId:'u1',Title:user.mail,Department:'old'}},{id:'2',eTag:'v2',fields:{EntraUserId:'u2',Title:'old@scpng.gov.pg'}}]};
  else throw new Error('Unexpected URL in offline test: '+path);
  return new Response(JSON.stringify(data),{status:200});
};`);
  const args = ['--import', pathToFileURL(join(folder, 'mock.mjs')).href, runner, '--config', join(folder, 'config.json'), '--max-removal-percent', '100'];
  if (apply) args.push('--apply');
  let failed = false;
  try {
    await execute(process.execPath, args, {env: {...process.env, STAFF_SYNC_AUTH_MODE: 'client-secret', STAFF_SYNC_TENANT_ID: 'test', STAFF_SYNC_CLIENT_ID: 'test', STAFF_SYNC_CLIENT_SECRET: 'fake', TEST_MODE: mode, TEST_REPORTS: output, TEST_WRITES: join(folder, 'writes')}});
  } catch { failed = true; }
  const reportName = (await readdir(output)).find(n => n.endsWith('.json') && !n.endsWith('.backup.json'));
  const report = JSON.parse(await readFile(join(output, reportName), 'utf8'));
  let writes = ''; try { writes = await readFile(join(folder, 'writes'), 'utf8'); } catch {}
  await rm(folder, {recursive: true, force: true});
  return {failed, report, writes};
}
test('preview pages all users, plans changes and makes no mutations', async () => {
  const {failed, report, writes} = await scenario('normal', false);
  assert.equal(failed, false); assert.equal(report.sourceCount, 2); assert.equal(report.status, 'previewed'); assert.equal(writes, '');
  assert.deepEqual(report.plans[0].actions.map(a=>a.type), ['update', 'remove']);
});
test('a failed later directory page prevents all list writes', async () => {
  const {failed, report, writes} = await scenario('partial', true);
  assert.equal(failed, true); assert.equal(report.status, 'failed'); assert.equal(writes, '');
});
test('apply saves backup before writes and updates before cleanup', async () => {
  const {failed, report, writes} = await scenario('normal', true);
  assert.equal(failed, false); assert.equal(report.status, 'applied');
  assert.deepEqual(writes.trim().split('\n').map(s=>s.split(' ')[0]), ['PATCH', 'DELETE']);
});
test('a concurrent update conflict stops before deletions', async () => {
  const {failed, writes} = await scenario('conflict', true);
  assert.equal(failed, true); assert.ok(writes.startsWith('PATCH')); assert.equal(writes.includes('DELETE'), false);
});
