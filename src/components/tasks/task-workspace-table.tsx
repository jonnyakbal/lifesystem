'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, CalendarDays, CheckCircle2, Circle, MoreHorizontal, Pencil, Copy, Trash2, ListChecks, Columns3, Loader2, StickyNote, ArrowRight, Hourglass } from 'lucide-react';
import type { StageDef, TaskPlanning } from '@/types';
import { cn, todayStr } from '@/lib/utils';
import { isTaskCompleted } from '@/lib/task-stages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { TaskStructureSummary } from './task-structure-summary';

export interface TaskListRecord {
  id: string; title: string; status: string; priority: 'normal' | 'important' | 'urgent';
  dueDate?: string; projectId?: string; pillarId?: string; completedAt?: string; planning?: TaskPlanning;
  description?: string; nextAction?: string; responsible?: string; tags?: string[]; waitingFor?: string | null;
  checklist?: { id: string; text: string; done: boolean }[];
  parentId?: string; dependsOnIds?: string[]; estimatedMinutes?: number;
}
export type TaskCellPatch = { priority?: TaskListRecord['priority']; status?: string; dueDate?: string | null; projectId?: string; checklist?: NonNullable<TaskListRecord['checklist']> };
interface TaskGroup { id: string; label: string; dot: string; items: TaskListRecord[] }
interface Props {
  allTasks?: TaskListRecord[];
  groups: TaskGroup[]; stages: StageDef[]; projects: { id: string; name: string }[];
  selectedIds: Set<string>; busyIds: Set<string>; dense: boolean;
  onSelect: (id: string) => void; onSelectVisible: (ids: string[], selected: boolean) => void;
  onOpen: (id: string) => void; onComplete: (id: string) => void;
  onPatch: (id: string, patch: TaskCellPatch) => Promise<boolean>;
  onDuplicate: (id: string) => void; onDelete: (id: string) => void;
  hideStatus?: boolean;
}
const columns = [ ['project', 'Projeto'], ['date', 'Prazo'], ['priority', 'Prioridade'], ['status', 'Status'], ['checklist', 'Checklist'] ] as const;

export function DeadlineCell({ task, busy, completed, onPatch }: { task: TaskListRecord; busy: boolean; completed: boolean; onPatch: Props['onPatch'] }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(task.dueDate || '');
  const [saving, setSaving] = useState(false);
  const locked = Boolean(task.planning?.startAt);
  const overdue = Boolean(task.dueDate && task.dueDate < todayStr() && !completed);
  async function save(next: string | null) {
    if (saving) return;
    setSaving(true);
    try { if (await onPatch(task.id, { dueDate: next })) setOpen(false); }
    finally { setSaving(false); }
  }
  return <Popover open={open} onOpenChange={value => { if (saving) return; if (value) setDate(task.dueDate || ''); setOpen(value); }}>
    <PopoverTrigger asChild><button type="button" className={cn('task-cell-date', overdue && 'task-overdue')} disabled={busy} aria-label={`Prazo de ${task.title}`}><CalendarDays className="h-3.5 w-3.5" />{task.dueDate ? new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Sem prazo'}{locked && <span className="task-plan-mark">Bloco</span>}</button></PopoverTrigger>
    <PopoverContent className="w-[min(300px,calc(100vw-32px))] space-y-3" align="start">
      {locked ? <><p className="text-sm font-medium">Prazo ligado ao bloco de horário</p><p className="text-xs leading-relaxed text-muted-foreground">Mova o bloco para atualizar o prazo e manter a agenda sincronizada.</p><Button asChild variant="outline" className="w-full"><Link href="/planejar">Replanejar bloco</Link></Button></> : <>
        <Label htmlFor={`deadline-${task.id}`}>Novo prazo</Label>
        <Input id={`deadline-${task.id}`} type="date" value={date} disabled={saving} onChange={event => setDate(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && date) void save(date); }} />
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => setDate(todayStr())}>Hoje</Button><Button size="sm" variant="outline" disabled={saving} onClick={() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); setDate(todayStr(tomorrow)); }}>Amanhã</Button></div>
        <div className="flex justify-between gap-2"><Button variant="ghost" disabled={saving || !task.dueDate} onClick={() => void save(null)}>Remover prazo</Button><Button disabled={!date || saving} onClick={() => void save(date)}>{saving ? 'Salvando…' : 'Salvar prazo'}</Button></div>
      </>}
    </PopoverContent>
  </Popover>;
}

export function TaskWorkspaceTable(props: Props) {
  const { groups, stages, projects, selectedIds, busyIds, dense, onSelect, onSelectVisible, onOpen, onComplete, onPatch, onDuplicate, onDelete } = props;
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [hiddenColumns, setHiddenColumns] = useState(new Set<string>());
  const visibleIds = groups.filter(group => !collapsed.has(group.id)).flatMap(group => group.items.map(task => task.id));
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const hasChecklists = groups.some(group => group.items.some(task => task.checklist?.length));
  // Agrupado por status, a coluna Status só repetiria o grupo; checklist vazio em tudo é coluna morta.
  const available = columns.filter(([id]) => !(id === 'status' && props.hideStatus) && !(id === 'checklist' && !hasChecklists));
  const shown = available.filter(([id]) => !hiddenColumns.has(id));
  const show = (id: string) => shown.some(([column]) => column === id);
  const columnCount = 3 + shown.length;
  function toggleGroup(group: TaskGroup) {
    const next = new Set(collapsed);
    if (next.has(group.id)) next.delete(group.id);
    else { next.add(group.id); onSelectVisible(group.items.map(task => task.id), false); }
    setCollapsed(next);
  }
  return <div className={cn('task-list-surface', dense && 'task-list-dense', selectedIds.size > 0 && 'has-selection')}>
    <table className="task-workspace-table" aria-label="Lista de tarefas">
      <thead><tr>
        <th className="task-select-cell"><label className="task-selection-target"><input type="checkbox" aria-label="Selecionar tarefas visíveis" checked={allSelected} disabled={!visibleIds.length || busyIds.size > 0} onChange={event => onSelectVisible(visibleIds, event.target.checked)} /></label></th>
        <th className="task-title-cell">Tarefa</th>
        {shown.map(([id, label]) => <th key={id}>{label}</th>)}
        <th className="task-action-cell"><Popover><PopoverTrigger asChild><button type="button" className="task-columns-button" aria-label="Colunas da lista" title="Colunas"><Columns3 className="h-4 w-4" /></button></PopoverTrigger><PopoverContent align="end" className="w-56"><p className="mb-2 text-sm font-medium">Mostrar na lista</p>{available.map(([id, label]) => <label key={id} className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={!hiddenColumns.has(id)} onChange={() => { const next = new Set(hiddenColumns); if (next.has(id)) next.delete(id); else next.add(id); setHiddenColumns(next); }} />{label}</label>)}</PopoverContent></Popover></th>
      </tr></thead>
      <tbody>{groups.filter(group => group.items.length > 0).map(group => <Fragment key={group.id}>
        <tr className="task-group-row"><th colSpan={columnCount}><button type="button" aria-expanded={!collapsed.has(group.id)} aria-label={`${collapsed.has(group.id) ? 'Expandir' : 'Recolher'} grupo ${group.label} (${group.items.length})`} onClick={() => toggleGroup(group)}>{collapsed.has(group.id) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}<span className={cn('h-2 w-2 rounded-full', group.dot)} /><span>{group.label}</span><span className="task-group-count">{group.items.length}</span></button></th></tr>
        {!collapsed.has(group.id) && group.items.map(task => {
          const done = isTaskCompleted(task, stages); const busy = busyIds.has(task.id);
          const tags = task.tags ?? [];
          const checks = task.checklist ?? [];
          return <tr key={task.id} data-testid={`task-row-${task.id}`} className={cn('task-data-row', selectedIds.has(task.id) && 'task-row-selected', done && 'task-row-completed')}>
            <td className="task-select-cell"><label className="task-selection-target"><input type="checkbox" aria-label={`Selecionar ${task.title}`} checked={selectedIds.has(task.id)} disabled={busy} onChange={() => onSelect(task.id)} /></label></td>
            <td className="task-title-cell"><div className="task-row-main">
              <button type="button" className="task-row-check" aria-label={`${done ? 'Reabrir' : 'Concluir'} ${task.title}`} title={done ? 'Reabrir' : 'Concluir'} disabled={busy} onClick={() => onComplete(task.id)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <Circle className="h-[18px] w-[18px]" />}</button>
              <button type="button" className="task-row-title" disabled={busy} onClick={() => onOpen(task.id)}>{task.title}</button>
              {task.waitingFor && <span className="task-waiting" title={`Aguardando ${task.waitingFor}`}><Hourglass className="h-3 w-3" />{task.waitingFor}</span>}
              {(task.description || task.nextAction) && <StickyNote className="task-row-note h-3.5 w-3.5" aria-label="Tem anotações" />}
              {!dense && tags.slice(0, 2).map(tag => <span key={tag} className="task-row-tag">{tag}</span>)}
              {!dense && tags.length > 2 && <span className="task-row-tag">+{tags.length - 2}</span>}
              {task.completedAt && <span className="task-completed-date">{new Date(task.completedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
            </div><TaskStructureSummary task={task} tasks={props.allTasks || groups.flatMap(group => group.items)} stages={stages} onOpen={onOpen} /></td>
            {show('project') && <td data-label="Projeto"><select aria-label={`Projeto de ${task.title}`} className={cn('task-cell-select task-project-select', !task.projectId && 'is-empty')} value={task.projectId || ''} disabled={busy} onChange={event => void onPatch(task.id, { projectId: event.target.value })}><option value="">Sem projeto</option>{task.projectId && !projects.some(project => project.id === task.projectId) && <option value={task.projectId}>Projeto indisponível</option>}{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></td>}
            {show('date') && <td data-label="Prazo"><DeadlineCell task={task} busy={busy} completed={done} onPatch={onPatch} /></td>}
            {show('priority') && <td data-label="Prioridade"><select aria-label={`Prioridade de ${task.title}`} className={cn('task-cell-select', `task-priority-${task.priority}`, task.priority === 'normal' && 'is-empty')} value={task.priority} disabled={busy} onChange={event => void onPatch(task.id, { priority: event.target.value as TaskListRecord['priority'] })}><option value="normal">Normal</option><option value="important">Importante</option><option value="urgent">Urgente</option></select></td>}
            {show('status') && <td data-label="Status"><select aria-label={`Status de ${task.title}`} className="task-cell-select" value={task.status} disabled={busy} onChange={event => void onPatch(task.id, { status: event.target.value })}>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></td>}
            {show('checklist') && <td data-label="Checklist">{checks.length > 0 && <button type="button" className="task-cell-checklist" aria-label={`Checklist de ${task.title}`} disabled={busy} onClick={() => onOpen(task.id)}><ListChecks className="h-3.5 w-3.5" />{checks.filter(item => item.done).length}/{checks.length}</button>}</td>}
            <td className="task-action-cell"><div className="task-row-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="task-row-more" aria-label={`Mais ações para ${task.title}`} disabled={busy}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onOpen(task.id)}><Pencil className="h-4 w-4" />Abrir detalhes</DropdownMenuItem><DropdownMenuItem disabled={busy} onClick={() => onComplete(task.id)}>{done ? 'Reabrir' : 'Concluir'}</DropdownMenuItem><DropdownMenuItem disabled={busy} onClick={() => onDuplicate(task.id)}><Copy className="h-4 w-4" />Duplicar</DropdownMenuItem><DropdownMenuSeparator />{stages.filter(stage => stage.id !== task.status).map(stage => <DropdownMenuItem key={stage.id} disabled={busy} onClick={() => void onPatch(task.id, { status: stage.id })}><ArrowRight className="h-4 w-4" />Mover para {stage.label}</DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuItem disabled={busy} onClick={() => onDelete(task.id)} className="text-destructive"><Trash2 className="h-4 w-4" />Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></td>
          </tr>;
        })}
      </Fragment>)}</tbody>
    </table>
  </div>;
}
