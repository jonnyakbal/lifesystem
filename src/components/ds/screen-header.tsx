import type { ReactNode } from 'react';

// Operational screens: one compact band with title, context, the main action
// and (below) the screen's own controls. Expressive openings belong to the
// overview and onboarding, not to work screens.
export function ScreenHeader({ eyebrow, title, context, action, children }: { eyebrow?: string; title: string; context?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 border-b pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>}
          <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h1>
          {context && <p className="mt-1 text-sm text-muted-foreground">{context}</p>}
        </div>
        {action}
      </div>
      {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
