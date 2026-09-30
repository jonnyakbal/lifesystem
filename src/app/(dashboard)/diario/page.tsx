'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Sparkles, ChevronLeft, ChevronRight, Calendar, Layers, ArrowUpRight, BookOpen, Target } from 'lucide-react';
import { cn, todayStr } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NotionEditor } from '@/components/notion-editor';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { WorkspaceHeading, WorkspaceMetric } from '@/components/workspace/workspace-heading';

interface JournalEntry {
  id: string;
  content: string;
  pillarChecks: Record<string, number>;
  gratitude?: string;
  mood?: string;
  entryDate: string;
}

interface Pillar {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

const moods = [
  { value: 'great', label: 'Ótimo', icon: '😄', color: 'text-money' },
  { value: 'good', label: 'Bom', icon: '😊', color: 'text-primary' },
  { value: 'neutral', label: 'Neutro', icon: '😐', color: 'text-muted-foreground' },
  { value: 'bad', label: 'Ruim', icon: '😔', color: 'text-critical' },
  { value: 'terrible', label: 'Péssimo', icon: '😢', color: 'text-critical' },
];

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function journalDate(value: string | null) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(date.getTime()) && todayStr(date) === value) return value;
  }
  return todayStr();
}

function DiarioWorkspace() {
  const searchParams = useSearchParams();
  const requestedDate = journalDate(searchParams.get('date'));
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(requestedDate);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date(`${requestedDate}T12:00:00`).getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date(`${requestedDate}T12:00:00`).getFullYear());

  const existingEntry = entries.find(e => e.entryDate === selectedDate);
  const [content, setContent] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [mood, setMood] = useState('');
  const [pillarChecks, setPillarChecks] = useState<Record<string, number>>({});
  const [lastDate, setLastDate] = useState('');

  useEffect(() => { loadData(); }, []);

  useEffect(() => { queueMicrotask(() => setSelectedDate(requestedDate)); }, [requestedDate]);

  useEffect(() => {
    const date = new Date(`${selectedDate}T12:00:00`);
    queueMicrotask(() => { setCalendarMonth(date.getMonth()); setCalendarYear(date.getFullYear()); });
  }, [selectedDate]);

  useEffect(() => {
    if (!isLoading && !loadError && selectedDate !== lastDate) queueMicrotask(() => {
      setContent(existingEntry?.content || '');
      setGratitude(existingEntry?.gratitude || '');
      setMood(existingEntry?.mood || '');
      setPillarChecks(existingEntry?.pillarChecks || {});
      setLastDate(selectedDate);
    });
  }, [selectedDate, existingEntry, lastDate, isLoading, loadError]);

  async function loadData() {
    setLoadError('');
    try {
      const [journalRes, pillarsRes] = await Promise.all([
        fetch('/api/journal'),
        fetch('/api/pillars'),
      ]);
      if (!journalRes.ok || !pillarsRes.ok) throw new Error('Falha ao carregar diário');
      const [journalData, pillarsData] = await Promise.all([journalRes.json(), pillarsRes.json()]);
      setEntries(journalData);
      setPillars(pillarsData.sort((a: Pillar, b: Pillar) => a.sortOrder - b.sortOrder));
    } catch (error) {
      console.error(error);
      setLoadError('Não foi possível carregar o diário. Tente novamente para abrir seus registros.');
      toast.error('Não foi possível carregar o diário');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (isSaving || isLoading || loadError) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, gratitude, pillarChecks, mood: mood || undefined, entryDate: selectedDate }),
      });
      if (!response.ok) throw new Error('Falha ao salvar diário');
      await loadData();
      toast.success('Diário salvo!');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar o diário');
    } finally {
      setIsSaving(false);
    }
  }

  function navigateDay(offset: number) {
    const current = new Date(`${selectedDate}T12:00:00`);
    current.setDate(current.getDate() + offset);
    setSelectedDate(todayStr(current));
  }

  const calendarDays = useMemo(() => {
    const days = getDaysInMonth(calendarYear, calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
    const result: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let i = 1; i <= days; i++) result.push(i);
    return result;
  }, [calendarMonth, calendarYear]);

  const entryDates = useMemo(() => {
    const dates = new Set(entries.map(e => e.entryDate));
    return dates;
  }, [entries]);

  function selectCalendarDay(day: number) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  }

  return (
    <motion.div
      className="work-page work-journal p-4 lg:p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <WorkspaceHeading eyebrow="Cultivar · reflexão" title="Diário" description="Uma pausa para perceber como você está. Registre o dia, reconheça os pequenos avanços e cuide dos seus pilares." actions={<Link href="/visao?tab=pilares" className="work-action-link"><Layers className="h-4 w-4" /> Meus pilares</Link>}>
        <div className="work-metrics"><WorkspaceMetric label="Registros salvos" value={isLoading || loadError ? '—' : entries.length} /><WorkspaceMetric label="Pilares avaliados" value={isLoading || loadError ? '—' : `${Object.keys(pillarChecks).length}/${pillars.length}`} tone="primary" /><WorkspaceMetric label="Humor do dia" value={moods.find(m => m.value === mood)?.label || '—'} /></div>
      </WorkspaceHeading>

      {loadError && <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-critical/30 bg-critical/5 p-4"><p className="text-sm">{loadError}</p><Button variant="outline" className="min-h-11" onClick={() => { setIsLoading(true); void loadData(); }}>Tentar novamente</Button></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Editor */}
        <div className="min-w-0 lg:col-span-2 space-y-5">
          {/* Date Picker */}
          <motion.div variants={fade}>
            <Card className="rounded-2xl border-primary/20">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Dia anterior" disabled={isSaving || isLoading} onClick={() => navigateDay(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex min-w-0 items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium leading-tight">
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Próximo dia" disabled={isSaving || isLoading} onClick={() => navigateDay(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <Button variant="ghost" size="sm" className="min-h-11 shrink-0" disabled={isSaving || isLoading} onClick={() => setSelectedDate(todayStr())}>
                      Hoje
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || isLoading || !!loadError} className="min-h-11 shrink-0">
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground" role="status">{isLoading ? 'Abrindo seus registros...' : existingEntry ? 'Registro salvo para este dia. Você pode continuar a reflexão.' : 'Uma página nova. Comece por como você se sente.'}</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Mood Selector */}
          <motion.div variants={fade}>
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="font-display text-xl font-medium">Como você se sente?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {moods.map((m) => (
                    <button
                      key={m.value}
                      aria-pressed={mood === m.value}
                      disabled={isLoading || isSaving || !!loadError}
                      onClick={() => setMood(mood === m.value ? '' : m.value)}
                      className={cn(
                        'flex min-h-[76px] min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl p-2 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3',
                        mood === m.value
                          ? 'bg-primary/10 border border-primary/40'
                          : 'bg-muted/40 hover:bg-muted border border-transparent'
                      )}
                    >
                      <span className="text-2xl">{m.icon}</span>
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Content Editor */}
          <motion.div variants={fade}>
            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex items-center justify-between gap-3"><CardTitle className="font-display text-xl font-medium">Reflexão do dia</CardTitle><BookOpen className="h-4 w-4 text-primary/60" /></div>
                <p className="text-xs leading-relaxed text-muted-foreground">O que aconteceu, o que você aprendeu e o que quer levar para amanhã?</p>
              </CardHeader>
              <CardContent>
                <NotionEditor
                  editable={!isLoading && !isSaving && !loadError}
                  content={content}
                  onChange={setContent}
                  placeholder="Como foi seu dia? O que aconteceu? O que aprendeu?"
                  className="min-h-[240px] border-0 bg-transparent p-0 text-base leading-relaxed"
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Gratitude */}
          <motion.div variants={fade}>
            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex items-center justify-between gap-3"><CardTitle className="font-display text-xl font-medium">Gratidão</CardTitle><Sparkles className="h-4 w-4 text-primary/60" /></div>
              </CardHeader>
              <CardContent>
                <NotionEditor
                  editable={!isLoading && !isSaving && !loadError}
                  content={gratitude}
                  onChange={setGratitude}
                  placeholder="Pelo que você é grato hoje?"
                  className="min-h-[100px] border-0 bg-transparent p-0"
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="min-w-0 space-y-5">
          {/* Pillar Check-in */}
          <motion.div variants={fade}>
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="font-display text-xl font-medium">Check-in dos pilares</CardTitle>
                <p className="text-xs text-muted-foreground">De 1 (precisa de cuidado) a 5 (em equilíbrio).</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pillars.map((pillar) => (
                    <div key={pillar.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span>{pillar.icon}</span>
                        <span className="text-sm">{pillar.name}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            aria-label={`${pillar.name}: ${value} de 5`}
                            aria-pressed={pillarChecks[pillar.id] === value}
                            disabled={isLoading || isSaving || !!loadError}
                            onClick={() => setPillarChecks({ ...pillarChecks, [pillar.id]: value })}
                            className={cn(
                              'h-11 min-w-0 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              pillarChecks[pillar.id] === value
                                ? 'text-primary-foreground bg-primary border-primary'
                                : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                            )}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!isLoading && pillars.length === 0 && <p className="text-sm text-muted-foreground">Seus pilares ajudam a perceber o que precisa de atenção. <Link href="/visao?tab=pilares" className="text-primary underline underline-offset-4">Conhecer meus pilares</Link></p>}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Mini Calendar */}
          <motion.div variants={fade}>
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Mês anterior"
                    onClick={() => calendarMonth === 0 ? (setCalendarMonth(11), setCalendarYear(calendarYear - 1)) : setCalendarMonth(calendarMonth - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Próximo mês"
                    onClick={() => calendarMonth === 11 ? (setCalendarMonth(0), setCalendarYear(calendarYear + 1)) : setCalendarMonth(calendarMonth + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
                  ))}
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} />;
                    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hasEntry = entryDates.has(dateStr);
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === todayStr();
                    return (
                      <button
                        key={day}
                        aria-label={`${day} de ${new Date(calendarYear, calendarMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}${hasEntry ? ', com registro' : ''}`}
                        aria-pressed={isSelected}
                        disabled={isSaving || isLoading}
                        onClick={() => selectCalendarDay(day)}
                        className={cn(
                          'relative min-h-10 w-full rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected && 'bg-primary text-primary-foreground',
                          !isSelected && isToday && 'bg-primary/20 text-primary',
                          !isSelected && hasEntry && !isToday && 'bg-muted text-foreground',
                          !isSelected && !hasEntry && !isToday && 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {day}
                        {hasEntry && !isSelected && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-money" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-money" /> Dias com registro</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Connected next action */}
          <motion.div variants={fade}>
            <Card className="rounded-2xl border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-medium">Da reflexão à direção</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Percebeu um padrão nos seus dias? Leve esse aprendizado para uma meta ou para sua próxima revisão.
                </p>
                <div className="mt-4 flex flex-wrap gap-2"><Link href="/indicadores" className="work-action-link"><Target className="h-3.5 w-3.5" /> Metas</Link><Link href="/revisao" className="work-action-link">Revisão <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
              </CardContent>
            </Card>
          </motion.div>

          {/* History */}
          <motion.div variants={fade}>
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="font-display text-xl font-medium">Entradas recentes</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg p-2">
                        <Skeleton className="h-4 w-16" /><Skeleton className="h-3 w-24" />
                      </div>
                    ))}
                  </div>
                ) : entries.length === 0 ? <p className="text-sm leading-relaxed text-muted-foreground">Seu histórico começa com uma pausa. Salve a primeira reflexão para voltar a ela depois.</p> : (
                  <div className="space-y-1">
                    <AnimatePresence>
                      {entries.slice(0, 7).map((entry) => {
                        const moodData = moods.find(m => m.value === entry.mood);
                        return (
                          <motion.button
                            key={entry.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => setSelectedDate(entry.entryDate)}
                            disabled={isSaving}
                            aria-pressed={entry.entryDate === selectedDate}
                            className={cn(
                              'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              entry.entryDate === selectedDate ? 'bg-primary/20' : 'hover:bg-muted'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span>{moodData?.icon || '📝'}</span>
                              <span className="text-sm">{new Date(entry.entryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            </div>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {entry.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 35) || 'Check-in do dia'}
                            </span>
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default function DiarioPage() {
  return <Suspense fallback={<div className="p-4 lg:p-8"><Skeleton className="h-48 w-full rounded-3xl" /></div>}><DiarioWorkspace /></Suspense>;
}
