import { randomUUID } from 'node:crypto';
import { storage } from '@/lib/storage';
import type { Bill } from '@/lib/finance-model';
import { CashOperationError, debitBillPayment, findBillDebit, moneyCents } from '@/lib/financial-cash';
import { settleInvoiceEntries } from '@/lib/financial-card-purchases';

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
    async (items) => {
      const current = items.find((item) => item.id === id);
      if (!current) return null;
      if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) {
        throw new Error('Conflito de versão. Releia a fatura antes de alterar.');
      }
      const changesPayment = fields.amount !== undefined || fields.paidAmount !== undefined
        || fields.status !== undefined || fields.cardId !== undefined || fields.month !== undefined;
      if (changesPayment && (current.paymentAccountId || await findBillDebit(id))) {
        throw new CashOperationError('A fatura tem um débito registrado. Os dados da quitação são preservados.');
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

export async function registerBillPayment(id: string, accountId: string) {
  return storage.transact<StoredFinancialBill, StoredFinancialBill>('bills', async bills => {
    const bill = bills.find(item => item.id === id);
    if (!bill) throw new CashOperationError('Fatura não encontrada.', 404);
    if (bill.status === 'paid') {
      if (bill.paymentAccountId === accountId) return bill;
      throw new CashOperationError('Esta fatura já está quitada.');
    }
    if (bill.status === 'open') throw new CashOperationError('Feche a fatura antes de registrar o pagamento.');
    const remaining = moneyCents(bill.amount) - moneyCents(bill.paidAmount || 0);
    if (remaining < 0) throw new CashOperationError('O valor já pago excede o valor da fatura.');
    const debit = await debitBillPayment(id, accountId, remaining);
    const paidDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(debit.recordedAt));
    await settleInvoiceEntries(bill.cardId, bill.month, paidDate);
    const paidBill: StoredFinancialBill = {
      ...bill,
      paidAmount: bill.amount,
      status: 'paid',
      paymentAccountId: debit.accountId,
      paymentRecordedAt: debit.recordedAt,
      updatedAt: new Date().toISOString(),
    };
    bills[bills.indexOf(bill)] = paidBill;
    return paidBill;
  });
}

export async function deleteFinancialBill(id: string) {
  return storage.transact<StoredFinancialBill, boolean>('bills', async bills => {
    const index = bills.findIndex(bill => bill.id === id);
    if (index < 0) return false;
    if (bills[index].paymentAccountId || await findBillDebit(id)) {
      throw new CashOperationError('A fatura tem um débito registrado e precisa ficar no histórico.');
    }
    bills.splice(index, 1);
    return true;
  });
}
