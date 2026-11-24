'use client';

import { useId, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  type DotItemDotProps,
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
import { ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/line-charts-1';
import { cn } from '@/lib/utils';
import { type FinancialEntry } from '@/lib/finance-model';
import { effectiveFinancialDate, financialEntriesForRange, summarizeFinancialEntries, type FinancialRange } from '@/lib/financial-period';
import {
  financialCategoryBreakdown,
  financialFlowSeries,
  financialTrend,
  formatMoney,
  shortFinancialDate,
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
const chartDate = (day: string) => Date.parse(day + 'T00:00:00Z');
const timeLabel = (milliseconds: number) => Number.isFinite(milliseconds)
  ? shortFinancialDate(new Date(milliseconds).toISOString().slice(0, 10))
  : '';
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
  onDate,
  onMonth,
}: {
  entries: FinancialEntry[];
  range: FinancialRange;
  selectedMonth: string;
  onCategory: (category: string, status: 'paid' | 'open') => void;
  onDate: (day: string) => void;
  onMonth: (month: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const fillId = useId().replaceAll(':', '');
  const [categoryMode, setCategoryMode] = useState<'paid' | 'open'>('paid');
  const [view, setView] = useState<'flow' | 'history'>('flow');
  const [showPlanned, setShowPlanned] = useState(true);
  const [selectedDay, setSelectedDay] = useState('');
  const points = useMemo(
    () => financialFlowSeries(entries, range).map(point => ({ ...point, time: chartDate(point.date) })),
    [entries, range]
  );
  const history = useMemo(
    () => financialTrend(entries, selectedMonth),
    [entries, selectedMonth]
  );
  const periodEntries = useMemo(
    () => financialEntriesForRange(entries, range),
    [entries, range]
  );
  const byDay = useMemo(() => {
    const grouped = new Map<string, FinancialEntry[]>();
    for (const entry of periodEntries) {
      const key = effectiveFinancialDate(entry);
      const items = grouped.get(key);
      if (items) items.push(entry);
      else grouped.set(key, [entry]);
    }
    return grouped;
  }, [periodEntries]);
  const movementDays = [...byDay.keys()].sort();
  const inspectedDate = byDay.has(selectedDay) ? selectedDay : movementDays.at(-1);
  const inspected = inspectedDate ? summarizeFinancialEntries(byDay.get(inspectedDate) ?? []) : null;
  const timeDomain: [number | 'dataMin', number | 'dataMax'] = points.length === 1
    ? [points[0].time - 86_400_000, points[0].time + 86_400_000]
    : ['dataMin', 'dataMax'];
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

  function renderPoint({ cx, cy, index }: DotItemDotProps, color: string) {
    const day = points[index]?.date;
    if (cx == null || cy == null || !day) return null;
    const selectable = byDay.has(day);
    return (
      <g data-chart-day={day} className={selectable ? 'cursor-pointer' : undefined}
        onClick={selectable ? () => setSelectedDay(day) : undefined}>
        {selectable && <circle cx={cx} cy={cy} r={10} fill="transparent" />}
        <circle cx={cx} cy={cy} r={inspectedDate === day ? 5 : 3.5}
          stroke={color} strokeWidth={2} fill="var(--color-card)" />
      </g>
    );
  }

  function openHistoryMonth(index: number) {
    const month = history[index];
    if (month) onMonth(month.month);
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <section
        aria-labelledby="financial-flow-title"
        className="min-w-0 rounded-3xl border border-border/70 bg-card/60 p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              id="financial-flow-title"
              className="font-display text-2xl"
            >
              {view === 'flow'
                ? 'Evolução do resultado'
                : 'Entradas e saídas por mês'}
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
            ? 'Entradas menos saídas acumuladas no período, a partir de zero. Selecione um ponto para ver o dia.'
            : 'Selecione uma barra ou um mês para abrir o resumo. As previsões aparecem em tom suave.'}
        </p>
        <div className="my-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            <LegendDot color="var(--color-money)">
              {view === 'flow' ? 'Realizado' : 'Recebido'}
            </LegendDot>
            {(view === 'history' || showPlanned) && <LegendDot
              color={
                view === 'flow'
                  ? 'var(--color-primary)'
                  : 'var(--color-critical)'
              }
              dashed={view === 'flow'}
            >
              {view === 'flow' ? 'Com previsões' : 'Pago'}
            </LegendDot>}
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
            className="h-[234px] min-w-0 cursor-crosshair sm:h-[278px]"
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
                    dataKey="time"
                    type="number"
                    scale="time"
                    domain={timeDomain}
                    tickFormatter={timeLabel}
                    tickCount={5}
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
                      <ChartTooltipContent valueFormatter={formatMoney} formatLabel={value => timeLabel(Number(value))} />
                    }
                    cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="var(--color-muted-foreground)"
                    strokeOpacity={0.4}
                  />
                  {inspectedDate && (
                    <ReferenceLine x={chartDate(inspectedDate)} stroke="var(--color-primary)" strokeDasharray="3 4" strokeOpacity={0.55} />
                  )}
                  <Area
                    name="Realizado"
                    type="stepAfter"
                    dataKey="realized"
                    stroke="var(--color-money)"
                    fill={`url(#${fillId})`}
                    strokeWidth={2.5}
                    dot={point => renderPoint(point, 'var(--color-money)')}
                    activeDot={false}
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
                      dot={point => renderPoint(point, 'var(--color-primary)')}
                      activeDot={false}
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
                    onClick={(_, index) => openHistoryMonth(index)}
                    className="cursor-pointer"
                    dataKey="received"
                    stackId="income"
                    fill="var(--color-money)"
                    maxBarSize={28}
                    isAnimationActive={animate}
                  />
                  {showPlanned && (
                    <Bar
                      name="A receber"
                      onClick={(_, index) => openHistoryMonth(index)}
                      className="cursor-pointer"
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
                    onClick={(_, index) => openHistoryMonth(index)}
                    className="cursor-pointer"
                    dataKey="paid"
                    stackId="expense"
                    fill="var(--color-critical)"
                    maxBarSize={28}
                    isAnimationActive={animate}
                  />
                  {showPlanned && (
                    <Bar
                      name="A pagar"
                      onClick={(_, index) => openHistoryMonth(index)}
                      className="cursor-pointer"
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
        {view === 'flow' && inspected && inspectedDate && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/25 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground" htmlFor="financial-chart-day">
                <CalendarDays aria-hidden className="size-3.5" /> Dia no gráfico
              </label>
              <select id="financial-chart-day" value={inspectedDate} onChange={event => setSelectedDay(event.target.value)}
                className="min-h-9 max-w-full rounded-lg border border-border bg-card px-2 text-sm">
                {movementDays.map(day => <option key={day} value={day}>{shortFinancialDate(day)} · {day.slice(0, 4)}</option>)}
              </select>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4" aria-live="polite">
              <div><p className="text-muted-foreground">Recebido</p><strong className="mt-1 block break-words tabular-nums">{formatMoney(inspected.realized.income)}</strong></div>
              <div><p className="text-muted-foreground">Pago</p><strong className="mt-1 block break-words tabular-nums">{formatMoney(inspected.realized.expenses)}</strong></div>
              {showPlanned && <>
                <div><p className="text-muted-foreground">A receber</p><strong className="mt-1 block break-words tabular-nums">{formatMoney(inspected.projected.income)}</strong></div>
                <div><p className="text-muted-foreground">A pagar</p><strong className="mt-1 block break-words tabular-nums">{formatMoney(inspected.projected.expenses)}</strong></div>
              </>}
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-2 -ml-2 max-w-full text-primary" onClick={() => onDate(inspectedDate)}>
              Ver lançamentos do dia <span className="text-xs text-muted-foreground">({inspected.entries})</span>
              <ArrowRight aria-hidden className="size-3.5" />
            </Button>
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
                aria-pressed={m.month === selectedMonth}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="financial-category-title" className="font-display text-2xl">
            Despesas por categoria
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
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const category = categories[index];
                      if (category) onCategory(category.name, categoryMode);
                    }}
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
