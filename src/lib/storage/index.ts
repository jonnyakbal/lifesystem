import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

function dataDir() {
  return process.env.LIFESYSTEM_DATA_DIR
    ? path.resolve(process.env.LIFESYSTEM_DATA_DIR)
    : path.join(process.cwd(), 'data');
}
const collectionLocks = new Map<string, Promise<void>>();

function assertDeletable(collection: string, items: unknown[]) {
  if (collection === 'tasks' && items.some(item => Boolean((item as { planning?: { eventId?: string } }).planning?.eventId))) {
    throw new Error('Esta tarefa possui evento espelhado. Remova o bloco em Planejar antes de excluir a tarefa.');
  }
}

async function ensureDataDir() {
  const dir = dataDir();
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function readCollection<T>(name: string): Promise<T[]> {
  await ensureDataDir();
  const filePath = path.join(dataDir(), `${name}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw new Error(`Não foi possível ler a coleção ${name}: ${String(error)}`);
  }
}

async function writeCollection<T>(name: string, data: T[]): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(dataDir(), `${name}.json`);
  const tempPath = path.join(dataDir(), `.${name}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    for (let attempt = 0; ; attempt++) {
      try {
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
  const previous = collectionLocks.get(collection) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  collectionLocks.set(collection, queued);
  await previous;
  try {
    if (collection !== 'tasks') return await operation();
    // Task actions can be written by the web app and MCP in separate workers.
    // Keep the read/modify/rename sequence exclusive across those processes.
    await ensureDataDir();
    const fileLock = path.join(dataDir(), '.tasks.lock');
    const deadline = Date.now() + 10_000;
    while (true) {
      try { await fs.mkdir(fileLock); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const stat = await fs.stat(fileLock).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > 60_000) await fs.rm(fileLock, { recursive: true, force: true }).catch(() => undefined);
        if (Date.now() >= deadline) throw new Error('Tarefas ocupadas; tente novamente com a mesma chave.');
        await new Promise(resolve => setTimeout(resolve, 25 + Math.floor(Math.random() * 25)));
      }
    }
    try { return await operation(); }
    finally { await fs.rmdir(fileLock).catch(() => undefined); }
  } finally {
    release();
    if (collectionLocks.get(collection) === queued) collectionLocks.delete(collection);
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
      assertDeletable(collection, items.filter(item => item.id === id));
      const filtered = items.filter(item => item.id !== id);
      if (filtered.length === items.length) return false;
      await writeCollection(collection, filtered);
      return true;
    });
  },

  async deleteWhere<T extends { id: string }>(collection: string, predicate: (item: T) => boolean): Promise<number> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      assertDeletable(collection, items.filter(predicate));
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
      assertDeletable(collection, items.filter(item => ids.includes(item.id)));
      const wanted = new Set(ids);
      const deleted = items.filter((item) => wanted.has(item.id)).map((item) => item.id);
      if (deleted.length > 0) {
        await writeCollection(collection, items.filter((item) => !wanted.has(item.id)));
      }
      return deleted;
    });
  },
};
