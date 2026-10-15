import {app} from '@azure/functions';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const execute = promisify(execFile);
app.timer('staffListSync', {
  // A TimeSpan requires a dedicated App Service plan, with Always On enabled.
  schedule: '5.00:00:00',
  runOnStartup: false,
  useMonitor: true,
  handler: async (_timer, context) => {
    const config = JSON.parse(process.env.STAFF_SYNC_CONFIG_JSON || '{}');
    if (!config.reportStorageAccountUrl || !config.reportContainer) throw new Error('Configure protected cloud report storage before running.');
    const folder = await mkdtemp(join(tmpdir(), 'scpng-staff-sync-'));
    try {
      config.reportDirectory = join(folder, 'reports');
      const path = join(folder, 'config.json');
      await writeFile(path, JSON.stringify(config), {mode: 0o600});
      const args = [fileURLToPath(new URL('./run.mjs', import.meta.url)), '--config', path];
      if (process.env.STAFF_SYNC_APPLY === 'true') args.push('--apply');
      const result = await execute(process.execPath, args, {
        env: {...process.env, STAFF_SYNC_AUTH_MODE: 'managed-identity'},
        timeout: 7100000, maxBuffer: 1024 * 1024
      });
      context.log(result.stdout.trim());
    } catch (error) {
      // Do not log environment variables, tokens or profile contents.
      context.error('Staff list sync failed. Review its protected JSON report and job exit status.');
      throw new Error(`Staff list sync failed (${error.code || 'configuration/runtime'}).`);
    } finally {
      // Only the exact directory created by mkdtemp is removed.
      await rm(folder, {recursive: true, force: true});
    }
  }
});
