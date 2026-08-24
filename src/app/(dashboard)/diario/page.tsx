'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Save, Sparkles, ChevronLeft, ChevronRight, Calendar, Smile, Meh, Frown, Heart, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotionEditor } from '@/components/notion-editor';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface JournalEntry {
  id: string;
  content: string;
  pillarChecks: Record<string, number>;
  gratitude?: string;
  mood?: string;
  entryDate: string;
}

const pillars = [
  { id: '1', name: 'Fé', icon: '✨', color: 'stellar' },
  { id: '2', name: 'Corpo', icon: '💪', color: 'critical' },
  { id: '3', name: 'Mente', icon: '🧠', color: 'qty' },
  { id: '4', name: 'Profissional', icon: '🚀', color: 'money' },
  { id: '5', name: 'Dinheiro', icon: '💰', color: 'primary' },
  { id: '6', name: 'Comunidade', icon: '👥', color: 'qty' },
];

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

export default function DiarioPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const existingEntry = entries.find(e => e.entryDate === selectedDate);
  const [content, setContent] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [mood, setMood] = useState('');
  const [pillarChecks, setPillarChecks] = useState<Record<string, number>>({});
  const [lastDate, setLastDate] = useState('');

  useEffect(() => { loadEntries(); }, []);

  useEffect(() => {
    if (selectedDate !== lastDate) {
      setContent(existingEntry?.content || '');
      setGratitude(existingEntry?.gratitude || '');
      setMood(existingEntry?.mood || '');
      setPillarChecks(existingEntry?.pillarChecks || {});
      setLastDate(selectedDate);
    }
  }, [selectedDate, existingEntry, lastDate]);

  async function loadEntries() {
    const res = await fetch('/api/journal');
    const data = await res.json();
    setEntries(data);
    setIsLoading(false);
  }

  async function handleSave() {
    setIsSaving(true);
    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, gratitude, pillarChecks, mood, entryDate: selectedDate }),
    });
    setIsSaving(false);
    loadEntries();
    toast.success('Diário salvo!');
  }

  function navigateDay(offset: number) {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offset);
    setSelectedDate(current.toISOString().split('T')[0]);
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
      className="p-8"
      variants={stagger}
      initial="initial"
      animate="animate"
    >
      <motion.div className="mb-8" variants={fade}>
        <h1 className="font-display text-3xl font-bold tracking-tight">Diário</h1>
        <p className="text-muted-foreground">Espaço de reflexão e alinhamento</p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Date Picker */}
          <motion.div variants={fade}>
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigateDay(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">
                        {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigateDay(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
                      Hoje
                    </Button>
                  </div>
                  <Button onClick={handleSave} disabled={isSaving} className="shrink-0">
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Mood Selector */}
          <motion.div variants={fade}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Como você se sente?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {moods.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMood(mood === m.value ? '' : m.value)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg p-3 transition-all',
                        mood === m.value
                          ? 'bg-primary/20 border border-primary/50 scale-105'
                          : 'bg-muted hover:bg-muted/80 border border-transparent'
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
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Reflexão do dia</CardTitle>
              </CardHeader>
              <CardContent>
                <NotionEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Como foi seu dia? O que aconteceu? O que aprendeu?"
                  className="min-h-[200px] border-0 bg-transparent p-0"
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Gratitude */}
          <motion.div variants={fade}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Gratidão</CardTitle>
              </CardHeader>
              <CardContent>
                <NotionEditor
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
        <div className="space-y-6">
          {/* Pillar Check-in */}
          <motion.div variants={fade}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Check-in dos Pilares (1-5)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pillars.map((pillar) => (
                    <div key={pillar.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{pillar.icon}</span>
                        <span className="text-sm">{pillar.name}</span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            onClick={() => setPillarChecks({ ...pillarChecks, [pillar.id]: value })}
                            className={cn(
                              'h-8 w-8 rounded-full text-xs font-medium transition-all',
                              pillarChecks[pillar.id] === value
                                ? 'text-white bg-primary scale-110'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            )}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Mini Calendar */}
          <motion.div variants={fade}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => calendarMonth === 0 ? (setCalendarMonth(11), setCalendarYear(calendarYear - 1)) : setCalendarMonth(calendarMonth - 1)}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => calendarMonth === 11 ? (setCalendarMonth(0), setCalendarYear(calendarYear + 1)) : setCalendarMonth(calendarMonth + 1)}>
                    <ChevronRight className="h-3 w-3" />
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
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    return (
                      <button
                        key={day}
                        onClick={() => selectCalendarDay(day)}
                        className={cn(
                          'relative h-8 w-full rounded-md text-xs font-medium transition-all',
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
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Summary */}
          <motion.div variants={fade}>
            <Card className="border-dashed border-primary/50 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-medium">Resumo da Semana (IA)</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Salve sua entrada de hoje para gerar um resumo ao final da semana.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* History */}
          <motion.div variants={fade}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Entradas Recentes</CardTitle>
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
                ) : (
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
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors',
                              entry.entryDate === selectedDate ? 'bg-primary/20' : 'hover:bg-muted'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span>{moodData?.icon || '📝'}</span>
                              <span className="text-sm">{new Date(entry.entryDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            </div>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {entry.content.slice(0, 25)}...
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
