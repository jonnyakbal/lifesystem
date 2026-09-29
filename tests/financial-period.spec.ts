import { test, expect } from '@playwright/test';
import { effectiveFinancialDate, financialEntriesForRange, financialPeriodRange, shiftFinancialPeriod, summarizeFinancialMonth } from '../src/lib/financial-period';

test('previsão entra no mês do vencimento e não no caixa realizado', () => {
  const entry = { type: 'expense_fixed' as const, amount: 240, date: '2026-09-28', dueDate: '2026-10-10', status: 'pending' as const, recurring: true };
  expect(effectiveFinancialDate(entry)).toBe('2026-10-10');
  expect(summarizeFinancialMonth([entry], '2026-09').entries).toBe(0);
  expect(summarizeFinancialMonth([entry], '2026-10')).toMatchObject({ entries: 1, realized: { expenses: 0, balance: 0 }, projected: { expenses: 240, balance: -240 } });
});

test('pagamento usa paidDate mesmo com vencimento em outro mês', () => {
  const entry = { type: 'expense_variable' as const, amount: 90, date: '2026-09-28', dueDate: '2026-10-05', paidDate: '2026-11-02', status: 'paid' as const };
  expect(effectiveFinancialDate(entry)).toBe('2026-11-02');
  expect(summarizeFinancialMonth([entry], '2026-10').entries).toBe(0);
  expect(summarizeFinancialMonth([entry], '2026-11')).toMatchObject({ entries: 1, realized: { expenses: 90 }, projected: { expenses: 0 } });
});

test('dados antigos sem vencimento ou pagamento usam date', () => {
  const entries = [
    { type: 'income' as const, amount: 300, date: '2026-10-20', status: 'paid' as const },
    { type: 'expense_variable' as const, amount: 50, date: '2026-10-21' },
    { type: 'expense_fixed' as const, amount: 25, date: '2026-10-22', status: 'overdue' as const },
  ];
  expect(summarizeFinancialMonth(entries, '2026-10')).toMatchObject({ realized: { income: 300, expenses: 0, balance: 300 }, projected: { income: 0, expenses: 75, balance: -75 }, entries: 3 });
  expect(summarizeFinancialMonth(entries, '2026-12')).toMatchObject({ entries: 0, realized: { income: 0, expenses: 0 }, projected: { income: 0, expenses: 0 } });
});

test('navegação e limites incluem meses completos e atravessam o ano', () => {
  expect(shiftFinancialPeriod('2026-12', 'month', 1)).toBe('2027-01');
  expect(shiftFinancialPeriod('2027-01', 'month', -1)).toBe('2026-12');
  expect(shiftFinancialPeriod('2026-12', 'quarter', 1)).toBe('2027-03');
  expect(financialPeriodRange('2026-12', 'month')).toMatchObject({ start: '2026-12-01', end: '2026-12-31' });
  expect(financialPeriodRange('2026-12', 'quarter')).toMatchObject({ start: '2026-10-01', end: '2026-12-31' });
  expect(financialPeriodRange('2026-12', 'year')).toMatchObject({ start: '2026-01-01', end: '2026-12-31' });
  const future = { type: 'expense_variable' as const, amount: 1, date: '2026-12-01', dueDate: '2026-12-31', status: 'pending' as const };
  expect(financialEntriesForRange([future], financialPeriodRange('2026-12', 'month'))).toHaveLength(1);
});
