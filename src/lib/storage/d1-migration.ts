import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { acquireD1Lease, readD1Collection, writeD1Collection } from './d1';

// One-time copy of the file collections into D1, run inside the app (where the
// data and the D1 credentials already are), so no personal data leaves the
// server through anyone's terminal. Rules:
//  - files are only read, never changed or deleted: they stay the rollback;
//  - a collection already present in D1 is never overwritten unless that
//    exact collection is named in `replace` after the owner compared it;
//  - every copy is read back from D1 and compared by SHA-256 before it
//    counts as copied.
// health-ledger and office-* keep their own file stores (see
// docs/cloudflare-d1-workers-ai.md), so they are listed as such and skipped.

const NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const separate = (name: string) => name === 'health-ledger' || name.startsWith('office-');

export type CollectionStatus = 'missing' | 'same' | 'different' | 'separate' | 'invalid';
export type CollectionRow = {
  name: string;
  status: CollectionStatus;
  fileItems: number | null;
  d1Items: number | null;
  error?: string;
};
export type MigrationPlan = {
  mode: string;
  d1Configured: boolean;
  collections: CollectionRow[];
  ready: boolean;
};

function dataDir() {
  return process.env.LIFESYSTEM_DATA_DIR ? path.resolve(process.env.LIFESYSTEM_DATA_DIR) : path.join(process.cwd(), 'data');
}

export function d1Configured() {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_D1_DATABASE_ID && process.env.CLOUDFLARE_D1_API_TOKEN);
}

const hash = (items: unknown[]) => createHash('sha256').update(JSON.stringify(items)).digest('hex');

async function fileCollections() {
  let files: string[] = [];
  try {
    files = (await fs.readdir(dataDir())).filter((f) => f.endsWith('.json')).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const result: { name: string; items?: unknown[]; error?: string; separate?: boolean }[] = [];
  for (const file of files) {
    const name = file.slice(0, -5);
    if (!NAME.test(name)) continue;
    if (separate(name)) {
      result.push({ name, separate: true });
      continue;
    }
    try {
      const items: unknown = JSON.parse(await fs.readFile(path.join(dataDir(), file), 'utf8'));
      if (!Array.isArray(items)) throw new Error('o arquivo não contém uma lista');
      result.push({ name, items });
    } catch (error) {
      result.push({ name, error: error instanceof Error ? error.message : 'arquivo ilegível' });
    }
  }
  return result;
}

export async function migrationPlan(): Promise<MigrationPlan> {
  const configured = d1Configured();
  const collections: CollectionRow[] = [];
  for (const entry of await fileCollections()) {
    if (entry.separate) {
      collections.push({ name: entry.name, status: 'separate', fileItems: null, d1Items: null });
      continue;
    }
    if (!entry.items) {
      collections.push({ name: entry.name, status: 'invalid', fileItems: null, d1Items: null, error: entry.error });
      continue;
    }
    if (!configured) {
      collections.push({ name: entry.name, status: 'missing', fileItems: entry.items.length, d1Items: null });
      continue;
    }
    const remote = await readD1Collection(entry.name);
    const status: CollectionStatus = !remote.rev ? 'missing' : hash(remote.items) === hash(entry.items) ? 'same' : 'different';
    collections.push({ name: entry.name, status, fileItems: entry.items.length, d1Items: remote.rev ? remote.items.length : null });
  }
  const copyable = collections.filter((c) => c.status !== 'separate');
  return {
    mode: process.env.LIFESYSTEM_STORAGE || 'file',
    d1Configured: configured,
    collections,
    ready: configured && copyable.length > 0 && copyable.every((c) => c.status === 'same'),
  };
}

export type CopyResult = { name: string; outcome: 'copied' | 'replaced' | 'unchanged' | 'kept' | 'skipped' | 'failed'; detail?: string };

export async function copyToD1(replace: string[] = []): Promise<CopyResult[]> {
  if (!d1Configured()) throw new Error('D1 não configurado no servidor.');
  const results: CopyResult[] = [];
  for (const entry of await fileCollections()) {
    if (entry.separate || !entry.items) {
      results.push({ name: entry.name, outcome: 'skipped', detail: entry.error || 'armazenamento próprio' });
      continue;
    }
    const lease = await acquireD1Lease(entry.name);
    try {
      const remote = await readD1Collection(entry.name);
      const expected = hash(entry.items);
      if (remote.rev && hash(remote.items) === expected) {
        results.push({ name: entry.name, outcome: 'unchanged' });
        continue;
      }
      if (remote.rev && !replace.includes(entry.name)) {
        results.push({ name: entry.name, outcome: 'kept', detail: 'já existe no D1 com conteúdo diferente' });
        continue;
      }
      await writeD1Collection(entry.name, entry.items, lease.owner, remote.rev);
      const check = await readD1Collection(entry.name);
      if (hash(check.items) !== expected) throw new Error('a releitura do D1 não confere com o arquivo');
      results.push({ name: entry.name, outcome: remote.rev ? 'replaced' : 'copied' });
    } catch (error) {
      results.push({ name: entry.name, outcome: 'failed', detail: error instanceof Error ? error.message.slice(0, 200) : 'falha' });
    } finally {
      await lease.release();
    }
  }
  return results;
}
