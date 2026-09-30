import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HealthLedger } from './schemas';

function directory() { return process.env.LIFESYSTEM_DATA_DIR ? path.resolve(process.env.LIFESYSTEM_DATA_DIR) : path.join(process.cwd(), 'data'); }
function empty(): HealthLedger { return { id: 'health-v1', schemaVersion: 1, observations: [], proposals: [], receipts: [] }; }
async function readFile(): Promise<HealthLedger> {
  try { return JSON.parse(await fs.readFile(path.join(directory(), 'health-ledger.json'), 'utf8')) as HealthLedger; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return empty(); throw error; }
}
export async function readHealthLedger() { return readFile(); }

async function wait(ms: number) { await new Promise(resolve => setTimeout(resolve, ms)); }
export async function transactHealthLedger<T>(operation: (ledger: HealthLedger) => Promise<T> | T): Promise<T> {
  const dir = directory();
  await fs.mkdir(dir, { recursive: true });
  const lock = path.join(dir, '.health-ledger.lock');
  const deadline = Date.now() + 10_000;
  while (true) {
    try { await fs.mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const stat = await fs.stat(lock).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > 60_000) await fs.rm(lock, { recursive: true, force: true }).catch(() => undefined);
      if (Date.now() >= deadline) throw new Error('Ledger de saúde ocupado; tente novamente com a mesma chave.');
      await wait(25 + Math.floor(Math.random() * 25));
    }
  }
  const temporary = path.join(dir, `.health-ledger.${randomUUID()}.tmp`);
  try {
    const ledger = await readFile();
    const result = await operation(ledger);
    await fs.writeFile(temporary, JSON.stringify(ledger), 'utf8');
    for (let attempt = 0; ; attempt++) {
      try { await fs.rename(temporary, path.join(dir, 'health-ledger.json')); break; }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (process.platform !== 'win32' || attempt >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(code || '')) throw error;
        await wait(30 * (attempt + 1));
      }
    }
    return result;
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    await fs.rmdir(lock).catch(() => undefined);
  }
}
