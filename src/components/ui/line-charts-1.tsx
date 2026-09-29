'use client';

// Adapted from the user-supplied ReUI / Sean Hello “Line Charts 1” component:
// https://21st.dev/@sean0205/components/line-charts-1
// Uses existing theme tokens and Recharts 3 types; no replacement of shared UI primitives.
import * as React from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
  string,
  { label: string; color: string; dashed?: boolean }
>;
const ChartContext = React.createContext<ChartConfig>({});

export function ChartContainer({
  config,
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof ResponsiveContainer>['children'];
}) {
  return (
    <ChartContext.Provider value={config}>
      <div
        data-slot="chart"
        className={cn(
          'min-w-0 text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
          className
        )}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = Tooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter = String,
}: Partial<TooltipContentProps<number, string>> & {
  valueFormatter?: (value: number) => string;
}) {
  const config = React.useContext(ChartContext);
  if (!active || !payload?.length) return null;
  const visible = payload.filter(
    (item) =>
      String(item.dataKey) in config &&
      item.value !== undefined &&
      item.value !== null
  );
  return (
    <div className="min-w-48 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
      <p className="mb-3 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-2">
        {visible.map((item) => {
          const series = config[String(item.dataKey)];
          return (
            <div
              key={String(item.dataKey)}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <i
                  aria-hidden
                  className={cn(
                    'h-3 w-3 rounded-full border-[3px] bg-popover',
                    series.dashed && 'border-dashed'
                  )}
                  style={{ borderColor: series.color }}
                />
                {series.label}
              </span>
              <strong className="font-medium tabular-nums">
                {valueFormatter(Number(item.value))}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
