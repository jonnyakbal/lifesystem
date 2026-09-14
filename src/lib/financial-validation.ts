import { z } from 'zod';

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');
export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Mês deve estar no formato YYYY-MM');
export const financialEntrySchema = z.object({
  type: z.enum(['income', 'expense_fixed', 'expense_variable']), category: z.string().min(1),
  description: z.string().optional(), amount: z.number().finite().positive(), date: dateSchema,
  recurring: z.boolean().optional(), recurringFrequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']).optional(),
  accountId: z.string().optional(), cardId: z.string().optional(), payee: z.string().optional(), tags: z.array(z.string()).optional(),
  status: z.enum(['pending', 'paid', 'overdue']).optional(), dueDate: dateSchema.optional(), paidDate: dateSchema.optional(),
}).strict();
export const financialEntryUpdateSchema = financialEntrySchema.partial();
export const accountSchema = z.object({ name: z.string().min(1), type: z.enum(['checking', 'savings', 'digital', 'cash', 'investment', 'pj']), bank: z.string().optional(), agency: z.string().optional(), accountNumber: z.string().optional(), balance: z.number().finite().optional(), color: z.string().optional(), icon: z.string().optional(), isActive: z.boolean().optional(), isDefault: z.boolean().optional() }).strict();
export const budgetSchema = z.object({ category: z.string().min(1), type: z.enum(['expense_fixed', 'expense_variable']), monthlyLimit: z.number().finite().nonnegative(), spent: z.number().finite().nonnegative().optional(), month: monthSchema }).strict();
export const billSchema = z.object({ cardId: z.string().min(1), month: monthSchema, amount: z.number().finite().nonnegative(), paidAmount: z.number().finite().nonnegative().optional(), status: z.enum(['open', 'paid', 'overdue', 'partial', 'closed']).optional(), dueDate: dateSchema, closeDate: dateSchema, description: z.string().optional(), items: z.array(z.object({ id: z.string(), description: z.string(), amount: z.number().finite().nonnegative(), date: dateSchema, category: z.string().optional() })).optional() }).strict();
export const cardSchema = z.object({ name: z.string().min(1), type: z.enum(['credit', 'debit', 'multiple']), lastDigits: z.string().min(4).max(4), brand: z.string().min(1), limit: z.number().finite().nonnegative().optional(), used: z.number().finite().nonnegative().optional(), closingDay: z.number().int().min(1).max(31).optional(), dueDay: z.number().int().min(1).max(31).optional(), color: z.string().optional(), accountId: z.string().optional(), isActive: z.boolean().optional() }).strict();
export const payeeSchema = z.object({ name: z.string().min(1), type: z.enum(['person', 'company', 'government', 'other']), document: z.string().optional(), email: z.string().email().optional(), phone: z.string().optional(), category: z.string().optional(), notes: z.string().optional(), color: z.string().optional(), icon: z.string().optional() }).strict();
export const financialGoalSchema = z.object({ name: z.string().min(1), description: z.string().optional(), targetAmount: z.number().finite().positive(), currentAmount: z.number().finite().nonnegative().optional(), deadline: dateSchema.optional(), icon: z.string().optional(), color: z.string().optional(), status: z.enum(['active', 'completed', 'paused']).optional() }).strict();
