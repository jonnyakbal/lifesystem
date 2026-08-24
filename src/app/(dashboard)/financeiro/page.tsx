'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, Edit2, PieChart, BarChart3,
  Target, Calendar, Search, ArrowUpRight, ArrowDownRight, Flame, PiggyBank,
  X, Check, AlertTriangle, Zap, Repeat, ChevronDown, ChevronUp,
  ArrowRightLeft, CreditCard, Building2, Landmark, Banknote, CircleDollarSign,
  Clock, CheckCircle2, AlertCircle, MoreHorizontal, Filter, Copy, Receipt,
  ArrowRight, CircleDot, DollarSign, BadgeCheck, LandmarkIcon, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecurringType = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

interface FinancialEntry {
  id: string;
  type: 'income' | 'expense_fixed' | 'expense_variable';
  category: string;
  description?: string;
  amount: number;
  date: string;
  recurring?: RecurringType;
  accountId?: string;
  cardId?: string;
  payee?: string;
  tags?: string[];
  status?: 'pending' | 'paid' | 'overdue';
  dueDate?: string;
  paidDate?: string;
}

interface Account {
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

interface Card {
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

interface Bill {
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

interface BillItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  installments?: { current: number; total: number };
}

interface Budget {
  id: string;
  category: string;
  type: string;
  monthlyLimit: number;
  spent: number;
  month: string;
}

interface FinancialGoal {
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

interface Payee {
  id: string;
  name: string;
  type: 'person' | 'company' | 'government' | 'other';
  document?: string;
  color: string;
  icon: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const accountTypeConfig: Record<string, { label: string; icon: string; color: string }> = {
  checking: { label: 'Conta Corrente', icon: '🏦', color: '#3b82f6' },
  savings: { label: 'Poupança', icon: '🐷', color: '#22c55e' },
  digital: { label: 'Conta Digital', icon: '📱', color: '#8b5cf6' },
  cash: { label: 'Dinheiro', icon: '💵', color: '#f59e0b' },
  investment: { label: 'Investimento', icon: '📈', color: '#06b6d4' },
  pj: { label: 'Conta PJ', icon: '🏢', color: '#ec4899' },
};

const cardBrandColors: Record<string, string> = {
  Visa: '#1a1f71', Mastercard: '#eb001b', Elo: '#00a5b5', American: '#006fcf',
  Hiper: '#cc0000', Nubank: '#820ad1', Inter: '#ff7a00', Mercado: '#009ee3',
};

const categories = {
  income: ['Dona Maria', 'ARCO PASS', 'ARCO LABS', 'DJ', 'Editais', 'Consultoria', 'Rendimento', 'Outros'],
  expense_fixed: ['Aluguel', 'Condomínio', 'Água', 'Luz', 'Internet', 'Celular', 'Faculdade', 'Seguro', 'Carro', 'Software', 'Assinaturas'],
  expense_variable: ['Alimentação', 'Combustível', 'Lazer', 'Roupas', 'Saúde', 'Educação', 'Presentes', 'Emergências', 'Marketing', 'Viagem'],
};

const categoryColors: Record<string, string> = {
  'Dona Maria': '#22c55e', 'ARCO PASS': '#3b82f6', 'ARCO LABS': '#a78bfa', 'DJ': '#ec4899', 'Editais': '#f59e0b', 'Consultoria': '#06b6d4', 'Rendimento': '#22c55e', 'Outros': '#64748b',
  'Aluguel': '#ef4444', 'Condomínio': '#f97316', 'Água': '#06b6d4', 'Luz': '#eab308', 'Internet': '#3b82f6', 'Celular': '#8b5cf6', 'Faculdade': '#a78bfa', 'Seguro': '#64748b', 'Carro': '#ef4444', 'Software': '#22c55e', 'Assinaturas': '#ec4899',
  'Alimentação': '#ef4444', 'Combustível': '#f97316', 'Lazer': '#ec4899', 'Roupas': '#a78bfa', 'Saúde': '#22c55e', 'Educação': '#3b82f6', 'Presentes': '#f59e0b', 'Emergências': '#dc2626', 'Marketing': '#8b5cf6', 'Viagem': '#06b6d4',
};

const recurringLabels: Record<RecurringType, string> = {
  none: 'Único', weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', yearly: 'Anual',
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: 'Pendente', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: '⏳' },
  paid: { label: 'Pago', color: 'text-green-500', bgColor: 'bg-green-500/10', icon: '✅' },
  overdue: { label: 'Atrasado', color: 'text-red-500', bgColor: 'bg-red-500/10', icon: '⚠️' },
};

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } } };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // View state
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'cards' | 'bills' | 'transactions' | 'categories'>('overview');
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Quick add
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickType, setQuickType] = useState<FinancialEntry['type']>('expense_variable');
  const [quickDescription, setQuickDescription] = useState('');
  const [quickAccountId, setQuickAccountId] = useState('');
  const [quickCardId, setQuickCardId] = useState('');
  const [quickPayee, setQuickPayee] = useState('');
  const [quickRecurring, setQuickRecurring] = useState<RecurringType>('none');
  const [quickDueDate, setQuickDueDate] = useState('');
  const quickAmountRef = useRef<HTMLInputElement>(null);

  // Dialogs
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isPayeeDialogOpen, setIsPayeeDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null);

  // These 5 dialogs are hand-rolled (not the Radix-based Dialog used elsewhere
  // in the app), so they don't get Escape-to-close for free — wire it up here.
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setIsAccountDialogOpen(false);
      setIsCardDialogOpen(false);
      setIsGoalDialogOpen(false);
      setIsBudgetDialogOpen(false);
      setIsPayeeDialogOpen(false);
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Account form
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Account['type']>('checking');
  const [accountBank, setAccountBank] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [accountColor, setAccountColor] = useState('#3b82f6');
  const [accountIcon, setAccountIcon] = useState('🏦');

  // Card form
  const [cardName, setCardName] = useState('');
  const [cardType, setCardType] = useState<Card['type']>('credit');
  const [cardLastDigits, setCardLastDigits] = useState('');
  const [cardBrand, setCardBrand] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('');
  const [cardDueDay, setCardDueDay] = useState('');
  const [cardColor, setCardColor] = useState('#64748b');

  // Payee form
  const [payeeName, setPayeeName] = useState('');
  const [payeeType, setPayeeType] = useState<Payee['type']>('person');
  const [payeeDocument, setPayeeDocument] = useState('');

  // Goal form
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalIcon, setGoalIcon] = useState('🎯');

  // Budget form
  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [entriesData, accountsData, cardsData, budgetsData, goalsData, payeesData, billsData] = await Promise.all([
        apiFetch<FinancialEntry[]>('/api/financial'),
        apiFetch<Account[]>('/api/accounts'),
        apiFetch<Card[]>('/api/cards'),
        apiFetch<Budget[]>('/api/budgets'),
        apiFetch<FinancialGoal[]>('/api/financial-goals'),
        apiFetch<Payee[]>('/api/payees'),
        apiFetch<Bill[]>('/api/bills'),
      ]);
      setEntries(entriesData);
      setAccounts(accountsData);
      setCards(cardsData);
      setBudgets(budgetsData);
      setGoals(goalsData);
      setPayees(payeesData);
      setBills(billsData);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Date Range Filter ────────────────────────────────────────────────────

  const range = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (dateRange === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { start, end: today, label: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) };
    }
    if (dateRange === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
      return { start, end: today, label: `T${q + 1} ${now.getFullYear()}` };
    }
    if (dateRange === 'year') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      return { start, end: today, label: `${now.getFullYear()}` };
    }
    return { start: '2000-01-01', end: '2099-12-31', label: 'Todo o período' };
  }, [dateRange]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.date < range.start || e.date > range.end) return false;
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return e.category.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || e.payee?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, range, filterType, filterStatus, searchQuery, categoryFilter]);

  // ─── Calculations ─────────────────────────────────────────────────────────

  const totalIncome = filteredEntries.filter(e => e.type === 'income').reduce((a, e) => a + e.amount, 0);
  const totalExpensesFixed = filteredEntries.filter(e => e.type === 'expense_fixed').reduce((a, e) => a + e.amount, 0);
  const totalExpensesVar = filteredEntries.filter(e => e.type === 'expense_variable').reduce((a, e) => a + e.amount, 0);
  const totalExpenses = totalExpensesFixed + totalExpensesVar;
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;
  const totalBalance = accounts.filter(a => a.isActive).reduce((a, acc) => a + acc.balance, 0);
  const totalCardUsed = cards.filter(c => c.type === 'credit' && c.isActive).reduce((a, c) => a + (c.used || 0), 0);
  const totalCardLimit = cards.filter(c => c.type === 'credit' && c.isActive).reduce((a, c) => a + (c.limit || 0), 0);

  const pendingEntries = entries.filter(e => e.status === 'pending' && e.dueDate);
  const overdueEntries = pendingEntries.filter(e => e.dueDate && e.dueDate < new Date().toISOString().split('T')[0]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentBudgets = budgets.filter(b => b.month === currentMonth);

  const incomePercent = totalIncome + totalExpenses > 0 ? Math.round((totalIncome / (totalIncome + totalExpenses)) * 100) : 50;

  const currentMonthExpenses = useMemo(() => {
    return entries.filter(e => e.type !== 'income' && e.date.startsWith(currentMonth)).reduce((a, e) => a + e.amount, 0);
  }, [entries, currentMonth]);

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  const dailyBurnRate = dayOfMonth > 0 ? Math.round(currentMonthExpenses / dayOfMonth) : 0;
  const projectedMonthEnd = dailyBurnRate * daysInMonth;

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredEntries.filter(e => e.type !== 'income').forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, color: categoryColors[label] || '#64748b' }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries]);

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredEntries.filter(e => e.type === 'income').forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, color: categoryColors[label] || '#22c55e' }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEntries]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { label: string; income: number; expense: number; balance: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' });
      const inc = entries.filter(e => e.type === 'income' && e.date.startsWith(monthStr)).reduce((a, e) => a + e.amount, 0);
      const exp = entries.filter(e => e.type !== 'income' && e.date.startsWith(monthStr)).reduce((a, e) => a + e.amount, 0);
      months.push({ label, income: inc, expense: exp, balance: inc - exp });
    }
    return months;
  }, [entries]);

  // ─── CRUD Functions ───────────────────────────────────────────────────────

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickAmount || !quickCategory) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const isFuture = quickDueDate && quickDueDate > today;
      await apiFetch('/api/financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: quickType, category: quickCategory, description: quickDescription,
          amount: parseFloat(quickAmount), date: today, recurring: quickRecurring,
          accountId: quickAccountId || undefined, cardId: quickCardId || undefined,
          payee: quickPayee || undefined, status: isFuture ? 'pending' : 'paid',
          dueDate: quickDueDate || undefined,
        }),
      });
      setQuickAmount(''); setQuickDescription(''); setQuickPayee(''); setQuickDueDate('');
      loadAll();
      toast.success('Lançamento adicionado!');
      setTimeout(() => quickAmountRef.current?.focus(), 100);
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleCreateAccount() {
    if (!accountName) return;
    try {
      await apiFetch('/api/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName, type: accountType, bank: accountBank, balance: parseFloat(accountBalance) || 0, color: accountColor, icon: accountIcon }),
      });
      setAccountName(''); setAccountBank(''); setAccountBalance('');
      setIsAccountDialogOpen(false); loadAll(); toast.success('Conta criada!');
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleCreateCard() {
    if (!cardName || !cardLastDigits) return;
    try {
      await apiFetch('/api/cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cardName, type: cardType, lastDigits: cardLastDigits, brand: cardBrand, limit: parseFloat(cardLimit) || undefined, closingDay: parseInt(cardClosingDay) || undefined, dueDay: parseInt(cardDueDay) || undefined, color: cardColor }),
      });
      setCardName(''); setCardLastDigits(''); setCardBrand(''); setCardLimit(''); setCardClosingDay(''); setCardDueDay('');
      setIsCardDialogOpen(false); loadAll(); toast.success('Cartão criado!');
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleCreatePayee() {
    if (!payeeName) return;
    try {
      await apiFetch('/api/payees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: payeeName, type: payeeType, document: payeeDocument }),
      });
      setPayeeName(''); setPayeeDocument('');
      setIsPayeeDialogOpen(false); loadAll(); toast.success('Credor criado!');
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleCreateGoal() {
    if (!goalName || !goalTarget) return;
    try {
      await apiFetch('/api/financial-goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: goalName, targetAmount: parseFloat(goalTarget), currentAmount: parseFloat(goalCurrent) || 0, deadline: goalDeadline || undefined, icon: goalIcon }),
      });
      setGoalName(''); setGoalTarget(''); setGoalCurrent(''); setGoalDeadline('');
      setIsGoalDialogOpen(false); loadAll(); toast.success('Meta criada!');
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleCreateBudget() {
    if (!budgetCategory || !budgetLimit) return;
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await apiFetch('/api/budgets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: budgetCategory, type: 'expense_variable', monthlyLimit: parseFloat(budgetLimit), spent: 0, month }),
      });
      setBudgetCategory(''); setBudgetLimit('');
      setIsBudgetDialogOpen(false); loadAll(); toast.success('Orçamento criado!');
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleDeleteEntry(id: string) {
    const entry = entries.find(e => e.id === id);
    try {
      await apiFetch(`/api/financial/${id}`, { method: 'DELETE' });
      loadAll();
      toast('Lançamento excluído', {
        action: { label: 'Desfazer', onClick: async () => {
          if (entry) { await apiFetch('/api/financial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }); loadAll(); toast.success('Restaurado!'); }
        }},
      });
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleTogglePaid(entry: FinancialEntry) {
    const newStatus = entry.status === 'paid' ? 'pending' : 'paid';
    try {
      await apiFetch(`/api/financial/${entry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, paidDate: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined }),
      });
      loadAll();
      toast.success(newStatus === 'paid' ? 'Marcado como pago!' : 'Marcado como pendente');
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleUpdateAccountBalance(account: Account, delta: number) {
    const newBalance = account.balance + delta;
    try {
      await apiFetch(`/api/accounts/${account.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBalance }),
      });
      loadAll();
    } catch (err) { toast.error(showError(err)); }
  }

  // ─── Bill Closing Functions ───────────────────────────────────────────────

  function getCurrentBillMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function getNextBillMonth() {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function getCardTransactionsForMonth(cardId: string, month: string) {
    return entries.filter(e => e.cardId === cardId && e.date.startsWith(month) && e.type !== 'income');
  }

  function getBillForCardMonth(cardId: string, month: string) {
    return bills.find(b => b.cardId === cardId && b.month === month);
  }

  async function handleCloseBill(cardId: string, month: string) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const transactions = getCardTransactionsForMonth(cardId, month);
    const total = transactions.reduce((a, e) => a + e.amount, 0);
    const closeDate = `${month}-${String(card.closingDay || 1).padStart(2, '0')}`;
    // Due date is in the NEXT month
    const [year, mon] = month.split('-').map(Number);
    const dueDateObj = new Date(year, mon, card.dueDay || 10);
    const dueDate = dueDateObj.toISOString().slice(0, 10);

    const existingBill = getBillForCardMonth(cardId, month);

    try {
      if (existingBill) {
        await apiFetch(`/api/bills/${existingBill.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: total, status: 'closed', closeDate, dueDate, items: transactions.map(t => ({ id: t.id, description: t.category + (t.description ? ` - ${t.description}` : ''), amount: t.amount, date: t.date, category: t.category })) }),
        });
      } else {
        await apiFetch('/api/bills', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId, month, amount: total, paidAmount: 0, status: 'closed', closeDate, dueDate, items: transactions.map(t => ({ id: t.id, description: t.category + (t.description ? ` - ${t.description}` : ''), amount: t.amount, date: t.date, category: t.category })) }),
        });
      }
      loadAll();
      toast.success(`Fatura de ${card.name} fechada! R$ ${total.toLocaleString('pt-BR')}`);
    } catch (err) { toast.error(showError(err)); }
  }

  async function handlePayBill(billId: string, amount: number) {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    const newPaidAmount = Math.min(bill.paidAmount + amount, bill.amount);
    const newStatus = newPaidAmount >= bill.amount ? 'paid' : 'partial';
    try {
      await apiFetch(`/api/bills/${billId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount: newPaidAmount, status: newStatus }),
      });
      loadAll();
      toast.success(newStatus === 'paid' ? 'Fatura quitada!' : `Pago R$ ${amount.toLocaleString('pt-BR')}`);
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleCreateBill() {
    const creditCards = cards.filter(c => c.type === 'credit');
    if (creditCards.length === 0) {
      toast.error('Cadastre um cartão de crédito primeiro');
      return;
    }
    const card = creditCards[0];
    const now = new Date();
    const month = getCurrentBillMonth();
    const closeDate = `${month}-${String(card.closingDay || 1).padStart(2, '0')}`;
    const [year, mon] = month.split('-').map(Number);
    const dueDateObj = new Date(year, mon, card.dueDay || 10);
    const dueDate = dueDateObj.toISOString().slice(0, 10);
    try {
      await apiFetch('/api/bills', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, month, amount: 0, paidAmount: 0, status: 'open', closeDate, dueDate, items: [] }),
      });
      loadAll();
      toast.success('Fatura criada!');
    } catch (err) { toast.error(showError(err)); }
  }

  async function handleDeleteBill(id: string) {
    try {
      await apiFetch(`/api/bills/${id}`, { method: 'DELETE' });
      loadAll();
      toast.success('Fatura excluída!');
    } catch (err) { toast.error(showError(err)); }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div className="p-4 lg:p-8 max-w-[1600px] mx-auto" variants={stagger} initial="initial" animate="animate">
      {/* Header */}
      <motion.div className="mb-6" variants={fade}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Central Financeira</h1>
            <p className="text-lg text-muted-foreground mt-1">Controle de caixa, saldos, cartões e relatórios</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
              <SelectTrigger className="w-[140px] h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este Mês</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* ─── Balances Overview (Organizze-style) ──────────────────────────── */}
      <motion.div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" variants={stagger}>
        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-3 lg:p-5"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>
        )) : (
          <>
            <motion.div variants={fade}>
              <Card className="border-l-4 border-l-money bg-money/5">
                <CardContent className="p-3 lg:p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs lg:text-sm font-medium text-muted-foreground">Saldo Total</span>
                    <Landmark className="h-4 w-4 text-money" />
                  </div>
                  <div className="text-xl lg:text-3xl font-bold text-money font-mono-num">R$ {totalBalance.toLocaleString('pt-BR')}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{accounts.filter(a => a.isActive).length} contas ativas</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={fade}>
              <Card className="border-l-4 border-l-primary bg-primary/5">
                <CardContent className="p-3 lg:p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs lg:text-sm font-medium text-muted-foreground">Receitas</span>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xl lg:text-3xl font-bold text-primary font-mono-num">R$ {totalIncome.toLocaleString('pt-BR')}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{range.label}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={fade}>
              <Card className="border-l-4 border-l-critical bg-critical/5">
                <CardContent className="p-3 lg:p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs lg:text-sm font-medium text-muted-foreground">Despesas</span>
                    <TrendingDown className="h-4 w-4 text-critical" />
                  </div>
                  <div className="text-xl lg:text-3xl font-bold text-critical font-mono-num">R$ {totalExpenses.toLocaleString('pt-BR')}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{range.label}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div variants={fade}>
              <Card className={cn('border-l-4', balance >= 0 ? 'border-l-money bg-money/5' : 'border-l-critical bg-critical/5')}>
                <CardContent className="p-3 lg:p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs lg:text-sm font-medium text-muted-foreground">Fluxo Líquido</span>
                    <CircleDollarSign className={cn('h-4 w-4', balance >= 0 ? 'text-money' : 'text-critical')} />
                  </div>
                  <div className={cn('text-xl lg:text-3xl font-bold font-mono-num', balance >= 0 ? 'text-money' : 'text-critical')}>
                    {balance >= 0 ? '+' : ''} R$ {balance.toLocaleString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={savingsRate} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">{savingsRate}% poupança</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ─── Quick Add (Full-width bar) ────────────────────────────────────── */}
      <motion.div className="mb-6" variants={fade}>
        <Card className="border-primary/30 bg-primary/5">
          <form onSubmit={handleQuickAdd} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Novo Lançamento</span>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo</Label>
                <Select value={quickType} onValueChange={(v) => { setQuickType(v as FinancialEntry['type']); setQuickCategory(''); }}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">💰 Entrada</SelectItem>
                    <SelectItem value="expense_fixed">📌 Fixa</SelectItem>
                    <SelectItem value="expense_variable">🔄 Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Categoria</Label>
                <Select value={quickCategory} onValueChange={setQuickCategory}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {categories[quickType].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Valor (R$)</Label>
                <Input ref={quickAmountRef} type="number" step="0.01" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} placeholder="0,00" className="h-10 font-mono-num text-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Descrição</Label>
                <Input value={quickDescription} onChange={(e) => setQuickDescription(e.target.value)} placeholder="O que foi?" className="h-10" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Conta</Label>
                <Select value={quickAccountId} onValueChange={setQuickAccountId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => a.isActive).map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Frequência</Label>
                <Select value={quickRecurring} onValueChange={(v) => setQuickRecurring(v as RecurringType)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(recurringLabels) as RecurringType[]).map(r => <SelectItem key={r} value={r}>{recurringLabels[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Input type="date" value={quickDueDate} onChange={(e) => setQuickDueDate(e.target.value)} className="h-10 w-40" placeholder="Vencimento" />
              <Input value={quickPayee} onChange={(e) => setQuickPayee(e.target.value)} placeholder="Credor/Fornecedor" className="h-10 flex-1 max-w-xs" />
              <Button type="submit" size="lg" disabled={!quickAmount || !quickCategory} className="h-10 px-6">
                <Plus className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>

      {/* ─── Tab Navigation ─────────────────────────────────────────────────── */}
      <motion.div className="mb-6 flex flex-wrap gap-1 border-b border-border pb-1" variants={fade}>
        {[
          { id: 'overview' as const, label: 'Visão Geral', icon: BarChart3 },
          { id: 'accounts' as const, label: 'Contas', icon: Landmark },
          { id: 'cards' as const, label: 'Cartões', icon: CreditCard },
          { id: 'bills' as const, label: 'Faturas', icon: Receipt },
          { id: 'transactions' as const, label: 'Lançamentos', icon: CircleDollarSign },
          { id: 'categories' as const, label: 'Cadastros', icon: Building2 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2',
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* ─── Tab Content ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {/* Cash Flow + Budgets */}
            <div className="grid gap-6 lg:grid-cols-3 mb-6">
              {/* Burn Rate */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Flame className="h-5 w-5 text-orange-500" /> Burn Rate Diário
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono-num">R$ {dailyBurnRate.toLocaleString('pt-BR')}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Projeção fim do mês: <span className="font-bold text-critical">R$ {projectedMonthEnd.toLocaleString('pt-BR')}</span>
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Dia {dayOfMonth}</span><span>{daysInMonth} dias</span>
                    </div>
                    <Progress value={(dayOfMonth / daysInMonth) * 100} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Pending Bills */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-5 w-5 text-yellow-500" /> Contas a Pagar
                  </CardTitle>
                  <Badge variant="secondary">{pendingEntries.length}</Badge>
                </CardHeader>
                <CardContent>
                  {pendingEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta pendente</p>
                  ) : (
                    <div className="space-y-2">
                      {pendingEntries.slice(0, 5).map(entry => (
                        <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                          <button onClick={() => handleTogglePaid(entry)}>
                            {entry.status === 'paid' ? <CheckCircle2 className="h-4 w-4 text-money" /> : <CircleDot className="h-4 w-4 text-yellow-500" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{entry.category}</p>
                            <p className="text-xs text-muted-foreground">Vence {new Date(entry.dueDate! + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          </div>
                          <span className="text-sm font-bold font-mono-num text-critical">R$ {entry.amount.toLocaleString('pt-BR')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Goals */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-5 w-5 text-stellar" /> Metas
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsGoalDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {goals.filter(g => g.status === 'active').length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma meta ativa</p>
                  ) : (
                    <div className="space-y-3">
                      {goals.filter(g => g.status === 'active').slice(0, 4).map(goal => {
                        const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);
                        return (
                          <div key={goal.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium flex items-center gap-1">{goal.icon} {goal.name}</span>
                              <span className="text-xs text-muted-foreground font-mono-num">{progress}%</span>
                            </div>
                            <Progress value={Math.min(progress, 100)} className="h-2" />
                            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                              <span>R$ {goal.currentAmount.toLocaleString('pt-BR')}</span>
                              <span>R$ {goal.targetAmount.toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2 mb-6">
              {/* Monthly Trend */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-5 w-5" /> Tendência Mensal</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {monthlyTrend.map((m) => {
                      const maxVal = Math.max(m.income, m.expense, 1);
                      return (
                        <div key={m.label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground capitalize w-8">{m.label}</span>
                            <span className="font-mono-num text-money">+R$ {m.income.toLocaleString('pt-BR')}</span>
                            <span className="font-mono-num text-critical">-R$ {m.expense.toLocaleString('pt-BR')}</span>
                            <span className={cn('font-mono-num font-bold w-24 text-right', m.balance >= 0 ? 'text-money' : 'text-critical')}>
                              R$ {m.balance.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex gap-0.5 h-4 rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-l-full bg-money/70" initial={{ width: 0 }} animate={{ width: `${(m.income / maxVal) * 50}%` }} transition={{ duration: 0.6 }} />
                            <motion.div className="h-full rounded-r-full bg-critical/70" initial={{ width: 0 }} animate={{ width: `${(m.expense / maxVal) * 50}%` }} transition={{ duration: 0.6 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><PieChart className="h-5 w-5" /> Por Categoria</CardTitle></CardHeader>
                <CardContent>
                  {expenseByCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sem despesas no período</p>
                  ) : (
                    <div className="space-y-2">
                      {expenseByCategory.slice(0, 8).map((cat, i) => {
                        const total = expenseByCategory.reduce((a, c) => a + c.value, 0);
                        const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
                        return (
                          <div key={cat.label} className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-sm flex-1 truncate">{cat.label}</span>
                            <span className="text-sm font-mono-num font-medium">{pct}%</span>
                            <span className="text-sm font-mono-num text-muted-foreground">R$ {cat.value.toLocaleString('pt-BR')}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Budgets */}
            {currentBudgets.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-5 w-5 text-qty" /> Orçamentos do Mês
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setIsBudgetDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {currentBudgets.map(budget => {
                      const percent = Math.round((budget.spent / budget.monthlyLimit) * 100);
                      const isOver = percent > 100;
                      return (
                        <div key={budget.id} className="rounded-xl border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{budget.category}</span>
                            {isOver && <Badge variant="destructive" className="text-xs">Estourado</Badge>}
                          </div>
                          <div className="text-lg font-bold font-mono-num">R$ {budget.spent.toLocaleString('pt-BR')}</div>
                          <div className="text-xs text-muted-foreground">de R$ {budget.monthlyLimit.toLocaleString('pt-BR')}</div>
                          <Progress value={Math.min(percent, 100)} className={cn('h-2 mt-2', isOver && '[&>div]:bg-critical')} />
                          <div className="text-right text-xs font-bold mt-1" style={{ color: isOver ? 'hsl(350 88% 64%)' : 'hsl(162 80% 58%)' }}>{percent}%</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === 'accounts' && (
          <motion.div key="accounts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold font-display">Contas</h2>
              <Button onClick={() => setIsAccountDialogOpen(true)} size="lg"><Plus className="mr-2 h-4 w-4" /> Nova Conta</Button>
            </div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-10 w-48" /></CardContent></Card>)}
              </div>
            ) : accounts.length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16">
                <Landmark className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-lg font-medium">Nenhuma conta cadastrada</p>
                <p className="text-sm text-muted-foreground mb-4">Cadastre suas contas para controle de caixa</p>
                <Button onClick={() => setIsAccountDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Criar Primeira Conta</Button>
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map(account => {
                  const typeInfo = accountTypeConfig[account.type] || { label: account.type, icon: '🏦', color: '#64748b' };
                  return (
                    <Card key={account.id} className="overflow-hidden hover:shadow-lg transition-all">
                      <div className="h-3" style={{ backgroundColor: account.color }} />
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-3xl">{account.icon || typeInfo.icon}</span>
                          <div>
                            <h3 className="font-bold text-lg">{account.name}</h3>
                            <p className="text-sm text-muted-foreground">{typeInfo.label} {account.bank ? `• ${account.bank}` : ''}</p>
                          </div>
                        </div>
                        <div className="text-3xl font-bold font-mono-num mb-4" style={{ color: account.balance >= 0 ? 'hsl(162 80% 58%)' : 'hsl(350 88% 64%)' }}>
                          R$ {account.balance.toLocaleString('pt-BR')}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleUpdateAccountBalance(account, 100)}>
                            <ArrowDownRight className="h-3 w-3 mr-1" /> +R$100
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => handleUpdateAccountBalance(account, -100)}>
                            <ArrowUpRight className="h-3 w-3 mr-1" /> -R$100
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'cards' && (
          <motion.div key="cards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold font-display">Cartões</h2>
              <Button onClick={() => setIsCardDialogOpen(true)} size="lg"><Plus className="mr-2 h-4 w-4" /> Novo Cartão</Button>
            </div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-10 w-48" /></CardContent></Card>)}
              </div>
            ) : cards.length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16">
                <CreditCard className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-lg font-medium">Nenhum cartão cadastrado</p>
                <p className="text-sm text-muted-foreground mb-4">Cadastre seus cartões de crédito e débito</p>
                <Button onClick={() => setIsCardDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Criar Primeiro Cartão</Button>
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {cards.map(card => {
                  const brandColor = cardBrandColors[card.brand] || card.color;
                  const usagePercent = card.limit ? Math.round(((card.used || 0) / card.limit) * 100) : 0;
                  return (
                    <Card key={card.id} className="overflow-hidden hover:shadow-lg transition-all">
                      <div className="h-40 p-6 flex flex-col justify-between relative" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)` }}>
                        <div className="flex items-center justify-between">
                          <span className="text-white/80 text-sm font-medium">{card.name}</span>
                          <Badge variant="secondary" className="bg-white/20 text-white border-0">{card.type === 'credit' ? 'Crédito' : 'Débito'}</Badge>
                        </div>
                        <div>
                          <div className="text-white text-2xl font-bold tracking-wider mb-1">
                            **** **** **** {card.lastDigits}
                          </div>
                          <div className="text-white/70 text-sm">{card.brand}</div>
                        </div>
                      </div>
                      <CardContent className="p-5">
                        {card.type === 'credit' && card.limit && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Limite usado</span>
                              <span className="font-mono-num font-medium">R$ {(card.used || 0).toLocaleString('pt-BR')} / R$ {card.limit.toLocaleString('pt-BR')}</span>
                            </div>
                            <Progress value={Math.min(usagePercent, 100)} className={cn('h-3', usagePercent > 80 && '[&>div]:bg-critical')} />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{usagePercent}% utilizado</span>
                              <span>Disponível: R$ {(card.limit - (card.used || 0)).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                          {card.closingDay && <span>Fechamento: dia {card.closingDay}</span>}
                          {card.dueDay && <span>Vencimento: dia {card.dueDay}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'bills' && (
          <motion.div key="bills" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold font-display">Faturas dos Cartões</h2>
                <p className="text-sm text-muted-foreground">Controle de fechamento e pagamento de faturas</p>
              </div>
              <Button onClick={handleCreateBill} size="lg"><Plus className="mr-2 h-4 w-4" /> Nova Fatura</Button>
            </div>

            {/* Credit Cards with Bills */}
            {cards.filter(c => c.type === 'credit').length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16">
                <CreditCard className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-lg font-medium">Nenhum cartão de crédito</p>
                <p className="text-sm text-muted-foreground mb-4">Cadastre um cartão de crédito na aba Cartões</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-6">
                {cards.filter(c => c.type === 'credit').map(card => {
                  const brandColor = cardBrandColors[card.brand] || card.color;
                  const currentMonth = getCurrentBillMonth();
                  const nextMonth = getNextBillMonth();
                  const currentBill = getBillForCardMonth(card.id, currentMonth);
                  const nextBill = getBillForCardMonth(card.id, nextMonth);
                  const currentTransactions = getCardTransactionsForMonth(card.id, currentMonth);
                  const currentTotal = currentTransactions.reduce((a, e) => a + e.amount, 0);

                  return (
                    <Card key={card.id} className="overflow-hidden">
                      {/* Card Header */}
                      <div className="p-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${brandColor}20, ${brandColor}05)` }}>
                        <div className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: brandColor + '30' }}>
                          💳
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{card.name}</h3>
                          <p className="text-sm text-muted-foreground">**** {card.lastDigits} • {card.brand}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Limite disponível</p>
                          <p className="text-lg font-bold font-mono-num text-money">R$ {((card.limit || 0) - (card.used || 0)).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>

                      <CardContent className="p-5">
                        {/* Current Month Bill */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">Fatura Atual</span>
                              <Badge variant="secondary" className="text-xs">{currentMonth}</Badge>
                              {currentBill && (
                                <Badge variant={currentBill.status === 'paid' ? 'default' : currentBill.status === 'closed' ? 'secondary' : 'outline'} className={cn('text-xs', currentBill.status === 'paid' && 'bg-money/10 text-money')}>
                                  {currentBill.status === 'paid' ? '✅ Paga' : currentBill.status === 'closed' ? '🔒 Fechada' : currentBill.status === 'partial' ? '⏳ Parcial' : '📋 Aberta'}
                                </Badge>
                              )}
                            </div>
                            {card.closingDay && (
                              <span className="text-xs text-muted-foreground">
                                Fecha dia {card.closingDay} • Vence dia {card.dueDay || 10}
                              </span>
                            )}
                          </div>

                          {/* Bill Amount */}
                          <div className="rounded-xl border p-4 mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-muted-foreground">Valor da fatura</span>
                              <span className="text-2xl font-bold font-mono-num">R$ {(currentBill?.amount || currentTotal).toLocaleString('pt-BR')}</span>
                            </div>
                            {currentBill && currentBill.paidAmount > 0 && (
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-muted-foreground">Pago</span>
                                <span className="text-lg font-bold font-mono-num text-money">R$ {currentBill.paidAmount.toLocaleString('pt-BR')}</span>
                              </div>
                            )}
                            {currentBill && currentBill.status !== 'paid' && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Saldo da fatura</span>
                                <span className="text-xl font-bold font-mono-num text-critical">R$ {((currentBill?.amount || currentTotal) - (currentBill?.paidAmount || 0)).toLocaleString('pt-BR')}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {!currentBill || currentBill.status === 'open' ? (
                              <Button onClick={() => handleCloseBill(card.id, currentMonth)} className="flex-1" variant="outline">
                                <Lock className="mr-2 h-4 w-4" /> Fechar Fatura
                              </Button>
                            ) : currentBill.status !== 'paid' ? (
                              <Button onClick={() => handlePayBill(currentBill.id, (currentBill.amount - currentBill.paidAmount))} className="flex-1 bg-money hover:bg-money/90">
                                <Check className="mr-2 h-4 w-4" /> Pagar Fatura
                              </Button>
                            ) : (
                              <div className="flex-1 text-center py-2 text-sm text-money font-medium">✅ Fatura quitada</div>
                            )}
                          </div>
                        </div>

                        {/* Transactions in Current Bill */}
                        {currentTransactions.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Compras nesta fatura ({currentTransactions.length})</h4>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {currentTransactions.sort((a, b) => b.date.localeCompare(a.date)).map(t => (
                                <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-sm">
                                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: categoryColors[t.category] || '#64748b' }} />
                                  <span className="flex-1 truncate">{t.category}{t.description ? ` - ${t.description}` : ''}</span>
                                  <span className="text-xs text-muted-foreground">{new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                                  <span className="font-mono-num font-medium text-critical">R$ {t.amount.toLocaleString('pt-BR')}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Previous Bills */}
                        {bills.filter(b => b.cardId === card.id && b.month < currentMonth).length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Faturas Anteriores</h4>
                            <div className="space-y-2">
                              {bills.filter(b => b.cardId === card.id && b.month < currentMonth).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6).map(bill => (
                                <div key={bill.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                                  <span className="text-xs text-muted-foreground w-16">{bill.month}</span>
                                  <span className="flex-1 text-sm font-mono-num">R$ {bill.amount.toLocaleString('pt-BR')}</span>
                                  <Badge variant={bill.status === 'paid' ? 'default' : 'destructive'} className={cn('text-xs', bill.status === 'paid' && 'bg-money/10 text-money')}>
                                    {bill.status === 'paid' ? 'Paga' : bill.status === 'closed' ? 'Fechada' : bill.status === 'partial' ? 'Parcial' : 'Aberta'}
                                  </Badge>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {bill.status !== 'paid' && (
                                        <DropdownMenuItem onClick={() => handlePayBill(bill.id, bill.amount - bill.paidAmount)}>✅ Pagar</DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => handleDeleteBill(bill.id)} className="text-destructive">🗑️ Excluir</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div key="transactions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold font-display">Lançamentos ({filteredEntries.length})</h2>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..." className="pl-9 h-10 w-48" />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[130px] h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">💰 Entradas</SelectItem>
                    <SelectItem value="expense_fixed">📌 Fixas</SelectItem>
                    <SelectItem value="expense_variable">🔄 Variáveis</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px] h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status</SelectItem>
                    <SelectItem value="paid">✅ Pago</SelectItem>
                    <SelectItem value="pending">⏳ Pendente</SelectItem>
                    <SelectItem value="overdue">⚠️ Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Monthly Summary Bar */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Proporção</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-money" /> Entradas {incomePercent}%</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-critical" /> Saídas {100 - incomePercent}%</span>
                  </div>
                </div>
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div className="h-full bg-money" initial={{ width: 0 }} animate={{ width: `${incomePercent}%` }} />
                  <motion.div className="h-full bg-critical" initial={{ width: 0 }} animate={{ width: `${100 - incomePercent}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-sm font-mono-num">
                  <span className="text-money font-bold">+R$ {totalIncome.toLocaleString('pt-BR')}</span>
                  <span className="text-critical font-bold">-R$ {totalExpenses.toLocaleString('pt-BR')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Category Filter Pills */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button onClick={() => setCategoryFilter(null)} className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all', categoryFilter === null ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                Todos
              </button>
              {expenseByCategory.map(cat => (
                <button key={cat.label} onClick={() => setCategoryFilter(categoryFilter === cat.label ? null : cat.label)} className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all', categoryFilter === cat.label ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Transaction List */}
            {filteredEntries.length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16">
                <Receipt className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-lg font-medium">Nenhum lançamento</p>
                <p className="text-sm text-muted-foreground">Adicione lançamentos usando o formulário acima</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {filteredEntries.sort((a, b) => b.date.localeCompare(a.date)).map(entry => {
                  const statusInfo = statusConfig[entry.status || 'pending'];
                  return (
                    <motion.div key={entry.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <Card className="hover:shadow-md transition-all">
                        <CardContent className="p-4 flex items-center gap-4">
                          <button onClick={() => handleTogglePaid(entry)} className="shrink-0">
                            {entry.status === 'paid' ? <CheckCircle2 className="h-6 w-6 text-money" /> : <CircleDot className="h-6 w-6 text-yellow-500" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: categoryColors[entry.category] || '#64748b' }} />
                              <p className="font-medium truncate">{entry.category}</p>
                              {entry.payee && <span className="text-xs text-muted-foreground">• {entry.payee}</span>}
                            </div>
                            {entry.description && <p className="text-sm text-muted-foreground truncate mt-0.5">{entry.description}</p>}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                              {entry.recurring && entry.recurring !== 'none' && <Badge variant="secondary" className="text-xs px-1 py-0"><Repeat className="h-2 w-2 mr-0.5" />{recurringLabels[entry.recurring]}</Badge>}
                              {entry.dueDate && <span className="text-xs text-muted-foreground">Vence {new Date(entry.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={cn('text-xl font-bold font-mono-num', entry.type === 'income' ? 'text-money' : 'text-critical')}>
                              {entry.type === 'income' ? '+' : '-'} R$ {entry.amount.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleTogglePaid(entry)}>
                                {entry.status === 'paid' ? '⏳ Marcar Pendente' : '✅ Marcar Pago'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteEntry(entry.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'categories' && (
          <motion.div key="categories" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold font-display">Gestão de Cadastros</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Categories by Type */}
              {(['income', 'expense_fixed', 'expense_variable'] as const).map(type => {
                const typeLabels = { income: '💰 Receitas', expense_fixed: '📌 Despesas Fixas', expense_variable: '🔄 Despesas Variáveis' };
                return (
                  <Card key={type}>
                    <CardHeader><CardTitle className="text-base">{typeLabels[type]}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {categories[type].map(cat => (
                          <div key={cat} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: categoryColors[cat] || '#64748b' }} />
                            <span className="text-sm font-medium flex-1">{cat}</span>
                            <Badge variant="secondary" className="text-xs">
                              {entries.filter(e => e.category === cat).reduce((a, e) => a + e.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Payees */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">👤 Credores/Fornecedores</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setIsPayeeDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
                </CardHeader>
                <CardContent>
                  {payees.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum credor cadastrado</p>
                  ) : (
                    <div className="space-y-2">
                      {payees.map(payee => (
                        <div key={payee.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                          <span className="text-xl">{payee.icon || '👤'}</span>
                          <div className="flex-1">
                            <span className="text-sm font-medium">{payee.name}</span>
                            <p className="text-xs text-muted-foreground">{payee.type === 'person' ? 'Pessoa' : payee.type === 'company' ? 'Empresa' : 'Órgão Público'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Account Dialog ─────────────────────────────────────────────────── */}
      <div className={cn('fixed inset-0 z-50 flex items-center justify-center', !isAccountDialogOpen && 'hidden')}>
        {isAccountDialogOpen && <div className="fixed inset-0 bg-black/60" onClick={() => setIsAccountDialogOpen(false)} />}
        <div className="relative z-50 w-full max-w-md rounded-xl border bg-popover p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-1">Nova Conta</h2>
          <p className="text-sm text-muted-foreground mb-4">Cadastre uma conta bancária ou carteira</p>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Ex: Nubank, Itaú, Carteira" />
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as Account['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(accountTypeConfig).map(([key, cfg]) => <SelectItem key={key} value={key}>{cfg.icon} {cfg.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Banco</Label>
              <Input value={accountBank} onChange={(e) => setAccountBank(e.target.value)} placeholder="Ex: Nubank, Bradesco" />
            </div>
            <div className="grid gap-2">
              <Label>Saldo Atual (R$)</Label>
              <Input type="number" step="0.01" value={accountBalance} onChange={(e) => setAccountBalance(e.target.value)} placeholder="0,00" className="font-mono-num text-lg" />
            </div>
            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {['#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#ef4444', '#64748b'].map(color => (
                  <button key={color} type="button" onClick={() => setAccountColor(color)} className={cn('w-8 h-8 rounded-full border-2 transition-all', accountColor === color ? 'border-white scale-110' : 'border-border')} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateAccount} disabled={!accountName}>Criar</Button>
          </div>
        </div>
      </div>

      {/* ─── Card Dialog ────────────────────────────────────────────────────── */}
      <div className={cn('fixed inset-0 z-50 flex items-center justify-center', !isCardDialogOpen && 'hidden')}>
        {isCardDialogOpen && <div className="fixed inset-0 bg-black/60" onClick={() => setIsCardDialogOpen(false)} />}
        <div className="relative z-50 w-full max-w-md rounded-xl border bg-popover p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-1">Novo Cartão</h2>
          <p className="text-sm text-muted-foreground mb-4">Cadastre um cartão de crédito ou débito</p>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex: Nubank Ultravioleta" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={cardType} onValueChange={(v) => setCardType(v as Card['type'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="multiple">Múltiplo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Bandeira</Label>
                <Select value={cardBrand} onValueChange={setCardBrand}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(cardBrandColors).map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Últimos 4 dígitos</Label>
              <Input value={cardLastDigits} onChange={(e) => setCardLastDigits(e.target.value)} placeholder="1234" maxLength={4} />
            </div>
            {cardType === 'credit' && (
              <div className="grid gap-2">
                <Label>Limite (R$)</Label>
                <Input type="number" step="0.01" value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} placeholder="0,00" className="font-mono-num" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Dia Fechamento</Label>
                <Input type="number" value={cardClosingDay} onChange={(e) => setCardClosingDay(e.target.value)} placeholder="1-31" min="1" max="31" />
              </div>
              <div className="grid gap-2">
                <Label>Dia Vencimento</Label>
                <Input type="number" value={cardDueDay} onChange={(e) => setCardDueDay(e.target.value)} placeholder="1-31" min="1" max="31" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsCardDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCard} disabled={!cardName || !cardLastDigits}>Criar</Button>
          </div>
        </div>
      </div>

      {/* ─── Payee Dialog ───────────────────────────────────────────────────── */}
      <div className={cn('fixed inset-0 z-50 flex items-center justify-center', !isPayeeDialogOpen && 'hidden')}>
        {isPayeeDialogOpen && <div className="fixed inset-0 bg-black/60" onClick={() => setIsPayeeDialogOpen(false)} />}
        <div className="relative z-50 w-full max-w-md rounded-xl border bg-popover p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-1">Novo Credor/Fornecedor</h2>
          <p className="text-sm text-muted-foreground mb-4">Cadastre quem recebe ou paga</p>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Ex: Manoel, Facebook Ads" />
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={payeeType} onValueChange={(v) => setPayeeType(v as Payee['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">👤 Pessoa</SelectItem>
                  <SelectItem value="company">🏢 Empresa</SelectItem>
                  <SelectItem value="government">🏛️ Órgão Público</SelectItem>
                  <SelectItem value="other">📦 Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Documento (CPF/CNPJ)</Label>
              <Input value={payeeDocument} onChange={(e) => setPayeeDocument(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsPayeeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePayee} disabled={!payeeName}>Criar</Button>
          </div>
        </div>
      </div>

      {/* ─── Goal Dialog ────────────────────────────────────────────────────── */}
      <div className={cn('fixed inset-0 z-50 flex items-center justify-center', !isGoalDialogOpen && 'hidden')}>
        {isGoalDialogOpen && <div className="fixed inset-0 bg-black/60" onClick={() => setIsGoalDialogOpen(false)} />}
        <div className="relative z-50 w-full max-w-md rounded-xl border bg-popover p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-1">Nova Meta Financeira</h2>
          <p className="text-sm text-muted-foreground mb-4">Defina uma meta de economia ou investimento</p>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Ícone</Label>
              <div className="flex gap-2 flex-wrap">
                {['🎯', '🏠', '🚗', '✈️', '📚', '💎', '🛡️', '🎓', '🏖️', '💼', '💊', '🔧'].map(icon => (
                  <button key={icon} onClick={() => setGoalIcon(icon)} className={cn('h-10 w-10 rounded-lg border-2 text-xl flex items-center justify-center transition-all', goalIcon === icon ? 'border-primary bg-primary/10 scale-110' : 'border-border hover:border-muted-foreground/50')}>{icon}</button>
                ))}
              </div>
            </div>
            <div className="grid gap-2"><Label>Nome</Label><Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Ex: Reserva de emergência" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Valor Alvo (R$)</Label><Input type="number" step="0.01" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="0,00" className="font-mono-num" /></div>
              <div className="grid gap-2"><Label>Valor Atual (R$)</Label><Input type="number" step="0.01" value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} placeholder="0,00" className="font-mono-num" /></div>
            </div>
            <div className="grid gap-2"><Label>Prazo</Label><Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsGoalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateGoal} disabled={!goalName || !goalTarget}>Criar Meta</Button>
          </div>
        </div>
      </div>

      {/* ─── Budget Dialog ──────────────────────────────────────────────────── */}
      <div className={cn('fixed inset-0 z-50 flex items-center justify-center', !isBudgetDialogOpen && 'hidden')}>
        {isBudgetDialogOpen && <div className="fixed inset-0 bg-black/60" onClick={() => setIsBudgetDialogOpen(false)} />}
        <div className="relative z-50 w-full max-w-md rounded-xl border bg-popover p-6 shadow-2xl">
          <h2 className="text-xl font-bold mb-1">Novo Orçamento</h2>
          <p className="text-sm text-muted-foreground mb-4">Defina um limite de gasto por categoria</p>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={budgetCategory} onValueChange={setBudgetCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {[...categories.expense_fixed, ...categories.expense_variable].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Limite Mensal (R$)</Label>
              <Input type="number" step="0.01" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} placeholder="0,00" className="font-mono-num" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsBudgetDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateBudget} disabled={!budgetCategory || !budgetLimit}>Criar</Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
