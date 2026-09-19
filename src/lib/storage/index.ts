import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

const DATA_DIR = process.env.LIFESYSTEM_DATA_DIR
  ? path.resolve(process.env.LIFESYSTEM_DATA_DIR)
  : path.join(process.cwd(), 'data');
const collectionLocks = new Map<string, Promise<void>>();

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readCollection<T>(name: string): Promise<T[]> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `${name}.json`);
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
  const filePath = path.join(DATA_DIR, `${name}.json`);
  const tempPath = path.join(DATA_DIR, `.${name}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
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
    return await operation();
  } finally {
    release();
    if (collectionLocks.get(collection) === queued) collectionLocks.delete(collection);
  }
}

export const storage = {
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

  async delete<T extends { id: string }>(collection: string, id: string): Promise<boolean> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
      const filtered = items.filter(item => item.id !== id);
      if (filtered.length === items.length) return false;
      await writeCollection(collection, filtered);
      return true;
    });
  },

  async deleteWhere<T extends { id: string }>(collection: string, predicate: (item: T) => boolean): Promise<number> {
    return withCollectionLock(collection, async () => {
      const items = await readCollection<T>(collection);
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
      const wanted = new Set(ids);
      const deleted = items.filter((item) => wanted.has(item.id)).map((item) => item.id);
      if (deleted.length > 0) {
        await writeCollection(collection, items.filter((item) => !wanted.has(item.id)));
      }
      return deleted;
    });
  },
};
