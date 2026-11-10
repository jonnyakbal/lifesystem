// Aprende com o uso: sugere descrições já lançadas e preenche o resto a partir do histórico.
import type { FinancialEntry } from '@/lib/finance-model';

export function normalizeDescription(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\(\d+\/\d+\)\s*$/, '') // "Fone (2/3)" aprende como "Fone"
    .trim()
    .toLowerCase();
}

function baseDescription(entry: FinancialEntry) {
  return (entry.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
}

/** Descrições mais usadas (e mais recentes) do tipo informado, sem repetir parcelas. */
export function descriptionSuggestions(entries: FinancialEntry[], type?: FinancialEntry['type'], limit = 40) {
  const stats = new Map<string, { label: string; count: number; last: string }>();
  for (const entry of entries) {
    if (type && (type === 'income') !== (entry.type === 'income')) continue;
    const label = baseDescription(entry);
    if (!label) continue;
    if (entry.installment && entry.installment.current > 1) continue;
    const key = normalizeDescription(label);
    const item = stats.get(key) || { label, count: 0, last: '' };
    item.count += 1;
    if (entry.date >= item.last) { item.last = entry.date; item.label = label; }
    stats.set(key, item);
  }
  return [...stats.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map((item) => item.label);
}

export interface EntrySuggestion {
  type: FinancialEntry['type'];
  category: string;
  cardId?: string;
  accountId?: string;
  payee?: string;
  amount?: number;
  installments?: number;
}

/** O que preencher quando a descrição já foi usada: o lançamento mais recente com ela. */
export function suggestionFor(entries: FinancialEntry[], description: string): EntrySuggestion | null {
  const key = normalizeDescription(description);
  if (!key) return null;
  const matches = entries
    .filter((e) => normalizeDescription(e.description || '') === key)
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = matches[0];
  if (!last) return null;
  // Valor só se repete quando ele costuma ser o mesmo (conta fixa, assinatura).
  const amounts = new Set(matches.slice(0, 3).map((e) => e.installment?.totalAmount ?? e.amount));
  return {
    type: last.type,
    category: last.category,
    cardId: last.cardId || undefined,
    accountId: last.accountId || undefined,
    payee: last.payee || undefined,
    amount: amounts.size === 1 ? [...amounts][0] : undefined,
    installments: last.installment?.total,
  };
}
