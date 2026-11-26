import { entryInvoiceMonth, invoiceCycle } from './card-invoice';
import type { Bill, Card, FinancialEntry } from './finance-model';

const invoiceMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const cents = (value: number) => Math.round(value * 100);
const paidDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });

export interface InvoiceMovement {
  cardId: string;
  month: string;
  total: number;
  paid: number;
  paymentDateKnown: boolean;
  /** Paid part of a partially paid invoice; the open remainder stays in its own movement. */
  partialPayment?: boolean;
  /** Purchases in the invoice, so search and category filters still find them. */
  purchases: Pick<FinancialEntry, 'category' | 'description' | 'payee'>[];
}

/** Text fields a movement answers to: its own, plus those of the purchases inside an invoice. */
export function movementSearchFields(entry: FinancialMovement) {
  return [entry, ...(entry.invoice?.purchases ?? [])].flatMap(item => [item.category, item.description, item.payee]);
}

/** Categories a movement belongs to: its own, plus those of the purchases inside an invoice. */
export function movementCategories(entry: FinancialMovement) {
  return [entry.category, ...(entry.invoice?.purchases.map(purchase => purchase.category) ?? [])];
}

/** Amount shown for a movement: the full invoice, except for the paid part of a partial one. */
export function movementDisplayAmount(entry: FinancialMovement) {
  return entry.invoice && !entry.invoice.partialPayment ? entry.invoice.total : entry.amount;
}

export type FinancialMovement = FinancialEntry & { invoice?: InvoiceMovement };

export function invoiceMonthForExpense(entry: FinancialEntry, card?: Card) {
  if (!entry.cardId || entry.type === 'income') return undefined;
  if (entry.billMonth && invoiceMonthPattern.test(entry.billMonth)) return entry.billMonth;
  if (card && card.type !== 'debit') return entryInvoiceMonth({ ...entry, billMonth: undefined }, card);
  return undefined;
}

export function invoiceTotal(bill: Bill | undefined, purchases: FinancialEntry[]) {
  if (bill && bill.status !== 'open') return bill.amount;
  const total = purchases.reduce((sum, entry) => sum + cents(entry.amount), 0) / 100;
  return total || bill?.amount || 0;
}

type InvoiceGroup = {
  cardId: string;
  month: string;
  bill?: Bill;
  purchases: FinancialEntry[];
};

function paymentDay(bill: Bill | undefined, purchases: FinancialEntry[]) {
  const timestamp = Date.parse(bill?.paymentRecordedAt || '');
  if (Number.isFinite(timestamp)) return paidDayFormatter.format(timestamp);
  return purchases.reduce((latest, entry) =>
    entry.status === 'paid' && entry.paidDate && entry.paidDate > latest ? entry.paidDate : latest, '');
}

function payingAccount(group: InvoiceGroup, card?: Card) {
  const ids = new Set(group.purchases.flatMap(entry => entry.accountId ? [entry.accountId] : []));
  return group.bill?.paymentAccountId || card?.accountId || (ids.size === 1 ? [...ids][0] : undefined);
}

/** Use one cash movement per invoice. Purchases continue to live in the card's detail. */
export function financialMovements(entries: FinancialEntry[], cards: Card[], bills: Bill[]): FinancialMovement[] {
  const cardById = new Map(cards.map(card => [card.id, card]));
  const groups = new Map<string, InvoiceGroup>();
  const movements: FinancialMovement[] = [];
  const keyOf = (cardId: string, month: string) => JSON.stringify([cardId, month]);

  for (const bill of bills) {
    if (!invoiceMonthPattern.test(bill.month)) continue;
    const key = keyOf(bill.cardId, bill.month);
    // Use the same first stored snapshot selected by the Card/Fatura view.
    if (!groups.has(key)) groups.set(key, { cardId: bill.cardId, month: bill.month, bill, purchases: [] });
  }

  for (const entry of entries) {
    const cardId = entry.cardId;
    const month = invoiceMonthForExpense(entry, cardId ? cardById.get(cardId) : undefined);
    if (!cardId || !month) {
      movements.push(entry);
      continue;
    }
    const key = keyOf(cardId, month);
    const group = groups.get(key);
    if (group) group.purchases.push(entry);
    else groups.set(key, { cardId, month, purchases: [entry] });
  }

  for (const [key, group] of groups) {
    const { bill, cardId, month, purchases } = group;
    const card = cardById.get(cardId);
    const total = invoiceTotal(bill, purchases);
    if (total <= 0) continue;
    const totalCents = cents(total);
    const settled = bill ? bill.status === 'paid' : purchases.every(entry => entry.status === 'paid');
    const recordedPaid = bill
      ? cents(bill.paidAmount || 0)
      : purchases.reduce((sum, entry) => sum + (entry.status === 'paid' ? cents(entry.amount) : 0), 0);
    const paid = settled ? totalCents : Math.min(totalCents, Math.max(0, recordedPaid));
    const cycle = invoiceCycle(card || {}, month);
    const closedBill = bill?.status !== 'open' ? bill : undefined;
    const dueDate = closedBill?.dueDate || (!card && (bill?.dueDate || purchases.find(entry => entry.dueDate)?.dueDate)) || cycle.dueDate;
    const actualPaymentDay = settled ? paymentDay(bill, purchases) : '';
    const accountId = payingAccount(group, card);
    const purchaseFields = purchases.map(({ category, description, payee }) => ({ category, description, payee }));
    if (!settled && paid > 0) {
      // The amount already paid is realized; only the remainder stays projected.
      const partialDay = paymentDay(bill, purchases);
      movements.push({
        id: 'invoice-payment:' + key,
        category: 'Fatura de cartão',
        description: 'Pagamento parcial · Fatura · ' + (card?.name || 'Cartão removido'),
        type: 'expense_variable',
        status: 'paid',
        date: closedBill?.closeDate || cycle.closeDate,
        dueDate,
        paidDate: partialDay || dueDate,
        amount: paid / 100,
        cardId,
        accountId,
        invoice: { cardId, month, total, paid: paid / 100, paymentDateKnown: Boolean(partialDay), partialPayment: true, purchases: purchaseFields },
      });
    }
    movements.push({
      id: 'invoice:' + key,
      category: 'Fatura de cartão',
      description: 'Fatura · ' + (card?.name || 'Cartão removido'),
      type: 'expense_variable',
      status: settled ? 'paid' : bill?.status === 'overdue' ? 'overdue' : 'pending',
      date: closedBill?.closeDate || cycle.closeDate,
      dueDate,
      paidDate: actualPaymentDay || (settled ? dueDate : undefined),
      amount: (settled ? totalCents : totalCents - paid) / 100,
      cardId,
      accountId,
      invoice: { cardId, month, total, paid: paid / 100, paymentDateKnown: Boolean(actualPaymentDay), purchases: purchaseFields },
    });
  }
  return movements;
}
