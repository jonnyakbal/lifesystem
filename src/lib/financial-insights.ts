import {
  effectiveFinancialDate,
  financialEntriesForRange,
  financialPeriodRange,
  shiftFinancialPeriod,
  summarizeFinancialEntries,
  summarizeFinancialMonth,
  type FinancialPeriodEntry,
  type FinancialRange,
} from './financial-period';

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    amount
  );
export const shortFinancialDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
const cents = (amount: number) => Math.round(amount * 100);

/** Derive display status without rewriting historical records. No due date means no inferred delay. */
export function financialDisplayStatus(
  entry: FinancialPeriodEntry,
  today: string
) {
  if (entry.status === 'paid') return 'paid';
  if (entry.status === 'overdue' || (entry.dueDate && entry.dueDate < today))
    return 'overdue';
  return 'pending';
}

export function financialCategoryBreakdown<
  T extends FinancialPeriodEntry & { category: string },
>(entries: T[], mode: 'paid' | 'open') {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.type === 'income' || (mode === 'paid') !== (e.status === 'paid'))
      continue;
    map.set(e.category, (map.get(e.category) || 0) + cents(e.amount));
  }
  return [...map]
    .map(([name, value]) => ({ name, value: value / 100 }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export interface FinancialFlowPoint {
  date: string;
  label: string;
  realized: number;
  withPlanned: number;
}

/** Accumulated net movement starting at zero, not a bank balance or an extrapolation. */
export function financialFlowSeries(
  entries: FinancialPeriodEntry[],
  range: FinancialRange
): FinancialFlowPoint[] {
  const filtered = financialEntriesForRange(entries, range);
  if (!filtered.length) return [];
  const buckets = new Map<string, { realized: number; planned: number }>();
  for (const entry of filtered) {
    const date = effectiveFinancialDate(entry);
    const bucket = buckets.get(date) || { realized: 0, planned: 0 };
    const amount = cents(entry.amount) * (entry.type === 'income' ? 1 : -1);
    bucket[entry.status === 'paid' ? 'realized' : 'planned'] += amount;
    buckets.set(date, bucket);
  }
  const dates = [...buckets.keys()].sort();
  const start = range.start === '0000-01-01' ? dates[0] : range.start;
  const end = range.end === '9999-12-31' ? dates[dates.length - 1] : range.end;
  const keys = [...new Set([start, ...dates, end])].sort();
  let realized = 0;
  let planned = 0;
  return keys.map((date) => {
    const bucket = buckets.get(date);
    realized += bucket?.realized || 0;
    planned += bucket?.planned || 0;
    return {
      date,
      label: shortFinancialDate(date),
      realized: realized / 100,
      withPlanned: (realized + planned) / 100,
    };
  });
}

export function financialTrend(
  entries: FinancialPeriodEntry[],
  anchor: string
) {
  let month = anchor;
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    months.unshift(month);
    month = shiftFinancialPeriod(month, 'month', -1);
  }
  return months.map((month) => {
    const summary = summarizeFinancialMonth(entries, month);
    return {
      month,
      label: new Date(`${month}-01T12:00:00`).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      }),
      received: summary.realized.income,
      paid: summary.realized.expenses,
      receivable: summary.projected.income,
      payable: summary.projected.expenses,
    };
  });
}

export function financialPeriodInsights<
  T extends FinancialPeriodEntry & { category: string },
>(entries: T[], range: FinancialRange, today: string) {
  const period = financialEntriesForRange(entries, range);
  const summary = summarizeFinancialEntries(period);
  const overdue = period.filter(
    (e) => e.type !== 'income' && financialDisplayStatus(e, today) === 'overdue'
  );
  const categories = financialCategoryBreakdown(period, 'paid');
  return {
    summary,
    withPlanned:
      (cents(summary.realized.balance) + cents(summary.projected.balance)) /
      100,
    overdueCount: overdue.length,
    overdueAmount:
      overdue.reduce((total, e) => total + cents(e.amount), 0) / 100,
    largestCategory: categories[0]
      ? {
          ...categories[0],
          percent:
            summary.realized.expenses > 0
              ? Math.round(
                  (categories[0].value / summary.realized.expenses) * 100
                )
              : 0,
        }
      : null,
  };
}

/** Strip storage metadata for the strict create API (including legacy recurring strings). */
export function financialCreatePayload(
  entry: FinancialPeriodEntry & {
    category: string;
    recurring?: boolean | string;
    recurringFrequency?: string;
    description?: string;
    accountId?: string;
    cardId?: string;
    payee?: string;
    tags?: string[];
  }
) {
  const legacyFrequency =
    typeof entry.recurring === 'string' && entry.recurring !== 'none'
      ? entry.recurring
      : undefined;
  return {
    type: entry.type,
    category: entry.category,
    amount: entry.amount,
    date: entry.date,
    description: entry.description,
    dueDate: entry.dueDate || undefined,
    paidDate: entry.status === 'paid' ? entry.paidDate || undefined : undefined,
    status: entry.status || 'pending',
    accountId: entry.accountId,
    cardId: entry.cardId,
    payee: entry.payee,
    tags: entry.tags,
    recurring:
      typeof entry.recurring === 'string'
        ? entry.recurring !== 'none'
        : !!entry.recurring,
    recurringFrequency: entry.recurringFrequency || legacyFrequency,
  };
}

export function billCycleDates(
  month: string,
  closingDay: number,
  dueDay: number
) {
  const range = financialPeriodRange(month, 'month');
  const next = financialPeriodRange(
    shiftFinancialPeriod(month, 'month', 1),
    'month'
  );
  return {
    closeDate: `${month}-${String(Math.min(closingDay, Number(range.end.slice(-2)))).padStart(2, '0')}`,
    dueDate: `${next.start.slice(0, 7)}-${String(Math.min(dueDay, Number(next.end.slice(-2)))).padStart(2, '0')}`,
  };
}
