import { randomUUID } from 'node:crypto';
import { storage } from '@/lib/storage';
import type { Bill } from '@/lib/finance-model';

export interface StoredFinancialBill extends Bill {
  createdAt: string;
  updatedAt: string;
}

export class DuplicateFinancialBillError extends Error {
  constructor(readonly existingBillId: string) {
    super('Já existe uma fatura deste cartão neste mês.');
    this.name = 'DuplicateFinancialBillError';
  }
}

type NewBill = Omit<StoredFinancialBill, 'id' | 'createdAt' | 'updatedAt'>;
type BillUpdate = Partial<NewBill>;

export async function createFinancialBill(
  data: NewBill,
  stableId?: string
): Promise<StoredFinancialBill> {
  return storage.transact<StoredFinancialBill, StoredFinancialBill>(
    'bills',
    (items) => {
      const duplicate = items.find(
        (item) => item.cardId === data.cardId && item.month === data.month
      );
      if (duplicate) {
        if (stableId && duplicate.id === stableId) return duplicate;
        throw new DuplicateFinancialBillError(duplicate.id);
      }

      const now = new Date().toISOString();
      const bill: StoredFinancialBill = {
        ...data,
        id: stableId || randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      items.push(bill);
      return bill;
    }
  );
}

export async function updateFinancialBill(
  id: string,
  fields: BillUpdate,
  expectedUpdatedAt?: string
): Promise<StoredFinancialBill | null> {
  return storage.transact<StoredFinancialBill, StoredFinancialBill | null>(
    'bills',
    (items) => {
      const current = items.find((item) => item.id === id);
      if (!current) return null;
      if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) {
        throw new Error('Conflito de versão. Releia a fatura antes de alterar.');
      }

      const nextCardId = fields.cardId ?? current.cardId;
      const nextMonth = fields.month ?? current.month;
      if (nextCardId !== current.cardId || nextMonth !== current.month) {
        const duplicate = items.find(
          (item) =>
            item.id !== id &&
            item.cardId === nextCardId &&
            item.month === nextMonth
        );
        if (duplicate) throw new DuplicateFinancialBillError(duplicate.id);
      }

      const updated: StoredFinancialBill = {
        ...current,
        ...fields,
        id,
        updatedAt: new Date().toISOString(),
      };
      items[items.indexOf(current)] = updated;
      return updated;
    }
  );
}
