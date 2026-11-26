'use client';

import { useEffect, useState, useMemo } from 'react';
import { entryInvoiceMonth, invoiceCycle } from '@/lib/card-invoice';
import { financialMovements, invoiceMonthForExpense, invoiceTotal, movementCategories, movementSearchFields, type InvoiceMovement } from '@/lib/financial-invoice-movements';
import {
  type FinancialEntry,
  type Account,
  type Card as FinanceCard,
  type Budget,
  type Bill,
  type CashTransfer,
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
  Pencil,
  CalendarDays,
  Wallet,
  ArrowLeftRight,
  Lock,
} from 'lucide-react';
import type { FinancialCategory } from '@/lib/financial-categories';
import { FinancialCategoryDialog } from '@/components/financial/category-dialog';
import { EntryDialog } from '@/components/financial/entry-dialog';
import { FinancialCardDialog } from '@/components/financial/card-dialog';
import { CashMovementDialog } from '@/components/financial/cash-movement-dialog';
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
  formatMoney,
} from '@/lib/financial-insights';
import { cn, todayStr } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [transfers, setTransfers] = useState<CashTransfer[] | null>([]);
  const [cashMovement, setCashMovement] = useState<Bill | 'transfer' | null>(null);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clientReady, setClientReady] = useState(false);

  // View state
  const [activeTab, setActiveTab] = useState<
    'overview' | 'accounts' | 'cards' | 'transactions' | 'categories'
  >('overview');
  const [dateRange, setDateRange] = useState<
    'month' | 'quarter' | 'year' | 'all'
  >('month');
  const [selectedMonth, setSelectedMonth] = useState(() =>
    todayStr().slice(0, 7)
  );
  const [filterType, setFilterType] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [focusTransactions, setFocusTransactions] = useState(false);
  const [focusInvoice, setFocusInvoice] = useState<string | null>(null);

  const [entryDialog, setEntryDialog] = useState<FinancialEntry | 'new' | null>(
    null
  );
  const [entryCardId, setEntryCardId] = useState<string | undefined>();
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
    category: string | null = null,
    day: string | null = null
  ) {
    setFilterStatus(status);
    setFilterType(type);
    setCategoryFilter(category);
    setDayFilter(day);
    setAccountFilter('all');
    setCardFilter('all');
    setSearchQuery('');
    if (activeTab !== 'transactions') setFocusTransactions(true);
    setActiveTab('transactions');
  }

  function openNewEntry(cardId?: string) {
    setEntryCardId(cardId);
    setEntryDialog('new');
  }

  function openInvoice(invoice: InvoiceMovement) {
    if (!cards.some(card => card.id === invoice.cardId)) {
      toast.info('O cartão desta fatura foi removido.');
      return;
    }
    setSelectedMonth(invoice.month);
    setFocusInvoice(invoice.cardId);
    setActiveTab('cards');
  }

  useEffect(() => {
    if (activeTab !== 'cards' || !focusInvoice || isLoading) return;
    const frame = requestAnimationFrame(() => {
      const heading = document.getElementById('finance-card-' + focusInvoice);
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, focusInvoice, isLoading]);

  // Dialogs
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [cardEditor, setCardEditor] = useState<{ card?: FinanceCard; trigger: HTMLElement } | null>(null);
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
        transfersData,
      ] = await Promise.all([
        apiFetch<FinancialEntry[]>('/api/financial'),
        apiFetch<Account[]>('/api/accounts'),
        apiFetch<FinanceCard[]>('/api/cards'),
        apiFetch<Budget[]>('/api/budgets'),
        apiFetch<FinancialGoal[]>('/api/financial-goals'),
        apiFetch<Payee[]>('/api/payees'),
        apiFetch<Bill[]>('/api/bills'),
        apiFetch<FinancialCategory[]>('/api/financial-categories'),
        apiFetch<CashTransfer[]>('/api/transfers').catch(() => null),
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
      setTransfers(transfersData);
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
  const movements = useMemo(() => financialMovements(entries, cards, bills), [entries, cards, bills]);
  const periodEntries = useMemo(
    () => financialEntriesForRange(movements, range),
    [movements, range]
  );

  const periodCategories = useMemo(() => [...new Set(periodEntries.flatMap(movementCategories))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [periodEntries]);
  const selectedDayFilter = dayFilter && dayFilter >= range.start && dayFilter <= range.end ? dayFilter : null;
  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '');
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
      if (categoryFilter && !movementCategories(e).includes(categoryFilter)) return false;
      if (selectedDayFilter && effectiveFinancialDate(e) !== selectedDayFilter) return false;
      if (accountFilter !== 'all' && (e.accountId || 'none') !== accountFilter) return false;
      if (cardFilter !== 'all' && (e.cardId || 'none') !== cardFilter) return false;
      if (query) {
        return movementSearchFields(e).some(value =>
          value?.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').includes(query)
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
    selectedDayFilter,
    accountFilter,
    cardFilter,
    today,
  ]);

  // ─── Calculations ─────────────────────────────────────────────────────────

  const periodSummary = useMemo(
    () => summarizeFinancialEntries(periodEntries),
    [periodEntries]
  );
  const previousPeriod = useMemo(() => {
    if (activeTab !== 'overview' || dateRange === 'all') return null;
    const anchor = shiftFinancialPeriod(selectedMonth, dateRange, -1);
    const previous = summarizeFinancialEntries(financialEntriesForRange(movements, financialPeriodRange(anchor, dateRange)));
    return previous.entries > 0 ? previous.realized.balance : null;
  }, [activeTab, dateRange, movements, selectedMonth]);
  const activeAccounts = accounts.filter(account => account.isActive);
  const totalBalance = activeAccounts.reduce((sum, account) => sum + account.balance, 0);
  const currentMonth = today.slice(0, 7);
  const showPeriodControls = activeTab === 'overview' || activeTab === 'transactions' || activeTab === 'cards';
  const periodMode = activeTab === 'cards' ? 'month' : dateRange;
  const periodLabel = activeTab === 'cards' ? financialPeriodRange(selectedMonth, 'month').label : range.label;
  const activeCreditCards = cards.some(card => card.isActive && card.type !== 'debit');
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
          balance: accountBalance.trim() ? Number(accountBalance) : undefined,
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
    if (
      entry?.installment &&
      window.confirm(
        `Esta é a parcela ${entry.installment.current}/${entry.installment.total}. Excluir também as outras parcelas ainda não pagas desta compra?`
      )
    ) {
      try {
        const res = await apiFetch<{ removed: number }>(
          `/api/financial/${id}?scope=installments`,
          { method: 'DELETE' }
        );
        await loadAll();
        toast.success(`${res.removed} parcelas excluídas.`);
      } catch (err) {
        toast.error(showError(err));
      }
      return;
    }
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
        body: JSON.stringify({ status: newStatus, paidDate: null, dueDate: entry.dueDate || entry.date }),
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
    const card = cards.find((c) => c.id === cardId);
    if (!card) return [];
    return entries.filter(
      (e) =>
        e.cardId === cardId &&
        e.type !== 'income' &&
        // Debit purchases have no invoice month of their own; list them by purchase date.
        (invoiceMonthForExpense(e, card) ?? entryInvoiceMonth(e, card)) === month
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
    const { closeDate, dueDate } = invoiceCycle(card, month);

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
    const { closeDate, dueDate } = invoiceCycle(card, month);
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
      <motion.div className="mb-4 flex flex-wrap items-center justify-between gap-3" variants={fade}>
        <div className="work-heading-row min-w-0">
          <h1 className="font-display">Financeiro</h1>
          <WorkspaceContinuations />
        </div>
        <Button id="financial-new-entry" onClick={() => openNewEntry()} className="h-11 rounded-xl">
          <Plus className="mr-2 h-4 w-4" /> Novo lançamento
        </Button>
      </motion.div>

      {/* ─── Tab Navigation ─────────────────────────────────────────────────── */}
      <motion.nav
        className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-border/65 bg-card/60 p-1.5"
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
          { id: 'cards' as const, label: 'Cartões e faturas', icon: CreditCard },
          { id: 'categories' as const, label: 'Cadastros', icon: Building2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setFocusTransactions(false);
              setFocusInvoice(null);
              setActiveTab(tab.id);
            }}
            aria-pressed={activeTab === tab.id}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              activeTab === tab.id
                ? 'border-primary/25 bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </motion.nav>

      {showPeriodControls && (
        <div aria-label="Navegação por período" role="group" className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/35 p-2">
          <span className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
            <CalendarDays aria-hidden className="h-4 w-4" /> {activeTab === 'cards' ? 'Mês da fatura' : 'Período'}
          </span>
            {activeTab !== 'cards' && <Select
              value={dateRange}
              onValueChange={(v) => setDateRange(v as typeof dateRange)}
            >
              <SelectTrigger
                aria-label="Período financeiro"
                className="h-10 w-auto min-w-24"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>}
            <div className="flex h-10 min-w-0 items-center rounded-xl border border-border/70 bg-card/70">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={periodMode === 'all'}
                aria-label={
                  periodMode === 'month' ? 'Mês anterior' : 'Período anterior'
                }
                onClick={() =>
                  setSelectedMonth((month) =>
                    shiftFinancialPeriod(month, periodMode, -1)
                  )
                }
                className="h-9 w-9 rounded-r-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span
                data-testid="financial-period-label"
                className="min-w-0 px-2 sm:min-w-36 text-center text-sm font-semibold first-letter:uppercase tabular-nums"
              >
                {periodLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={periodMode === 'all'}
                aria-label={
                  periodMode === 'month' ? 'Próximo mês' : 'Próximo período'
                }
                onClick={() =>
                  setSelectedMonth((month) =>
                    shiftFinancialPeriod(month, periodMode, 1)
                  )
                }
                className="h-9 w-9 rounded-l-none"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {selectedMonth !== currentMonth && periodMode !== 'all' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedMonth(currentMonth)}
                className="h-10"
              >
                {periodMode === 'month' ? 'Mês atual' : 'Período atual'}
              </Button>
            )}
        </div>
      )}

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
      {activeTab === 'overview' && (isLoading ? (
        <div
          className="mb-6 h-60 animate-pulse rounded-3xl bg-muted/30"
          aria-label="Carregando financeiro"
        />
      ) : (
        !loadError && (
          <FinanceSummary
            summary={periodSummary}
            period={range.label}
            previousResult={previousPeriod}
            totalBalance={totalBalance}
            accountCount={activeAccounts.length}
            onTransactions={openTransactions}
            onAccounts={() => setActiveTab('accounts')}
          />
        )
      ))}

      {/* ─── Tab Content ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && !isLoading && !loadError && (
          <FinanceOverview
            entries={movements}
            periodEntries={periodEntries}
            range={range}
            selectedMonth={selectedMonth}
            today={today}
            goals={goals}
            budgets={currentBudgets}
            onCategory={(category, status) =>
              openTransactions(status, 'expenses', category)
            }
            onDate={day => openTransactions('all', 'all', null, day)}
            onInvoice={openInvoice}
            onMonth={(month) => {
              setSelectedMonth(month);
              setDateRange('month');
            }}
            onTransactions={openTransactions}
            onPay={handleTogglePaid}
            onNewEntry={() => openNewEntry()}
            onNewGoal={() => setIsGoalDialogOpen(true)}
            onNewBudget={() => setIsBudgetDialogOpen(true)}
          />
        )}

        {activeTab === 'accounts' && !loadError && (
          <motion.div
            key="accounts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold font-display">Contas</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setCashMovement('transfer')} disabled={activeAccounts.length < 2}>
                  <ArrowLeftRight aria-hidden className="mr-2 h-4 w-4" /> Transferir entre contas
                </Button>
                <Button onClick={() => setIsAccountDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Nova Conta
                </Button>
              </div>
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
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet className="h-4 w-4" /> Saldo das contas ativas</p>
                  <strong className={cn('font-display text-2xl tabular-nums', totalBalance < 0 && 'text-critical')}>
                    {activeAccounts.length ? formatMoney(totalBalance) : '—'}
                  </strong>
                </div>
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
                                {!account.isActive && 'Inativa · '}
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
                            Última conferência {account.balanceCheckedAt
                              ? 'em ' + new Date(account.balanceCheckedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                              : 'ainda não registrada'}
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
              </div>
            )}
            {transfers === null ? (
              <p className="mt-4 text-sm text-muted-foreground">Não foi possível carregar as transferências.</p>
            ) : transfers.length > 0 && (
              <section className="mt-6 rounded-2xl border border-border/70 bg-card/45 p-4">
                <h3 className="font-display text-xl font-semibold">Transferências recentes</h3>
                <ul className="mt-3 divide-y divide-border/60">
                  {transfers.map(transfer => (
                    <li key={transfer.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <span className="min-w-0 break-words">
                        {transfer.fromAccountName} → {transfer.toAccountName}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(transfer.recordedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        </span>
                      </span>
                      <strong className="tabular-nums">{formatMoney(transfer.amount)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </motion.div>
        )}

        {activeTab === 'cards' && !loadError && (
          <motion.div
            key="cards"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">Cartões e faturas</h2>
              <div className="flex flex-wrap gap-2">
                {activeCreditCards && (
                  <Button variant="outline" onClick={() => {
                    setBillCardId('');
                    setIsBillDialogOpen(true);
                  }}>
                    <Plus className="mr-2 h-4 w-4" /> Nova Fatura
                  </Button>
                )}
                <Button onClick={event => setCardEditor({ trigger: event.currentTarget })}>
                  <Plus className="mr-2 h-4 w-4" /> Novo cartão
                </Button>
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-32 rounded-2xl" />
            ) : cards.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <CreditCard aria-hidden className="h-9 w-9 text-muted-foreground" />
                  <p className="font-medium">Nenhum cartão cadastrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {cards.map((card) => {
                    const brandColor =
                      cardBrandColors[card.brand] || card.color || '#64748b';
                    const account = accounts.find(item => item.id === card.accountId);
                    const hasCredit = card.type !== 'debit';
                    const currentMonth = selectedMonth;
                    const currentBill = getBillForCardMonth(
                      card.id,
                      currentMonth
                    );
                    const currentTransactions = getCardTransactionsForMonth(
                      card.id,
                      currentMonth
                    );
                    const canAddPurchase = !currentBill || currentBill.status === 'open';
                    const previousBills = bills.filter(bill => bill.cardId === card.id && bill.month < currentMonth)
                      .sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
                    const showCurrentInvoice = hasCredit || Boolean(currentBill)
                      || currentTransactions.some(entry => entry.billMonth);
                    const cycle = invoiceCycle(card, currentMonth);
                    const closedBill = currentBill?.status === 'open' ? undefined : currentBill;
                    const closeDate = closedBill?.closeDate || cycle.closeDate;
                    const dueDate = closedBill?.dueDate || cycle.dueDate;
                    const amount = invoiceTotal(currentBill, currentTransactions);

                    return (
                      <Card key={card.id} className="overflow-hidden">
                        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 p-4 sm:px-6"
                          style={{ background: 'linear-gradient(110deg, ' + brandColor + '28, transparent 85%)' }}>
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border/70 bg-card">
                            <CreditCard className="h-5 w-5 text-primary" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1 basis-36">
                            <h3 id={'finance-card-' + card.id} tabIndex={-1}
                              className="scroll-mt-24 break-words text-lg font-semibold focus:outline-none">{card.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {card.brand} · Final {card.lastDigits} · {card.type === 'multiple' ? 'Múltiplo' : hasCredit ? 'Crédito' : 'Débito'}
                              {!card.isActive && ' · Inativo'}
                              {account && ' · ' + account.name}
                            </p>
                          </div>
                          {hasCredit && card.limit != null && (
                            <div className="text-sm tabular-nums sm:text-right">
                              <p className="text-xs text-muted-foreground">Limite cadastrado</p>
                              <strong>{formatMoney(card.limit)}</strong>
                            </div>
                          )}
                          <Button variant="outline" size="sm" className="min-h-10"
                            aria-label={'Editar cartão ' + card.name}
                            onClick={event => setCardEditor({ card, trigger: event.currentTarget })}>
                            <Pencil aria-hidden className="mr-2 h-4 w-4" /> Editar cartão
                          </Button>
                        </div>

                        {(showCurrentInvoice || previousBills.length > 0) && <CardContent className="p-4 sm:p-6">
                          {/* Current Month Bill */}
                          {showCurrentInvoice && <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">
                                  Fatura · {periodLabel}
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
                              <span className="text-xs text-muted-foreground">
                                Fecha em {closeDate.slice(8)}/{closeDate.slice(5, 7)} · Vence em {dueDate.slice(8)}/{dueDate.slice(5, 7)}
                              </span>
                            </div>

                            {/* Bill Amount */}
                            <div className="rounded-xl border p-4 mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-muted-foreground">
                                  Valor da fatura
                                </span>
                                <span className="text-2xl font-bold font-mono-num">
                                  {formatMoney(amount)}
                                </span>
                              </div>
                              {currentBill && currentBill.paidAmount > 0 && (
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-muted-foreground">
                                    Pago
                                  </span>
                                  <span className="text-lg font-bold font-mono-num text-money">
                                    {formatMoney(currentBill.paidAmount)}
                                  </span>
                                </div>
                              )}
                              {currentBill && currentBill.status !== 'paid' && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    Saldo da fatura
                                  </span>
                                  <span className="text-xl font-bold font-mono-num text-critical">
                                    {formatMoney(amount - currentBill.paidAmount)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-2">
                              {hasCredit && card.isActive && <Button
                                variant="outline"
                                className="flex-1"
                                aria-label={`Adicionar compra ao ${card.name}`}
                                disabled={!canAddPurchase}
                                onClick={() => openNewEntry(card.id)}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar compra
                              </Button>}
                              {((!currentBill && hasCredit && card.isActive) || currentBill?.status === 'open') ? (
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
                              ) : currentBill && currentBill.status !== 'paid' ? (
                                <Button
                                  onClick={() => setCashMovement(currentBill)}
                                  className="flex-1 bg-money hover:bg-money/90"
                                >
                                  <Check className="mr-2 h-4 w-4" /> Registrar pagamento
                                </Button>
                              ) : currentBill?.status === 'paid' ? (
                                <div className="flex-1 text-center py-2 text-sm text-money font-medium">
                                  Fatura quitada{currentBill.paymentAccountId && (
                                    <span className="ml-1 block text-xs text-muted-foreground">
                                      Conta pagadora · {accounts.find(item => item.id === currentBill.paymentAccountId)?.name || 'Conta indisponível'}
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {currentBill && currentBill.status !== 'open' && currentBill.status !== 'paid' && (
                              <p className="text-xs text-muted-foreground">
                                A quitação atualiza o saldo da conta pagadora e marca as compras associadas como pagas.
                              </p>
                            )}
                          </div>}

                          {/* Transactions in Current Bill */}
                          {showCurrentInvoice && currentTransactions.length > 0 && (
                            <div className="mt-4">
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
                          {previousBills.length > 0 && (
                            <details className="mt-4 border-t pt-4">
                              <summary className="mb-2 cursor-pointer text-sm font-medium text-muted-foreground">
                                Faturas anteriores ({previousBills.length})
                              </summary>
                              <div className="space-y-2">
                                {previousBills
                                  .map((bill) => (
                                    <div
                                      key={bill.id}
                                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                                    >
                                      <button type="button" className="text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={() => setSelectedMonth(bill.month)}>
                                        {financialPeriodRange(bill.month, 'month').label}
                                      </button>
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
                                          {bill.status !== 'paid' && bill.status !== 'open' && (
                                            <DropdownMenuItem onClick={() => setCashMovement(bill)}>
                                              Registrar pagamento
                                            </DropdownMenuItem>
                                          )}
                                          {!bill.paymentAccountId && <DropdownMenuItem
                                            onClick={() =>
                                              handleDeleteBill(bill.id)
                                            }
                                            className="text-destructive"
                                          >
                                            🗑️ Excluir
                                          </DropdownMenuItem>}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  ))}
                              </div>
                            </details>
                          )}
                        </CardContent>}
                      </Card>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'transactions' && !isLoading && !loadError && (
          <FinancialTransactions
            entries={filteredEntries}
            filterType={filterType}
            filterStatus={filterStatus}
            categoryFilter={categoryFilter}
            dayFilter={selectedDayFilter}
            onClearDay={() => setDayFilter(null)}
            focusOnOpen={focusTransactions}
            period={range.label}
            totalInPeriod={periodEntries.length}
            categories={periodCategories}
            accounts={accounts}
            cards={cards}
            accountFilter={accountFilter}
            cardFilter={cardFilter}
            onCategory={setCategoryFilter}
            onAccount={setAccountFilter}
            onCard={setCardFilter}
            search={searchQuery}
            today={today}
            onType={setFilterType}
            onStatus={setFilterStatus}
            onSearch={setSearchQuery}
            onClear={() => openTransactions()}
            onEdit={setEntryDialog}
            onInvoice={openInvoice}
            onPay={handleTogglePaid}
            onDelete={handleDeleteEntry}
            onNew={() => openNewEntry()}
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

      {cashMovement && (
        <CashMovementDialog
          accounts={activeAccounts}
          bill={cashMovement === 'transfer' ? undefined : cashMovement}
          defaultAccountId={cashMovement === 'transfer' ? undefined : cards.find(card => card.id === cashMovement.cardId)?.accountId}
          onClose={() => setCashMovement(null)}
          onSaved={() => {
            toast.success(cashMovement === 'transfer' ? 'Transferência registrada.' : 'Fatura quitada.');
            setCashMovement(null);
            void loadAll();
          }}
        />
      )}
      {cardEditor && (
        <FinancialCardDialog card={cardEditor.card} accounts={accounts} trigger={cardEditor.trigger}
          onClose={() => setCardEditor(null)}
          onSaved={saved => {
            setCards(current => current.some(card => card.id === saved.id)
              ? current.map(card => card.id === saved.id ? saved : card)
              : [...current, saved]);
            setCardEditor(null);
          }} />
      )}

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
            Escolha o cartão para registrar a fatura com fechamento em {periodLabel}.
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
          {!activeCreditCards && (
            <p className="text-sm text-muted-foreground">
              Cadastre um cartão de crédito ou múltiplo para começar.
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
          cards={cards}
          initialCardId={entryDialog === 'new' ? entryCardId : undefined}
          selectedMonth={selectedMonth}
          onClose={() => setEntryDialog(null)}
          onSaved={(month) => {
            setSelectedMonth(month);
            setDateRange('month');
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
