import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// One chip for every short label: status, priority, date, project, pillar.
// Tone carries meaning and is the same in every screen and theme; colour is
// never the only signal (the text always says it).
export type ChipTone = 'neutral' | 'action' | 'success' | 'warning' | 'danger' | 'agent' | 'info';

const tones: Record<ChipTone, string> = {
  neutral: 'border-border bg-muted/60 text-muted-foreground',
  action: 'border-primary/30 bg-primary/10 text-primary',
  success: 'border-money/30 bg-money/10 text-money',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  danger: 'border-critical/30 bg-critical/10 text-critical',
  agent: 'border-stellar/30 bg-stellar/10 text-stellar',
  info: 'border-qty/30 bg-qty/10 text-qty',
};

export function Chip({ tone = 'neutral', icon, children, className }: { tone?: ChipTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium leading-none', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
