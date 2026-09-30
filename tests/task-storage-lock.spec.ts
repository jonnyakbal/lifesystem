import { test, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import type { Task } from '../src/types';

test('task writes wait for a collection lock held by another process', async () => {
  const previous = process.env.LIFESYSTEM_DATA_DIR;
  const dir = await mkdtemp(join(tmpdir(), 'ls-task-lock-'));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  const lock = join(dir, '.tasks.lock');
  try {
    await mkdir(lock);
    let finished = false;
    const pending = storage.createOnce<Task>('tasks', crypto.randomUUID(), { title: 'Caminhar', status: 'todo', priority: 'normal', sortOrder: 0, tags: [], checklist: [] }).then(result => { finished = true; return result; });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(finished).toBe(false);
    await rm(lock, { recursive: true });
    expect((await pending).title).toBe('Caminhar');
    expect(await storage.getAll<Task>('tasks')).toHaveLength(1);
  } finally {
    await rm(lock, { recursive: true, force: true });
    if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
