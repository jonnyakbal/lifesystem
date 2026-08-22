import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');

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
  } catch {
    return [];
  }
}

async function writeCollection<T>(name: string, data: T[]): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `${name}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export const storage = {
  async getAll<T>(collection: string): Promise<T[]> {
    return readCollection<T>(collection);
  },

  async getById<T extends { id: string }>(collection: string, id: string): Promise<T | null> {
    const items = await readCollection<T>(collection);
    return items.find(item => item.id === id) || null;
  },

  async create<T extends { id: string }>(collection: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const items = await readCollection<T>(collection);
    const now = new Date().toISOString();
    const newItem = {
      ...data,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    } as unknown as T;
    items.push(newItem);
    await writeCollection(collection, items);
    return newItem;
  },

  async update<T extends { id: string }>(collection: string, id: string, data: Partial<T>): Promise<T | null> {
    const items = await readCollection<T>(collection);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    const now = new Date().toISOString();
    items[index] = { ...items[index], ...data, id, updatedAt: now } as T;
    await writeCollection(collection, items);
    return items[index];
  },

  async delete<T extends { id: string }>(collection: string, id: string): Promise<boolean> {
    const items = await readCollection<T>(collection);
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length === items.length) return false;
    await writeCollection(collection, filtered);
    return true;
  },

  async query<T>(collection: string, filters: Record<string, unknown>): Promise<T[]> {
    const items = await readCollection<T>(collection);
    return items.filter(item => {
      return Object.entries(filters).every(([key, value]) =>
        (item as Record<string, unknown>)[key] === value
      );
    });
  },
};
