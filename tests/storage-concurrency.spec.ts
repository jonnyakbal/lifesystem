import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { storage } from '../src/lib/storage';

const workerSource = `
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText, file);
const { storage } = require(process.env.STORAGE_MODULE);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
process.send('ready');
process.once('message', async () => {
  try {
    if (process.env.STORAGE_MODE === 'hold') {
      await storage.transact(process.env.STORAGE_COLLECTION, async items => {
        process.send('locked');
        await new Promise(resolve => process.once('message', resolve));
        items.push({ id: 'holder' });
      });
    } else {
      for (let i = 0; i < 6; i++) {
        await storage.transact(process.env.STORAGE_COLLECTION, async items => {
          await delay(45);
          items.push({ id: process.env.STORAGE_ID + '-' + i });
        });
      }
    }
    process.exit(0);
  } catch (error) { console.error(error); process.exit(1); }
});
`;

function worker(dir: string, collection: string, mode = 'append', id = 'one') {
  const child = spawn(process.execPath, ['-e', workerSource], {
    cwd: resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, LIFESYSTEM_DATA_DIR: dir, STORAGE_MODULE: resolve(__dirname, '../src/lib/storage/index.ts'), STORAGE_COLLECTION: collection, STORAGE_MODE: mode, STORAGE_ID: id },
  });
  let output = '';
  child.stdout!.on('data', data => { output += String(data); });
  child.stderr!.on('data', data => { output += String(data); });
  const messages = new Set<string>();
  child.on('message', value => { messages.add(String(value)); });
  const exited = new Promise<void>((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 || signal ? resolveExit() : reject(new Error(`Storage worker exited ${code}: ${output}`)));
  });
  // Attach a handler immediately so failure before the next await is reported by the test.
  void exited.catch(() => undefined);
  return { child, exited, async message(value: string) { await expect.poll(() => messages.has(value)).toBe(true); } };
}

let dir: string;
let oldDir: string | undefined;
let children: ChildProcess[];
test.beforeEach(async () => {
  oldDir = process.env.LIFESYSTEM_DATA_DIR;
  dir = await mkdtemp(join(tmpdir(), 'ls-storage-concurrency-'));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  children = [];
});
test.afterEach(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolveExit => child.once('exit', resolveExit));
      child.kill();
      await exited;
    }
  }
  if (oldDir === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
  else process.env.LIFESYSTEM_DATA_DIR = oldDir;
  await rm(dir, { recursive: true, force: true });
});

for (const collection of ['tasks', 'projects', 'captures', 'finance_transactions', 'recurring_runs']) {
  test(`${collection}: concurrent child processes retain every transaction`, async () => {
    const first = worker(dir, collection, 'append', 'first');
    const second = worker(dir, collection, 'append', 'second');
    children.push(first.child, second.child);
    await Promise.all([first.message('ready'), second.message('ready')]);
    first.child.send('go'); second.child.send('go');
    await Promise.all([first.exited, second.exited]);
    const items = await storage.getAll<{ id: string }>(collection);
    expect(items).toHaveLength(12);
    expect(new Set(items.map(item => item.id)).size).toBe(12);
    expect((await readdir(dir)).filter(file => file.endsWith('.tmp') || file.endsWith('.lock'))).toEqual([]);
  });
}

test('a live owner is not stolen when its heartbeat timestamp is over 60 seconds old', async () => {
  const owner = worker(dir, 'tasks', 'hold'); children.push(owner.child);
  await owner.message('ready'); owner.child.send('go'); await owner.message('locked');
  const old = new Date(Date.now() - 120_000);
  await utimes(join(dir, '.tasks.lock'), old, old);
  let finished = false;
  const pending = storage.createOnce('tasks', 'waiter', {}).then(() => { finished = true; });
  await new Promise(resolveWait => setTimeout(resolveWait, 180));
  const prematurelyFinished = finished;
  owner.child.send('release');
  await Promise.all([pending, owner.exited]);
  expect(prematurelyFinished).toBe(false);
  expect(await storage.getAll('tasks')).toHaveLength(2);
});

test('collection owner heartbeat advances while the callback is running', async () => {
  const owner = worker(dir, 'projects', 'hold'); children.push(owner.child);
  await owner.message('ready'); owner.child.send('go'); await owner.message('locked');
  const lock = join(dir, '.projects.lock');
  const before = (await stat(lock)).mtimeMs;
  await expect.poll(async () => (await stat(lock)).mtimeMs, { timeout: 4000 }).toBeGreaterThan(before);
  owner.child.send('release'); await owner.exited;
});

test('a stale lock of a terminated owner is recovered', async () => {
  const owner = worker(dir, 'tasks', 'hold'); children.push(owner.child);
  await owner.message('ready'); owner.child.send('go'); await owner.message('locked');
  owner.child.kill(); await owner.exited;
  const old = new Date(Date.now() - 120_000);
  await utimes(join(dir, '.tasks.lock'), old, old);
  await storage.createOnce('tasks', 'recovered', {});
  expect(await storage.getAll('tasks')).toEqual([expect.objectContaining({ id: 'recovered' })]);
});

test('callback failure preserves data and releases the lock for the next writer', async () => {
  await storage.createOnce('projects', 'original', {});
  await expect(storage.transact<{ id: string }, void>('projects', items => {
    items.push({ id: 'discarded' }); throw new Error('Callback failed');
  })).rejects.toThrow('Callback failed');
  await storage.createOnce('projects', 'next', {});
  expect((await storage.getAll<{ id: string }>('projects')).map(item => item.id)).toEqual(['original', 'next']);
  expect(await readdir(dir)).toEqual(['projects.json']);
});

test('a writer with a replaced lease cannot commit or remove the replacement owner', async () => {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(resolveEnter => { enter = resolveEnter; });
  const gate = new Promise<void>(resolveRelease => { release = resolveRelease; });
  const pending = storage.transact<{ id: string }, void>('projects', async items => {
    enter(); await gate; items.push({ id: 'must-not-commit' });
  });
  void pending.catch(() => undefined);
  await entered;
  const lock = join(dir, '.projects.lock');
  await rm(lock, { recursive: true });
  await mkdir(lock);
  const replacement = { token: 'replacement-owner', pid: process.pid, host: hostname() };
  await writeFile(join(lock, 'owner.json'), JSON.stringify(replacement));
  release();
  await expect(pending).rejects.toThrow(/trava.*perdida/i);
  expect(JSON.parse(await readFile(join(lock, 'owner.json'), 'utf8'))).toEqual(replacement);
  expect(await storage.getAll('projects')).toEqual([]);
});

test('the same collection in separate data directories proceeds independently and retains its original directory', async () => {
  const other = join(dir, 'other');
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(resolveEnter => { enter = resolveEnter; });
  const gate = new Promise<void>(resolveRelease => { release = resolveRelease; });
  const pending = storage.transact<{ id: string }, void>('projects', async items => {
    enter(); await gate; items.push({ id: 'first-dir' });
  });
  await entered;
  process.env.LIFESYSTEM_DATA_DIR = other;
  let finished = false;
  const independent = storage.createOnce('projects', 'other-dir', {}).then(() => { finished = true; });
  await new Promise(resolveWait => setTimeout(resolveWait, 180));
  const independentlyFinished = finished;
  release(); await Promise.all([pending, independent]);
  expect(independentlyFinished).toBe(true);
  expect(JSON.parse(await readFile(join(dir, 'projects.json'), 'utf8'))).toEqual([{ id: 'first-dir' }]);
  expect(JSON.parse(await readFile(join(other, 'projects.json'), 'utf8'))).toEqual([expect.objectContaining({ id: 'other-dir' })]);
});

test('malformed collection names reject before reading or writing any file', async () => {
  for (const name of ['', '..', '../escape', '..\\escape', '/absolute', 'C:\\escape', '.hidden', 'bad/name', 'bad\\name', 'tasks.json', 'CON', 'nul']) {
    await expect(storage.getAll(name)).rejects.toThrow(/coleção inválid/i);
    await expect(storage.createOnce(name, 'unsafe', {})).rejects.toThrow(/coleção inválid/i);
  }
  expect(await readdir(dir)).toEqual([]);
});
