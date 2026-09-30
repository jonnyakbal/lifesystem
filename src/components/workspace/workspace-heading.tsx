import type { ReactNode } from 'react';
import { Orbit } from 'lucide-react';
import { WorkspaceContinuations } from './workspace-continuations';

export function WorkspaceHeading({ eyebrow, title, description, actions, children, showContinuations = true }: {
  eyebrow: string; title: string; description: ReactNode; actions?: ReactNode; children?: ReactNode; showContinuations?: boolean;
}) {
  return <header className="work-heading">
    <div className="work-heading-orbit" aria-hidden="true"><span /><span /><i /></div>
    <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0"><p className="work-eyebrow"><Orbit className="h-3.5 w-3.5" />{eyebrow}</p><h1 className="font-display text-4xl tracking-tight sm:text-5xl">{title}</h1><div className="work-heading-description mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</div></div>
      {actions && <div className="work-heading-actions flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {showContinuations && <WorkspaceContinuations />}
    {children && <div className="work-heading-summary relative z-10 mt-6">{children}</div>}
  </header>;
}

export function WorkspaceMetric({ label, value, detail, tone = 'default' }: { label: string; value: ReactNode; detail?: string; tone?: 'default' | 'primary' | 'warning' }) {
  return <div className={`work-metric work-metric-${tone}`}><p>{label}</p><strong>{value}</strong>{detail && <span>{detail}</span>}</div>;
}
