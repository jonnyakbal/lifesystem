'use client';

import { useState } from 'react';
import { GitBranch, Link2, Timer, ArrowUpRight } from 'lucide-react';
import type { StageDef } from '@/types';
import { isTaskCompleted } from '@/lib/task-stages';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface LinkedTask { id: string; title: string; status: string; completedAt?: string; parentId?: string }
interface Props {
  taskId?: string; tasks: LinkedTask[]; stages: StageDef[];
  parentId: string; onParent: (id: string) => void;
  dependencies: string[]; onDependencies: (ids: string[]) => void;
  estimate: string; onEstimate: (value: string) => void; onOpen: (id: string) => void;
}
export function TaskRelationships(props: Props) {
  const [search, setSearch] = useState('');
  const available = props.tasks.filter(task => task.id !== props.taskId);
  const children = props.tasks.filter(task => task.parentId === props.taskId && props.taskId);
  const pending = props.dependencies.filter(id => { const task = available.find(item => item.id === id); return !task || !isTaskCompleted(task, props.stages); });
  return <section aria-label="Estrutura e esforço" className="rounded-xl border border-border bg-muted/20 p-4 grid gap-4">
    <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Estrutura e esforço</h3></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2"><Label htmlFor="task-parent">Tarefa principal</Label><select id="task-parent" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={props.parentId} onChange={event => props.onParent(event.target.value)}><option value="">Independente</option>{available.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></div>
      <div className="grid gap-2"><Label htmlFor="task-estimate" className="flex items-center gap-2"><Timer className="h-3.5 w-3.5" />Esforço previsto · minutos</Label><Input id="task-estimate" type="number" min={1} max={10080} step={1} value={props.estimate} onChange={event => props.onEstimate(event.target.value)} placeholder="Sem estimativa" /></div>
    </div>
    {children.length > 0 && <div><p className="mb-2 text-xs text-muted-foreground">Subtarefas · {children.filter(task => isTaskCompleted(task, props.stages)).length}/{children.length} concluídas</p><div className="grid gap-1">{children.map(task => <button key={task.id} type="button" className="flex items-center gap-2 text-left text-sm rounded-md border px-3 py-2 hover:bg-muted" onClick={() => props.onOpen(task.id)}>{isTaskCompleted(task, props.stages) ? '✓' : '○'}<span className="flex-1">{task.title}</span><ArrowUpRight className="h-3 w-3" /></button>)}</div></div>}
    <div className="grid gap-2"><Label htmlFor="task-dependency-search" className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" />Depende de</Label><Input id="task-dependency-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar tarefas para vincular" />
      <div className="max-h-36 overflow-y-auto rounded-md border p-2">{available.filter(task => props.dependencies.includes(task.id) || task.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(task => <label key={task.id} className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted"><input type="checkbox" checked={props.dependencies.includes(task.id)} onChange={event => props.onDependencies(event.target.checked ? [...props.dependencies, task.id] : props.dependencies.filter(id => id !== task.id))} /><span className="flex-1">{task.title}</span><small className="text-muted-foreground">{isTaskCompleted(task, props.stages) ? 'Concluída' : 'Em aberto'}</small></label>)}{available.length === 0 && <p className="text-xs text-muted-foreground">Crie outra tarefa para vincular.</p>}</div>
      {props.dependencies.filter(id => !available.some(task => task.id === id)).map(id => <button key={id} type="button" className="text-xs text-destructive text-left" onClick={() => props.onDependencies(props.dependencies.filter(item => item !== id))}>Remover vínculo indisponível</button>)}
      <p className="text-xs text-muted-foreground">{pending.length ? `${pending.length} dependências em aberto impedem a conclusão.` : 'Sem bloqueios por dependências.'} O esforço não reserva horário. Subtarefas têm prazo e status próprios.</p>
    </div>
  </section>;
}
