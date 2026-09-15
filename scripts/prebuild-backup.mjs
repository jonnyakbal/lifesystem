import { spawnSync } from 'node:child_process';

if (!process.env.LIFESYSTEM_DATA_DIR) {
  console.log('Backup de deploy ignorado: LIFESYSTEM_DATA_DIR não está configurada neste ambiente.');
  process.exit(0);
}

const result = spawnSync(process.execPath, ['scripts/backup-data.mjs'], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
