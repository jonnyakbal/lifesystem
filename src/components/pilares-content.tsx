'use client';

// Moved out of its own route (src/app/(dashboard)/pilares/page.tsx, which
// now just redirects here) so it can live as the second tab of the unified
// Visão page — item 9 of the queue. No padding wrapper here on purpose:
// the parent page (visao/page.tsx) already provides it.
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { Layers, Edit2, Target, Trash2, Flame, BookOpen, ChevronDown, ArrowRight, Sparkles, ArrowUpRight } from 'lucide-react';
import { PillarConstellation } from '@/components/pillar-constellation';
import { cn, todayStr } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';

interface Pillar {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  currentStatus: string;
  target: string;
}

interface JournalEntry {
  id: string;
  pillarChecks: Record<string, number>;
  entryDate: string;
}

interface Indicator {
  id: string;
  pillarId: string;
  name: string;
  targetValue?: number;
  currentValue?: number;
  frequency: string;
}

const defaultPillars: Omit<Pillar, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Fé & Propósito', description: 'Espiritualidade, direção, por que tudo isso existe', icon: '✨', color: 'stellar', sortOrder: 1, currentStatus: '', target: '' },
  { name: 'Físico / Corpo', description: 'Saúde, alimentação, exercício, sono', icon: '💪', color: 'critical', sortOrder: 2, currentStatus: '', target: '' },
  { name: 'Mente / Conhecimento', description: 'Aprendizado, reflexão e estudos', icon: '🧠', color: 'qty', sortOrder: 3, currentStatus: '', target: '' },
  { name: 'Profissional / Talentos', description: 'Trabalho, projetos, habilidades e contribuição', icon: '🚀', color: 'money', sortOrder: 4, currentStatus: '', target: '' },
  { name: 'Dinheiro & Patrimônio', description: 'Finanças, investimentos, fluxo de caixa', icon: '💰', color: 'primary', sortOrder: 5, currentStatus: '', target: '' },
  { name: 'Comunidade', description: 'Relações, rede de contatos, coletivos culturais', icon: '👥', color: 'qty', sortOrder: 6, currentStatus: '', target: '' },
];

const colorMap: Record<string, string> = {
  stellar: '#a78bfa',
  critical: '#ef4444',
  qty: '#3b82f6',
  money: '#22c55e',
  primary: '#36c8d8',
};

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

function ProgressRing({ value, color, size = 48 }: { value: number; color: string; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const strokeColor = colorMap[color] || '#a78bfa';

  return (
    <svg width={size} height={size} className="transform -rotate-90" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="4"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

export function PilaresContent() {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPillar, setEditingPillar] = useState<Pillar | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('stellar');
  const [editCurrentStatus, setEditCurrentStatus] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [expandedPillarId, setExpandedPillarId] = useState<string | null>(null);

  const emojiOptions = ['✨', '💪', '🧠', '🚀', '💰', '👥', '❤️', '🎯', '📚', '🎨', '🏠', '🌱', '⚡', '🔥', '💎', '🌟'];
  const colorOptions = ['stellar', 'critical', 'qty', 'money', 'primary'];

  async function loadPillars() {
    setLoadError('');
    try {
      const [pillarsData, journalData, indicatorsData] = await Promise.all([
        apiFetch<Pillar[]>('/api/pillars'),
        apiFetch<JournalEntry[]>('/api/journal'),
        apiFetch<Indicator[]>('/api/indicators'),
      ]);
      setJournalEntries(journalData);
      setIndicators(indicatorsData);

      if (pillarsData.length === 0) {
        for (const pillar of defaultPillars) {
          await apiFetch('/api/pillars', {
            method: 'POST',
            body: JSON.stringify(pillar),
          });
        }
        const newData = await apiFetch<Pillar[]>('/api/pillars');
        setPillars([...newData].sort((a, b) => a.sortOrder - b.sortOrder));
      } else {
        setPillars([...pillarsData].sort((a, b) => a.sortOrder - b.sortOrder));
      }
    } catch (err) {
      toast.error('Erro ao carregar pilares');
      setLoadError('Não foi possível abrir seus pilares. Tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { queueMicrotask(() => { void loadPillars(); }); }, []);

  const pillarStreaks = useMemo(() => {
    const streaks: Record<string, number> = {};
    const sorted = [...journalEntries].sort((a, b) => b.entryDate.localeCompare(a.entryDate));

    for (const pillar of pillars) {
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = todayStr(date);
        const entry = sorted.find(e => e.entryDate === dateStr);
        if (entry && entry.pillarChecks?.[pillar.id] && entry.pillarChecks[pillar.id] >= 3) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }
      streaks[pillar.id] = streak;
    }
    return streaks;
  }, [pillars, journalEntries]);

  // Constellation "strength" and the per-card progress ring are driven by
  // how close this pillar's Metas (Indicators) are to their targets — not
  // by the old free-text "ações" field, which is gone (item 2 of the queue).
  const pillarProgress = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pillar of pillars) {
      const pillarIndicators = indicators.filter(i => i.pillarId === pillar.id && (i.targetValue || 0) > 0);
      if (pillarIndicators.length === 0) { map[pillar.id] = 0; continue; }
      const avgPct = pillarIndicators.reduce((sum, i) => sum + Math.max(0, Math.min(100, ((i.currentValue || 0) / (i.targetValue || 1)) * 100)), 0) / pillarIndicators.length;
      map[pillar.id] = Math.round(avgPct);
    }
    return map;
  }, [pillars, indicators]);

  function openEdit(pillar: Pillar) {
    setEditingPillar(pillar);
    setEditName(pillar.name);
    setEditDescription(pillar.description);
    setEditIcon(pillar.icon);
    setEditColor(pillar.color);
    setEditCurrentStatus(pillar.currentStatus || '');
    setEditTarget(pillar.target || '');
    setIsEditorOpen(true);
  }

  async function handleSave() {
    if (!editingPillar || isSaving || !editName.trim()) return;
    setIsSaving(true);
    try {
      await apiFetch(`/api/pillars/${editingPillar.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName, description: editDescription, icon: editIcon, color: editColor,
          currentStatus: editCurrentStatus, target: editTarget,
        }),
      });
      setIsEditorOpen(false);
      loadPillars();
      toast.success('Pilar atualizado!');
    } catch (err) {
      toast.error('Erro ao salvar pilar');
      console.error(err);
    } finally { setIsSaving(false); }
  }

  async function handleDelete(id: string) {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await apiFetch(`/api/pillars/${id}`, { method: 'DELETE' });
      setIsEditorOpen(false);
      loadPillars();
      toast.success('Pilar excluído!');
    } catch (err) {
      toast.error('Erro ao excluir pilar');
      console.error(err);
    } finally { setIsSaving(false); }
  }

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <WorkspaceHeading eyebrow="Cultivar · equilíbrio" title="Pilares" description="As áreas que sustentam sua vida. Conecte sua visão às metas e use o diário para perceber o que precisa de cuidado." actions={<><Link href="/diario" className="work-action-link"><BookOpen className="h-4 w-4" /> Fazer check-in</Link><Link href="/indicadores" className="work-action-link"><Target className="h-4 w-4" /> Metas <ArrowUpRight className="h-3.5 w-3.5" /></Link></>}><div className="work-metrics"><WorkspaceMetric label="Áreas da vida" value={isLoading || loadError ? '—' : pillars.length} /><WorkspaceMetric label="Metas conectadas" value={isLoading || loadError ? '—' : indicators.length} tone="primary" /><WorkspaceMetric label="Check-ins hoje" value={isLoading || loadError ? '—' : Object.keys(journalEntries.find(e => e.entryDate === todayStr())?.pillarChecks || {}).length} detail="Avaliações no diário de hoje" /></div></WorkspaceHeading>

      {loadError && <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-critical/30 bg-critical/5 p-4"><p className="text-sm">{loadError}</p><Button variant="outline" className="min-h-11" onClick={() => { setIsLoading(true); void loadPillars(); }}>Tentar novamente</Button></div>}

      {!isLoading && pillars.length > 0 && (
        <motion.div className="mb-8 overflow-hidden rounded-2xl border bg-card/40 p-3 sm:p-5" variants={fade}>
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground"><Layers className="h-3.5 w-3.5" /> Sua constelação</div>
          <PillarConstellation
            selectedId={expandedPillarId}
            pillars={pillars.map(p => ({
              id: p.id,
              name: p.name,
              icon: p.icon,
              colorHex: colorMap[p.color] || '#a78bfa',
              strength: pillarProgress[p.id] || 0,
            }))}
            onSelect={(id) => {
              setExpandedPillarId(id);
              document.getElementById(`pillar-card-${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
            }}
          />
          <p className="mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
            A luz reflete suas metas com alvo definido. O check-in no diário traz o contexto de como cada área está hoje.
          </p>
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando pilares">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" variants={stagger}>
          {pillars.map((pillar) => {
            const pillarIndicators = indicators.filter(i => i.pillarId === pillar.id);
            const progress = pillarProgress[pillar.id] || 0;
            const streak = pillarStreaks[pillar.id] || 0;

            return (
              <motion.div
                key={pillar.id}
                variants={fade}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Card id={`pillar-card-${pillar.id}`} className={cn(
                  "group relative h-full min-w-0 scroll-mt-24 rounded-2xl transition-colors hover:border-primary/40",
                  expandedPillarId === pillar.id && "border-primary/50 shadow-md shadow-primary/5"
                )}>
                  <div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="min-w-0"><button className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Detalhes de ${pillar.name}`} aria-expanded={expandedPillarId === pillar.id} aria-controls={`pillar-details-${pillar.id}`} onClick={() => setExpandedPillarId(expandedPillarId === pillar.id ? null : pillar.id)}>
                          <motion.span
                            className="text-2xl"
                            whileHover={{ scale: 1.2, rotate: -8 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            {pillar.icon}
                          </motion.span>
                          <span className="font-display text-xl font-medium leading-tight">{pillar.name}</span>
                          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expandedPillarId === pillar.id && 'rotate-180')} aria-hidden="true" />
                        </button></h2>
                        <div className="flex shrink-0 items-center gap-1">
                          {pillarIndicators.some(i => (i.targetValue || 0) > 0) && (
                            <div className="relative">
                              <ProgressRing value={progress} color={pillar.color} size={40} />
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                                {progress}%
                              </span>
                            </div>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11"
                                aria-label={`Editar pilar ${pillar.name}`}
                                onClick={(e) => { e.stopPropagation(); openEdit(pillar); }}
                              >
                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <CardDescription>{pillar.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {streak > 0 && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Flame className="h-3 w-3 text-orange-500" />
                            {streak} dia{streak > 1 ? 's' : ''} seguidos
                          </Badge>
                        )}
                        {pillarIndicators.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {pillarIndicators.length} meta{pillarIndicators.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      {pillar.target && (
                        <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-primary">
                            <Sparkles className="h-3 w-3" />
                            Meta do Ano
                          </div>
                          <p className="mt-1 text-sm font-medium">{pillar.target}</p>
                        </div>
                      )}

                      {pillar.currentStatus && (
                        <div>
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Target className="h-3 w-3" />
                            Situação atual
                          </div>
                          <p className="mt-1 text-sm">{pillar.currentStatus}</p>
                        </div>
                      )}
                      {!pillar.target && !pillar.currentStatus && <p className="text-sm leading-relaxed text-muted-foreground">Defina sua direção para esta área e acompanhe um pequeno avanço.</p>}
                    </CardContent>
                  </div>

                  <AnimatePresence initial={false}>
                    {expandedPillarId === pillar.id && (
                      <motion.div
                        id={`pillar-details-${pillar.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6 pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Metas deste pilar</span>
                            <Link href={`/indicadores?pillar=${encodeURIComponent(pillar.id)}`} aria-label={`Ver metas de ${pillar.name}`} className="flex min-h-11 items-center gap-1 text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                              Ver metas <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                          <div className="space-y-1.5">
                            {indicators.filter(i => i.pillarId === pillar.id).map(ind => {
                              const pct = ind.targetValue ? Math.max(0, Math.min(100, Math.round(((ind.currentValue || 0) / ind.targetValue) * 100))) : 0;
                              return (
                                <div key={ind.id} className="rounded-lg bg-muted/20 px-3 py-2.5">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="truncate">{ind.name}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{ind.currentValue || 0}{ind.targetValue ? `/${ind.targetValue}` : ''}</span>
                                  </div>
                                  {ind.targetValue && (
                                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {indicators.filter(i => i.pillarId === pillar.id).length === 0 && (
                              <div className="rounded-xl border border-dashed px-3 py-4"><p className="text-xs leading-relaxed text-muted-foreground">Que pequeno avanço fortaleceria esta área?</p><Link href={`/indicadores?pillar=${encodeURIComponent(pillar.id)}`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary">Definir uma meta <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditorOpen} onOpenChange={open => { if (!isSaving) setIsEditorOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pilar</DialogTitle>
            <DialogDescription>Altere as informações do pilar</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions.map(emoji => (
                  <button
                    key={emoji}
                    aria-label={`Ícone ${emoji}`}
                    aria-pressed={editIcon === emoji}
                    onClick={() => setEditIcon(emoji)}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl border-2 text-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      editIcon === emoji ? 'border-primary bg-primary/10 scale-110' : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pillar-name">Nome</Label>
              <Input id="pillar-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do pilar" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pillar-description">Descrição</Label>
              <Textarea id="pillar-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Descreva o pilar" rows={2} />
            </div>

            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    aria-label={`Cor ${color}`}
                    aria-pressed={editColor === color}
                    onClick={() => setEditColor(color)}
                    className={cn(
                      'h-11 w-11 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      editColor === color ? 'border-white scale-110' : 'border-transparent',
                      color === 'stellar' && 'bg-stellar',
                      color === 'critical' && 'bg-critical',
                      color === 'qty' && 'bg-qty',
                      color === 'money' && 'bg-money',
                      color === 'primary' && 'bg-primary',
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pillar-status">Situação Atual</Label>
              <Textarea id="pillar-status" value={editCurrentStatus} onChange={(e) => setEditCurrentStatus(e.target.value)} placeholder="Como está este pilar agora?" rows={2} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pillar-target">Meta do Ano (BHAG)</Label>
              <Textarea id="pillar-target" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} placeholder="Qual é o grande objetivo deste pilar até o fim do ano?" rows={2} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editingPillar && (
              <Button variant="ghost" className="min-h-11 text-destructive sm:mr-auto" disabled={isSaving} onClick={() => handleDelete(editingPillar.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </Button>
            )}
            <Button variant="outline" className="min-h-11" disabled={isSaving} onClick={() => setIsEditorOpen(false)}>Cancelar</Button>
            <Button className="min-h-11" onClick={handleSave} disabled={isSaving || !editName.trim()}>{isSaving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
