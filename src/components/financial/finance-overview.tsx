'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CircleDot,
  Plus,
  ReceiptText,
  Target,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  type FinancialEntry,
  type FinancialGoal,
  type Budget,
} from '@/lib/finance-model';
import {
  effectiveFinancialDate,
  type FinancialRange,
  type FinancialSummary,
} from '@/lib/financial-period';
import {
  financialDisplayStatus,
  financialPeriodInsights,
  formatMoney,
  shortFinancialDate,
} from '@/lib/financial-insights';

const FinanceCharts = dynamic(() => import('./finance-charts'), {
  ssr: false,
  loading: () => (
    <div
      className="h-96 animate-pulse rounded-3xl bg-muted/30"
      aria-label="Carregando gráficos"
    />
  ),
});

export function FinanceSummary({
  summary,
  period,
  previousResult,
  totalBalance,
  accountCount,
  onTransactions,
  onAccounts,
}: {
  summary: FinancialSummary;
  period: string;
  previousResult: number | null;
  totalBalance: number;
  accountCount: number;
  onTransactions: (status: string, type: string) => void;
  onAccounts: () => void;
}) {
  const result = summary.realized.balance;
  const withPlanned = result + summary.projected.balance;
  const difference = previousResult === null ? null : Math.round((result - previousResult) * 100) / 100;
  const metrics = [
    { label: 'Recebido', value: summary.realized.income, icon: ArrowDownLeft, color: 'text-money', status: 'paid', type: 'income', id: 'financial-paid-income' },
    { label: 'Despesas pagas', value: summary.realized.expenses, icon: ArrowUpRight, color: 'text-critical', status: 'paid', type: 'expenses', id: 'financial-paid-expenses' },
    { label: 'A receber', value: summary.projected.income, icon: CalendarClock, color: 'text-qty', status: 'open', type: 'income', id: 'financial-planned-income' },
    { label: 'A pagar', value: summary.projected.expenses, icon: CalendarClock, color: 'text-primary', status: 'open', type: 'expenses', id: 'financial-planned-expenses' },
  ];

  return (
    <section aria-label="Resumo financeiro do período" className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
      <div className="relative isolate flex min-w-0 flex-col items-start overflow-hidden rounded-3xl border border-primary/25 bg-card p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--color-primary)_24%,transparent),transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 -z-10 size-64 rounded-full border border-primary/20">
          <div className="absolute inset-6 rounded-full border border-primary/15" />
          <div className="absolute inset-12 rounded-full border border-primary/10" />
        </div>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Wallet aria-hidden className="size-4" /> Saldo total das contas
        </p>
        <p data-testid="financial-account-balance"
          className={cn('mt-4 max-w-full break-words font-display text-[clamp(2.3rem,4vw,4.5rem)] leading-[1.05] tracking-tight tabular-nums', totalBalance < 0 && 'text-critical')}>
          {accountCount ? formatMoney(totalBalance) : '—'}
        </p>
        <p className="mb-5 mt-2 text-xs leading-relaxed text-muted-foreground">
          {accountCount > 0 ? accountCount + (accountCount === 1 ? ' conta ativa' : ' contas ativas') + ' · saldo registrado' : 'Cadastre uma conta para acompanhar seu saldo'}
        </p>
        <Button variant="outline" className="mt-auto rounded-xl border-primary/25 bg-card/55" onClick={onAccounts}>
          Ver contas e saldos <ArrowUpRight aria-hidden className="size-3.5" />
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-3xl border border-border/75 bg-card/60">
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">{period} · realizado</p>
            <p data-testid="financial-realized-result"
              className={cn('mt-1 break-words font-display text-3xl leading-tight tracking-tight tabular-nums', result < 0 && 'text-critical')}>
              {formatMoney(result)}
            </p>
            {difference !== null && summary.entries > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {difference === 0 ? 'Igual ao período anterior' : formatMoney(Math.abs(difference)) + (difference > 0 ? ' acima' : ' abaixo') + ' do período anterior'}
              </p>
            )}
          </div>
          <div className="min-w-0 border-t border-border/70 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <p className="text-xs font-medium text-muted-foreground">Resultado com previsões</p>
            <p className={cn('mt-1 break-words font-display text-2xl leading-tight tracking-tight tabular-nums', withPlanned < 0 ? 'text-critical' : 'text-primary')}>
              {formatMoney(withPlanned)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Realizado + lançamentos em aberto</p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-border/70 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <button type="button" key={metric.id} onClick={() => onTransactions(metric.status, metric.type)}
              className={cn('group min-w-0 p-3 text-left transition-colors hover:bg-primary/5 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:p-4',
                index % 2 === 0 && 'border-r border-border/70',
                index === 1 && 'xl:border-r xl:border-border/70',
                index > 1 && 'border-t border-border/70 xl:border-t-0')}>
              <span className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                <span>{metric.label}</span><metric.icon aria-hidden className={cn('size-3.5 shrink-0', metric.color)} />
              </span>
              <strong data-testid={metric.id} className="mt-2 block break-words text-base tracking-tight tabular-nums sm:text-lg">
                {formatMoney(metric.value)}
              </strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

type BudgetProgress = Budget & { planned: number };

export function FinanceOverview({
  entries,
  periodEntries,
  range,
  selectedMonth,
  today,
  goals,
  budgets,
  onCategory,
  onDate,
  onMonth,
  onTransactions,
  onPay,
  onNewEntry,
  onNewGoal,
  onNewBudget,
}: {
  entries: FinancialEntry[];
  periodEntries: FinancialEntry[];
  range: FinancialRange;
  selectedMonth: string;
  today: string;
  goals: FinancialGoal[];
  budgets: BudgetProgress[];
  onCategory: (category: string, status: 'paid' | 'open') => void;
  onDate: (day: string) => void;
  onMonth: (month: string) => void;
  onTransactions: (status: string, type: string) => void;
  onPay: (entry: FinancialEntry) => void;
  onNewEntry: () => void;
  onNewGoal: () => void;
  onNewBudget: () => void;
}) {
  const insights = useMemo(
    () => financialPeriodInsights(entries, range, today),
    [entries, range, today]
  );
  const pending = useMemo(
    () =>
      periodEntries
        .filter((e) => e.status !== 'paid')
        .sort((a, b) =>
          effectiveFinancialDate(a).localeCompare(effectiveFinancialDate(b))
        ),
    [periodEntries]
  );
  const activeGoals = goals.filter((g) => g.status === 'active');
  return (
    <div className="space-y-5">
      <FinanceCharts
        entries={entries}
        range={range}
        selectedMonth={selectedMonth}
        onCategory={onCategory}
        onDate={onDate}
        onMonth={onMonth}
      />
      <section
        aria-label="Insights do período"
        className="grid gap-3 md:grid-cols-3"
      >
        <button
          onClick={() =>
            onTransactions(
              insights.overdueCount ? 'overdue' : 'open',
              'expenses'
            )
          }
          className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/30 p-4 text-left hover:bg-muted/30"
        >
          <CalendarClock
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              insights.overdueCount ? 'text-critical' : 'text-money'
            )}
          />
          <span>
            <strong className="block text-sm font-medium">
              {insights.overdueCount
                ? `${insights.overdueCount} ${insights.overdueCount === 1 ? 'vencimento precisa' : 'vencimentos precisam'} de atenção`
                : 'Sem vencimentos atrasados'}
            </strong>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {insights.overdueCount
                ? `${formatMoney(insights.overdueAmount)} em aberto com atraso neste período.`
                : 'Considerando os vencimentos informados neste período.'}
            </span>
          </span>
        </button>
        <button type="button" onClick={() => onTransactions('open', 'all')}
          className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/30 p-4 text-left hover:bg-muted/30">
          <ReceiptText aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <strong className="block text-sm font-medium">{pending.length} {pending.length === 1 ? 'lançamento em aberto' : 'lançamentos em aberto'}</strong>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {formatMoney(insights.summary.projected.income)} a receber · {formatMoney(insights.summary.projected.expenses)} a pagar
            </span>
          </span>
          <ArrowUpRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        </button>
        <button
          onClick={() =>
            insights.largestCategory
              ? onCategory(insights.largestCategory.name, 'paid')
              : onNewEntry()
          }
          className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/30 p-4 text-left hover:bg-muted/30"
        >
          <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-qty" />
          <span>
            <strong className="block text-sm font-medium">
              {insights.largestCategory
                ? `${insights.largestCategory.name}: ${insights.largestCategory.percent}% dos gastos`
                : 'Tudo começa com um registro'}
            </strong>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {insights.largestCategory
                ? 'Sua maior categoria entre as despesas pagas. Abra para entender os lançamentos.'
                : 'Categorize os lançamentos para descobrir para onde seu dinheiro vai.'}
            </span>
          </span>
        </button>
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="min-w-0 rounded-3xl border border-border/70 bg-card/50 p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">
                Compromissos do período
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTransactions('open', 'all')}
              aria-label="Ver todos os compromissos"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {pending.length === 0 ? (
            <div className="py-8 text-center">
              <Check className="mx-auto mb-3 h-6 w-6 text-money" />
              <p className="text-sm">Nenhum compromisso em aberto.</p>
              <Button variant="link" className="mt-2" onClick={onNewEntry}>
                Planejar um lançamento
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {pending.slice(0, 5).map((e) => {
                const overdue = financialDisplayStatus(e, today) === 'overdue';
                return (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        e.type === 'income'
                          ? 'bg-money/10 text-money'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {e.type === 'income' ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {e.description || e.category}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          overdue ? 'text-critical' : 'text-muted-foreground'
                        )}
                      >
                        {e.dueDate
                          ? overdue
                            ? 'Vencido'
                            : 'Vence'
                          : 'Previsto'}{' '}
                        {shortFinancialDate(effectiveFinancialDate(e))} ·{' '}
                        {e.category}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(e.amount)}
                      </p>
                      <button
                        className="mt-1 min-h-8 text-xs text-primary hover:underline"
                        onClick={() => onPay(e)}
                        aria-label={`Registrar ${e.type === 'income' ? 'recebimento' : 'pagamento'} de ${e.description || e.category}`}
                      >
                        {e.type === 'income' ? 'Receber' : 'Pagar'} ↗
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {pending.length > 5 && (
            <Button
              variant="ghost"
              className="mt-3 w-full text-muted-foreground"
              onClick={() => onTransactions('open', 'all')}
            >
              Ver todos os {pending.length} compromissos{' '}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </section>
        <section className="min-w-0 rounded-3xl border border-border/70 bg-card/50 p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl">Reservas & metas</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewGoal}
              aria-label="Nova meta financeira"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {activeGoals.length ? (
            <div className="space-y-5">
              {activeGoals.map((g) => (
                <div key={g.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-sm">
                      {g.icon} {g.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round((g.currentAmount / g.targetAmount) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      100,
                      Math.max(0, (g.currentAmount / g.targetAmount) * 100)
                    )}
                    className="h-1.5"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatMoney(g.currentAmount)} de{' '}
                    {formatMoney(g.targetAmount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-7 text-center">
              <Target className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Dê um destino à sua próxima conquista.
              </p>
              <Button
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={onNewGoal}
              >
                Criar uma meta
              </Button>
            </div>
          )}
          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            Valores das metas são informados manualmente e não movimentam suas
            contas.
          </p>
        </section>
      </div>
      <section className="rounded-3xl border border-border/70 bg-card/50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Limites com intenção</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Orçamentos de{' '}
              {new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString(
                'pt-BR',
                { month: 'long', year: 'numeric' }
              )}{' '}
              · pago e comprometido
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={onNewBudget}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo orçamento
          </Button>
        </div>
        {budgets.length ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {budgets.map((b) => {
              const used = b.spent + b.planned;
              const over = used > b.monthlyLimit;
              return (
                <div key={b.id} className="rounded-2xl bg-muted/25 p-4">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium">{b.category}</span>
                    <span
                      className={
                        over ? 'text-critical' : 'text-muted-foreground'
                      }
                    >
                      {over
                        ? 'Acima do limite'
                        : `${formatMoney(b.monthlyLimit - used)} livres`}
                    </span>
                  </div>
                  <div
                    className="my-3 flex h-2 overflow-hidden rounded-full bg-muted"
                    aria-label={`Pago ${formatMoney(b.spent)}, previsto ${formatMoney(b.planned)}, limite ${formatMoney(b.monthlyLimit)}`}
                  >
                    <span
                      className="bg-primary"
                      style={{
                        width: `${b.monthlyLimit ? Math.min(100, (b.spent / b.monthlyLimit) * 100) : b.spent ? 100 : 0}%`,
                      }}
                    />
                    <span
                      className="bg-primary/30"
                      style={{
                        width: `${b.monthlyLimit ? Math.min(Math.max(0, 100 - (b.spent / b.monthlyLimit) * 100), (b.planned / b.monthlyLimit) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {formatMoney(b.spent)} pagos + {formatMoney(b.planned)}{' '}
                    previstos
                    <br />
                    Limite de {formatMoney(b.monthlyLimit)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            Escolha uma categoria e defina quanto deseja destinar a ela neste
            mês.
          </p>
        )}
      </section>
    </div>
  );
}
