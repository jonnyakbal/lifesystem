export type FinancialPeriod = 'month' | 'quarter' | 'year' | 'all';

export interface FinancialPeriodEntry {
  type: 'income' | 'expense_fixed' | 'expense_variable';
  amount: number;
  date: string;
  dueDate?: string | null;
  paidDate?: string | null;
  status?: 'pending' | 'paid' | 'overdue';
}

export interface FinancialRange { start: string; end: string; label: string }

export interface FinancialTotals { income: number; expenses: number; balance: number }

export interface FinancialSummary {
  realized: FinancialTotals;
  projected: FinancialTotals;
  entries: number;
}

function monthDate(month: string): Date {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1, 1);
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthKey(date: Date): string { return dateKey(date).slice(0, 7); }

/** `date` is the recorded transaction date; it never changes to fit a report. */
export function effectiveFinancialDate(entry: FinancialPeriodEntry): string {
  return entry.status === 'paid' ? (entry.paidDate || entry.date) : (entry.dueDate || entry.date);
}

export function financialPeriodRange(anchorMonth: string, period: FinancialPeriod): FinancialRange {
  if (period === 'all') return { start: '0000-01-01', end: '9999-12-31', label: 'Todo o período' };
  const anchor = monthDate(anchorMonth);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstMonth = period === 'year' ? 0 : period === 'quarter' ? Math.floor(month / 3) * 3 : month;
  const count = period === 'year' ? 12 : period === 'quarter' ? 3 : 1;
  const start = new Date(year, firstMonth, 1);
  const end = new Date(year, firstMonth + count, 0);
  const label = period === 'month'
    ? start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : period === 'quarter' ? `T${Math.floor(month / 3) + 1} ${year}` : String(year);
  return { start: dateKey(start), end: dateKey(end), label };
}

export function shiftFinancialPeriod(anchorMonth: string, period: FinancialPeriod, direction: -1 | 1): string {
  if (period === 'all') return anchorMonth;
  const date = monthDate(anchorMonth);
  date.setMonth(date.getMonth() + direction * (period === 'year' ? 12 : period === 'quarter' ? 3 : 1));
  return monthKey(date);
}

export function financialEntriesForRange<T extends FinancialPeriodEntry>(entries: T[], range: FinancialRange): T[] {
  return entries.filter(entry => {
    const day = effectiveFinancialDate(entry);
    return day >= range.start && day <= range.end;
  });
}

export function summarizeFinancialEntries(entries: FinancialPeriodEntry[]): FinancialSummary {
  const realized: FinancialTotals = { income: 0, expenses: 0, balance: 0 };
  const projected: FinancialTotals = { income: 0, expenses: 0, balance: 0 };
  for (const entry of entries) {
    const totals = entry.status === 'paid' ? realized : projected;
    if (entry.type === 'income') totals.income += entry.amount;
    else totals.expenses += entry.amount;
  }
  realized.balance = realized.income - realized.expenses;
  projected.balance = projected.income - projected.expenses;
  return { realized, projected, entries: entries.length };
}

export function summarizeFinancialMonth(entries: FinancialPeriodEntry[], month: string): FinancialSummary {
  return summarizeFinancialEntries(financialEntriesForRange(entries, financialPeriodRange(month, 'month')));
}
