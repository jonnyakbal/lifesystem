import type { ReactNode } from 'react';
import { WorkspaceContinuations } from './workspace-continuations';

// Cabeçalho de 1 linha (decisão geral do polimento): título, ações e, logo
// abaixo, números compactos. O texto de apoio continua disponível para leitores
// de tela, mas sai da frente — a tela fala pelo conteúdo.
export function WorkspaceHeading({ eyebrow, title, description, actions, children, showContinuations = true }: {
  eyebrow: string; title: string; description: ReactNode; actions?: ReactNode; children?: ReactNode; showContinuations?: boolean;
}) {
  return <header className="work-heading">
    <div className="work-heading-row">
      <div className="min-w-0"><p className="sr-only">{eyebrow}</p><h1 className="font-display">{title}</h1><div className="sr-only">{description}</div></div>
      {showContinuations && <WorkspaceContinuations />}
      {actions && <div className="work-heading-actions flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {children && <div className="work-heading-summary">{children}</div>}
  </header>;
}

export function WorkspaceMetric({ label, value, detail, tone = 'default' }: { label: string; value: ReactNode; detail?: string; tone?: 'default' | 'primary' | 'warning' }) {
  return <div className={`work-metric work-metric-${tone}`} title={detail}><strong>{value}</strong><p>{label}</p></div>;
}
