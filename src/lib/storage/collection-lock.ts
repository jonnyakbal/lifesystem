import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import path from 'node:path';

const STALE_MS = 60_000;
const WAIT_MS = 10_000;
const HEARTBEAT_MS = 1_000;
type Owner = { token: string; pid: number; host: string };

export function validateCollection(name: string): void {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(name)
    || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(name)) {
    throw new Error('Nome de coleção inválido.');
  }
}

async function readOwner(lock: string): Promise<Owner | null> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(path.join(lock, 'owner.json'), 'utf8'));
    if (!value || typeof value !== 'object') return null;
    const owner = value as Owner;
    return typeof owner.token === 'string' && owner.token.length > 0
      && Number.isInteger(owner.pid) && owner.pid > 0 && typeof owner.host === 'string' ? owner : null;
  } catch { return null; }
}

function isDeadLocalOwner(owner: Owner): boolean {
  if (owner.host !== hostname()) return false;
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'ESRCH'; }
}

async function recoverDeadOwner(lock: string): Promise<void> {
  const observed = await readOwner(lock);
  const observedStat = await fs.stat(lock).catch(() => null);
  if (!observed || !observedStat || Date.now() - observedStat.mtimeMs <= STALE_MS || !isDeadLocalOwner(observed)) return;

  // All stale removers use this guard and recheck the owner after acquiring it.
  // The guard is never stolen automatically: a crash here requires maintenance.
  const guard = `${lock}.reclaim`;
  try { await fs.mkdir(guard); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return;
    throw error;
  }
  try {
    const current = await readOwner(lock);
    const currentStat = await fs.stat(lock).catch(() => null);
    if (current?.token !== observed.token || !currentStat
      || Date.now() - currentStat.mtimeMs <= STALE_MS || !isDeadLocalOwner(current)) return;
    await fs.rm(lock, { recursive: true, force: true });
  } finally { await fs.rmdir(guard); }
}

export type CollectionLease = { assertOwned: () => Promise<void>; release: () => Promise<void> };

export async function acquireCollectionLock(dir: string, collection: string): Promise<CollectionLease> {
  validateCollection(collection);
  const lock = path.join(dir, `.${collection}.lock`);
  const owner: Owner = { token: randomUUID(), pid: process.pid, host: hostname() };
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    try { await fs.mkdir(lock); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await recoverDeadOwner(lock);
      if (Date.now() >= deadline) throw new Error(`Coleção ${collection} ocupada; tente novamente com a mesma chave.`);
      await new Promise(resolve => setTimeout(resolve, 25 + Math.floor(Math.random() * 25)));
    }
  }
  try { await fs.writeFile(path.join(lock, 'owner.json'), JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    await fs.rmdir(lock).catch(() => undefined);
    throw error;
  }

  let compromised: Error | undefined;
  let heartbeat = Promise.resolve();
  const assertOwned = async () => {
    if (compromised) throw compromised;
    if ((await readOwner(lock))?.token !== owner.token) throw new Error(`Trava da coleção ${collection} perdida.`);
  };
  const timer = setInterval(() => {
    heartbeat = heartbeat.then(async () => {
      await assertOwned();
      const now = new Date();
      await fs.utimes(lock, now, now);
    }).catch(error => { compromised = error instanceof Error ? error : new Error(String(error)); });
  }, HEARTBEAT_MS);
  timer.unref();
  return {
    assertOwned,
    async release() {
      clearInterval(timer);
      await heartbeat;
      // A lost lease must never delete the directory of a successor owner.
      if ((await readOwner(lock))?.token !== owner.token) return;
      await fs.unlink(path.join(lock, 'owner.json'));
      await fs.rmdir(lock);
    },
  };
}
