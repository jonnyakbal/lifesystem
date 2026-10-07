import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import initSqlJs from 'sql.js';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { storage } from '../src/lib/storage';
import { askAI } from '../src/lib/ai';
import { copyToD1, migrationPlan } from '../src/lib/storage/d1-migration';
import { writeFile, readFile } from 'node:fs/promises';

// A local stand-in for Cloudflare's REST API backed by real SQLite, so the
// production D1 code path (HTTP, lease and fenced writes) runs unmodified.
const ACCOUNT = 'acct-test';
const DATABASE = 'db-test';
const TOKEN = 'd1-synthetic-token';
const AI_TOKEN = 'ai-synthetic-token';

let server: Server;
let db: DatabaseSync;
let base: string;
const aiRequests: Record<string, unknown>[] = [];
let throttleNext = 0;
let collectionSelects = 0;

// Real SQLite (sql.js, WebAssembly) so the suite also runs on the Node 20 CI.
type Statement = { all(...params: unknown[]): unknown[]; get(...params: unknown[]): unknown; run(...params: unknown[]): { changes: number } };
type DatabaseSync = { exec(sql: string): void; prepare(sql: string): Statement; close(): void };
async function openDatabase(): Promise<DatabaseSync> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const rows = (sql: string, params: unknown[]) => {
    const statement = raw.prepare(sql);
    statement.bind(params as never);
    const out: Record<string, unknown>[] = [];
    while (statement.step()) out.push(statement.getAsObject());
    statement.free();
    return out;
  };
  return {
    exec: (sql) => { raw.exec(sql); },
    close: () => raw.close(),
    prepare: (sql) => ({
      all: (...params) => rows(sql, params),
      get: (...params) => rows(sql, params)[0],
      run: (...params) => { raw.run(sql, params as never); return { changes: raw.getRowsModified() }; },
    }),
  };
}

function reply(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

test.beforeAll(async () => {
  // One database for the file: the app creates its schema once per process.
  db = await openDatabase();
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      if (req.url === `/client/v4/accounts/${ACCOUNT}/ai/v1/chat/completions`) {
        if (req.headers.authorization !== `Bearer ${AI_TOKEN}`) return reply(res, 401, { errors: [{ message: 'bad token' }] });
        aiRequests.push(body);
        return reply(res, 200, { choices: [{ message: { role: 'assistant', content: 'Resposta do Workers AI' } }] });
      }
      if (req.url !== `/client/v4/accounts/${ACCOUNT}/d1/database/${DATABASE}/query`) return reply(res, 404, { success: false, errors: [{ message: 'not found' }] });
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return reply(res, 403, { success: false, errors: [{ message: 'Authentication error' }] });
      if (throttleNext > 0) {
        throttleNext--;
        res.setHeader('Retry-After', '0');
        return reply(res, 429, { success: false, errors: [{ message: 'rate limited' }] });
      }
      const sql = String(body.sql);
      if (/^\s*SELECT rev, encoding, data FROM lifesystem_collections/i.test(sql)) collectionSelects++;
      const params: unknown[] = body.params || [];
      try {
        // Mirrors D1: parameters are only accepted with a single statement.
        if (params.length && sql.trim().replace(/;$/, '').includes(';')) {
          return reply(res, 400, { success: false, errors: [{ message: 'params with multiple statements is not supported' }] });
        }
        if (!params.length && sql.includes(';')) {
          db.exec(sql);
          return reply(res, 200, { success: true, errors: [], result: [{ results: [], success: true, meta: { changes: 0 } }] });
        }
        const statement = db.prepare(sql);
        if (/^\s*select/i.test(sql)) {
          return reply(res, 200, { success: true, errors: [], result: [{ results: statement.all(...(params as string[])), success: true, meta: { changes: 0 } }] });
        }
        const outcome = statement.run(...(params as string[]));
        return reply(res, 200, { success: true, errors: [], result: [{ results: [], success: true, meta: { changes: Number(outcome.changes) } }] });
      } catch (error) {
        return reply(res, 400, { success: false, errors: [{ code: 7500, message: String((error as Error).message) }] });
      }
    });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/client/v4`;
});

test.afterAll(async () => {
  await new Promise(done => server.close(done));
  db.close();
});

const saved: Record<string, string | undefined> = {};
const ENV = ['LIFESYSTEM_STORAGE', 'LIFESYSTEM_DATA_DIR', 'LIFESYSTEM_BACKUP_DIR', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_D1_API_TOKEN', 'CLOUDFLARE_API_BASE', 'AI_CLOUDFLARE_API_KEY'];
let dataDir: string;
let children: ChildProcess[];

test.beforeEach(async () => {
  for (const key of ENV) saved[key] = process.env[key];
  for (const table of ['lifesystem_collections', 'lifesystem_locks']) {
    const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    if (exists) db.exec(`DELETE FROM ${table}`);
  }
  dataDir = await mkdtemp(join(tmpdir(), 'ls-storage-d1-'));
  Object.assign(process.env, {
    LIFESYSTEM_STORAGE: 'd1', LIFESYSTEM_DATA_DIR: dataDir,
    CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_D1_DATABASE_ID: DATABASE, CLOUDFLARE_D1_API_TOKEN: TOKEN, CLOUDFLARE_API_BASE: base,
  });
  children = [];
});

test.afterEach(async () => {
  for (const child of children) if (child.exitCode === null) child.kill();
  for (const key of ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  await rm(dataDir, { recursive: true, force: true });
});

test('CRUD goes to D1 and never touches the data directory', async () => {
  const created = await storage.create<{ id: string; title: string }>('tasks', { title: 'Primeira' });
  await storage.createOnce('tasks', 'fixed-id', { title: 'Estável' });
  await storage.createOnce('tasks', 'fixed-id', { title: 'Ignorada' });
  await storage.update<{ id: string; title: string }>('tasks', created.id, { title: 'Renomeada' });
  expect((await storage.getById<{ id: string; title: string }>('tasks', created.id))?.title).toBe('Renomeada');
  expect(await storage.query('tasks', { title: 'Estável' })).toHaveLength(1);
  expect(await storage.delete('tasks', 'fixed-id')).toBe(true);
  expect((await storage.getAll<{ id: string }>('tasks')).map(item => item.id)).toEqual([created.id]);
  expect(await storage.getAll('projects')).toEqual([]);

  const row = db.prepare('SELECT encoding, data FROM lifesystem_collections WHERE name = ?').get('tasks') as { encoding: string; data: string };
  expect(row.encoding).toBe('json');
  expect(JSON.parse(row.data)).toEqual([expect.objectContaining({ id: created.id, title: 'Renomeada' })]);
  expect(db.prepare('SELECT COUNT(*) AS n FROM lifesystem_locks').get()).toEqual(expect.objectContaining({ n: 0 }));
  expect(await readdir(dataDir)).toEqual([]);
});

test('capture conversion commits both collections through D1', async () => {
  await storage.createOnce('captures', 'cap-1', { status: 'inbox', text: 'Ideia' });
  const result = await storage.convertCapture('cap-1', 'task', 'tasks', { title: 'Ideia' });
  expect(result).toEqual({ id: 'capture-cap-1', targetType: 'task' });
  expect(await storage.getById('tasks', 'capture-cap-1')).toEqual(expect.objectContaining({ title: 'Ideia' }));
  expect(await storage.getById('captures', 'cap-1')).toEqual(expect.objectContaining({ status: 'organized', targetId: 'capture-cap-1' }));
});

test('a large collection is stored compressed and read back intact', async () => {
  const body = 'x'.repeat(4000);
  await storage.transact<{ id: string; body: string }, void>('notes', items => {
    for (let index = 0; index < 500; index++) items.push({ id: `note-${index}`, body: `${index}-${body}` });
  });
  const row = db.prepare('SELECT encoding FROM lifesystem_collections WHERE name = ?').get('notes') as { encoding: string };
  expect(row.encoding).toBe('gzip-base64');
  const notes = await storage.getAll<{ id: string; body: string }>('notes');
  expect(notes).toHaveLength(500);
  expect(notes[499].body).toBe(`499-${body}`);
});

test('a writer whose lease was taken over cannot commit nor delete the new owner', async () => {
  await storage.createOnce('tasks', 'original', {});
  let entered!: () => void;
  let proceed!: () => void;
  const inside = new Promise<void>(done => { entered = done; });
  const gate = new Promise<void>(done => { proceed = done; });
  const writing = storage.transact<{ id: string }, void>('tasks', async items => {
    entered(); await gate; items.push({ id: 'late' });
  });
  await inside;
  db.prepare("UPDATE lifesystem_locks SET owner = 'intruder' WHERE name = 'tasks'").run();
  proceed();
  await expect(writing).rejects.toThrow('Trava da coleção tasks perdida.');
  expect((await storage.getAll<{ id: string }>('tasks')).map(item => item.id)).toEqual(['original']);
  expect(db.prepare('SELECT owner FROM lifesystem_locks WHERE name = ?').get('tasks')).toEqual(expect.objectContaining({ owner: 'intruder' }));
});

test('a write is refused when the collection changed after it was read', async () => {
  await storage.createOnce('tasks', 'original', {});
  await expect(storage.transact<{ id: string }, void>('tasks', items => {
    db.prepare("UPDATE lifesystem_collections SET rev = 'someone-else' WHERE name = 'tasks'").run();
    items.push({ id: 'stale' });
  })).rejects.toThrow('Trava da coleção tasks perdida.');
  expect((await storage.getAll<{ id: string }>('tasks')).map(item => item.id)).toEqual(['original']);
});

test('an expired lease of a dead owner is taken over', async () => {
  db.exec(`CREATE TABLE IF NOT EXISTS lifesystem_locks (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL)`);
  db.prepare("INSERT INTO lifesystem_locks VALUES ('tasks', 'crashed', 0)").run();
  await storage.createOnce('tasks', 'recovered', {});
  expect((await storage.getAll<{ id: string }>('tasks')).map(item => item.id)).toEqual(['recovered']);
});

const workerSource = `
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText, file);
const { storage } = require(process.env.STORAGE_MODULE);
(async () => {
  for (let i = 0; i < 5; i++) {
    await storage.transact('tasks', async items => {
      await new Promise(resolve => setTimeout(resolve, 30));
      items.push({ id: process.env.STORAGE_ID + '-' + i });
    });
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
`;

test('concurrent processes sharing one D1 database keep every transaction', async () => {
  const runs = ['a', 'b', 'c'].map(id => {
    const child = spawn(process.execPath, ['-e', workerSource], {
      cwd: resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, STORAGE_MODULE: resolve(__dirname, '../src/lib/storage/index.ts'), STORAGE_ID: id },
    });
    children.push(child);
    let output = '';
    child.stdout!.on('data', data => { output += String(data); });
    child.stderr!.on('data', data => { output += String(data); });
    return new Promise<void>((done, fail) => child.once('exit', code => code === 0 ? done() : fail(new Error(`worker ${id} exited ${code}: ${output}`))));
  });
  await Promise.all(runs);
  const items = await storage.getAll<{ id: string }>('tasks');
  expect(items).toHaveLength(15);
  expect(new Set(items.map(item => item.id)).size).toBe(15);
});

function runScript(script: string, args: string[] = []) {
  return new Promise<string>((done, fail) => {
    const child = spawn(process.execPath, [resolve(__dirname, '../scripts', script), ...args], { cwd: resolve(__dirname, '..'), env: process.env });
    children.push(child);
    let output = '';
    child.stdout.on('data', data => { output += String(data); });
    child.stderr.on('data', data => { output += String(data); });
    child.once('exit', code => code === 0 ? done(output) : fail(new Error(`${script} exited ${code}: ${output}`)));
  });
}

test('import moves JSON collections into D1 without overwriting, and export restores the files', async () => {
  const { writeFile, readFile } = await import('node:fs/promises');
  await writeFile(join(dataDir, 'tasks.json'), JSON.stringify([{ id: 't1', title: 'Do arquivo' }]));
  await writeFile(join(dataDir, 'projects.json'), JSON.stringify([]));
  await writeFile(join(dataDir, 'health-ledger.json'), JSON.stringify({ id: 'health-v1' }));
  await writeFile(join(dataDir, 'office-abc.json'), JSON.stringify({}));

  expect(await runScript('d1-import.mjs', ['--dry-run'])).toContain('importaria tasks (1 itens)');
  expect(await storage.getAll('tasks')).toEqual([]);
  const first = await runScript('d1-import.mjs');
  expect(first).toContain('2 de 2 coleções gravadas no D1.');
  expect(first).toContain('ignorado   health-ledger.json');
  expect(await storage.getAll('tasks')).toEqual([{ id: 't1', title: 'Do arquivo' }]);

  await storage.update<{ id: string; title: string }>('tasks', 't1', { title: 'Editada no D1' });
  expect(await runScript('d1-import.mjs')).toContain('mantido    tasks');
  expect((await storage.getById<{ id: string; title: string }>('tasks', 't1'))?.title).toBe('Editada no D1');

  const out = join(dataDir, 'export');
  expect(await runScript('d1-export.mjs', [out])).toContain('(2 coleções)');
  expect(JSON.parse(await readFile(join(out, 'tasks.json'), 'utf8'))).toEqual([expect.objectContaining({ id: 't1', title: 'Editada no D1' })]);
  expect((await readdir(out)).sort()).toEqual(['projects.json', 'tasks.json']);
});

test('backup in D1 mode exports the collections into a manifest-verified snapshot', async () => {
  const { writeFile, readFile } = await import('node:fs/promises');
  await storage.createOnce('tasks', 'from-d1', { title: 'No banco' });
  // A stale file from before the migration must not win over D1.
  await writeFile(join(dataDir, 'tasks.json'), JSON.stringify([{ id: 'stale' }]));
  await writeFile(join(dataDir, 'health-ledger.json'), JSON.stringify({ id: 'health-v1' }));
  const backups = join(dataDir, 'snapshots');
  process.env.LIFESYSTEM_BACKUP_DIR = backups;
  expect(await runScript('backup-data.mjs')).toContain('inclui D1');
  const snapshot = join(backups, (await readdir(backups))[0]);
  const manifest = JSON.parse(await readFile(join(snapshot, 'manifest.json'), 'utf8'));
  expect(manifest.storage).toBe('d1');
  expect(manifest.files.map((f: { path: string }) => f.path).sort()).toEqual(['health-ledger.json', 'tasks.json']);
  expect(JSON.parse(await readFile(join(snapshot, 'tasks.json'), 'utf8'))).toEqual([expect.objectContaining({ id: 'from-d1' })]);
  expect((await readdir(snapshot)).sort()).toEqual(['health-ledger.json', 'manifest.json', 'tasks.json']);
});

test('in-app migration copies, verifies, never overwrites unasked and leaves files untouched', async () => {
  process.env.LIFESYSTEM_STORAGE = 'file';
  const tasks = [{ id: 't1', title: 'Sintética' }];
  const notes = [{ id: 'n1', body: 'Nota sintética' }];
  await writeFile(join(dataDir, 'tasks.json'), JSON.stringify(tasks));
  await writeFile(join(dataDir, 'notes.json'), JSON.stringify(notes));
  await writeFile(join(dataDir, 'health-ledger.json'), JSON.stringify({ receipts: [] }));
  await writeFile(join(dataDir, 'broken.json'), '{not json');
  const before = await readFile(join(dataDir, 'tasks.json'), 'utf8');

  const plan = await migrationPlan();
  expect(plan).toMatchObject({ mode: 'file', d1Configured: true, ready: false });
  const status = Object.fromEntries(plan.collections.map(c => [c.name, c.status]));
  expect(status).toEqual({ broken: 'invalid', 'health-ledger': 'separate', notes: 'missing', tasks: 'missing' });

  // Something different already in D1 is kept until explicitly named.
  process.env.LIFESYSTEM_STORAGE = 'd1';
  await storage.create('notes', { body: 'Outra versão' });
  process.env.LIFESYSTEM_STORAGE = 'file';
  const first = Object.fromEntries((await copyToD1()).map(r => [r.name, r.outcome]));
  expect(first).toMatchObject({ tasks: 'copied', notes: 'kept', broken: 'skipped', 'health-ledger': 'skipped' });
  expect((await migrationPlan()).collections.find(c => c.name === 'notes')?.status).toBe('different');

  const second = Object.fromEntries((await copyToD1(['notes'])).map(r => [r.name, r.outcome]));
  expect(second).toMatchObject({ tasks: 'unchanged', notes: 'replaced' });
  await rm(join(dataDir, 'broken.json'));
  const done = await migrationPlan();
  expect(done.ready).toBe(true);
  expect(done.collections.filter(c => c.name !== 'health-ledger').every(c => c.status === 'same')).toBe(true);

  process.env.LIFESYSTEM_STORAGE = 'd1';
  expect(await storage.getAll('tasks')).toEqual(tasks);
  expect(await storage.getAll('notes')).toEqual(notes);
  expect(await readFile(join(dataDir, 'tasks.json'), 'utf8')).toBe(before);
});

test('after the switch to D1 the old files can no longer be copied over newer records', async () => {
  process.env.LIFESYSTEM_STORAGE = 'd1';
  await writeFile(join(dataDir, 'tasks.json'), JSON.stringify([{ id: 'old' }]));
  await storage.create('tasks', { title: 'Nova no D1' });
  await expect(copyToD1(['tasks'])).rejects.toThrow('já usa o D1');
  expect((await storage.getAll<{ title?: string }>('tasks')).map(t => t.title)).toEqual(['Nova no D1']);
});

test('migration refuses to run without D1 credentials', async () => {
  delete process.env.CLOUDFLARE_D1_API_TOKEN;
  await expect(copyToD1()).rejects.toThrow('D1 não configurado');
  expect((await migrationPlan()).d1Configured).toBe(false);
});

test('overlapping reads share one D1 call, give independent copies and never hide a later write', async () => {
  await storage.create('tasks', { title: 'A' });
  collectionSelects = 0;
  const [one, two, three] = await Promise.all([storage.getAll<{ title: string }>('tasks'), storage.getAll<{ title: string }>('tasks'), storage.getAll<{ title: string }>('tasks')]);
  expect(collectionSelects).toBe(1);
  one[0].title = 'mutado só aqui';
  expect(two[0].title).toBe('A');
  expect(three).toHaveLength(1);

  const slowRead = storage.getAll('tasks');
  await storage.create('tasks', { title: 'B' });
  expect((await storage.getAll<{ title: string }>('tasks')).map(t => t.title)).toEqual(['A', 'B']);
  await slowRead;
});

test('a Cloudflare 429 is waited out and retried instead of failing the request', async () => {
  throttleNext = 2;
  const created = await storage.create<{ id: string; title: string }>('tasks', { title: 'Depois do limite' });
  expect(throttleNext).toBe(0);
  throttleNext = 1;
  expect((await storage.getById<{ title: string }>('tasks', created.id))?.title).toBe('Depois do limite');
});

test('storage fails closed on an unknown backend or incomplete D1 configuration', async () => {
  process.env.LIFESYSTEM_STORAGE = 'postgres';
  await expect(storage.getAll('tasks')).rejects.toThrow('LIFESYSTEM_STORAGE inválido');
  process.env.LIFESYSTEM_STORAGE = 'd1';
  delete process.env.CLOUDFLARE_D1_API_TOKEN;
  await expect(storage.getAll('tasks')).rejects.toThrow('CLOUDFLARE_D1_API_TOKEN');
  process.env.CLOUDFLARE_D1_API_TOKEN = 'wrong';
  await expect(storage.getAll('tasks')).rejects.toThrow('Authentication error');
  expect(await readdir(dataDir)).toEqual([]);
  expect(db.prepare('SELECT COUNT(*) AS n FROM lifesystem_collections').get()).toEqual(expect.objectContaining({ n: 0 }));
});

test('Workers AI answers through the OpenAI-compatible endpoint only when fully configured', async () => {
  process.env.AI_CLOUDFLARE_API_KEY = AI_TOKEN;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  await expect(askAI('Olá')).rejects.toThrow('Nenhum provedor de IA configurado.');
  process.env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT;
  aiRequests.length = 0;
  await expect(askAI('Olá', { system: 'Seja breve' })).resolves.toBe('Resposta do Workers AI');
  expect(aiRequests[0]).toEqual(expect.objectContaining({
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    messages: [{ role: 'system', content: 'Seja breve' }, { role: 'user', content: 'Olá' }],
  }));
});
