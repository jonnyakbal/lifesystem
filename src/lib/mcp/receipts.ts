import { z } from 'zod';
import { storage } from '@/lib/storage';

export const idempotencyKeySchema = z.string().trim().min(8).max(200).regex(/^[a-zA-Z0-9_.:-]+$/, 'Chave de idempotência inválida.');

interface McpReceipt {
  id: string;
  clientId: string;
  operation: string;
  key: string;
  result: unknown;
  createdAt: string;
  updatedAt: string;
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
export async function runMcpIdempotent<T>(clientId: string, operation: string, key: string, action: () => Promise<T>) {
  const parsedKey = idempotencyKeySchema.parse(key);
  return withReceiptLock(`${clientId}:${parsedKey}`, async () => {
    const receipts = await storage.getAll<McpReceipt>('mcp-receipts');
    const prior = receipts.find(receipt => receipt.clientId === clientId && receipt.key === parsedKey);
    if (prior) {
      if (prior.operation !== operation) throw new Error('Esta chave de idempotência já foi usada por outra operação.');
      return { result: prior.result as T, replayed: true };
    }
    const result = await action();
    await storage.create<McpReceipt>('mcp-receipts', { clientId, operation, key: parsedKey, result });
    return { result, replayed: false };
  });
}
