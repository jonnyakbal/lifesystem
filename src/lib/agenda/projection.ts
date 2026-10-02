import type { AgendaFilters, AgendaItemV2 } from './schemas';
import { DEFAULT_AGENDA_FILTERS } from './schemas';

// Pure projection for agenda v2 phase A. Rules mirror the existing domains:
// - a task's planned day is its dueDate; its primary block is the legacy
//   `planning` interval, identified as legacy-task-block:<taskId>;
// - content publishes on scheduledDate (point when a valid time exists,
//   otherwise the day); archived content is hidden; it never reserves time;
// - finance follows effectiveFinancialDate: pending/overdue use
//   dueDate || date (the fallback is labelled), paid uses paidDate || date;
//   one entry is never shown both as due and as paid; nothing is busy.

type TaskSource = { id: string; title: string; dueDate?: string | null; updatedAt: string; completedAt?: string | null; planning?: { date: string | null; startAt?: string; endAt?: string; timeZone: string } | null };
type ContentSource = { id: string; title: string; status?: string; scheduledDate?: string; scheduledTime?: string; updatedAt: string };
type FinancialSource = { id: string; description?: string; category: string; status?: string; date: string; dueDate?: string | null; paidDate?: string | null; updatedAt: string };

const civilDate = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !civilDate.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};
const validTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const inRange = (day: string, from: string, to: string) => day >= from && day <= to;

export function projectAgenda(input: {
  from: string;
  to: string;
  timeZone: string;
  tasks?: TaskSource[];
  content?: ContentSource[];
  financial?: FinancialSource[];
  filters?: Partial<AgendaFilters>;
}): AgendaItemV2[] {
  const filters = { ...DEFAULT_AGENDA_FILTERS, ...input.filters };
  const { from, to, timeZone } = input;
  const items: AgendaItemV2[] = [];
  const base = { contractVersion: '2.0' as const, managedBy: 'lifesystem' as const };

  if (filters.tasks) for (const task of input.tasks || []) {
    if (task.completedAt) continue;
    const day = task.dueDate || task.planning?.date || null;
    if (!validDate(day) || !inRange(day, from, to)) continue;
    const start = task.planning?.startAt;
    const end = task.planning?.endAt;
    if (start && end) {
      items.push({ ...base, id: `legacy-task-block:${task.id}`, kind: 'task_block', entity: { type: 'task', id: task.id }, sourceRevision: task.updatedAt, title: task.title, time: { kind: 'interval', startAt: start, endAt: end, timeZone: task.planning?.timeZone || timeZone }, day, busy: true, confidence: 'explicit' });
    } else {
      items.push({ ...base, id: `task-day:${task.id}`, kind: 'task_day', entity: { type: 'task', id: task.id }, sourceRevision: task.updatedAt, title: task.title, time: { kind: 'day', date: day, timeZone }, day, busy: false, confidence: 'explicit' });
    }
  }

  if (filters.content) for (const item of input.content || []) {
    if (item.status === 'archived' || !validDate(item.scheduledDate) || !inRange(item.scheduledDate, from, to)) continue;
    // A local time without a stored zone is shown in the user's zone and
    // marked as fallback; no end time is invented for a publication.
    const timed = validTime(item.scheduledTime);
    items.push({ ...base, id: `content_publication:${item.id}`, kind: 'content_publication', entity: { type: 'content', id: item.id }, sourceRevision: item.updatedAt, title: item.title,
      time: timed ? { kind: 'point', at: `${item.scheduledDate}T${item.scheduledTime}`, timeZone } : { kind: 'day', date: item.scheduledDate, timeZone },
      day: item.scheduledDate, busy: false, confidence: timed ? 'fallback' : 'explicit' });
  }

  if (filters.financial) for (const entry of input.financial || []) {
    const paid = entry.status === 'paid';
    if (paid && !filters.includePaid) continue;
    const explicit = paid ? entry.paidDate : entry.dueDate;
    const day = explicit || entry.date;
    if (!validDate(day) || !inRange(day, from, to)) continue;
    items.push({ ...base, id: `${paid ? 'financial_paid' : 'financial_due'}:${entry.id}`, kind: paid ? 'financial_paid' : 'financial_due', entity: { type: 'financial', id: entry.id }, sourceRevision: entry.updatedAt, title: entry.description || entry.category,
      time: { kind: 'day', date: day, timeZone }, day, busy: false, confidence: explicit ? 'explicit' : 'fallback' });
  }

  return items.sort((a, b) => a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}
