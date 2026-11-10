import { randomUUID } from 'node:crypto';
import { storage } from '@/lib/storage';
import type { Card, FinancialEntry } from '@/types';
import { entryInvoiceMonth, installmentPlan, invoiceCycle } from '@/lib/card-invoice';

type StoredEntry = FinancialEntry & { createdAt: string; updatedAt: string };
export type NewEntryInput = Omit<FinancialEntry, 'id' | 'createdAt' | 'updatedAt' | 'installment'> & {
  installments?: number;
};

function isCreditCard(card: Card | undefined): card is Card {
  return !!card && (card.type === 'credit' || card.type === 'multiple');
}

/**
 * Cria o lançamento. Compra no cartão de crédito entra na fatura certa pela data;
 * parcelada vira uma parcela por fatura, todas gravadas de uma vez.
 */
export async function createFinancialEntries(input: NewEntryInput, stableId?: string): Promise<StoredEntry[]> {
  const { installments, ...data } = input;
  const card = data.cardId && data.type !== 'income'
    ? (await storage.getAll<Card>('cards')).find((c) => c.id === data.cardId)
    : undefined;

  return storage.transact<StoredEntry, StoredEntry[]>('financial', (items) => {
    if (stableId) {
      const existing = items.filter((e) => e.id === stableId || e.id.startsWith(`${stableId}~p`));
      if (existing.length) return existing; // retry da mesma intenção
    }
    const idFor = (i: number) => (stableId ? (i === 0 ? stableId : `${stableId}~p${i + 1}`) : randomUUID());
    const now = new Date().toISOString();
    const base = { ...data, createdAt: now, updatedAt: now };
    if (!isCreditCard(card)) {
      const entry = { ...base, id: idFor(0) } as StoredEntry;
      items.push(entry);
      return [entry];
    }
    if (data.billMonth) {
      // Restauração/ajuste: lançamento já sabe a fatura (ex.: parcela 3/5 desfeita).
      const entry = { ...base, id: idFor(0), status: 'pending', dueDate: invoiceCycle(card, data.billMonth).dueDate } as StoredEntry;
      items.push(entry);
      return [entry];
    }
    const plan = installmentPlan(card, data.date, data.amount, installments || 1);
    const groupId = plan.length > 1 ? randomUUID() : undefined;
    const created = plan.map((part, i) => ({
      ...base,
      id: idFor(i),
      amount: part.amount,
      billMonth: part.month,
      dueDate: part.dueDate,
      status: 'pending' as const,
      paidDate: undefined,
      description: plan.length > 1
        ? `${data.description || data.category} (${part.current}/${part.total})`
        : data.description,
      installment: groupId
        ? { groupId, current: part.current, total: part.total, totalAmount: data.amount }
        : undefined,
    })) as StoredEntry[];
    items.push(...created);
    return created;
  });
}

/** Ao quitar a fatura, as compras dela passam a pagas (o pagamento da fatura não é outra despesa). */
export async function settleInvoiceEntries(cardId: string, month: string, paidDate: string) {
  const card = (await storage.getAll<Card>('cards')).find((c) => c.id === cardId);
  if (!card) return 0;
  return storage.transact<StoredEntry, number>('financial', (items) => {
    let changed = 0;
    const now = new Date().toISOString();
    items.forEach((entry, i) => {
      if (entry.cardId !== cardId || entry.type === 'income' || entry.status === 'paid') return;
      if (entryInvoiceMonth(entry, card) !== month) return;
      items[i] = { ...entry, status: 'paid', paidDate, updatedAt: now };
      changed += 1;
    });
    return changed;
  });
}

/** Exclui as parcelas ainda não pagas de uma compra parcelada. */
export async function deleteInstallmentGroup(entryId: string) {
  return storage.transact<StoredEntry, number | null>('financial', (items) => {
    const entry = items.find((e) => e.id === entryId);
    if (!entry) return null;
    const groupId = entry.installment?.groupId;
    if (!groupId) {
      items.splice(items.indexOf(entry), 1);
      return 1;
    }
    let removed = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].installment?.groupId === groupId && items[i].status !== 'paid') {
        items.splice(i, 1);
        removed += 1;
      }
    }
    return removed;
  });
}
