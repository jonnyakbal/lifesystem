export type RecurringType =
  'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface FinancialEntry {
  id: string;
  type: 'income' | 'expense_fixed' | 'expense_variable';
  category: string;
  description?: string;
  amount: number;
  date: string;
  recurring?: boolean | RecurringType;
  recurringFrequency?: RecurringType;
  accountId?: string;
  cardId?: string;
  payee?: string;
  tags?: string[];
  status?: 'pending' | 'paid' | 'overdue';
  dueDate?: string | null;
  paidDate?: string | null;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'digital' | 'cash' | 'investment' | 'pj';
  bank?: string;
  balance: number;
  color: string;
  icon: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface Card {
  id: string;
  name: string;
  type: 'credit' | 'debit' | 'multiple';
  lastDigits: string;
  brand: string;
  limit?: number;
  used?: number;
  closingDay?: number;
  dueDay?: number;
  color: string;
  accountId?: string;
  isActive: boolean;
}

export interface Bill {
  id: string;
  cardId: string;
  month: string;
  amount: number;
  paidAmount: number;
  status: 'open' | 'paid' | 'overdue' | 'partial' | 'closed';
  dueDate: string;
  closeDate: string;
  description?: string;
  items: BillItem[];
}

export interface BillItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  installments?: { current: number; total: number };
}

export interface Budget {
  id: string;
  category: string;
  type: string;
  monthlyLimit: number;
  spent: number;
  month: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon: string;
  color: string;
  status: 'active' | 'completed' | 'paused';
}

export interface Payee {
  id: string;
  name: string;
  type: 'person' | 'company' | 'government' | 'other';
  document?: string;
  color: string;
  icon: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const accountTypeConfig: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  checking: { label: 'Conta Corrente', icon: '🏦', color: '#3b82f6' },
  savings: { label: 'Poupança', icon: '🐷', color: '#22c55e' },
  digital: { label: 'Conta Digital', icon: '📱', color: '#8b5cf6' },
  cash: { label: 'Dinheiro', icon: '💵', color: '#f59e0b' },
  investment: { label: 'Investimento', icon: '📈', color: '#06b6d4' },
  pj: { label: 'Conta PJ', icon: '🏢', color: '#ec4899' },
};

export const cardBrandColors: Record<string, string> = {
  Visa: '#1a1f71',
  Mastercard: '#eb001b',
  Elo: '#00a5b5',
  American: '#006fcf',
  Hiper: '#cc0000',
  Nubank: '#820ad1',
  Inter: '#ff7a00',
  Mercado: '#009ee3',
};

export const categories = {
  income: [
    'Salário',
    'Serviços',
    'Vendas',
    'Projetos',
    'Rendimentos',
    'Outros',
  ],
  expense_fixed: [
    'Aluguel',
    'Condomínio',
    'Água',
    'Luz',
    'Internet',
    'Celular',
    'Faculdade',
    'Seguro',
    'Carro',
    'Software',
    'Assinaturas',
  ],
  expense_variable: [
    'Alimentação',
    'Combustível',
    'Lazer',
    'Roupas',
    'Saúde',
    'Educação',
    'Presentes',
    'Emergências',
    'Marketing',
    'Viagem',
  ],
};

export const categoryColors: Record<string, string> = {
  Salário: '#22c55e',
  Serviços: '#3b82f6',
  Vendas: '#a78bfa',
  Projetos: '#f59e0b',
  Rendimentos: '#06b6d4',
  Outros: '#64748b',
  Aluguel: '#ef4444',
  Condomínio: '#f97316',
  Água: '#06b6d4',
  Luz: '#eab308',
  Internet: '#3b82f6',
  Celular: '#8b5cf6',
  Faculdade: '#a78bfa',
  Seguro: '#64748b',
  Carro: '#ef4444',
  Software: '#22c55e',
  Assinaturas: '#ec4899',
  Alimentação: '#ef4444',
  Combustível: '#f97316',
  Lazer: '#ec4899',
  Roupas: '#a78bfa',
  Saúde: '#22c55e',
  Educação: '#3b82f6',
  Presentes: '#f59e0b',
  Emergências: '#dc2626',
  Marketing: '#8b5cf6',
  Viagem: '#06b6d4',
};

export const recurringLabels: Record<RecurringType, string> = {
  none: 'Único',
  daily: 'Diária',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  pending: {
    label: 'Pendente',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    icon: '⏳',
  },
  paid: {
    label: 'Pago',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    icon: '✅',
  },
  overdue: {
    label: 'Atrasado',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    icon: '⚠️',
  },
};
