// Item 8 of the queue: Jonny wants to rename the status labels shown in
// Tarefas/Projetos/Conteúdo without touching the underlying kanban logic —
// explicitly NOT a full CRUD (add/remove columns), just relabeling. The
// internal status values ('todo', 'active', 'idea', ...) stay fixed in
// TypeScript; only the display text is overridable, and only client-side —
// these are cosmetic labels, not data that needs to sync across devices,
// so localStorage is enough and avoids turning a fixed union type into a
// database-backed list (that redesign was explicitly ruled out as too much
// risk when this was scoped).
export type StatusLabelScope = 'tasks' | 'projects' | 'content';

function storageKey(scope: StatusLabelScope): string {
  return `lifesystem-status-labels-${scope}`;
}

export function loadStatusLabelOverrides(scope: StatusLabelScope): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey(scope)) || '{}');
  } catch {
    return {};
  }
}

export function saveStatusLabelOverrides(scope: StatusLabelScope, overrides: Record<string, string>): void {
  localStorage.setItem(storageKey(scope), JSON.stringify(overrides));
}
