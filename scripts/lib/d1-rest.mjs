// Minimal D1 REST client for maintenance scripts. Mirrors the encoding of
// src/lib/storage/d1.ts: one row per collection, gzip past 1.5 MB.
import { randomUUID } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const PLAIN_LIMIT = 1_500_000;
const VALUE_LIMIT = 1_900_000;
// Same names the app validates; files outside this set are not collections.
export const COLLECTION_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export const SCHEMA = `CREATE TABLE IF NOT EXISTS lifesystem_collections (
  name TEXT PRIMARY KEY, rev TEXT NOT NULL, encoding TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lifesystem_locks (
  name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL
);`;

export function d1Client() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const database = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_API_TOKEN;
  if (!account || !database || !token) {
    throw new Error('Defina CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID e CLOUDFLARE_D1_API_TOKEN.');
  }
  const api = process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4';
  const url = `${api}/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(database)}/query`;
  return async function query(sql, params = []) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params.length ? { sql, params } : { sql }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      const detail = body.errors?.map(error => error.message).filter(Boolean).join('; ') || `HTTP ${response.status}`;
      throw new Error(`D1 recusou a operação: ${detail}`);
    }
    return body.result?.[body.result.length - 1] || {};
  };
}

export function encodeCollection(items) {
  const json = JSON.stringify(items);
  if (Buffer.byteLength(json) <= PLAIN_LIMIT) return { encoding: 'json', data: json };
  const data = gzipSync(json).toString('base64');
  if (data.length > VALUE_LIMIT) throw new Error('Coleção grande demais para uma linha do D1 mesmo comprimida.');
  return { encoding: 'gzip-base64', data };
}

export function decodeCollection(name, encoding, data) {
  const json = encoding === 'gzip-base64' ? gunzipSync(Buffer.from(data, 'base64')).toString('utf8')
    : encoding === 'json' ? data : null;
  if (json === null) throw new Error(`Codificação desconhecida da coleção ${name}.`);
  const items = JSON.parse(json);
  if (!Array.isArray(items)) throw new Error(`Coleção ${name} não é uma lista.`);
  return items;
}

export const newRevision = () => randomUUID();
