import { randomUUID } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { CollectionLease } from './collection-lock';

// Cloudflare D1 reached over its REST API, so the app keeps running on its
// own host. The REST endpoint takes one parameterized statement per request,
// so every guarantee below is expressed as a single atomic statement:
//  - a lease row per collection gives cross-process, cross-host exclusion;
//  - each write is fenced by that lease AND by the revision read under it.
// Each collection stays one document (the JSON array the file backend keeps),
// which preserves the read-modify-write semantics of storage.transact.

const NOW_MS = "CAST(unixepoch('subsec') * 1000 AS INTEGER)";
const LEASE_MS = 30_000;
const HEARTBEAT_MS = 5_000;
const WAIT_MS = 10_000;
// D1 caps a row/value at 2 MB; past this size a collection is stored gzipped.
const PLAIN_LIMIT = 1_500_000;
const VALUE_LIMIT = 1_900_000;

const SCHEMA = `CREATE TABLE IF NOT EXISTS lifesystem_collections (
  name TEXT PRIMARY KEY, rev TEXT NOT NULL, encoding TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lifesystem_locks (
  name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL
);`;

type Meta = { changes?: number };
type Result = { results?: Record<string, unknown>[]; meta?: Meta };
type Envelope = { success?: boolean; errors?: { message?: string }[]; result?: Result[] };

function config() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const database = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_API_TOKEN;
  if (!account || !database || !token) {
    throw new Error('Armazenamento D1 selecionado sem CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID e CLOUDFLARE_D1_API_TOKEN.');
  }
  const api = process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4';
  return { url: `${api}/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(database)}/query`, token };
}

async function send(sql: string, params: unknown[] = []): Promise<Result> {
  const { url, token } = config();
  let lastError: unknown;
  let throttled = 0;
  // Every statement here is safe to resend: lease and write outcomes are
  // re-checked by token/revision, so an unknown first outcome is resolved.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(params.length ? { sql, params } : { sql }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json().catch(() => ({})) as Envelope;
      if (response.ok && body.success !== false) return body.result?.[body.result.length - 1] || {};
      const detail = body.errors?.map(error => error.message).filter(Boolean).join('; ') || `HTTP ${response.status}`;
      const failure = new Error(`Banco D1 recusou a operação: ${detail}`);
      // The Cloudflare API rate-limits per token; a 429 is "wait", not "no".
      if (response.status === 429 && throttled < 3) {
        throttled++;
        attempt--;
        const retryAfter = Number(response.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 4000) : 400 * throttled;
        await new Promise(resolve => setTimeout(resolve, waitMs));
        lastError = failure;
        continue;
      }
      if (response.status < 500) throw Object.assign(failure, { final: true });
      lastError = failure;
    } catch (error) {
      if ((error as { final?: boolean }).final) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Banco D1 indisponível.');
}

let schemaReady: Promise<void> | null = null;
function ensureSchema() {
  schemaReady ??= send(SCHEMA).then(() => undefined, error => { schemaReady = null; throw error; });
  return schemaReady;
}

function encode(items: unknown[]): { encoding: string; data: string } {
  const json = JSON.stringify(items);
  if (Buffer.byteLength(json) <= PLAIN_LIMIT) return { encoding: 'json', data: json };
  const data = gzipSync(json).toString('base64');
  if (data.length > VALUE_LIMIT) throw new Error('Coleção grande demais para uma linha do D1 mesmo comprimida.');
  return { encoding: 'gzip-base64', data };
}

function decode(name: string, encoding: unknown, data: unknown): unknown[] {
  if (typeof data !== 'string') throw new Error(`Coleção ${name} corrompida no D1.`);
  const json = encoding === 'gzip-base64' ? gunzipSync(Buffer.from(data, 'base64')).toString('utf8')
    : encoding === 'json' ? data : null;
  if (json === null) throw new Error(`Codificação desconhecida da coleção ${name} no D1.`);
  const items: unknown = JSON.parse(json);
  if (!Array.isArray(items)) throw new Error(`Coleção ${name} corrompida no D1.`);
  return items;
}

/** Returns the items and the revision a fenced write must match ('' when absent). */
export async function readD1Collection<T>(name: string): Promise<{ items: T[]; rev: string }> {
  await ensureSchema();
  const row = (await send('SELECT rev, encoding, data FROM lifesystem_collections WHERE name = ?1', [name])).results?.[0];
  if (!row) return { items: [], rev: '' };
  return { items: decode(name, row.encoding, row.data) as T[], rev: String(row.rev) };
}

/** Commits only while `owner` holds the lease and nobody wrote since `expectedRev`. */
export async function writeD1Collection(name: string, items: unknown[], owner: string, expectedRev: string): Promise<string> {
  const { encoding, data } = encode(items);
  const rev = randomUUID();
  const result = await send(
    `INSERT INTO lifesystem_collections (name, rev, encoding, data, updated_at)
     SELECT ?1, ?2, ?3, ?4, ?5
     WHERE EXISTS (SELECT 1 FROM lifesystem_locks WHERE name = ?1 AND owner = ?6 AND expires_at > ${NOW_MS})
     ON CONFLICT(name) DO UPDATE SET rev = excluded.rev, encoding = excluded.encoding, data = excluded.data, updated_at = excluded.updated_at
     WHERE lifesystem_collections.rev = ?7`,
    [name, rev, encoding, data, new Date().toISOString(), owner, expectedRev],
  );
  if (result.meta?.changes === 1) return rev;
  // A resent request may have committed the first time; the new revision proves it.
  const current = await send('SELECT rev FROM lifesystem_collections WHERE name = ?1', [name]);
  if (current.results?.[0]?.rev === rev) return rev;
  throw new Error(`Trava da coleção ${name} perdida.`);
}

export type D1Lease = CollectionLease & { owner: string };

export async function acquireD1Lease(name: string): Promise<D1Lease> {
  await ensureSchema();
  const owner = randomUUID();
  const deadline = Date.now() + WAIT_MS;
  for (;;) {
    const taken = await send(
      `INSERT INTO lifesystem_locks (name, owner, expires_at) VALUES (?1, ?2, ${NOW_MS} + ?3)
       ON CONFLICT(name) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at
       WHERE lifesystem_locks.expires_at < ${NOW_MS} OR lifesystem_locks.owner = ?2`,
      [name, owner, LEASE_MS],
    );
    if (taken.meta?.changes === 1) break;
    if (Date.now() >= deadline) throw new Error(`Coleção ${name} ocupada; tente novamente com a mesma chave.`);
    await new Promise(resolve => setTimeout(resolve, 100 + Math.floor(Math.random() * 100)));
  }

  let compromised: Error | undefined;
  let heartbeat = Promise.resolve();
  const timer = setInterval(() => {
    heartbeat = heartbeat.then(async () => {
      if (compromised) return;
      const renewed = await send(`UPDATE lifesystem_locks SET expires_at = ${NOW_MS} + ?3 WHERE name = ?1 AND owner = ?2`, [name, owner, LEASE_MS]);
      if (renewed.meta?.changes !== 1) throw new Error(`Trava da coleção ${name} perdida.`);
    }).catch(error => { compromised = error instanceof Error ? error : new Error(String(error)); });
  }, HEARTBEAT_MS);
  timer.unref();
  return {
    owner,
    // The write statement re-checks ownership on the server; this only fails fast.
    async assertOwned() { if (compromised) throw compromised; },
    async release() {
      clearInterval(timer);
      await heartbeat;
      // Scoped to our token: a lost lease never deletes a successor's row.
      // A failed release must not turn a committed write into a reported
      // failure; the lease then simply expires after LEASE_MS.
      await send('DELETE FROM lifesystem_locks WHERE name = ?1 AND owner = ?2', [name, owner]).catch(() => undefined);
    },
  };
}
