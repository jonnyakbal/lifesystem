import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HealthLedger } from './schemas';
import { acquireCollectionLock } from '../storage/collection-lock';

function directory() { return process.env.LIFESYSTEM_DATA_DIR ? path.resolve(process.env.LIFESYSTEM_DATA_DIR) : path.join(process.cwd(), 'data'); }
function empty(): HealthLedger { return { id: 'health-v1', schemaVersion: 1, observations: [], proposals: [], receipts: [] }; }
async function readFile(): Promise<HealthLedger> {
  try { return JSON.parse(await fs.readFile(path.join(directory(), 'health-ledger.json'), 'utf8')) as HealthLedger; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty(); throw error; }
}
export async function readHealthLedger() { return readFile(); }

async function wait(ms: number) { await new Promise(resolve => setTimeout(resolve, ms)); }

// Locks written by the previous implementation are empty directories with no
// owner record; one older than a minute cannot belong to a live new-format
// owner (they write their record right after mkdir), so it is reclaimed once.
async function reclaimLegacyLock(dir: string) {
  const lock = path.join(dir, '.health-ledger.lock');
  const stat = await fs.stat(lock).catch(() => null);
  if (!stat || Date.now() - stat.mtimeMs <= 60_000) return;
  const hasOwner = await fs.access(path.join(lock, 'owner.json')).then(() => true, () => false);
  if (hasOwner) return;
  const guard = `${lock}.reclaim`;
  try { await fs.mkdir(guard); } catch { return; }
  try {
    const again = await fs.stat(lock).catch(() => null);
    const stillLegacy = !(await fs.access(path.join(lock, 'owner.json')).then(() => true, () => false));
    if (again && stillLegacy && Date.now() - again.mtimeMs > 60_000) await fs.rmdir(lock).catch(() => undefined);
  } finally { await fs.rmdir(guard).catch(() => undefined); }
}

// Same owner/heartbeat lock as the collections: a live owner is never robbed
// by age, a dead local owner is recovered, and the commit re-checks ownership.
export async function transactHealthLedger<T>(operation: (ledger: HealthLedger) => Promise<T> | T): Promise<T> {
  const dir = directory();
  await fs.mkdir(dir, { recursive: true });
  await reclaimLegacyLock(dir);
  const lease = await acquireCollectionLock(dir, 'health-ledger');
  const temporary = path.join(dir, `.health-ledger.${randomUUID()}.tmp`);
  try {
    const ledger = await readFile();
    const result = await operation(ledger);
    await lease.assertOwned();
    await fs.writeFile(temporary, JSON.stringify(ledger), 'utf8');
    for (let attempt = 0; ; attempt++) {
      try {
        await lease.assertOwned();
        await fs.rename(temporary, path.join(dir, 'health-ledger.json'));
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (process.platform !== 'win32' || attempt >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(code || '')) throw error;
        await wait(30 * (attempt + 1));
      }
    }
    return result;
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    await lease.release();
  }
}
