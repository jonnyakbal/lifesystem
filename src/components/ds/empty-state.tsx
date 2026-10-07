import type { ReactNode } from 'react';

// Empty, error and "nothing here yet" states always say what happened and
// offer the next step. Error tone is reserved for real failures.
export function EmptyState({ icon, title, children, action, tone = 'neutral' }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; tone?: 'neutral' | 'error' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center ${tone === 'error' ? 'border-critical/40 bg-critical/5' : ''}`}>
      {icon && <div className="mb-1 text-primary">{icon}</div>}
      <p className="text-base font-semibold">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
