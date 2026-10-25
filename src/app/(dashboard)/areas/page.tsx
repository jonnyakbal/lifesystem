'use client';

// Áreas (PARA): cada pilar é uma responsabilidade contínua. A página junta o
// que já existe espalhado — tarefas, projetos, metas e editais do pilar — sem
// criar dados novos. Pilares continuam editáveis em Visão → Pilares.
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Hourglass, Target, Award, Settings2 } from 'lucide-react';
import { apiFetch, showError } from '@/lib/api';
import { cn, todayStr } from '@/lib/utils';
import { isTaskCompleted, resolveTaskStages } from '@/lib/task-stages';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import type { StageDef } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface Pillar { id: string; name: string; description?: string; icon?: string; color?: string; sortOrder?: number; target?: string }
interface Task { id: string; title: string; status: string; priority: 'urgent' | 'important' | 'normal'; dueDate?: string; pillarId?: string; projectId?: string; waitingFor?: string | null; completedAt?: string }
interface Project { id: string; name: string; status: string }
interface Indicator { id: string; pillarId: string; name: string; targetValue?: number; currentValue?: number; frequency: string }
interface Edital { id: string; title: string; stage?: string; pillarId?: string; deadline?: string }

const rank = { urgent: 0, important: 1, normal: 2 } as const;

function AreasWorkspace() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [editais, setEditais] = useState<Edital[]>([]);
  const [configuredStages, setStages] = useState<StageDef[]>(DEFAULT_STAGES.tasks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<Pillar[]>('/api/pillars'),
      apiFetch<Task[]>('/api/tasks'),
      apiFetch<Project[]>('/api/projects').catch(() => [] as Project[]),
      apiFetch<Indicator[]>('/api/indicators').catch(() => [] as Indicator[]),
      apiFetch<Edital[]>('/api/editais').catch(() => [] as Edital[]),
      apiFetch<{ stages: StageDef[] }>('/api/stage-configs/tasks').catch(() => ({ stages: DEFAULT_STAGES.tasks })),
    ]).then(([p, t, pr, i, e, config]) => {
      if (!active) return;
      setPillars([...p].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))); setTasks(t); setProjects(pr); setIndicators(i); setEditais(e); setStages(config.stages || DEFAULT_STAGES.tasks);
    }).catch(err => { if (active) setError(showError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const stages = useMemo(() => resolveTaskStages(configuredStages, tasks), [configuredStages, tasks]);
  const today = todayStr();
  function areaData(pillarId: string) {
    const all = tasks.filter(task => task.pillarId === pillarId);
    const open = all.filter(task => !isTaskCompleted(task, stages));
    const next = open.filter(task => !task.waitingFor).sort((a, b) => rank[a.priority] - rank[b.priority] || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
    const projectIds = [...new Set(all.map(task => task.projectId).filter(Boolean))] as string[];
    return {
      open, next, waiting: open.filter(task => task.waitingFor),
      overdue: open.filter(task => task.dueDate && task.dueDate < today).length,
      doneWeek: all.filter(task => task.completedAt && Date.now() - new Date(task.completedAt).getTime() < 7 * 86400000).length,
      projects: projects.filter(project => projectIds.includes(project.id)),
      metas: indicators.filter(item => item.pillarId === pillarId),
      editais: editais.filter(item => item.pillarId === pillarId),
    };
  }

  if (loading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>;
  if (error) return <p role="alert" className="text-sm text-destructive">Não foi possível carregar as áreas. {error}</p>;

  const pillar = selectedId ? pillars.find(item => item.id === selectedId) : undefined;
  if (pillar) {
    const data = areaData(pillar.id);
    return <>
      <header className="today-head">
        <div><Link href="/areas" className="today-date inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Áreas</Link><h1 className="font-display">{pillar.icon} {pillar.name}</h1></div>
        <Button asChild variant="ghost" size="sm" className="ml-auto"><Link href="/visao?tab=pilares"><Settings2 className="h-4 w-4" />Editar pilar</Link></Button>
      </header>
      {pillar.description && <p className="area-lead">{pillar.description}</p>}
      <div className="area-grid">
        <section className="today-card" aria-label="Próximas ações da área">
          <h2 className="today-label">Próximas ações · {data.next.length}</h2>
          {data.next.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma ação aberta nesta área. Ela está em dia ou parada?</p> : data.next.slice(0, 12).map(task =>
            <Link key={task.id} href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="today-side-row"><Circle className="h-4 w-4 text-muted-foreground" /><span>{task.title}</span>{task.dueDate && <small className={cn(task.dueDate < today && 'is-late')}>{new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</small>}</Link>)}
          {data.waiting.length > 0 && <>
            <h2 className="today-label mt-4">Aguardando · {data.waiting.length}</h2>
            {data.waiting.map(task => <Link key={task.id} href={`/tarefas?open=${encodeURIComponent(task.id)}`} className="today-side-row"><Hourglass className="h-4 w-4 text-amber-400" /><span>{task.title}</span><small>{task.waitingFor}</small></Link>)}
          </>}
        </section>
        <div className="flex flex-col gap-4">
          <section className="today-card" aria-label="Projetos da área">
            <h2 className="today-label">Projetos · {data.projects.length}</h2>
            {data.projects.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum projeto com tarefas nesta área.</p> : data.projects.map(project => <Link key={project.id} href="/projetos" className="today-side-row"><ArrowRight className="h-4 w-4 text-primary" /><span>{project.name}</span></Link>)}
          </section>
          <section className="today-card" aria-label="Metas da área">
            <h2 className="today-label"><Target className="h-4 w-4" />Metas · {data.metas.length}</h2>
            {data.metas.length === 0 ? <Link href="/indicadores" className="text-sm text-primary hover:underline">Criar uma meta para esta área</Link> : data.metas.map(meta => {
              const pct = meta.targetValue ? Math.min(100, Math.round((meta.currentValue || 0) / meta.targetValue * 100)) : null;
              return <div key={meta.id} className="area-meta"><div className="flex justify-between gap-2 text-sm"><span className="truncate">{meta.name}</span><span className="font-mono-num text-xs text-muted-foreground">{meta.currentValue || 0}{meta.targetValue ? `/${meta.targetValue}` : ''}</span></div>{pct !== null && <div className="project-card-bar mt-1.5"><i style={{ width: `${pct}%` }} /></div>}</div>;
            })}
          </section>
          {data.editais.length > 0 && <section className="today-card" aria-label="Editais da área">
            <h2 className="today-label"><Award className="h-4 w-4" />Editais · {data.editais.length}</h2>
            {data.editais.map(item => <Link key={item.id} href="/editais" className="today-side-row"><Award className="h-4 w-4 text-primary" /><span>{item.title}</span></Link>)}
          </section>}
        </div>
      </div>
    </>;
  }

  return <>
    <header className="today-head">
      <div><p className="today-date">Responsabilidades que não terminam</p><h1 className="font-display">Áreas</h1></div>
      <Button asChild variant="ghost" size="sm" className="ml-auto"><Link href="/visao?tab=pilares"><Settings2 className="h-4 w-4" />Editar pilares</Link></Button>
    </header>
    {pillars.length === 0 ? <div className="today-clear"><Target className="h-8 w-8" /><h2>Nenhuma área ainda</h2><p>Crie seus pilares em Visão → Pilares; cada um vira uma área aqui.</p><Link href="/visao?tab=pilares" className="work-action-link">Criar pilares<ArrowRight className="h-4 w-4" /></Link></div> :
      <div className="area-list">{pillars.map(item => {
        const data = areaData(item.id);
        const metasDone = data.metas.filter(meta => (meta.currentValue || 0) >= (meta.targetValue || 1)).length;
        const quiet = data.next.length === 0 && data.doneWeek === 0;
        return <Link key={item.id} href={`/areas?id=${encodeURIComponent(item.id)}`} className={cn('area-card', quiet && 'is-quiet')} aria-label={`Abrir área ${item.name}`}>
          <div className="area-card-top"><span className="area-icon">{item.icon}</span><strong>{item.name}</strong>{data.overdue > 0 && <span className="area-alert">{data.overdue} atrasada{data.overdue > 1 ? 's' : ''}</span>}</div>
          <p className="area-next">{data.next[0] ? <><span className="area-next-label">Próxima:</span> {data.next[0].title}</> : <span className="area-next-empty">Sem próxima ação</span>}</p>
          <div className="area-stats">
            <span><Circle className="h-3.5 w-3.5" />{data.open.length} abertas</span>
            <span><CheckCircle2 className="h-3.5 w-3.5" />{data.doneWeek} na semana</span>
            {data.metas.length > 0 && <span><Target className="h-3.5 w-3.5" />{metasDone}/{data.metas.length} metas</span>}
            {data.waiting.length > 0 && <span className="text-amber-400"><Hourglass className="h-3.5 w-3.5" />{data.waiting.length}</span>}
          </div>
        </Link>;
      })}</div>}
  </>;
}

export default function AreasPage() {
  return <div className="work-page mx-auto max-w-[1180px] p-4 pb-24 lg:p-8">
    <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}><AreasWorkspace /></Suspense>
  </div>;
}
