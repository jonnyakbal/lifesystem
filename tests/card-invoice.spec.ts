import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storage } from '../src/lib/storage';
import { installmentPlan, invoiceCycle, invoiceForPurchase, splitInstallments, entryInvoiceMonth } from '../src/lib/card-invoice';
import { createFinancialEntries, deleteInstallmentGroup, settleInvoiceEntries } from '../src/lib/financial-card-purchases';
import type { Card, FinancialEntry } from '../src/types';

// Cartão sintético: fecha dia 3, vence dia 10 (vencimento no mesmo mês do fechamento).
const nubank = { closingDay: 3, dueDay: 10 };
// Fecha dia 25, vence dia 5 (vencimento no mês seguinte).
const inter = { closingDay: 25, dueDay: 5 };

test('compra antes do fechamento entra na fatura do mês; no dia do fechamento ou depois, na próxima', () => {
  expect(invoiceForPurchase(nubank, '2026-11-02')).toEqual({ month: '2026-11', closeDate: '2026-11-03', dueDate: '2026-11-10' });
  expect(invoiceForPurchase(nubank, '2026-11-03')).toEqual({ month: '2026-12', closeDate: '2026-12-03', dueDate: '2026-12-10' });
  expect(invoiceForPurchase(inter, '2026-11-10')).toEqual({ month: '2026-11', closeDate: '2026-11-25', dueDate: '2026-12-05' });
  expect(invoiceForPurchase(inter, '2026-12-28')).toEqual({ month: '2027-01', closeDate: '2027-01-25', dueDate: '2027-02-05' });
});

test('dias que não existem no mês caem no último dia', () => {
  expect(invoiceCycle({ closingDay: 31, dueDay: 30 }, '2027-02')).toEqual({ month: '2027-02', closeDate: '2027-02-28', dueDate: '2027-03-30' });
  expect(invoiceCycle({ closingDay: 30, dueDay: 31 }, '2028-02')).toEqual({ month: '2028-02', closeDate: '2028-02-29', dueDate: '2028-03-31' });
});

test('parcelas somam o total exato e a sobra de centavos vai na primeira', () => {
  expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
  expect(splitInstallments(0.05, 2)).toEqual([0.03, 0.02]);
  const plan = installmentPlan(inter, '2026-12-28', 1000, 10);
  expect(plan.map(p => p.month)).toEqual(['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10']);
  expect(plan.reduce((a, p) => a + Math.round(p.amount * 100), 0)).toBe(100000);
  expect(plan[9]).toEqual(expect.objectContaining({ current: 10, total: 10, dueDate: '2027-11-05' }));
});

test('compra parcelada cria uma parcela por fatura, quitar a fatura paga só as dela e excluir remove as abertas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ls-card-invoice-'));
  const previous = process.env.LIFESYSTEM_DATA_DIR;
  process.env.LIFESYSTEM_DATA_DIR = dir;
  try {
    const card = await storage.create<Card>('cards', { name: 'Cartão sintético', type: 'credit', lastDigits: '0000', brand: 'visa', color: '#000', isActive: true, ...nubank });
    const debit = await storage.create<Card>('cards', { name: 'Débito sintético', type: 'debit', lastDigits: '1111', brand: 'visa', color: '#000', isActive: true });
    const created = await createFinancialEntries({ type: 'expense_variable', category: 'Compras', description: 'Fone', amount: 300, date: '2026-11-05', cardId: card.id, status: 'paid', installments: 3 });
    expect(created.map(e => [e.billMonth, e.dueDate, e.amount, e.status, e.description])).toEqual([
      ['2026-12', '2026-12-10', 100, 'pending', 'Fone (1/3)'],
      ['2027-01', '2027-01-10', 100, 'pending', 'Fone (2/3)'],
      ['2027-02', '2027-02-10', 100, 'pending', 'Fone (3/3)'],
    ]);
    expect(new Set(created.map(e => e.installment?.groupId)).size).toBe(1);

    // Retry com a mesma identidade não duplica.
    const again = await createFinancialEntries({ type: 'expense_variable', category: 'Compras', amount: 50, date: '2026-11-01', cardId: card.id, installments: 2 }, 'mcp-x');
    const retry = await createFinancialEntries({ type: 'expense_variable', category: 'Compras', amount: 50, date: '2026-11-01', cardId: card.id, installments: 2 }, 'mcp-x');
    expect(retry.map(e => e.id)).toEqual(again.map(e => e.id));
    expect(again.map(e => e.billMonth)).toEqual(['2026-11', '2026-12']);

    // Débito e sem cartão seguem como antes.
    const [plain] = await createFinancialEntries({ type: 'expense_variable', category: 'Mercado', amount: 20, date: '2026-11-05', cardId: debit.id, status: 'paid', paidDate: '2026-11-05', installments: 4 });
    expect([plain.status, plain.billMonth, plain.installment]).toEqual(['paid', undefined, undefined]);

    expect(await settleInvoiceEntries(card.id, '2026-12', '2026-12-10')).toBe(2);
    const all = await storage.getAll<FinancialEntry>('financial');
    const byMonth = (m: string) => all.filter(e => e.cardId === card.id && entryInvoiceMonth(e, card) === m);
    expect(byMonth('2026-12').every(e => e.status === 'paid' && e.paidDate === '2026-12-10')).toBe(true);
    expect(byMonth('2027-01').every(e => e.status === 'pending')).toBe(true);

    expect(await deleteInstallmentGroup(created[2].id)).toBe(2);
    const left = (await storage.getAll<FinancialEntry>('financial')).filter(e => e.installment?.groupId === created[0].installment?.groupId);
    expect(left.map(e => e.description)).toEqual(['Fone (1/3)']);
  } finally { if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR; else process.env.LIFESYSTEM_DATA_DIR = previous; await rm(dir, { recursive: true, force: true }); }
});
