import { storage } from '@/lib/storage';
import type { Ledger } from './schemas';

const empty = (): Ledger => ({ id: 'professional-v1', schemaVersion: 1, records: [], proposals: [], approvals: [], jobs: [], receipts: [], history: [] });
export async function readLedger() { return (await storage.getAll<Ledger>('professional-ledger'))[0] || empty(); }
export async function transactLedger<T>(operation: (ledger: Ledger) => Promise<T> | T): Promise<T> {
  return storage.transact<Ledger, T>('professional-ledger', async items => {
    const ledger = structuredClone(items[0] || empty());
    const result = await operation(ledger);
    items.splice(0, items.length, ledger);
    return result;
  });
}
