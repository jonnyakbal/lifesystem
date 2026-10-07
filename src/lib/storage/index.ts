import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { acquireCollectionLock, validateCollection, type CollectionLease } from './collection-lock';
import { acquireD1Lease, readD1Collection, writeD1Collection } from './d1';

// D1 holds the owner token and the revision read under the lease.
type D1Session = { owner: string; rev?: string };
const storageContext = new AsyncLocalStorage<{ dir: string; collection: string; lease: CollectionLease; d1?: D1Session }>();

// Files stay the default; an unknown value fails closed instead of writing elsewhere.
function isD1Backend() {
  const backend = process.env.LIFESYSTEM_STORAGE || 'file';
  if (backend !== 'file' && backend !== 'd1') throw new Error(`LIFESYSTEM_STORAGE inválido: ${backend}`);
  return backend === 'd1';
}

function dataDir() {
  const context = storageContext.getStore();
  if (context) return context.dir;
  return process.env.LIFESYSTEM_DATA_DIR
    ? path.resolve(process.env.LIFESYSTEM_DATA_DIR)
    : path.join(process.cwd(), 'data');
}
const collectionLocks = new Map<string, Promise<void>>();

export function assertTaskDeletionLinks(allItems: unknown[], ids: string[]) {
  const deleting = new Set(ids);
  if (allItems.some(item => {
    const task = item as { id: string; parentId?: string; dependsOnIds?: string[] };
    return !deleting.has(task.id) && ((task.parentId && deleting.has(task.parentId)) || task.dependsOnIds?.some(id => deleting.has(id)));
  })) throw new Error('Esta tarefa tem vínculos com outras tarefas. Desvincule as subtarefas e dependências antes de excluir.');
}

function assertDeletable(collection: string, items: unknown[], allItems: unknown[] = items) {
  if (collection === 'tasks' && items.some(item => Boolean((item as { planning?: { eventId?: string } }).planning?.eventId))) {
    throw new Error('Esta tarefa possui evento espelhado. Remova o bloco em Planejar antes de excluir a tarefa.');
  }
  if (collection === 'tasks') {
    assertTaskDeletionLinks(allItems, items.map(item => (item as { id: string }).id));
  }
}

async function ensureDataDir(dir = dataDir()) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Unlocked D1 reads of the same collection that overlap in time share one
// API call (a page load often asks for the same collection from several
// routes at once). Each caller gets its own copy, and reads under a lease
// never join: they must start after the lease and carry their own revision.
const sharedD1Reads = new Map<string, Promise<unknown[]>>();

async function readCollection<T>(name: string): Promise<T[]> {
  validateCollection(name);
  if (isD1Backend()) {
    const context = storageContext.getStore();
    if (context?.d1 && context.collection === name) {
      const { items, rev } = await readD1Collection<T>(name);
      context.d1.rev = rev;
      return items;
    }
    let shared = sharedD1Reads.get(name);
    if (!shared) {
      shared = readD1Collection<unknown>(name).then(r => r.items).finally(() => sharedD1Reads.delete(name));
      sharedD1Reads.set(name, shared);
    }
    return structuredClone(await shared) as T[];
  }
  const dir = dataDir();
  await ensureDataDir(dir);
  const filePath = path.join(dir, `${name}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new Error(`Não foi possível ler a coleção ${name}: ${String(error)}`);
  }
}

async function writeCollection<T>(name: string, data: T[]): Promise<void> {
  validateCollection(name);
  const dir = dataDir();
  const context = storageContext.getStore();
  if (!context || context.collection !== name) throw new Error('Escrita sem trava de coleção.');
  await context.lease.assertOwned();
  if (context.d1) {
    if (context.d1.rev === undefined) throw new Error('Escrita sem leitura da coleção sob a trava.');
    context.d1.rev = await writeD1Collection(name, data, context.d1.owner, context.d1.rev);
    // Later reads must see this write, never join a read started before it.
    sharedD1Reads.delete(name);
    return;
  }
  await ensureDataDir(dir);
  const filePath = path.join(dir, `${name}.json`);
  const tempPath = path.join(dir, `.${name}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    for (let attempt = 0; ; attempt++) {
      try {
        await context.lease.assertOwned();
        await fs.rename(tempPath, filePath);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (process.platform !== 'win32' || attempt >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(code || '')) throw error;
        await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)));
      }
    }
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function withCollectionLock<T>(collection: string, operation: () => Promise<T>): Promise<T> {
  validateCollection(collection);
  const d1 = isD1Backend();
  let dir = '';
  if (!d1) {
    const requestedDir = dataDir();
    await ensureDataDir(requestedDir);
    dir = await fs.realpath(requestedDir);
  }
  const key = d1 ? `d1:${collection}` : path.join(dir, `${collection}.json`);
  const previous = collectionLocks.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  collectionLocks.set(key, queued);
  await previous;
  try {
    if (d1) {
      const lease = await acquireD1Lease(collection);
      try { return await storageContext.run({ dir, collection, lease, d1: { owner: lease.owner } }, operation); }
      finally { await lease.release(); }
    }
    const lease = await acquireCollectionLock(dir, collection);
    try { return await storageContext.run({ dir, collection, lease }, operation); }
    finally { await lease.release(); }
  } finally {
    release();
    if (collectionLocks.get(key) === queued) collectionLocks.delete(key);
  }
}

export const storage = {
  // A ledger transaction is committed by one atomic file rename. The callback
  // must not recursively acquire the same collection lock.
  async transact<T, R>(collection: string, operation: (items: T[]) => Promise<R> | R): Promise<R> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      const result = await operation(items);
      await writeCollection(collection, items);
      return result;
    });
  },
  // Destination IDs are stable so retrying after a failed source write is safe.
  async convertCapture(id: string, targetType: string, collection: string, data: Record<string, unknown>, targetIdOverride?: string) {
    return withCollectionLock('captures', async () => {
      const captures = await readCollection<{ id: string; status: string; targetType?: string; targetId?: string }>('captures');
      const capture = captures.find(item => item.id === id);
      if (!capture) throw new Error('Captura não encontrada');
      if (capture.targetId && capture.targetType !== 'note') {
        if (capture.targetType !== targetType) throw new Error('Esta captura já foi convertida para outro destino');
        return { id: capture.targetId, targetType };
      }
      const targetId = targetIdOverride || (targetType === 'note' ? id : `capture-${id}`);
      if (targetType !== 'note') {
        await withCollectionLock(collection, async () => {
          const items = await readCollection<{ id: string }>(collection);
          if (!items.some(item => item.id === targetId)) {
            const now = new Date().toISOString();
            items.push({ ...data, id: targetId, createdAt: now, updatedAt: now } as { id: string });
            await writeCollection(collection, items);
          }
        });
      }
      Object.assign(capture, { status: targetType === 'note' ? 'noted' : 'organized', targetType, targetId, updatedAt: new Date().toISOString() });
      await writeCollection('captures', captures);
      return { id: targetId, targetType };
    });
  },
  async getAll<T>(collection: string): Promise<T[]> {
    return readCollection<T>(collection);
  },

  async getById<T extends { id: string }>(collection: string, id: string): Promise<T | null> {
    const items = await readCollection<T>(collection);
    return items.find(item => item.id === id) || null;
  },

  async create<T extends { id: string }>(collection: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      const now = new Date().toISOString();
      const newItem = {
        ...data,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      } as unknown as T;
      items.push(newItem);
      await writeCollection(collection, items);
      return newItem;
    });
  },

  // Stable identity survives failure of a separate receipt write or a process restart.
  async createOnce<T extends { id: string }>(collection: string, id: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      const existing = items.find(item => item.id === id);
      if (existing) return existing;
      const now = new Date().toISOString();
      const item = { ...data, id, createdAt: now, updatedAt: now } as unknown as T;
      items.push(item);
      await writeCollection(collection, items);
      return item;
    });
  },

  async update<T extends { id: string }>(collection: string, id: string, data: Partial<T>): Promise<T | null> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return null;

      const now = new Date().toISOString();
      items[index] = { ...items[index], ...data, id, updatedAt: now } as T;
      await writeCollection(collection, items);
      return items[index];
    });
  },

  async updateChecked<T extends { id: string; updatedAt?: string }>(collection: string, id: string, data: Partial<T>, expectedUpdatedAt?: string): Promise<T | null> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      const current = items.find(item => item.id === id); if (!current) return null;
      if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) throw new Error('Conflito de versão. Releia o registro antes de alterar.');
      const next = { ...current, ...data, id, updatedAt: new Date().toISOString() } as T;
      items[items.indexOf(current)] = next; await writeCollection(collection, items); return next;
    });
  },

  async delete<T extends { id: string }>(collection: string, id: string): Promise<boolean> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      assertDeletable(collection, items.filter(item => item.id === id), items);
      const filtered = items.filter(item => item.id !== id);
      if (filtered.length === items.length) return false;
      await writeCollection(collection, filtered);
      return true;
    });
  },

  async deleteWhere<T extends { id: string }>(collection: string, predicate: (item: T) => boolean): Promise<number> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      assertDeletable(collection, items.filter(predicate), items);
      const kept = items.filter(item => !predicate(item));
      if (kept.length === items.length) return 0;
      await writeCollection(collection, kept);
      return items.length - kept.length;
    });
  },

  async query<T>(collection: string, filters: Record<string, unknown>): Promise<T[]> {
    const items = await readCollection<T>(collection);
    return items.filter(item => {
      return Object.entries(filters).every(([key, value]) =>
        (item as Record<string, unknown>)[key] === value
      );
    });
  },

  async updateMany<T extends { id: string }>(collection: string, ids: string[], data: Partial<T>): Promise<T[]> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      const wanted = new Set(ids);
      const now = new Date().toISOString();
      const updated: T[] = [];
      for (let index = 0; index < items.length; index += 1) {
        if (!wanted.has(items[index].id)) continue;
        items[index] = { ...items[index], ...data, id: items[index].id, updatedAt: now } as T;
        updated.push(items[index]);
      }
      if (updated.length > 0) await writeCollection(collection, items);
      return updated;
    });
  },

  async deleteMany<T extends { id: string }>(collection: string, ids: string[]): Promise<string[]> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      assertDeletable(collection, items.filter(item => ids.includes(item.id)), items);
      const wanted = new Set(ids);
      const deleted = items.filter((item) => wanted.has(item.id)).map((item) => item.id);
      if (deleted.length > 0) {
        await writeCollection(collection, items.filter((item) => !wanted.has(item.id)));
      }
      return deleted;
    });
  },
};
