import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { storage } from '@/lib/storage';
import { categories, categoryColors } from '@/lib/finance-model';
import type { FinancialEntry, Budget } from '@/types';

export interface FinancialCategory { id: string; name: string; type: FinancialEntry['type']; color: string; revision: number; aliases: string[]; historicalTypes: FinancialEntry['type'][]; archived: boolean }
const stable = (type: string, name: string) => `category-${createHash('sha256').update(`${type}:${name}`).digest('hex').slice(0, 24)}`;
const normal = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
export async function getFinancialCategories() {
  const saved = await storage.getAll<FinancialCategory>('financial-categories');
  const entries = await storage.getAll<FinancialEntry>('financial');
  const virtual: FinancialCategory[] = [];
  for (const type of ['income', 'expense_fixed', 'expense_variable'] as const) {
    const names = Array.from(new Set([...categories[type], ...entries.filter(entry => entry.type === type).map(entry => entry.category)]));
    for (const name of names) {
      if (saved.some(item => item.historicalTypes.includes(type) && item.aliases.some(alias => normal(alias) === normal(name)))) continue;
      virtual.push({ id: stable(type, name), name, type, color: categoryColors[name] || '#64748b', revision: 0, aliases: [name], historicalTypes: [type], archived: false });
    }
  }
  return [...saved, ...virtual];
}
const schema = z.object({ id: z.string().optional(), expectedRevision: z.number().int().nonnegative(), name: z.string().trim().min(1).max(100), type: z.enum(['income', 'expense_fixed', 'expense_variable']), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), archived: z.boolean().optional() }).strict();
export async function saveFinancialCategory(raw: unknown) {
  const input = schema.parse(raw);
  return storage.transact<FinancialCategory, FinancialCategory>('financial-categories', async saved => {
    const catalog = await getFinancialCategories();
    const previous = input.id ? catalog.find(item => item.id === input.id) : undefined;
    if (input.id && !previous) throw new Error('Categoria não encontrada.');
    if ((previous?.revision || 0) !== input.expectedRevision) throw new Error('Conflito de versão. Releia a categoria.');
    const inheritedAliases = [...(previous?.aliases || []), input.name];
    const ownedTypes = [...(previous?.historicalTypes || []), input.type];
    if (catalog.some(item => item.id !== previous?.id && item.historicalTypes.some(type => ownedTypes.includes(type)) && item.aliases.some(alias => inheritedAliases.some(name => normal(name) === normal(alias))))) throw new Error('Esse nome ou nome histórico já pertence a outra categoria nesse tipo.');
    const next: FinancialCategory = { id: previous?.id || randomUUID(), name: input.name, type: input.type, color: input.color, revision: input.expectedRevision + 1, aliases: Array.from(new Set([...(previous?.aliases || []), input.name])), historicalTypes: Array.from(new Set([...(previous?.historicalTypes || []), input.type])), archived: input.archived ?? previous?.archived ?? false };
    const index = saved.findIndex(item => item.id === next.id); if (index >= 0) saved[index] = next; else saved.push(next);
    return next;
  });
}
/** Names are resolved for display; no amount, status, date or historical category is rewritten. */
export async function getFinancialDisplayEntries() {
  const [entries, catalog] = await Promise.all([storage.getAll<FinancialEntry>('financial'), getFinancialCategories()]);
  return entries.map(entry => ({ ...entry, category: catalog.find(item => item.historicalTypes.includes(entry.type) && item.aliases.some(alias => normal(alias) === normal(entry.category)))?.name || entry.category }));
}

export async function getFinancialDisplayBudgets() {
  const [budgets, catalog] = await Promise.all([storage.getAll<Budget>('budgets'), getFinancialCategories()]);
  return budgets.map(item => ({ ...item, category: catalog.find(category => category.historicalTypes.includes(item.type) && category.aliases.some(alias => normal(alias) === normal(item.category)))?.name || item.category }));
}
