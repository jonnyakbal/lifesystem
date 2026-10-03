// Agenda v2, phase A (docs/agenda-expansion-contracts.md §3): the read-only
// item every source is projected into. Nothing here writes, syncs or
// reserves time; Google events, extra blocks and mirrors are later phases.

export type AgendaItemKind = 'task_day' | 'task_block' | 'content_publication' | 'financial_due' | 'financial_paid';

export type AgendaTime =
  | { kind: 'day'; date: string; timeZone: string }
  | { kind: 'point'; at: string; timeZone: string }
  | { kind: 'interval'; startAt: string; endAt: string; timeZone: string };

export interface AgendaItemV2 {
  contractVersion: '2.0';
  id: string;
  kind: AgendaItemKind;
  entity: { type: 'task' | 'content' | 'financial'; id: string };
  sourceRevision: string;
  title: string;
  time: AgendaTime;
  /** The civil day the item is shown on, in the projection time zone. */
  day: string;
  managedBy: 'lifesystem';
  busy: boolean;
  /** 'fallback' marks a date inferred by a documented rule, never invented. */
  confidence: 'explicit' | 'fallback';
}

export interface AgendaFilters {
  tasks: boolean;
  content: boolean;
  financial: boolean;
  includePaid: boolean;
}

export const DEFAULT_AGENDA_FILTERS: AgendaFilters = { tasks: true, content: true, financial: true, includePaid: false };
