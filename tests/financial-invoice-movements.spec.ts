import { expect, test } from '@playwright/test';
import type { Bill, Card, FinancialEntry } from '../src/lib/finance-model';
import { financialMovements, movementDisplayAmount } from '../src/lib/financial-invoice-movements';
import { financialEntriesForRange, financialPeriodRange, summarizeFinancialEntries } from '../src/lib/financial-period';

const credit: Card = {
  id: 'credit', name: 'Cartão', type: 'credit', brand: 'Visa', lastDigits: '1234',
  color: '#123456', isActive: true, accountId: 'linked', closingDay: 25, dueDay: 3,
};

function purchase(id: string, fields: Partial<FinancialEntry> = {}): FinancialEntry {
  return {
    id, type: 'expense_variable', category: 'Mercado', amount: 10.12,
    date: '2026-11-10', cardId: credit.id, status: 'pending', ...fields,
  };
}

const bill: Bill = {
  id: 'bill-id', cardId: credit.id, month: '2026-11', amount: 100.03,
  paidAmount: 0, status: 'closed', closeDate: '2026-11-25', dueDate: '2026-12-03', items: [],
};

test('agrupa compras em centavos e lança a fatura no mês do vencimento', () => {
  const debit = { ...credit, id: 'debit', type: 'debit' as const };
  const unaffected = purchase('debit-expense', { cardId: debit.id });
  const result = financialMovements([
    purchase('one'), purchase('two', { amount: 8.23, billMonth: '2026-11' }), unaffected,
    purchase('future-part', { amount: 15, billMonth: '2026-12' }),
  ], [credit, debit], []);
  expect(result).toHaveLength(3);
  expect(result).toContain(unaffected);
  const december = financialEntriesForRange(result, financialPeriodRange('2026-12', 'month'));
  expect(december).toHaveLength(1);
  expect(december[0]).toMatchObject({
    amount: 18.35, dueDate: '2026-12-03', accountId: 'linked',
    invoice: { month: '2026-11', total: 18.35 },
  });
});

test('usa o total fechado e a data real da quitação sem somar as compras novamente', () => {
  const paid = { ...bill, status: 'paid' as const, paidAmount: bill.amount,
    paymentRecordedAt: '2026-11-30T02:10:00.000Z', paymentAccountId: 'payer' };
  const result = financialMovements([
    purchase('one', { status: 'paid', paidDate: '2026-12-01' }), purchase('two'),
  ], [credit], [paid, { ...bill, id: 'legacy-duplicate' }]);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    amount: 100.03, status: 'paid', accountId: 'payer', paidDate: '2026-11-29',
    invoice: { total: 100.03, paid: 100.03, paymentDateKnown: true },
  });
  expect(summarizeFinancialEntries(result)).toMatchObject({ realized: { expenses: 100.03 }, projected: { expenses: 0 } });
});

test('fatura parcial conta o pago como realizado e só o restante como previsto', () => {
  const result = financialMovements([], [credit], [
    { ...bill, status: 'partial', paidAmount: 24.18, paymentRecordedAt: '2026-11-28T15:00:00.000Z' },
  ]);
  expect(result).toHaveLength(2);
  const open = result.find(entry => entry.status === 'pending');
  const payment = result.find(entry => entry.status === 'paid');
  expect(open).toMatchObject({ amount: 75.85, invoice: { total: 100.03, paid: 24.18 } });
  expect(payment).toMatchObject({ amount: 24.18, paidDate: '2026-11-28', invoice: { partialPayment: true } });
  expect(movementDisplayAmount(open!)).toBe(100.03);
  expect(movementDisplayAmount(payment!)).toBe(24.18);
  expect(summarizeFinancialEntries(result)).toMatchObject({ realized: { expenses: 24.18 }, projected: { expenses: 75.85 } });
});
