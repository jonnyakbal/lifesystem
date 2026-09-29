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
  Target,
  Wallet,
  Sparkles,
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
  totalBalance,
  onTransactions,
  onAccounts,
}: {
  summary: FinancialSummary;
  totalBalance: number;
  onTransactions: (status: string, type: string) => void;
  onAccounts: () => void;
}) {
  const net = summary.realized.balance;
  const withPlanned = net + summary.projected.balance;
  return (
    <section
      aria-label="Resumo financeiro do período"
      className="mb-6 grid gap-4 lg:grid-cols-[1.05fr_2fr]"
    >
      <div className="relative isolate overflow-hidden rounded-3xl border border-primary/25 bg-primary/[.04] p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-16 -z-10 h-64 w-64 rounded-full border border-primary/15"
        >
          <div className="absolute inset-7 rounded-full border border-primary/10" />
          <div className="absolute inset-14 rounded-full border border-primary/10" />
          <span className="absolute bottom-12 left-9 h-2 w-2 rounded-full bg-primary/60 shadow-[0_0_20px_var(--color-primary)]" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Resultado realizado
        </p>
        <p
          data-testid="financial-realized-result"
          className={cn(
            'mt-3 break-words font-display text-4xl tracking-tight tabular-nums sm:text-5xl',
            net < 0 ? 'text-critical' : 'text-foreground'
          )}
        >
          {formatMoney(net)}
        </p>
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t border-primary/15 pt-4">
          <span className="text-xs text-muted-foreground">
            Se as previsões se confirmarem
          </span>
          <strong
            className={cn(
              'text-sm tabular-nums',
              withPlanned < 0 ? 'text-critical' : 'text-money'
            )}
          >
            {formatMoney(withPlanned)}
          </strong>
        </div>
        <button
          onClick={onAccounts}
          className="mt-4 flex min-h-9 w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          <Wallet className="h-3.5 w-3.5" />
          <span className="flex-1">
            Saldo informado das contas:{' '}
            <span className="font-medium">{formatMoney(totalBalance)}</span>
          </span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-3xl border border-border/70 bg-card/50">
        {[
          {
            title: 'Recebido',
            value: summary.realized.income,
            caption: 'Entradas realizadas',
            icon: ArrowDownLeft,
            color: 'text-money',
            status: 'paid',
            type: 'income',
            testId: 'financial-paid-income',
          },
          {
            title: 'Despesas pagas',
            value: summary.realized.expenses,
            caption: 'Saídas realizadas',
            icon: ArrowUpRight,
            color: 'text-critical',
            status: 'paid',
            type: 'expenses',
            testId: 'financial-paid-expenses',
          },
          {
            title: 'A receber · previsto',
            value: summary.projected.income,
            caption: 'Entradas em aberto',
            icon: CalendarClock,
            color: 'text-qty',
            status: 'open',
            type: 'income',
            testId: 'financial-planned-income',
          },
          {
            title: 'A pagar · previsto',
            value: summary.projected.expenses,
            caption: 'Saídas em aberto',
            icon: CalendarClock,
            color: 'text-primary',
            status: 'open',
            type: 'expenses',
            testId: 'financial-planned-expenses',
          },
        ].map((item, i) => (
          <button
            key={item.title}
            onClick={() => onTransactions(item.status, item.type)}
            className={cn(
              'group min-w-0 p-4 text-left transition-colors hover:bg-muted/40 sm:p-5',
              i % 2 === 0 && 'border-r border-border/60',
              i < 2 && 'border-b border-border/60'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {item.title}
              </span>
              <item.icon className={cn('h-4 w-4 shrink-0', item.color)} />
            </div>
            <p
              data-testid={item.testId}
              className="mt-3 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl"
            >
              {formatMoney(item.value)}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {item.caption}
              <span
                className="ml-2 opacity-0 group-hover:opacity-100"
                aria-hidden
              >
                ↗
              </span>
            </p>
          </button>
        ))}
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
        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/30 p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <strong className="block text-sm font-medium">
              {insights.summary.entries
                ? `Resultado com previsões: ${formatMoney(insights.withPlanned)}`
                : 'Um período para planejar'}
            </strong>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {insights.summary.entries
                ? 'Realizado + entradas previstas − saídas previstas. Apenas valores já registrados.'
                : 'Registre o que espera receber e pagar. As previsões ficam separadas dos pagamentos.'}
            </p>
          </div>
        </div>
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
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">
                O que vem pela frente
              </p>
              <h2 className="mt-2 font-display text-2xl">
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
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">
                Espaço para seus planos
              </p>
              <h2 className="mt-2 font-display text-2xl">Reservas & metas</h2>
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
