'use client';

import { useId, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from 'motion/react';
import { ArrowUpRight, ChartNoAxesCombined, Table2 } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/line-charts-1';
import { cn } from '@/lib/utils';
import { type FinancialEntry } from '@/lib/finance-model';
import { type FinancialRange } from '@/lib/financial-period';
import {
  financialCategoryBreakdown,
  financialFlowSeries,
  financialTrend,
  formatMoney,
} from '@/lib/financial-insights';

const flowConfig = {
  realized: { label: 'Realizado', color: 'var(--color-money)' },
  withPlanned: {
    label: 'Com previsões',
    color: 'var(--color-primary)',
    dashed: true,
  },
} satisfies ChartConfig;
const historyConfig = {
  received: { label: 'Recebido', color: 'var(--color-money)' },
  paid: { label: 'Pago', color: 'var(--color-critical)' },
  receivable: { label: 'A receber', color: 'var(--color-money)' },
  payable: { label: 'A pagar', color: 'var(--color-critical)' },
} satisfies ChartConfig;
const colors = [
  'var(--color-primary)',
  'var(--color-qty)',
  'var(--color-money)',
  'var(--color-stellar)',
  'var(--color-critical)',
  '#9aa5b5',
];
const compactMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
const chartTick = { fill: 'var(--color-muted-foreground)', fontSize: 11 };
const tooltipStyle = {
  background: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  color: 'var(--color-foreground)',
  fontSize: 12,
  boxShadow: '0 8px 30px #0002',
};

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 text-center">
      <ChartNoAxesCombined className="h-8 w-8 text-muted-foreground/50" />
      <p className="max-w-60 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function LegendDot({
  color,
  children,
  dashed = false,
}: {
  color: string;
  children: React.ReactNode;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <i
        aria-hidden
        className={cn('w-4 border-t-2', dashed && 'border-dashed')}
        style={{ borderColor: color }}
      />
      {children}
    </span>
  );
}

export default function FinanceCharts({
  entries,
  range,
  selectedMonth,
  onCategory,
  onMonth,
}: {
  entries: FinancialEntry[];
  range: FinancialRange;
  selectedMonth: string;
  onCategory: (category: string, status: 'paid' | 'open') => void;
  onMonth: (month: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const fillId = useId().replaceAll(':', '');
  const [categoryMode, setCategoryMode] = useState<'paid' | 'open'>('paid');
  const [view, setView] = useState<'flow' | 'history'>('flow');
  const [showPlanned, setShowPlanned] = useState(true);
  const points = useMemo(
    () => financialFlowSeries(entries, range),
    [entries, range]
  );
  const history = useMemo(
    () => financialTrend(entries, selectedMonth),
    [entries, selectedMonth]
  );
  const periodEntries = useMemo(
    () =>
      entries.filter((e) => {
        const date =
          e.status === 'paid' ? e.paidDate || e.date : e.dueDate || e.date;
        return date >= range.start && date <= range.end;
      }),
    [entries, range]
  );
  const categories = useMemo(
    () =>
      financialCategoryBreakdown(periodEntries, categoryMode).map((c, i) => ({
        ...c,
        fill: colors[i % colors.length],
      })),
    [periodEntries, categoryMode]
  );
  const total = categories.reduce((sum, c) => sum + c.value, 0);
  const animate = !reduceMotion;

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="financial-flow-title"
        className="min-w-0 rounded-3xl border border-border/70 bg-card/60 p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">
              O movimento do dinheiro
            </p>
            <h2
              id="financial-flow-title"
              className="mt-2 font-display text-2xl"
            >
              {view === 'flow'
                ? 'Como o período evolui'
                : 'Um olhar sobre os meses'}
            </h2>
          </div>
          <div
            className="flex rounded-lg bg-muted/60 p-1"
            role="group"
            aria-label="Visualização do gráfico"
          >
            {(['flow', 'history'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={cn(
                  'min-h-9 rounded-md px-3 text-xs font-medium',
                  view === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                {mode === 'flow' ? 'Evolução' : '6 meses'}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {view === 'flow'
            ? 'Resultado acumulado dos lançamentos, a partir de zero. Não representa saldo bancário.'
            : 'Entradas e saídas de cada mês. As parcelas em aberto aparecem com cor suave.'}
        </p>
        <div className="my-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            <LegendDot color="var(--color-money)">
              {view === 'flow' ? 'Realizado' : 'Recebido'}
            </LegendDot>
            <LegendDot
              color={
                view === 'flow'
                  ? 'var(--color-primary)'
                  : 'var(--color-critical)'
              }
              dashed={view === 'flow'}
            >
              {view === 'flow' ? 'Com previsões' : 'Pago'}
            </LegendDot>
          </div>
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showPlanned}
              onChange={(e) => setShowPlanned(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Incluir previsões
          </label>
        </div>
        {points.length === 0 && view === 'flow' ? (
          <EmptyChart text="Nenhum movimento neste período. Planeje uma entrada ou despesa para começar." />
        ) : (
          <div
            className="h-[260px] min-w-0 sm:h-[300px]"
            data-testid="financial-flow-chart"
          >
            <ChartContainer
              config={view === 'flow' ? flowConfig : historyConfig}
              className="h-full w-full"
            >
              {view === 'flow' ? (
                <ComposedChart
                  data={points}
                  accessibilityLayer
                  margin={{ top: 8, right: 8, left: -15, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-money)"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-money)"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeDasharray="3 5"
                  />
                  <XAxis
                    dataKey="label"
                    tick={chartTick}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                    dy={8}
                  />
                  <YAxis
                    tick={chartTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={compactMoney}
                    width={65}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent valueFormatter={formatMoney} />
                    }
                    cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="var(--color-muted-foreground)"
                    strokeOpacity={0.4}
                  />
                  <Area
                    name="Realizado"
                    type="stepAfter"
                    dataKey="realized"
                    stroke="var(--color-money)"
                    fill={`url(#${fillId})`}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'var(--color-card)', strokeWidth: 2 }}
                    isAnimationActive={animate}
                    animationDuration={550}
                  />
                  {showPlanned && (
                    <Line
                      name="Com previsões"
                      type="stepAfter"
                      dataKey="withPlanned"
                      stroke="var(--color-primary)"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={{
                        r: 4,
                        fill: 'var(--color-card)',
                        strokeWidth: 2,
                        strokeDasharray: '0',
                      }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={animate}
                      animationDuration={550}
                    />
                  )}
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={history}
                  accessibilityLayer
                  margin={{ top: 8, right: 0, left: -15, bottom: 4 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeDasharray="3 5"
                  />
                  <XAxis
                    dataKey="label"
                    tick={chartTick}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={10}
                  />
                  <YAxis
                    tick={chartTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={compactMoney}
                    width={65}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent valueFormatter={formatMoney} />
                    }
                    cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
                  />
                  <Bar
                    name="Recebido"
                    dataKey="received"
                    stackId="income"
                    fill="var(--color-money)"
                    maxBarSize={28}
                    isAnimationActive={animate}
                  />
                  {showPlanned && (
                    <Bar
                      name="A receber"
                      dataKey="receivable"
                      stackId="income"
                      fill="var(--color-money)"
                      fillOpacity={0.25}
                      maxBarSize={28}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={animate}
                    />
                  )}
                  <Bar
                    name="Pago"
                    dataKey="paid"
                    stackId="expense"
                    fill="var(--color-critical)"
                    maxBarSize={28}
                    isAnimationActive={animate}
                  />
                  {showPlanned && (
                    <Bar
                      name="A pagar"
                      dataKey="payable"
                      stackId="expense"
                      fill="var(--color-critical)"
                      fillOpacity={0.25}
                      maxBarSize={28}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={animate}
                    />
                  )}
                </ComposedChart>
              )}
            </ChartContainer>
          </div>
        )}
        {view === 'history' && (
          <div
            className="mt-4 flex flex-wrap gap-1"
            aria-label="Abrir mês do histórico"
          >
            {history.map((m) => (
              <button
                key={m.month}
                onClick={() => onMonth(m.month)}
                className={cn(
                  'min-h-9 rounded-lg px-2 text-xs capitalize text-muted-foreground hover:bg-muted',
                  m.month === selectedMonth && 'bg-primary/10 text-primary'
                )}
              >
                {m.label}
                <span className="sr-only">: abrir mês</span>
              </button>
            ))}
          </div>
        )}
        <details className="mt-4 border-t border-border/60 pt-3">
          <summary className="flex min-h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Table2 className="h-3.5 w-3.5" />
            Ver dados do gráfico
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                {view === 'flow'
                  ? 'Resultado acumulado em reais'
                  : 'Movimentação mensal em reais'}
              </caption>
              <thead>
                <tr className="text-muted-foreground">
                  {(view === 'flow'
                    ? ['Data', 'Realizado', 'Com previsões']
                    : ['Mês', 'Recebido', 'Pago', 'A receber', 'A pagar']
                  ).map((h) => (
                    <th key={h} scope="col" className="p-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view === 'flow'
                  ? points.map((p) => (
                      <tr key={p.date} className="border-t border-border/50">
                        <th scope="row" className="p-2 font-normal">
                          {p.label}
                        </th>
                        <td className="p-2 whitespace-nowrap">
                          {formatMoney(p.realized)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {formatMoney(p.withPlanned)}
                        </td>
                      </tr>
                    ))
                  : history.map((m) => (
                      <tr key={m.month} className="border-t border-border/50">
                        <th scope="row" className="p-2 font-normal">
                          {m.label}
                        </th>
                        {[m.received, m.paid, m.receivable, m.payable].map(
                          (value, i) => (
                            <td key={i} className="p-2 whitespace-nowrap">
                              {formatMoney(value)}
                            </td>
                          )
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section
        aria-labelledby="financial-category-title"
        className="min-w-0 rounded-3xl border border-border/70 bg-card/60 p-4 sm:p-6"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">
          Cada escolha conta
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h2 id="financial-category-title" className="font-display text-2xl">
            Para onde vai
          </h2>
          <div
            className="flex rounded-lg bg-muted/60 p-1"
            role="group"
            aria-label="Situação das categorias"
          >
            {(['paid', 'open'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCategoryMode(mode)}
                aria-pressed={categoryMode === mode}
                className={cn(
                  'min-h-8 rounded-md px-2.5 text-xs',
                  categoryMode === mode
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                {mode === 'paid' ? 'Pago' : 'Em aberto'}
              </button>
            ))}
          </div>
        </div>
        {categories.length === 0 ? (
          <div className="mt-6">
            <EmptyChart
              text={
                categoryMode === 'paid'
                  ? 'Nenhuma despesa paga neste período.'
                  : 'Nenhuma despesa em aberto neste período.'
              }
            />
          </div>
        ) : (
          <>
            <div
              className="relative mx-auto mt-2 h-52 max-w-72"
              aria-label={`${categoryMode === 'paid' ? 'Despesas pagas' : 'Despesas em aberto'}: ${formatMoney(total)}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer>
                  <Pie
                    data={categories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={90}
                    paddingAngle={categories.length > 1 ? 3 : 0}
                    stroke="none"
                    isAnimationActive={animate}
                    animationDuration={550}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => formatMoney(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {categoryMode === 'paid' ? 'Total pago' : 'Em aberto'}
                </span>
                <strong className="mt-1 max-w-40 break-all text-center text-xl tabular-nums">
                  {formatMoney(total)}
                </strong>
              </div>
            </div>
            <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
              {categories.map((c) => (
                <button
                  key={c.name}
                  aria-label={`Ver lançamentos de ${c.name}`}
                  onClick={() => onCategory(c.name, categoryMode)}
                  className="group flex min-h-12 w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted/60"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.fill }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.name}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {Math.round((c.value / total) * 100)}%
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatMoney(c.value)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
