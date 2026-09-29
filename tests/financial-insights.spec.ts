import { test, expect } from '@playwright/test';
import {
  billCycleDates,
  financialCategoryBreakdown,
  financialCreatePayload,
  financialDisplayStatus,
  financialFlowSeries,
  financialPeriodInsights,
  financialTrend,
} from '../src/lib/financial-insights';
import {
  financialPeriodRange,
  summarizeFinancialMonth,
} from '../src/lib/financial-period';
import {
  financialEntrySchema,
  financialEntryUpdateSchema,
} from '../src/lib/financial-validation';

const entries = [
  {
    type: 'income' as const,
    category: 'Serviços',
    amount: 1000,
    status: 'paid' as const,
    date: '2026-09-01',
    paidDate: '2026-10-02',
  },
  {
    type: 'expense_fixed' as const,
    category: 'Internet',
    amount: 100,
    status: 'pending' as const,
    date: '2026-09-01',
    dueDate: '2026-10-10',
  },
  {
    type: 'expense_variable' as const,
    category: 'Mercado',
    amount: 200,
    status: 'paid' as const,
    date: '2026-10-01',
    paidDate: '2026-10-05',
  },
  {
    type: 'income' as const,
    category: 'Serviços',
    amount: 300,
    status: 'pending' as const,
    date: '2026-09-01',
    dueDate: '2026-10-20',
  },
];

test('séries, insights e resumo mensal concordam sem dupla contagem', () => {
  const range = financialPeriodRange('2026-10', 'month');
  const series = financialFlowSeries([...entries].reverse(), range);
  const summary = summarizeFinancialMonth(entries, '2026-10');
  expect(series[0]).toMatchObject({
    date: '2026-10-01',
    realized: 0,
    withPlanned: 0,
  });
  expect(series.at(-1)).toMatchObject({
    date: '2026-10-31',
    realized: 800,
    withPlanned: 1000,
  });
  const insight = financialPeriodInsights(entries, range, '2026-10-15');
  expect(insight.summary).toEqual(summary);
  expect(insight).toMatchObject({
    withPlanned: 1000,
    overdueCount: 1,
    overdueAmount: 100,
    largestCategory: { name: 'Mercado', value: 200, percent: 100 },
  });
  expect(financialCategoryBreakdown(entries, 'open')).toEqual([
    { name: 'Internet', value: 100 },
  ]);
});

test('mês vazio, dados sem datas adicionais e virada de ano mantêm o contrato', () => {
  expect(
    financialFlowSeries(entries, financialPeriodRange('2027-01', 'month'))
  ).toEqual([]);
  const legacy = [
    {
      type: 'expense_fixed' as const,
      category: 'Internet',
      amount: 30,
      date: '2026-12-31',
    },
  ];
  const trend = financialTrend(legacy, '2027-01');
  expect(trend.map((m) => m.month)).toEqual([
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
    '2026-12',
    '2027-01',
  ]);
  expect(trend[4]).toMatchObject({ payable: 30, paid: 0 });
  expect(financialDisplayStatus(legacy[0], '2027-02-01')).toBe('pending');
  expect(
    financialDisplayStatus(
      { ...legacy[0], dueDate: '2027-02-01' },
      '2027-02-01'
    )
  ).toBe('pending');
  expect(
    financialDisplayStatus(
      { ...legacy[0], dueDate: '2027-01-31' },
      '2027-02-01'
    )
  ).toBe('overdue');
  expect(
    financialDisplayStatus(
      { ...legacy[0], dueDate: '2027-01-31', status: 'paid' },
      '2027-02-01'
    )
  ).toBe('paid');
});

test('valores agregados são exatos em centavos, também no resumo usado pelo MCP', () => {
  const records = [0.1, 0.2].map((amount) => ({
    type: 'income' as const,
    amount,
    date: '2026-10-01',
    status: 'paid' as const,
  }));
  expect(summarizeFinancialMonth(records, '2026-10').realized.income).toBe(0.3);
  expect(
    financialFlowSeries(records, financialPeriodRange('2026-10', 'month'))[0]
      .realized
  ).toBe(0.3);
});

test('restaurar um registro descarta metadados e normaliza recorrência legada', () => {
  const original = {
    ...entries[1],
    id: 'old',
    createdAt: '2026-01-01',
    paidDate: null,
    recurring: 'monthly',
  };
  const payload = financialCreatePayload(original);
  expect(financialEntrySchema.safeParse(payload).success).toBe(true);
  expect(payload).not.toHaveProperty('id');
  expect(payload).toMatchObject({
    recurring: true,
    recurringFrequency: 'monthly',
  });
  expect(
    financialEntryUpdateSchema.safeParse({ dueDate: null, paidDate: null })
      .success
  ).toBe(true);
});

test('faturas limitam dias ao último dia do mês e atravessam o ano', () => {
  expect(billCycleDates('2026-01', 31, 31)).toEqual({
    closeDate: '2026-01-31',
    dueDate: '2026-02-28',
  });
  expect(billCycleDates('2028-02', 31, 31)).toEqual({
    closeDate: '2028-02-29',
    dueDate: '2028-03-31',
  });
  expect(billCycleDates('2026-12', 15, 10)).toEqual({
    closeDate: '2026-12-15',
    dueDate: '2027-01-10',
  });
});
