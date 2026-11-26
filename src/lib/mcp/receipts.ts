import { createHash } from 'node:crypto';
import { z } from 'zod';
import { storage } from '@/lib/storage';

export const idempotencyKeySchema = z.string().trim().min(8).max(200).regex(/^[a-zA-Z0-9_.:-]+$/, 'Chave de idempotência inválida.');

interface McpReceipt {
  id: string;
  clientId: string;
  operation: string;
  key: string;
  fingerprint?: string;
  result: unknown;
  createdAt: string;
  updatedAt: string;
}

interface McpIntent {
  id: string;
  operation: string;
  fingerprint: string;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  });
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

const locks = new Map<string, Promise<void>>();

async function withReceiptLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  const queued = previous.then(() => current);
  locks.set(key, queued);
  await previous;
  try { return await operation(); }
  finally {
    release();
    if (locks.get(key) === queued) locks.delete(key);
  }
}

/** Runs a mutable operation once per client/key and stores only its safe result receipt. */
export async function runMcpIdempotent<T>(clientId: string, operation: string, key: string, action: () => Promise<T>, input?: Record<string, unknown>) {
  const parsedKey = idempotencyKeySchema.parse(key);
  const fingerprint = input === undefined ? undefined : digest(input);
  return withReceiptLock(`${clientId}:${parsedKey}`, async () => {
    const receipts = await storage.getAll<McpReceipt>('mcp-receipts');
    const prior = receipts.find(receipt => receipt.clientId === clientId && receipt.key === parsedKey);
    if (prior) {
      if (prior.operation !== operation) throw new Error('Esta chave de idempotência já foi usada por outra operação.');
      if (prior.fingerprint && prior.fingerprint !== fingerprint) throw new Error('Chave de idempotência usada com dados diferentes.');
      return { result: prior.result as T, replayed: true };
    }
    const intentId = digest([clientId, parsedKey]);
    let reservedNow = false;
    if (fingerprint) {
      // Reserve the intent before the effect so recovery cannot accept a changed payload.
      reservedNow = !(await storage.getById<McpIntent>('mcp-intents', intentId));
      const intent = await storage.createOnce<McpIntent>('mcp-intents', intentId, { operation, fingerprint });
      if (intent.operation !== operation) throw new Error('Esta chave de idempotência já foi usada por outra operação.');
      if (intent.fingerprint !== fingerprint) throw new Error('Chave de idempotência usada com dados diferentes.');
    }
    let result: T;
    try {
      result = await action();
    } catch (error) {
      // A rejected first attempt frees its key, so the caller can correct the data and retry.
      // An intent left by an earlier attempt stays: that attempt may already have had its effect.
      if (reservedNow) await storage.delete('mcp-intents', intentId).catch(() => undefined);
      throw error;
    }
    await storage.create<McpReceipt>('mcp-receipts', { clientId, operation, key: parsedKey, fingerprint, result });
    return { result, replayed: false };
  });
}
