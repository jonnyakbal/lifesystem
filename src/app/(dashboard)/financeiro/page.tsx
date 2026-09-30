'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  type FinancialEntry,
  type Account,
  type Card as FinanceCard,
  type Budget,
  type Bill,
  type FinancialGoal,
  type Payee,
  accountTypeConfig,
  cardBrandColors,
  categories as defaultCategories,
  categoryColors as defaultCategoryColors,
} from '@/lib/finance-model';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Building2,
  Landmark,
  CircleDollarSign,
  MoreHorizontal,
  Receipt,
  Lock,
} from 'lucide-react';
import type { FinancialCategory } from '@/lib/financial-categories';
import { FinancialCategoryDialog } from '@/components/financial/category-dialog';
import { EntryDialog } from '@/components/financial/entry-dialog';
import { WorkspaceContinuations } from '@/components/workspace/workspace-continuations';
import {
  FinanceOverview,
  FinanceSummary,
} from '@/components/financial/finance-overview';
import { FinancialTransactions } from '@/components/financial/transactions';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  financialCreatePayload,
  financialDisplayStatus,
  billCycleDates,
  formatMoney,
} from '@/lib/financial-insights';
import { cn, todayStr } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { apiFetch, showError } from '@/lib/api';
import {
  effectiveFinancialDate,
  financialEntriesForRange,
  financialPeriodRange,
  shiftFinancialPeriod,
  summarizeFinancialEntries,
} from '@/lib/financial-period';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };
const stagger = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<FinanceCard[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientReady, setClientReady] = useState(false);

  // View state
  const [activeTab, setActiveTab] = useState<
    'overview' | 'accounts' | 'cards' | 'bills' | 'transactions' | 'categories'
  >('overview');
  const [dateRange, setDateRange] = useState<
    'month' | 'quarter' | 'year' | 'all'
  >('month');
  const [selectedMonth, setSelectedMonth] = useState(() =>
    todayStr().slice(0, 7)
  );
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const [entryDialog, setEntryDialog] = useState<FinancialEntry | 'new' | null>(
    null
  );
  const [loadError, setLoadError] = useState('');
  const [balanceAccount, setBalanceAccount] = useState<Account | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [isBillDialogOpen, setIsBillDialogOpen] = useState(false);
  const [billCardId, setBillCardId] = useState('');
  const [billSaving, setBillSaving] = useState(false);
  const today = todayStr();

  function openTransactions(
    status = 'all',
    type = 'all',
    category: string | null = null
  ) {
    setFilterStatus(status);
    setFilterType(type);
    setCategoryFilter(category);
    setSearchQuery('');
    setActiveTab('transactions');
  }

  // Dialogs
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [isPayeeDialogOpen, setIsPayeeDialogOpen] = useState(false);

  // Account form
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<Account['type']>('checking');
  const [accountBank, setAccountBank] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [accountColor, setAccountColor] = useState('#3b82f6');
  const accountIcon = '🏦';

  // Card form
  const [cardName, setCardName] = useState('');
  const [cardType, setCardType] = useState<FinanceCard['type']>('credit');
  const [cardLastDigits, setCardLastDigits] = useState('');
  const [cardBrand, setCardBrand] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('');
  const [cardDueDay, setCardDueDay] = useState('');
  const cardColor = '#64748b';

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
  const [budgetType, setBudgetType] = useState<
    'expense_fixed' | 'expense_variable'
  >('expense_variable');

  useEffect(() => {
    queueMicrotask(() => { setClientReady(true); void loadAll(); });
  }, []);

  const [categoryCatalog, setCategoryCatalog] = useState<FinancialCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null | undefined>(undefined);
  const categories = useMemo(() => categoryCatalog.length ? Object.fromEntries(Object.keys(defaultCategories).map(type => [type, categoryCatalog.filter(item => item.type === type && !item.archived).map(item => item.name)])) as typeof defaultCategories : defaultCategories, [categoryCatalog]);
  const categoryColors = useMemo(() => ({ ...defaultCategoryColors, ...Object.fromEntries(categoryCatalog.map(item => [item.name, item.color])) }), [categoryCatalog]);

  async function loadAll() {
    setLoadError('');
    try {
      const [
        entriesData,
        accountsData,
        cardsData,
        budgetsData,
        goalsData,
        payeesData,
        billsData,
        categoriesData,
      ] = await Promise.all([
        apiFetch<FinancialEntry[]>('/api/financial'),
        apiFetch<Account[]>('/api/accounts'),
        apiFetch<FinanceCard[]>('/api/cards'),
        apiFetch<Budget[]>('/api/budgets'),
        apiFetch<FinancialGoal[]>('/api/financial-goals'),
        apiFetch<Payee[]>('/api/payees'),
        apiFetch<Bill[]>('/api/bills'),
        apiFetch<FinancialCategory[]>('/api/financial-categories'),
      ]);
      setEntries(
        entriesData.map((entry) => {
          if (typeof entry.recurring === 'string') {
            return {
              ...entry,
              recurring: entry.recurring !== 'none',
              recurringFrequency: entry.recurring,
            };
          }
          return entry;
        })
      );
      setAccounts(accountsData);
      setCards(cardsData);
      setBudgets(budgetsData);
      setGoals(goalsData);
      setPayees(payeesData);
      setBills(billsData);
      setCategoryCatalog(categoriesData);
    } catch (err) {
      setLoadError(showError(err));
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Date Range Filter ────────────────────────────────────────────────────

  const range = useMemo(
    () => financialPeriodRange(selectedMonth, dateRange),
    [selectedMonth, dateRange]
  );
  const periodEntries = useMemo(
    () => financialEntriesForRange(entries, range),
    [entries, range]
  );

  const filteredEntries = useMemo(() => {
    return periodEntries.filter((e) => {
      if (
        filterType === 'expenses'
          ? e.type === 'income'
          : filterType !== 'all' && e.type !== filterType
      )
        return false;
      if (
        filterStatus === 'open'
          ? e.status === 'paid'
          : filterStatus !== 'all' &&
            financialDisplayStatus(e, today) !== filterStatus
      )
        return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          e.category.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.payee?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    periodEntries,
    filterType,
    filterStatus,
    searchQuery,
    categoryFilter,
    today,
  ]);

  // ─── Calculations ─────────────────────────────────────────────────────────

  const periodSummary = useMemo(
    () => summarizeFinancialEntries(periodEntries),
    [periodEntries]
  );
  const totalBalance = accounts
    .filter((a) => a.isActive)
    .reduce((sum, account) => sum + account.balance, 0);
  const currentMonth = today.slice(0, 7);
  const currentBudgets = useMemo(
    () =>
      budgets
        .filter((b) => b.month === selectedMonth)
        .map((budget) => ({
          ...budget,
          spent: entries
            .filter(
              (entry) =>
                entry.type === budget.type &&
                entry.category === budget.category &&
                effectiveFinancialDate(entry).startsWith(budget.month) &&
                entry.status === 'paid'
            )
            .reduce((total, entry) => total + entry.amount, 0),
          planned: entries
            .filter(
              (entry) =>
                entry.type === budget.type &&
                entry.category === budget.category &&
                effectiveFinancialDate(entry).startsWith(budget.month) &&
                entry.status !== 'paid'
            )
            .reduce((total, entry) => total + entry.amount, 0),
        })),
    [budgets, entries, selectedMonth]
  );

  async function handleCreateAccount() {
    if (!accountName) return;
    try {
      await apiFetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: accountName,
          type: accountType,
          bank: accountBank,
          balance: parseFloat(accountBalance) || 0,
          color: accountColor,
          icon: accountIcon,
        }),
      });
      setAccountName('');
      setAccountBank('');
      setAccountBalance('');
      setIsAccountDialogOpen(false);
      loadAll();
      toast.success('Conta criada!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleCreateCard() {
    if (!cardName || !cardLastDigits) return;
    try {
      await apiFetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cardName,
          type: cardType,
          lastDigits: cardLastDigits,
          brand: cardBrand,
          limit: parseFloat(cardLimit) || undefined,
          closingDay: parseInt(cardClosingDay) || undefined,
          dueDay: parseInt(cardDueDay) || undefined,
          color: cardColor,
        }),
      });
      setCardName('');
      setCardLastDigits('');
      setCardBrand('');
      setCardLimit('');
      setCardClosingDay('');
      setCardDueDay('');
      setIsCardDialogOpen(false);
      loadAll();
      toast.success('Cartão criado!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleCreatePayee() {
    if (!payeeName) return;
    try {
      await apiFetch('/api/payees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payeeName,
          type: payeeType,
          document: payeeDocument,
        }),
      });
      setPayeeName('');
      setPayeeDocument('');
      setIsPayeeDialogOpen(false);
      loadAll();
      toast.success('Credor criado!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleCreateGoal() {
    if (!goalName || !goalTarget) return;
    try {
      await apiFetch('/api/financial-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: goalName,
          targetAmount: parseFloat(goalTarget),
          currentAmount: parseFloat(goalCurrent) || 0,
          deadline: goalDeadline || undefined,
          icon: goalIcon,
        }),
      });
      setGoalName('');
      setGoalTarget('');
      setGoalCurrent('');
      setGoalDeadline('');
      setIsGoalDialogOpen(false);
      loadAll();
      toast.success('Meta criada!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleCreateBudget() {
    if (!budgetCategory || !budgetLimit) return;
    try {
      await apiFetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: budgetCategory,
          type: budgetType,
          monthlyLimit: parseFloat(budgetLimit),
          spent: 0,
          month: selectedMonth,
        }),
      });
      setBudgetCategory('');
      setBudgetLimit('');
      setIsBudgetDialogOpen(false);
      loadAll();
      toast.success('Orçamento criado!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleDeleteEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    try {
      await apiFetch(`/api/financial/${id}`, { method: 'DELETE' });
      loadAll();
      toast('Lançamento excluído', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            if (entry) {
              try {
                await apiFetch('/api/financial', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(financialCreatePayload(entry)),
                });
                await loadAll();
                toast.success('Restaurado!');
              } catch (err) {
                toast.error(showError(err));
              }
            }
          },
        },
      });
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleTogglePaid(entry: FinancialEntry) {
    if (entry.status !== 'paid') {
      setEntryDialog({ ...entry, status: 'paid', paidDate: today });
      return;
    }
    const newStatus = 'pending';
    try {
      await apiFetch(`/api/financial/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, paidDate: null }),
      });
      loadAll();
      toast.success('Devolvido a previsto.');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleUpdateAccountBalance() {
    if (
      !balanceAccount ||
      !newBalance.trim() ||
      !Number.isFinite(Number(newBalance)) ||
      balanceSaving
    )
      return;
    setBalanceSaving(true);
    try {
      await apiFetch('/api/accounts/' + balanceAccount.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: Number(newBalance) }),
      });
      setBalanceAccount(null);
      await loadAll();
      toast.success('Saldo informado atualizado.');
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setBalanceSaving(false);
    }
  }

  // ─── Bill Closing Functions ───────────────────────────────────────────────

  function getCardTransactionsForMonth(cardId: string, month: string) {
    return entries.filter(
      (e) =>
        e.cardId === cardId && e.date.startsWith(month) && e.type !== 'income'
    );
  }

  function getBillForCardMonth(cardId: string, month: string) {
    return bills.find((b) => b.cardId === cardId && b.month === month);
  }

  async function handleCloseBill(cardId: string, month: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const transactions = getCardTransactionsForMonth(cardId, month);
    const total = transactions.reduce((a, e) => a + e.amount, 0);
    const { closeDate, dueDate } = billCycleDates(
      month,
      card.closingDay || 1,
      card.dueDay || 10
    );

    const existingBill = getBillForCardMonth(cardId, month);
    if (
      existingBill &&
      (existingBill.paidAmount > 0 || existingBill.status === 'paid')
    ) {
      toast.error(
        'Uma fatura com pagamento registrado não pode ser fechada novamente.'
      );
      return;
    }

    try {
      if (existingBill) {
        await apiFetch(`/api/bills/${existingBill.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: total,
            status: 'closed',
            closeDate,
            dueDate,
            items: transactions.map((t) => ({
              id: t.id,
              description:
                t.category + (t.description ? ` - ${t.description}` : ''),
              amount: t.amount,
              date: t.date,
              category: t.category,
            })),
          }),
        });
      } else {
        await apiFetch('/api/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId,
            month,
            amount: total,
            paidAmount: 0,
            status: 'closed',
            closeDate,
            dueDate,
            items: transactions.map((t) => ({
              id: t.id,
              description:
                t.category + (t.description ? ` - ${t.description}` : ''),
              amount: t.amount,
              date: t.date,
              category: t.category,
            })),
          }),
        });
      }
      loadAll();
      toast.success(
        `Fatura de ${card.name} fechada! R$ ${total.toLocaleString('pt-BR')}`
      );
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handlePayBill(billId: string, amount: number) {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;
    const newPaidAmount = Math.min(bill.paidAmount + amount, bill.amount);
    const newStatus = newPaidAmount >= bill.amount ? 'paid' : 'partial';
    try {
      await apiFetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount: newPaidAmount, status: newStatus }),
      });
      loadAll();
      toast.success(
        newStatus === 'paid'
          ? 'Fatura quitada!'
          : `Pago R$ ${amount.toLocaleString('pt-BR')}`
      );
    } catch (err) {
      toast.error(showError(err));
    }
  }

  async function handleCreateBill() {
    const card = cards.find(
      (c) =>
        c.id === billCardId &&
        c.isActive &&
        (c.type === 'credit' || c.type === 'multiple')
    );
    if (!card || billSaving) return;
    const month = selectedMonth;
    if (getBillForCardMonth(card.id, month)) {
      toast.info('Este cartão já tem uma fatura neste mês.');
      return;
    }
    const { closeDate, dueDate } = billCycleDates(
      month,
      card.closingDay || 1,
      card.dueDay || 10
    );
    setBillSaving(true);
    try {
      await apiFetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card.id,
          month,
          amount: 0,
          paidAmount: 0,
          status: 'open',
          closeDate,
          dueDate,
          items: [],
        }),
      });
      loadAll();
      toast.success('Fatura criada!');
      setIsBillDialogOpen(false);
    } catch (err) {
      toast.error(showError(err));
    } finally {
      setBillSaving(false);
    }
  }

  async function handleDeleteBill(id: string) {
    try {
      await apiFetch(`/api/bills/${id}`, { method: 'DELETE' });
      loadAll();
      toast.success('Fatura excluída!');
    } catch (err) {
      toast.error(showError(err));
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  // The initial month follows the browser's clock/time zone. A stable shell
  // avoids mismatched server text when the server is in a different month.
  if (!clientReady) return <div className="mx-auto max-w-[1600px] space-y-6 p-4 pb-12 sm:p-6 lg:p-8" role="status" aria-label="Carregando Financeiro"><h1 className="sr-only">Financeiro</h1><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-60 rounded-2xl" /></div>;

  return (
    <motion.div
      className="mx-auto max-w-[1600px] p-4 pb-12 sm:p-6 lg:p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <motion.div className="mb-6" variants={fade}>
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.25em] text-primary">
              FINANCEIRO / LIFESYSTEM
            </p>
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">
              Seu dinheiro, em perspectiva.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Clareza sobre o que passou. Espaço para o que vem.
            </p>
            <WorkspaceContinuations />
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/30 p-2">
            <Select
              value={dateRange}
              onValueChange={(v) => setDateRange(v as typeof dateRange)}
            >
              <SelectTrigger
                aria-label="Período financeiro"
                className="w-[130px] h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex h-10 items-center rounded-xl border border-border/70 bg-card/70">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={dateRange === 'all'}
                aria-label={
                  dateRange === 'month' ? 'Mês anterior' : 'Período anterior'
                }
                onClick={() =>
                  setSelectedMonth((month) =>
                    shiftFinancialPeriod(month, dateRange, -1)
                  )
                }
                className="h-9 w-9 rounded-r-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span
                data-testid="financial-period-label"
                className="min-w-[158px] px-2 text-center text-sm font-semibold first-letter:uppercase tabular-nums"
              >
                {range.label}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={dateRange === 'all'}
                aria-label={
                  dateRange === 'month' ? 'Próximo mês' : 'Próximo período'
                }
                onClick={() =>
                  setSelectedMonth((month) =>
                    shiftFinancialPeriod(month, dateRange, 1)
                  )
                }
                className="h-9 w-9 rounded-l-none"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {selectedMonth !== currentMonth && dateRange !== 'all' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(currentMonth)}
                className="h-10"
              >
                Mês atual
              </Button>
            )}
            <Button
              id="financial-new-entry"
              onClick={() => setEntryDialog('new')}
              className="h-11 w-full rounded-xl sm:ml-auto sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo lançamento
            </Button>
          </div>
        </div>
      </motion.div>

      {loadError && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
        >
          <p className="font-medium">
            Não foi possível atualizar o financeiro.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => {
              setIsLoading(true);
              loadAll();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {isLoading ? (
        <div
          className="mb-6 h-60 animate-pulse rounded-3xl bg-muted/30"
          aria-label="Carregando financeiro"
        />
      ) : (
        !loadError && (
          <FinanceSummary
            summary={periodSummary}
            totalBalance={totalBalance}
            onTransactions={openTransactions}
            onAccounts={() => setActiveTab('accounts')}
          />
        )
      )}

      {/* ─── Tab Navigation ─────────────────────────────────────────────────── */}
      <motion.div
        className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-1"
        aria-label="Áreas do financeiro"
        variants={fade}
      >
        {[
          { id: 'overview' as const, label: 'Visão Geral', icon: BarChart3 },
          {
            id: 'transactions' as const,
            label: 'Lançamentos',
            icon: CircleDollarSign,
          },
          { id: 'accounts' as const, label: 'Contas', icon: Landmark },
          { id: 'cards' as const, label: 'Cartões', icon: CreditCard },
          { id: 'bills' as const, label: 'Faturas', icon: Receipt },
          { id: 'categories' as const, label: 'Cadastros', icon: Building2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={cn(
              'flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium rounded-t-lg transition-colors border-b-2',
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
        {activeTab === 'overview' && !isLoading && !loadError && (
          <FinanceOverview
            entries={entries}
            periodEntries={periodEntries}
            range={range}
            selectedMonth={selectedMonth}
            today={today}
            goals={goals}
            budgets={currentBudgets}
            onCategory={(category, status) =>
              openTransactions(status, 'expenses', category)
            }
            onMonth={(month) => {
              setSelectedMonth(month);
              setDateRange('month');
            }}
            onTransactions={openTransactions}
            onPay={handleTogglePaid}
            onNewEntry={() => setEntryDialog('new')}
            onNewGoal={() => setIsGoalDialogOpen(true)}
            onNewBudget={() => setIsBudgetDialogOpen(true)}
          />
        )}

        {activeTab === 'accounts' && (
          <motion.div
            key="accounts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold font-display">Contas</h2>
              <Button onClick={() => setIsAccountDialogOpen(true)} size="lg">
                <Plus className="mr-2 h-4 w-4" /> Nova Conta
              </Button>
            </div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-32 mb-2" />
                      <Skeleton className="h-10 w-48" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Landmark className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-lg font-medium">
                    Nenhuma conta cadastrada
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Cadastre suas contas para controle de caixa
                  </p>
                  <Button onClick={() => setIsAccountDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Criar Primeira Conta
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => {
                  const typeInfo = accountTypeConfig[account.type] || {
                    label: account.type,
                    icon: '🏦',
                    color: '#64748b',
                  };
                  return (
                    <Card
                      key={account.id}
                      className="overflow-hidden hover:shadow-lg transition-all"
                    >
                      <div
                        className="h-3"
                        style={{ backgroundColor: account.color }}
                      />
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-3xl">
                            {account.icon || typeInfo.icon}
                          </span>
                          <div>
                            <h3 className="font-bold text-lg">
                              {account.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {typeInfo.label}{' '}
                              {account.bank ? `• ${account.bank}` : ''}
                            </p>
                          </div>
                        </div>
                        <div
                          className="text-3xl font-bold font-mono-num mb-4"
                          style={{
                            color:
                              account.balance >= 0
                                ? 'hsl(162 80% 58%)'
                                : 'hsl(350 88% 64%)',
                          }}
                        >
                          {formatMoney(account.balance)}
                        </div>
                        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                          Saldo informado manualmente. Lançamentos e previsões
                          não alteram este valor.
                        </p>
                        <Button
                          variant="outline"
                          className="w-full rounded-xl"
                          aria-label={`Atualizar saldo de ${account.name}`}
                          onClick={() => {
                            setBalanceAccount(account);
                            setNewBalance(String(account.balance));
                          }}
                        >
                          Atualizar saldo
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'cards' && (
          <motion.div
            key="cards"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold font-display">Cartões</h2>
              <Button onClick={() => setIsCardDialogOpen(true)} size="lg">
                <Plus className="mr-2 h-4 w-4" /> Novo Cartão
              </Button>
            </div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-32 mb-2" />
                      <Skeleton className="h-10 w-48" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : cards.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <CreditCard className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-lg font-medium">
                    Nenhum cartão cadastrado
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Cadastre seus cartões de crédito e débito
                  </p>
                  <Button onClick={() => setIsCardDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Criar Primeiro Cartão
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {cards.map((card) => {
                  const brandColor = cardBrandColors[card.brand] || card.color;
                  const usagePercent = card.limit
                    ? Math.round(((card.used || 0) / card.limit) * 100)
                    : 0;
                  return (
                    <Card
                      key={card.id}
                      className="overflow-hidden hover:shadow-lg transition-all"
                    >
                      <div
                        className="h-40 p-6 flex flex-col justify-between relative"
                        style={{
                          background: `linear-gradient(135deg, ${brandColor}, ${brandColor}cc)`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white/80 text-sm font-medium">
                            {card.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="bg-white/20 text-white border-0"
                          >
                            {card.type === 'credit' || card.type === 'multiple'
                              ? 'Crédito'
                              : 'Débito'}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-white text-2xl font-bold tracking-wider mb-1">
                            **** **** **** {card.lastDigits}
                          </div>
                          <div className="text-white/70 text-sm">
                            {card.brand}
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-5">
                        {(card.type === 'credit' || card.type === 'multiple') &&
                          card.limit && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Limite usado
                                </span>
                                <span className="font-mono-num font-medium">
                                  R$ {(card.used || 0).toLocaleString('pt-BR')}{' '}
                                  / R$ {card.limit.toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <Progress
                                value={Math.min(usagePercent, 100)}
                                className={cn(
                                  'h-3',
                                  usagePercent > 80 && '[&>div]:bg-critical'
                                )}
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{usagePercent}% utilizado</span>
                                <span>
                                  Disponível: R${' '}
                                  {(
                                    card.limit - (card.used || 0)
                                  ).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            </div>
                          )}
                        <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                          {card.closingDay && (
                            <span>Fechamento: dia {card.closingDay}</span>
                          )}
                          {card.dueDay && (
                            <span>Vencimento: dia {card.dueDay}</span>
                          )}
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
          <motion.div
            key="bills"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold font-display">
                  Faturas dos Cartões
                </h2>
                <p className="text-sm text-muted-foreground">
                  Controle separado dos lançamentos. Registrar quitação aqui não
                  movimenta contas nem quita as compras.
                </p>
              </div>
              <Button
                onClick={() => {
                  setBillCardId('');
                  setIsBillDialogOpen(true);
                }}
                size="lg"
              >
                <Plus className="mr-2 h-4 w-4" /> Nova Fatura
              </Button>
            </div>

            {/* Credit Cards with Bills */}
            {cards.filter((c) => c.type === 'credit' || c.type === 'multiple')
              .length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <CreditCard className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-lg font-medium">
                    Nenhum cartão de crédito
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Cadastre um cartão de crédito na aba Cartões
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {cards
                  .filter((c) => c.type === 'credit' || c.type === 'multiple')
                  .map((card) => {
                    const brandColor =
                      cardBrandColors[card.brand] || card.color;
                    const currentMonth = selectedMonth;
                    const currentBill = getBillForCardMonth(
                      card.id,
                      currentMonth
                    );
                    const currentTransactions = getCardTransactionsForMonth(
                      card.id,
                      currentMonth
                    );
                    const currentTotal = currentTransactions.reduce(
                      (a, e) => a + e.amount,
                      0
                    );

                    return (
                      <Card key={card.id} className="overflow-hidden">
                        {/* Card Header */}
                        <div
                          className="p-5 flex items-center gap-4"
                          style={{
                            background: `linear-gradient(135deg, ${brandColor}20, ${brandColor}05)`,
                          }}
                        >
                          <div
                            className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl"
                            style={{ backgroundColor: brandColor + '30' }}
                          >
                            💳
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{card.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              **** {card.lastDigits} • {card.brand}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              Limite disponível
                            </p>
                            <p className="text-lg font-bold font-mono-num text-money">
                              R${' '}
                              {(
                                (card.limit || 0) - (card.used || 0)
                              ).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        <CardContent className="p-5">
                          {/* Current Month Bill */}
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">
                                  Fatura · {selectedMonth}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {currentMonth}
                                </Badge>
                                {currentBill && (
                                  <Badge
                                    variant={
                                      currentBill.status === 'paid'
                                        ? 'default'
                                        : currentBill.status === 'closed'
                                          ? 'secondary'
                                          : 'outline'
                                    }
                                    className={cn(
                                      'text-xs',
                                      currentBill.status === 'paid' &&
                                        'bg-money/10 text-money'
                                    )}
                                  >
                                    {currentBill.status === 'paid'
                                      ? '✅ Paga'
                                      : currentBill.status === 'closed'
                                        ? '🔒 Fechada'
                                        : currentBill.status === 'partial'
                                          ? '⏳ Parcial'
                                          : '📋 Aberta'}
                                  </Badge>
                                )}
                              </div>
                              {card.closingDay && (
                                <span className="text-xs text-muted-foreground">
                                  Fecha dia {card.closingDay} • Vence dia{' '}
                                  {card.dueDay || 10}
                                </span>
                              )}
                            </div>

                            {/* Bill Amount */}
                            <div className="rounded-xl border p-4 mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-muted-foreground">
                                  Valor da fatura
                                </span>
                                <span className="text-2xl font-bold font-mono-num">
                                  R${' '}
                                  {(
                                    currentBill?.amount || currentTotal
                                  ).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              {currentBill && currentBill.paidAmount > 0 && (
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-muted-foreground">
                                    Pago
                                  </span>
                                  <span className="text-lg font-bold font-mono-num text-money">
                                    R${' '}
                                    {currentBill.paidAmount.toLocaleString(
                                      'pt-BR'
                                    )}
                                  </span>
                                </div>
                              )}
                              {currentBill && currentBill.status !== 'paid' && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    Saldo da fatura
                                  </span>
                                  <span className="text-xl font-bold font-mono-num text-critical">
                                    R${' '}
                                    {(
                                      (currentBill?.amount || currentTotal) -
                                      (currentBill?.paidAmount || 0)
                                    ).toLocaleString('pt-BR')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              {!currentBill || currentBill.status === 'open' ? (
                                <Button
                                  onClick={() =>
                                    handleCloseBill(card.id, currentMonth)
                                  }
                                  className="flex-1"
                                  variant="outline"
                                >
                                  <Lock className="mr-2 h-4 w-4" /> Fechar
                                  Fatura
                                </Button>
                              ) : currentBill.status !== 'paid' ? (
                                <Button
                                  onClick={() =>
                                    handlePayBill(
                                      currentBill.id,
                                      currentBill.amount -
                                        currentBill.paidAmount
                                    )
                                  }
                                  className="flex-1 bg-money hover:bg-money/90"
                                >
                                  <Check className="mr-2 h-4 w-4" /> Pagar
                                  Fatura
                                </Button>
                              ) : (
                                <div className="flex-1 text-center py-2 text-sm text-money font-medium">
                                  ✅ Fatura quitada
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Transactions in Current Bill */}
                          {currentTransactions.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">
                                Compras nesta fatura (
                                {currentTransactions.length})
                              </h4>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {currentTransactions
                                  .sort((a, b) => b.date.localeCompare(a.date))
                                  .map((t) => (
                                    <div
                                      key={t.id}
                                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-sm"
                                    >
                                      <span
                                        className="h-2 w-2 rounded-full shrink-0"
                                        style={{
                                          backgroundColor:
                                            categoryColors[t.category] ||
                                            '#64748b',
                                        }}
                                      />
                                      <span className="flex-1 truncate">
                                        {t.category}
                                        {t.description
                                          ? ` - ${t.description}`
                                          : ''}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(
                                          t.date + 'T12:00:00'
                                        ).toLocaleDateString('pt-BR', {
                                          day: '2-digit',
                                          month: 'short',
                                        })}
                                      </span>
                                      <span className="font-mono-num font-medium text-critical">
                                        R$ {t.amount.toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Previous Bills */}
                          {bills.filter(
                            (b) =>
                              b.cardId === card.id && b.month < currentMonth
                          ).length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                                Faturas Anteriores
                              </h4>
                              <div className="space-y-2">
                                {bills
                                  .filter(
                                    (b) =>
                                      b.cardId === card.id &&
                                      b.month < currentMonth
                                  )
                                  .sort((a, b) =>
                                    b.month.localeCompare(a.month)
                                  )
                                  .slice(0, 6)
                                  .map((bill) => (
                                    <div
                                      key={bill.id}
                                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                                    >
                                      <span className="text-xs text-muted-foreground w-16">
                                        {bill.month}
                                      </span>
                                      <span className="flex-1 text-sm font-mono-num">
                                        R$ {bill.amount.toLocaleString('pt-BR')}
                                      </span>
                                      <Badge
                                        variant={
                                          bill.status === 'paid'
                                            ? 'default'
                                            : 'destructive'
                                        }
                                        className={cn(
                                          'text-xs',
                                          bill.status === 'paid' &&
                                            'bg-money/10 text-money'
                                        )}
                                      >
                                        {bill.status === 'paid'
                                          ? 'Paga'
                                          : bill.status === 'closed'
                                            ? 'Fechada'
                                            : bill.status === 'partial'
                                              ? 'Parcial'
                                              : 'Aberta'}
                                      </Badge>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                          >
                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {bill.status !== 'paid' && (
                                            <DropdownMenuItem
                                              onClick={() =>
                                                handlePayBill(
                                                  bill.id,
                                                  bill.amount - bill.paidAmount
                                                )
                                              }
                                            >
                                              ✅ Pagar
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleDeleteBill(bill.id)
                                            }
                                            className="text-destructive"
                                          >
                                            🗑️ Excluir
                                          </DropdownMenuItem>
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

        {activeTab === 'transactions' && !loadError && (
          <FinancialTransactions
            entries={filteredEntries}
            filterType={filterType}
            filterStatus={filterStatus}
            categoryFilter={categoryFilter}
            search={searchQuery}
            today={today}
            onType={setFilterType}
            onStatus={setFilterStatus}
            onSearch={setSearchQuery}
            onClear={() => openTransactions()}
            onEdit={setEntryDialog}
            onPay={handleTogglePaid}
            onDelete={handleDeleteEntry}
            onNew={() => setEntryDialog('new')}
          />
        )}

        {activeTab === 'categories' && (
          <motion.div
            key="categories"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold font-display">
                Gestão de Cadastros
              </h2>
              <Button variant="outline" onClick={() => setEditingCategory(null)}><Plus className="mr-2 h-4 w-4" />Nova categoria</Button>
            </div>
            {categoryCatalog.some(item => item.archived) && <details className="mb-5 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Categorias arquivadas</summary><div className="mt-3 flex flex-wrap gap-2">{categoryCatalog.filter(item => item.archived).map(item => <Button key={item.id} variant="outline" onClick={() => setEditingCategory(item)}>{item.name} · editar ou reativar</Button>)}</div></details>}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Categories by Type */}
              {(['income', 'expense_fixed', 'expense_variable'] as const).map(
                (type) => {
                  const typeLabels = {
                    income: '💰 Receitas',
                    expense_fixed: '📌 Despesas Fixas',
                    expense_variable: '🔄 Despesas Variáveis',
                  };
                  return (
                    <Card key={type}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {typeLabels[type]}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Totais de todos os períodos, separados por situação.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {[
                            ...new Set([
                              ...categories[type],
                              ...entries
                                .filter((entry) => entry.type === type)
                                .map((entry) => entry.category),
                            ]),
                          ].map((cat) => {
                            const totals = summarizeFinancialEntries(
                              entries.filter(
                                (entry) =>
                                  entry.type === type && entry.category === cat
                              )
                            );
                            return (
                              <div
                                key={cat}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                              >
                                <span
                                  className="h-3 w-3 rounded-full"
                                  style={{
                                    backgroundColor:
                                      categoryColors[cat] || '#64748b',
                                  }}
                                />
                                <button className="flex-1 text-left text-sm font-medium text-foreground hover:text-primary min-h-11" aria-label={`Editar categoria ${cat}`} disabled={!categoryCatalog.some(item => item.name === cat && item.historicalTypes.includes(type))} onClick={() => { const category = categoryCatalog.find(item => item.name === cat && item.historicalTypes.includes(type)); if (category) setEditingCategory(category); }}>
                                  {cat}<span className="ml-2 text-xs font-normal text-muted-foreground">Editar</span>
                                </button>
                                <span className="text-right text-xs text-muted-foreground">
                                  Realizado R${' '}
                                  {(type === 'income'
                                    ? totals.realized.income
                                    : totals.realized.expenses
                                  ).toLocaleString('pt-BR')}
                                  <br />
                                  Previsto R${' '}
                                  {(type === 'income'
                                    ? totals.projected.income
                                    : totals.projected.expenses
                                  ).toLocaleString('pt-BR')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
              )}

              {/* Payees */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    👤 Credores/Fornecedores
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPayeeDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Novo
                  </Button>
                </CardHeader>
                <CardContent>
                  {payees.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhum credor cadastrado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {payees.map((payee) => (
                        <div
                          key={payee.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <span className="text-xl">{payee.icon || '👤'}</span>
                          <div className="flex-1">
                            <span className="text-sm font-medium">
                              {payee.name}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {payee.type === 'person'
                                ? 'Pessoa'
                                : payee.type === 'company'
                                  ? 'Empresa'
                                  : 'Órgão Público'}
                            </p>
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
        {editingCategory !== undefined && <FinancialCategoryDialog category={editingCategory || undefined} onClose={() => setEditingCategory(undefined)} onSaved={loadAll} />}


      {/* ─── Account Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl">
          <DialogTitle className="font-display text-2xl">
            Nova Conta
          </DialogTitle>
          <DialogDescription>
            Cadastre uma conta bancária ou carteira
          </DialogDescription>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="finance-accountName">Nome</Label>
              <Input
                id="finance-accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Ex: Nubank, Itaú, Carteira"
              />
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                value={accountType}
                onValueChange={(v) => setAccountType(v as Account['type'])}
              >
                <SelectTrigger aria-label="Tipo de conta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(accountTypeConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.icon} {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-accountBank">Banco</Label>
              <Input
                id="finance-accountBank"
                value={accountBank}
                onChange={(e) => setAccountBank(e.target.value)}
                placeholder="Ex: Nubank, Bradesco"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-accountBalance">Saldo Atual (R$)</Label>
              <Input
                id="finance-accountBalance"
                type="number"
                step="0.01"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
                placeholder="0,00"
                className="font-mono-num text-lg"
              />
            </div>
            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {[
                  '#3b82f6',
                  '#22c55e',
                  '#8b5cf6',
                  '#ec4899',
                  '#f59e0b',
                  '#06b6d4',
                  '#ef4444',
                  '#64748b',
                ].map((color) => (
                  <button
                    key={color}
                    aria-label={`Cor ${color}`}
                    type="button"
                    onClick={() => setAccountColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      accountColor === color
                        ? 'border-white scale-110'
                        : 'border-border'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsAccountDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateAccount} disabled={!accountName}>
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Card Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl">
          <DialogTitle className="font-display text-2xl">
            Novo Cartão
          </DialogTitle>
          <DialogDescription>
            Cadastre um cartão de crédito ou débito
          </DialogDescription>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="finance-cardName">Nome</Label>
              <Input
                id="finance-cardName"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Ex: Nubank Ultravioleta"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={cardType}
                  onValueChange={(v) => setCardType(v as FinanceCard['type'])}
                >
                  <SelectTrigger aria-label="Tipo de cartão">
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger aria-label="Bandeira">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(cardBrandColors).map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-cardLastDigits">Últimos 4 dígitos</Label>
              <Input
                id="finance-cardLastDigits"
                value={cardLastDigits}
                onChange={(e) => setCardLastDigits(e.target.value)}
                placeholder="1234"
                maxLength={4}
              />
            </div>
            {cardType === 'credit' && (
              <div className="grid gap-2">
                <Label htmlFor="finance-cardLimit">Limite (R$)</Label>
                <Input
                  id="finance-cardLimit"
                  type="number"
                  step="0.01"
                  value={cardLimit}
                  onChange={(e) => setCardLimit(e.target.value)}
                  placeholder="0,00"
                  className="font-mono-num"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="finance-cardClosingDay">Dia Fechamento</Label>
                <Input
                  id="finance-cardClosingDay"
                  type="number"
                  value={cardClosingDay}
                  onChange={(e) => setCardClosingDay(e.target.value)}
                  placeholder="1-31"
                  min="1"
                  max="31"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="finance-cardDueDay">Dia Vencimento</Label>
                <Input
                  id="finance-cardDueDay"
                  type="number"
                  value={cardDueDay}
                  onChange={(e) => setCardDueDay(e.target.value)}
                  placeholder="1-31"
                  min="1"
                  max="31"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsCardDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCard}
              disabled={!cardName || !cardLastDigits}
            >
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Payee Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={isPayeeDialogOpen} onOpenChange={setIsPayeeDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl">
          <DialogTitle className="font-display text-2xl">
            Novo Credor/Fornecedor
          </DialogTitle>
          <DialogDescription>Cadastre quem recebe ou paga</DialogDescription>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="finance-payeeName">Nome</Label>
              <Input
                id="finance-payeeName"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Ex: Manoel, Facebook Ads"
              />
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                value={payeeType}
                onValueChange={(v) => setPayeeType(v as Payee['type'])}
              >
                <SelectTrigger aria-label="Tipo de pessoa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">👤 Pessoa</SelectItem>
                  <SelectItem value="company">🏢 Empresa</SelectItem>
                  <SelectItem value="government">🏛️ Órgão Público</SelectItem>
                  <SelectItem value="other">📦 Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-payeeDocument">
                Documento (CPF/CNPJ)
              </Label>
              <Input
                id="finance-payeeDocument"
                value={payeeDocument}
                onChange={(e) => setPayeeDocument(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsPayeeDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreatePayee} disabled={!payeeName}>
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Goal Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl">
          <DialogTitle className="font-display text-2xl">
            Nova Meta Financeira
          </DialogTitle>
          <DialogDescription>
            Defina uma meta de economia ou investimento
          </DialogDescription>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Ícone</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  '🎯',
                  '🏠',
                  '🚗',
                  '✈️',
                  '📚',
                  '💎',
                  '🛡️',
                  '🎓',
                  '🏖️',
                  '💼',
                  '💊',
                  '🔧',
                ].map((icon) => (
                  <button
                    key={icon}
                    aria-label={`Ícone ${icon}`}
                    onClick={() => setGoalIcon(icon)}
                    className={cn(
                      'h-10 w-10 rounded-lg border-2 text-xl flex items-center justify-center transition-all',
                      goalIcon === icon
                        ? 'border-primary bg-primary/10 scale-110'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-goalName">Nome</Label>
              <Input
                id="finance-goalName"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Ex: Reserva de emergência"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="finance-goalTarget">Valor Alvo (R$)</Label>
                <Input
                  id="finance-goalTarget"
                  type="number"
                  step="0.01"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder="0,00"
                  className="font-mono-num"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="finance-goalCurrent">Valor Atual (R$)</Label>
                <Input
                  id="finance-goalCurrent"
                  type="number"
                  step="0.01"
                  value={goalCurrent}
                  onChange={(e) => setGoalCurrent(e.target.value)}
                  placeholder="0,00"
                  className="font-mono-num"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-goalDeadline">Prazo</Label>
              <Input
                id="finance-goalDeadline"
                type="date"
                value={goalDeadline}
                onChange={(e) => setGoalDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsGoalDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateGoal}
              disabled={!goalName || !goalTarget}
            >
              Criar Meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Budget Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl">
          <DialogTitle className="font-display text-2xl">
            Novo Orçamento
          </DialogTitle>
          <DialogDescription>
            Defina um limite de gasto por categoria
          </DialogDescription>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Tipo de despesa</Label>
              <Select
                value={budgetType}
                onValueChange={(v) => {
                  setBudgetType(v as typeof budgetType);
                  setBudgetCategory('');
                }}
              >
                <SelectTrigger aria-label="Tipo do orçamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense_fixed">Fixa</SelectItem>
                  <SelectItem value="expense_variable">Variável</SelectItem>
                </SelectContent>
              </Select>
              <Label>Categoria</Label>
              <Select value={budgetCategory} onValueChange={setBudgetCategory}>
                <SelectTrigger aria-label="Categoria do orçamento">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ...new Set([
                      ...categories[budgetType],
                      ...entries
                        .filter((e) => e.type === budgetType)
                        .map((e) => e.category),
                    ]),
                  ].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="finance-budgetLimit">Limite Mensal (R$)</Label>
              <Input
                id="finance-budgetLimit"
                type="number"
                step="0.01"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                placeholder="0,00"
                className="font-mono-num"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsBudgetDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateBudget}
              disabled={!budgetCategory || !budgetLimit}
            >
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBillDialogOpen}
        onOpenChange={(open) => {
          if (!billSaving) setIsBillDialogOpen(open);
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-3xl">
          <DialogTitle>Nova fatura</DialogTitle>
          <DialogDescription>
            Escolha o cartão. Esta fatura pertence a {selectedMonth}, por data
            de compra.
          </DialogDescription>
          <Label htmlFor="bill-card">Cartão de crédito</Label>
          <Select value={billCardId} onValueChange={setBillCardId}>
            <SelectTrigger id="bill-card">
              <SelectValue placeholder="Selecionar cartão" />
            </SelectTrigger>
            <SelectContent>
              {cards
                .filter(
                  (c) =>
                    c.isActive && (c.type === 'credit' || c.type === 'multiple')
                )
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {!cards.some(
            (c) => c.isActive && (c.type === 'credit' || c.type === 'multiple')
          ) && (
            <p className="text-sm text-muted-foreground">
              Cadastre um cartão de crédito na aba Cartões para começar.
            </p>
          )}
          <Button
            disabled={!billCardId || billSaving}
            onClick={handleCreateBill}
          >
            {billSaving ? 'Criando…' : 'Criar fatura'}
          </Button>
        </DialogContent>
      </Dialog>
      {entryDialog && (
        <EntryDialog
          entry={entryDialog === 'new' ? undefined : entryDialog}
          entries={entries}
          accounts={accounts}
          selectedMonth={selectedMonth}
          onClose={() => setEntryDialog(null)}
          onSaved={(month) => {
            setSelectedMonth(month);
            setDateRange('month');
            if (activeTab === 'transactions') openTransactions();
            loadAll();
          }}
        />
      )}
      <Dialog
        open={!!balanceAccount}
        onOpenChange={(open) => {
          if (!open && !balanceSaving) setBalanceAccount(null);
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-3xl">
          <DialogTitle>Atualizar saldo</DialogTitle>
          <DialogDescription>
            Informe o saldo atual de {balanceAccount?.name}. Este ajuste não
            cria receita ou despesa.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateAccountBalance();
            }}
            className="space-y-4"
          >
            <Label htmlFor="account-exact-balance">Saldo informado (R$)</Label>
            <Input
              id="account-exact-balance"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              className="h-12 font-mono-num text-xl"
            />
            <Button type="submit" className="w-full" disabled={balanceSaving}>
              {balanceSaving ? 'Salvando…' : 'Salvar saldo'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
